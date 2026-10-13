// Écran « Duel » : jouer à deux sur cet écran, ou en ligne (créer une partie / rejoindre avec un code).

import { hostRoom, joinRoom, leaveRoom, normalizeCode } from "../services/netplay.js";
import { $, setText } from "./dom.js";
import { getPseudo } from "./mainMenu.js";
import { showScreen } from "./screens.js";

const JOIN_ERRORS = {
  notFound: "Aucune partie avec ce code. Vérifie-le avec ton adversaire.",
  full: "Cette partie a déjà deux joueurs.",
};
const NETWORK_ERROR = "Impossible de joindre le serveur. Vérifie ta connexion.";

let busy = false;

export function initDuelMenu({ onLocal, onBack }) {
  $("btnDuelLocal").addEventListener("click", () => {
    leaveRoom();
    onLocal();
  });
  $("btnDuelBack").addEventListener("click", () => {
    leaveRoom();
    onBack();
  });
  $("btnDuelHost").addEventListener("click", host);
  $("btnDuelJoin").addEventListener("click", join);
  const input = $("duelCode");
  input.addEventListener("input", () => (input.value = normalizeCode(input.value)));
  input.addEventListener("keydown", (e) => e.key === "Enter" && join());
}

export function openDuel() {
  busy = false;
  setText("duelRoomCode", "");
  setDuelStatus("");
  showScreen("duelMenu");
}

export function setDuelStatus(text) {
  setText("duelStatus", text);
}

async function host() {
  if (busy) return;
  busy = true;
  setText("duelRoomCode", "");
  setDuelStatus("Création de la partie…");
  try {
    const code = await hostRoom(getPseudo());
    setText("duelRoomCode", code);
    setDuelStatus("Donne ce code à ton adversaire. En attente…");
  } catch {
    setDuelStatus(NETWORK_ERROR);
  }
  busy = false;
}

async function join() {
  const code = normalizeCode($("duelCode").value);
  if (busy || !code) return;
  busy = true;
  setText("duelRoomCode", "");
  setDuelStatus("Recherche de la partie…");
  try {
    await joinRoom(code, getPseudo());
    setDuelStatus("Partie trouvée ! Connexion à l'adversaire…");
  } catch (e) {
    setDuelStatus(JOIN_ERRORS[e.message] || NETWORK_ERROR);
  }
  busy = false;
}
