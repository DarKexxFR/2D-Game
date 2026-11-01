// Écran « Coop » : salon en ligne de 2 à 4 joueurs. L'hôte crée le salon et donne le code ; les invités le
// rejoignent ; l'hôte lance la partie dès qu'au moins un coéquipier est connecté.
//
// Lancement : l'hôte demande à chaque invité son vaisseau (« prep ») ; chacun le prépare chez lui, avec son
// équipement, ses talents et son skin, et le renvoie (« ready »). L'hôte place tout le monde dans la partie
// (« go ») ; ensuite les messages de la partie passent par systems/coopSync.js.

import { COOP } from "../config.js";
import {
  broadcast,
  checkCoopConnection,
  closeLobby,
  coopNet,
  coopPeers,
  hostCoop,
  joinCoop,
  leaveCoop,
  myId,
  ping,
  reopenLobby,
  sendTo,
  setCoopHandlers,
} from "../services/coopNet.js";
import { normalizeCode } from "../services/netplay.js";
import { $, el, setText } from "./dom.js";
import { icon } from "./icons.js";
import { getPseudo } from "./mainMenu.js";
import { currentScreen, showScreen } from "./screens.js";

const JOIN_ERRORS = {
  notFound: "Aucun salon avec ce code. Vérifie-le avec tes amis.",
  full: `Ce salon est complet (${COOP.maxPlayers} joueurs).`,
  started: "La partie de ce salon a déjà commencé.",
};
const NETWORK_ERROR = "Impossible de joindre le serveur. Vérifie ta connexion.";
const READY_TIMEOUT_MS = 6000;

/**
 * @typedef {{ id: string | null, name: string, data?: any }} Seat  id null : l'hôte
 * @typedef {{
 *   buildShip: () => any,
 *   startHost: (seats: Seat[]) => void,
 *   startGuest: (opts: { slot: number, names: string[] }) => void,
 *   onHostMessage: (msg: any) => void,
 *   onGuestMessage: (id: string, msg: any) => void,
 *   onPeerLost: (id: string) => void,
 *   onLost: () => void,
 *   inGame: () => boolean,
 *   onBack: () => void,
 * }} CoopHooks
 */

/** @type {CoopHooks} */
let hooks;
let busy = false;
let phase = "idle"; // idle | lobby | preparing | playing
/** Hôte, pendant la préparation : joueurs retenus et vaisseaux reçus. */
let seats = /** @type {Seat[]} */ ([]);
let readyTimer = null;
let lobbyNames = /** @type {string[]} */ ([]);
let keepAlive = null;

/** @param {CoopHooks} h */
export function initCoopMenu(h) {
  hooks = h;
  $("btnCoopHost").addEventListener("click", host);
  $("btnCoopStart").addEventListener("click", launch);
  $("btnCoopBack").addEventListener("click", () => {
    leaveCoopRoom();
    hooks.onBack();
  });
  const input = /** @type {HTMLInputElement} */ ($("coopCode"));
  input.addEventListener("input", () => (input.value = normalizeCode(input.value)));
  input.addEventListener("keydown", (e) => e.key === "Enter" && join());
  $("btnCoopJoin").addEventListener("click", () => join());
  setCoopHandlers({
    onPeers: onPeers,
    onMessage: onMessage,
    onPeerLost: (id) => {
      if (phase === "playing") hooks.onPeerLost(id);
      else if (phase === "preparing") seats = seats.filter((s) => s.id !== id);
    },
    onLost: () => {
      const wasPlaying = phase === "playing";
      stopKeepAlive();
      phase = "idle";
      if (wasPlaying || hooks.inGame()) hooks.onLost();
      else if (currentScreen() === "coopMenu") {
        renderLobby();
        setStatus("L'hôte a fermé le salon.");
      }
    },
  });
}

/** Ouvre l'écran Coop (sans salon, ou celui en cours après une partie). */
export function openCoop() {
  busy = false;
  if (!coopNet.role) {
    phase = "idle";
    lobbyNames = [];
    setText("coopRoomCode", "");
    setStatus("");
  } else if (coopNet.role === "host") {
    phase = "lobby";
    reopenLobby();
    announceLobby();
    setStatus(lobbyHint());
  } else {
    phase = "lobby";
    setStatus("En attente du lancement par l'hôte…");
  }
  renderLobby();
  showScreen("coopMenu");
}

export function leaveCoopRoom() {
  stopKeepAlive();
  clearTimeout(readyTimer);
  phase = "idle";
  seats = [];
  lobbyNames = [];
  leaveCoop();
}

function setStatus(text) {
  setText("coopStatus", text);
}

/** Signes de vie réguliers (salon, écran de fin) : sans eux la connexion passerait pour perdue. */
function startKeepAlive() {
  stopKeepAlive();
  keepAlive = setInterval(() => {
    if (!coopNet.role) return stopKeepAlive();
    if (phase !== "playing") ping();
    checkCoopConnection();
    if (coopNet.role === "host" && phase === "lobby") announceLobby();
  }, COOP.lobbyPingMs);
}

function stopKeepAlive() {
  clearInterval(keepAlive);
  keepAlive = null;
}

// --- SALON ---

async function host() {
  if (busy) return;
  busy = true;
  setText("coopRoomCode", "");
  setStatus("Création du salon…");
  try {
    const code = await hostCoop(getPseudo());
    phase = "lobby";
    setText("coopRoomCode", code);
    setStatus(lobbyHint());
    startKeepAlive();
  } catch {
    setStatus(NETWORK_ERROR);
  }
  busy = false;
  renderLobby();
}

async function join() {
  const code = normalizeCode(/** @type {HTMLInputElement} */ ($("coopCode")).value);
  if (busy || !code) return;
  busy = true;
  setText("coopRoomCode", "");
  setStatus("Recherche du salon…");
  try {
    await joinCoop(code, getPseudo());
    phase = "lobby";
    lobbyNames = [coopNet.hostName, getPseudo()];
    setStatus("Salon trouvé ! Connexion à l'hôte…");
    startKeepAlive();
  } catch (e) {
    setStatus(JOIN_ERRORS[e.message] || NETWORK_ERROR);
  }
  busy = false;
  renderLobby();
}

const connectedGuests = () => coopPeers().filter((p) => p.connected);

function lobbyHint() {
  const n = connectedGuests().length;
  return n === 0
    ? `Donne ce code à tes amis (jusqu'à ${COOP.maxPlayers} joueurs). En attente…`
    : `${n + 1} joueurs prêts. Lance la partie quand tout le monde est là.`;
}

/** Hôte : la liste des invités a changé. */
function onPeers() {
  if (coopNet.role !== "host") return;
  if (phase === "lobby") {
    announceLobby();
    setStatus(lobbyHint());
  }
  if (currentScreen() === "coopMenu") renderLobby();
}

/** Hôte : qui est dans le salon, envoyé aux invités. */
function announceLobby() {
  lobbyNames = [getPseudo(), ...connectedGuests().map((p) => p.name)];
  broadcast({ t: "lobby", names: lobbyNames });
}

function renderLobby() {
  const list = $("coopLobby");
  const names =
    coopNet.role === "host"
      ? [{ name: getPseudo(), ok: true }, ...coopPeers().map((p) => ({ name: p.name, ok: p.connected }))]
      : lobbyNames.map((name) => ({ name, ok: true }));
  list.replaceChildren(
    ...names.map(({ name, ok }, k) => {
      const li = el("li", ok ? "" : "pending");
      li.style.setProperty("--member", COOP.colors[k % COOP.colors.length]);
      li.append(icon(k === 0 ? "crown" : "user"), el("span", "", name || "JOUEUR"));
      if (!ok) li.append(el("small", "", "connexion…"));
      return li;
    }),
  );
  const isHost = coopNet.role === "host";
  $("btnCoopStart").style.display = isHost ? "" : "none";
  /** @type {HTMLButtonElement} */ ($("btnCoopStart")).disabled = connectedGuests().length === 0;
  list.style.display = coopNet.role ? "" : "none";
}

// --- LANCEMENT ---

/** Hôte : lance la partie avec les invités connectés (chacun prépare son vaisseau). */
function launch() {
  const guests = connectedGuests();
  if (coopNet.role !== "host" || guests.length === 0 || phase === "preparing") return;
  closeLobby();
  phase = "preparing";
  seats = [{ id: null, name: getPseudo() }, ...guests.map((g) => ({ id: g.id, name: g.name }))];
  const names = seats.map((s) => s.name);
  seats.forEach((s, slot) => s.id && sendTo(s.id, { t: "prep", slot, names }));
  setStatus("Préparation des vaisseaux…");
  clearTimeout(readyTimer);
  readyTimer = setTimeout(go, READY_TIMEOUT_MS);
}

/** Hôte : tous les vaisseaux sont là (ou le temps est écoulé) : la partie commence. */
function go() {
  clearTimeout(readyTimer);
  if (phase !== "preparing") return;
  const playing = seats.filter((s) => s.id === null || s.data);
  if (playing.length < COOP.minPlayers) {
    phase = "lobby";
    reopenLobby();
    setStatus("Personne n'a pu rejoindre la partie. Réessaie.");
    return;
  }
  phase = "playing";
  const names = playing.map((s) => s.name);
  /** @type {Record<string, number>} */
  const slots = {};
  playing.forEach((s, k) => s.id && (slots[s.id] = k));
  broadcast({ t: "go", names, slots });
  hooks.startHost(playing);
}

function onMessage(from, msg) {
  if (!msg) return;
  if (coopNet.role === "host") {
    if (msg.t === "ready" && phase === "preparing") {
      const seat = seats.find((s) => s.id === from);
      if (seat) seat.data = msg.data;
      if (seats.every((s) => s.id === null || s.data)) go();
      return;
    }
    if (phase === "playing") hooks.onGuestMessage(from, msg);
    return;
  }
  // Invité
  if (msg.t === "linked") {
    if (phase === "lobby") setStatus("Connecté ! En attente du lancement par l'hôte…");
  } else if (msg.t === "lobby") {
    lobbyNames = msg.names || [];
    if (currentScreen() === "coopMenu") renderLobby();
  } else if (msg.t === "prep") {
    phase = "preparing";
    if (currentScreen() === "coopMenu") setStatus("Lancement de la partie…");
    sendTo(null, { t: "ready", data: hooks.buildShip() });
  } else if (msg.t === "go") {
    const slot = msg.slots?.[myId()];
    if (slot === undefined) {
      phase = "lobby";
      setStatus("La partie a commencé sans toi (connexion trop lente).");
      return;
    }
    phase = "playing";
    hooks.startGuest({ slot, names: msg.names });
  } else if (phase === "playing") hooks.onHostMessage(msg);
}

/** Fin de partie : le salon reste ouvert (REJOUER ramène au salon). */
export function coopRoundOver() {
  if (phase === "playing") phase = coopNet.role ? "lobby" : "idle";
}
