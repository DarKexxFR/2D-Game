// Duel en ligne : salle avec code, mise en relation par Supabase Realtime, puis connexion directe
// entre les deux navigateurs (WebRTC, canal de données). Si la connexion directe n'aboutit pas
// (pare-feu, réseau d'entreprise...), les messages du jeu passent par Supabase.
//
// L'hôte crée la salle et fait tourner la partie ; l'invité la rejoint avec le code.

import { NET } from "../config.js";
import { joinChannel } from "./realtime.js";
import { isOnlineEnabled } from "./supabase.js";

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sans I, L, O, 0, 1 (faciles à confondre)

export const net = {
  role: null, // "host" | "guest" | null
  code: "",
  peerName: "",
  connected: false,
  relay: false, // vrai : les messages du jeu passent par Supabase
};

let me = "";
let peer = null; // identifiant de l'adversaire
let channel = null;
let pc = null;
let dc = null;
let handlers = { onGame() {}, onReady() {}, onLost() {} };
let lastHeard = 0;
let timers = [];
let myName = "";
let pendingIce = []; // candidats reçus avant l'offre / la réponse

export function setNetHandlers(h) {
  handlers = { ...handlers, ...h };
}

export function isNetAvailable() {
  return isOnlineEnabled() && typeof WebSocket !== "undefined";
}

export function newRoomCode() {
  let code = "";
  for (let i = 0; i < NET.codeLength; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

/** Nettoie un code tapé par le joueur (majuscules, sans espaces). */
export function normalizeCode(text) {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, NET.codeLength);
}

function reset() {
  for (const t of timers) clearInterval(t); // clearInterval arrête aussi les setTimeout
  timers = [];
  dc?.close();
  pc?.close();
  channel?.close();
  dc = pc = channel = peer = null;
  pendingIce = [];
  Object.assign(net, { role: null, code: "", peerName: "", connected: false, relay: false });
}

const later = (fn, ms) => timers.push(setTimeout(fn, ms));
const every = (fn, ms) => timers.push(setInterval(fn, ms));

/** Crée une salle ; résolu avec le code dès que la salle est ouverte (l'adversaire arrive ensuite). */
export async function hostRoom(name) {
  reset();
  me = crypto.randomUUID?.() ?? String(Math.random());
  myName = name;
  net.role = "host";
  net.code = newRoomCode();
  channel = await joinChannel(`duel-${net.code}`, onSignal, lost);
  return net.code;
}

/** Rejoint la salle `code` ; résolu quand l'hôte a répondu, rejeté si la salle n'existe pas. */
export function joinRoom(code, name) {
  reset();
  me = crypto.randomUUID?.() ?? String(Math.random());
  myName = name;
  net.role = "guest";
  net.code = code;
  return new Promise((resolve, reject) => {
    let answered = false;
    joinChannel(
      `duel-${code}`,
      (event, data) => {
        if (event === "sig" && data?.to === me && !answered) {
          if (data.type === "full") {
            answered = true;
            reset();
            return reject(new Error("full"));
          }
          if (data.type === "welcome") {
            answered = true;
            peer = data.from;
            net.peerName = data.name || "";
            resolve();
          }
        }
        onSignal(event, data);
      },
      lost,
    )
      .then((ch) => {
        channel = ch;
        const hello = () => !answered && ch.send("sig", { type: "hello", from: me, name: myName });
        hello();
        every(hello, 1500);
        later(() => {
          if (answered) return;
          reset();
          reject(new Error("notFound"));
        }, NET.joinTimeoutMs);
      })
      .catch((e) => {
        reset();
        reject(e);
      });
  });
}

export function leaveRoom() {
  if (net.connected) sendGame({ t: "bye" });
  reset();
}

function signal(type, data) {
  channel?.send("sig", { type, from: me, to: peer, data });
}

async function onSignal(event, msg) {
  if (!msg || msg.from === me) return;
  if (event === "game") {
    if (msg.to === me && msg.from === peer) receive(msg.msg);
    return;
  }
  if (event !== "sig") return;
  if (msg.type === "hello" && net.role === "host") {
    if (peer && peer !== msg.from) return channel.send("sig", { type: "full", from: me, to: msg.from });
    if (peer) return; // « hello » répété avant l'arrivée de notre réponse
    peer = msg.from;
    net.peerName = msg.name || "";
    channel.send("sig", { type: "welcome", from: me, to: peer, name: myName });
    startPeer(true);
    return;
  }
  if (msg.to !== me || msg.from !== peer) return;
  if (msg.type === "welcome" && net.role === "guest" && !pc) startPeer(false);
  else if (msg.type === "offer" && pc) {
    await remoteDescription(msg.data);
    await pc.setLocalDescription(await pc.createAnswer());
    signal("answer", pc.localDescription.toJSON());
  } else if (msg.type === "answer" && pc) await remoteDescription(msg.data);
  else if (msg.type === "ice" && pc && msg.data) {
    if (pc.remoteDescription) await pc.addIceCandidate(msg.data).catch(() => {});
    else pendingIce.push(msg.data);
  }
}

async function remoteDescription(desc) {
  const target = pc;
  await target.setRemoteDescription(desc);
  for (const c of pendingIce.splice(0)) await target.addIceCandidate(c).catch(() => {});
}

/** Connexion directe ; au bout de `p2pTimeoutMs` sans canal ouvert, on passe par Supabase. */
function startPeer(offerer) {
  later(() => {
    if (!dc || dc.readyState !== "open") useRelay();
  }, NET.p2pTimeoutMs);
  if (NET.disableP2P || typeof RTCPeerConnection === "undefined") return;
  pc = new RTCPeerConnection({ iceServers: NET.iceServers });
  pc.onicecandidate = (e) => e.candidate && signal("ice", e.candidate.toJSON());
  const setup = (channel) => {
    dc = channel;
    dc.onopen = ready;
    dc.onmessage = (e) => receive(JSON.parse(e.data));
    dc.onclose = () => net.connected && !net.relay && lost();
  };
  if (offerer) {
    setup(pc.createDataChannel("game"));
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => signal("offer", pc.localDescription.toJSON()));
  } else {
    pc.ondatachannel = (e) => setup(e.channel);
  }
}

function useRelay() {
  if (net.connected) return;
  net.relay = true;
  dc?.close();
  pc?.close();
  dc = pc = null;
  ready();
}

function ready() {
  if (net.connected) return;
  net.connected = true;
  lastHeard = performance.now();
  handlers.onReady({ role: net.role, peerName: net.peerName, relay: net.relay });
}

function receive(msg) {
  lastHeard = performance.now();
  if (msg?.t === "bye") return lost();
  handlers.onGame(msg);
}

function lost() {
  const was = net.role !== null;
  reset();
  if (was) handlers.onLost();
}

export function sendGame(msg) {
  if (dc?.readyState === "open") dc.send(JSON.stringify(msg));
  else channel?.send("game", { from: me, to: peer, msg });
}

/** À appeler régulièrement : détecte un adversaire qui ne répond plus. */
export function checkConnection(now = performance.now()) {
  if (net.connected && now - lastHeard > NET.lostAfterMs) lost();
}
