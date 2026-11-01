// Coop en ligne : salon de 2 à 4 joueurs, en étoile autour de l'hôte. Supabase Realtime sert de salon
// (code de salle) et de mise en relation, puis chaque invité ouvre une connexion directe (WebRTC, canal de
// données) avec l'hôte. Si elle n'aboutit pas (pare-feu, réseau d'entreprise...), les messages de cet invité
// passent par Supabase. Les invités ne se parlent pas entre eux : l'hôte fait tourner la partie.

import { COOP, NET } from "../config.js";
import { newRoomCode } from "./netplay.js";
import { joinChannel } from "./realtime.js";

/**
 * @typedef {{ id: string, name: string, connected: boolean, relay: boolean, pc: RTCPeerConnection | null,
 *   dc: RTCDataChannel | null, ice: RTCIceCandidateInit[], lastHeard: number, timers: any[] }} Peer
 */

export const coopNet = {
  role: /** @type {"host" | "guest" | null} */ (null),
  code: "",
  hostName: "",
  open: true, // hôte : le salon accepte encore des joueurs (fermé une fois la partie lancée)
};

let me = "";
let myName = "";
let channel = null;
/** Hôte : les invités ; invité : l'hôte seul. @type {Map<string, Peer>} */
const peers = new Map();
let hostId = null; // invité : identifiant de l'hôte
let timers = [];
let handlers = {
  onPeers(_list) {}, // hôte : liste des invités a changé (arrivée, départ, connexion prête)
  onMessage(_from, _msg) {},
  onPeerLost(_id) {}, // hôte : un invité est parti
  onLost() {}, // invité : l'hôte est parti (ou la connexion est perdue)
};

export function setCoopHandlers(h) {
  handlers = { ...handlers, ...h };
}

const later = (fn, ms) => timers.push(setTimeout(fn, ms));
const every = (fn, ms) => timers.push(setInterval(fn, ms));

function closePeer(p) {
  for (const t of p.timers) clearInterval(t);
  p.dc?.close();
  p.pc?.close();
}

function reset() {
  for (const t of timers) clearInterval(t); // clearInterval arrête aussi les setTimeout
  timers = [];
  for (const p of peers.values()) closePeer(p);
  peers.clear();
  channel?.close();
  channel = hostId = null;
  Object.assign(coopNet, { role: null, code: "", hostName: "", open: true });
}

/** Identifiant de cet appareil dans le salon. */
export const myId = () => me;

/** Invités du salon, dans leur ordre d'arrivée (hôte), avec leur état de connexion. */
export function coopPeers() {
  return [...peers.values()].map(({ id, name, connected, relay }) => ({ id, name, connected, relay }));
}

/** Crée un salon ; résolu avec le code dès qu'il est ouvert (les invités arrivent ensuite). */
export async function hostCoop(name) {
  reset();
  me = crypto.randomUUID?.() ?? String(Math.random());
  myName = name;
  coopNet.role = "host";
  coopNet.code = newRoomCode();
  channel = await joinChannel(`coop-${coopNet.code}`, onSignal, lostChannel);
  return coopNet.code;
}

/**
 * Rejoint le salon `code` ; résolu quand l'hôte a répondu, rejeté si le salon n'existe pas (`notFound`),
 * est complet (`full`) ou a déjà lancé sa partie (`started`).
 */
export function joinCoop(code, name) {
  reset();
  me = crypto.randomUUID?.() ?? String(Math.random());
  myName = name;
  coopNet.role = "guest";
  coopNet.code = code;
  return new Promise((resolve, reject) => {
    let answered = false;
    const refuse = (reason) => {
      answered = true;
      reset();
      reject(new Error(reason));
    };
    joinChannel(
      `coop-${code}`,
      (event, data) => {
        if (event === "sig" && data?.to === me && !answered) {
          if (data.type === "full" || data.type === "started") return refuse(data.type);
          if (data.type === "welcome") {
            answered = true;
            hostId = data.from;
            coopNet.hostName = data.name || "";
            peers.set(hostId, newPeer(hostId, coopNet.hostName));
            resolve();
          }
        }
        onSignal(event, data);
      },
      lostChannel,
    )
      .then((ch) => {
        channel = ch;
        const hello = () => !answered && ch.send("sig", { type: "hello", from: me, name: myName });
        hello();
        every(hello, 1500);
        later(() => !answered && refuse("notFound"), NET.joinTimeoutMs);
      })
      .catch((e) => {
        reset();
        reject(e);
      });
  });
}

export function leaveCoop() {
  if (coopNet.role) broadcast({ t: "bye" });
  reset();
}

/** Hôte : la partie commence, le salon n'accepte plus personne. */
export function closeLobby() {
  coopNet.open = false;
}

/** Hôte : retour au salon après une partie (de nouveaux joueurs peuvent arriver). */
export function reopenLobby() {
  coopNet.open = true;
}

/** @returns {Peer} */
function newPeer(id, name) {
  return { id, name, connected: false, relay: false, pc: null, dc: null, ice: [], lastHeard: 0, timers: [] };
}

function signal(to, type, data) {
  channel?.send("sig", { type, from: me, to, data });
}

async function onSignal(event, msg) {
  if (!msg || msg.from === me) return;
  if (event === "game") {
    const to = msg.to;
    if ((to === me || (Array.isArray(to) && to.includes(me))) && peers.has(msg.from))
      receive(msg.from, msg.msg);
    return;
  }
  if (event !== "sig") return;
  if (msg.type === "hello" && coopNet.role === "host") return onHello(msg);
  const peer = peers.get(msg.from);
  if (msg.to !== me || !peer) return;
  if (msg.type === "welcome" && coopNet.role === "guest" && !peer.pc) startPeer(peer, false);
  else if (msg.type === "offer" && peer.pc) {
    await remoteDescription(peer, msg.data);
    await peer.pc.setLocalDescription(await peer.pc.createAnswer());
    signal(peer.id, "answer", peer.pc.localDescription.toJSON());
  } else if (msg.type === "answer" && peer.pc) await remoteDescription(peer, msg.data);
  else if (msg.type === "ice" && peer.pc && msg.data) {
    if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(msg.data).catch(() => {});
    else peer.ice.push(msg.data);
  }
}

/** Hôte : un joueur frappe à la porte. */
function onHello(msg) {
  if (peers.has(msg.from)) return; // « hello » répété avant l'arrivée de notre réponse
  const refuse = (type) => channel.send("sig", { type, from: me, to: msg.from });
  if (!coopNet.open) return refuse("started");
  if (peers.size >= COOP.maxPlayers - 1) return refuse("full");
  const peer = newPeer(msg.from, String(msg.name || "").slice(0, 16));
  peers.set(peer.id, peer);
  channel.send("sig", { type: "welcome", from: me, to: peer.id, name: myName });
  startPeer(peer, true);
  handlers.onPeers(coopPeers());
}

async function remoteDescription(peer, desc) {
  await peer.pc.setRemoteDescription(desc);
  for (const c of peer.ice.splice(0)) await peer.pc.addIceCandidate(c).catch(() => {});
}

/** Connexion directe avec `peer` ; au bout de `p2pTimeoutMs` sans canal ouvert, on passe par Supabase. */
function startPeer(peer, offerer) {
  peer.timers.push(
    setTimeout(() => {
      if (!peer.dc || peer.dc.readyState !== "open") useRelay(peer);
    }, NET.p2pTimeoutMs),
  );
  if (NET.disableP2P || typeof RTCPeerConnection === "undefined") return;
  const pc = (peer.pc = new RTCPeerConnection({ iceServers: NET.iceServers }));
  pc.onicecandidate = (e) => e.candidate && signal(peer.id, "ice", e.candidate.toJSON());
  const setup = (dc) => {
    peer.dc = dc;
    dc.onopen = () => ready(peer);
    dc.onmessage = (e) => receive(peer.id, JSON.parse(e.data));
    dc.onclose = () => peer.connected && !peer.relay && lostPeer(peer.id);
  };
  if (offerer) {
    setup(pc.createDataChannel("coop"));
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => signal(peer.id, "offer", pc.localDescription.toJSON()));
  } else {
    pc.ondatachannel = (e) => setup(e.channel);
  }
}

function useRelay(peer) {
  if (peer.connected || !peers.has(peer.id)) return;
  peer.relay = true;
  peer.dc?.close();
  peer.pc?.close();
  peer.dc = peer.pc = null;
  ready(peer);
}

function ready(peer) {
  if (peer.connected) return;
  peer.connected = true;
  peer.lastHeard = performance.now();
  if (coopNet.role === "host") handlers.onPeers(coopPeers());
  else handlers.onMessage(peer.id, { t: "linked" });
}

function receive(from, msg) {
  const peer = peers.get(from);
  if (!peer) return;
  peer.lastHeard = performance.now();
  if (msg?.t === "bye") return lostPeer(from);
  if (msg?.t === "ping") return;
  handlers.onMessage(from, msg);
}

function lostPeer(id) {
  const peer = peers.get(id);
  if (!peer) return;
  if (coopNet.role === "guest") return lostChannel();
  closePeer(peer);
  peers.delete(id);
  handlers.onPeerLost(id);
  handlers.onPeers(coopPeers());
}

function lostChannel() {
  const was = coopNet.role !== null;
  reset();
  if (was) handlers.onLost();
}

/** Message à un joueur (hôte → invité, ou invité → hôte avec `to` = null). */
export function sendTo(to, msg) {
  const peer = peers.get(to ?? hostId);
  if (!peer) return;
  if (peer.dc?.readyState === "open") peer.dc.send(JSON.stringify(msg));
  else if (peer.relay || coopNet.role === "guest") channel?.send("game", { from: me, to: peer.id, msg });
}

/**
 * Hôte : même message à plusieurs invités (`ids`, tous par défaut). Par Supabase, un seul envoi pour
 * tous ceux qui y passent (quota de messages).
 */
export function broadcast(msg, ids = null) {
  const relayed = [];
  let text = null;
  for (const peer of peers.values()) {
    if (ids && !ids.includes(peer.id)) continue;
    if (peer.dc?.readyState === "open") peer.dc.send((text ??= JSON.stringify(msg)));
    else if (peer.connected) relayed.push(peer.id);
  }
  if (relayed.length > 0) channel?.send("game", { from: me, to: relayed, msg });
}

/** Au moins un invité passe par Supabase (envois plus espacés). */
export const anyRelay = () => [...peers.values()].some((p) => p.relay);

/** À appeler régulièrement : un joueur qui ne répond plus est considéré comme parti. */
export function checkCoopConnection(now = performance.now()) {
  for (const peer of [...peers.values()]) {
    if (peer.connected && now - peer.lastHeard > NET.lostAfterMs) lostPeer(peer.id);
  }
}

/** Petit signe de vie (salon, choix d'amélioration...) quand rien d'autre ne part. */
export function ping() {
  if (coopNet.role === "host") broadcast({ t: "ping" });
  else if (coopNet.role === "guest") sendTo(null, { t: "ping" });
}
