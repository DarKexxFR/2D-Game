// Écran « Amis » (bouton AMIS de l'accueil, ou MES AMIS de l'écran Duel) : code ami, ajout par pseudo ou code, demandes reçues
// et envoyées, amis avec leur présence et bouton « DÉFIER ». Plus la fenêtre de défi reçu, affichée
// par-dessus les menus. Logique et réseau : services/friends.js.

import {
  answerInvite,
  cancelChallenge,
  canUseFriends,
  challengeStarted,
  friends,
  initFriends,
  removeFriend,
  requestFriend,
  respondFriend,
  sendChallenge,
  syncFriends,
} from "../services/friends.js";
import { hostRoom, leaveRoom, net } from "../services/netplay.js";
import { $, el, setText, setVisible } from "./dom.js";
import { getPseudo } from "./mainMenu.js";
import { currentScreen, showScreen } from "./screens.js";

const ADD_ERRORS = {
  introuvable: "Aucun joueur avec ce pseudo ou ce code ami.",
  ambigu: "Plusieurs joueurs ont ce pseudo : demande-lui son code ami.",
  soi: "C'est toi !",
  deja: "Déjà ami, ou demande déjà envoyée.",
  trop: "Trop de demandes : réessaie plus tard.",
  login: "Connecte-toi pour ajouter des amis.",
};
const NETWORK_ERROR = "Impossible de joindre le serveur. Vérifie ta connexion.";
const ANSWERS = {
  decline: "{name} a refusé le défi.",
  busy: "{name} est occupé, réessaie plus tard.",
  timeout: "{name} n'a pas répondu.",
};
const STATUS_LABELS = { menu: "En ligne", jeu: "En partie", duel: "En duel" };

let busy = false;
let challenged = null; // ami défié, en attente de sa réponse ou de la connexion
let from = "main"; // écran d'où il a été ouvert (« main » ou « duel »), pour le retour

/**
 * `getStatus()` : « menu », « jeu » ou « duel » ; `onBack(from)` : retour à l'écran d'origine ; `onLogin` : connexion ;
 * `onAccept(room)` : rejoint la partie de duel d'un ami qui nous a défié.
 */
export function initFriendsMenu({ getStatus, onBack, onLogin, onAccept }) {
  $("btnFriendsBack").addEventListener("click", () => {
    stopChallenge();
    onBack(from);
  });
  $("btnFriendsLogin").addEventListener("click", onLogin);
  $("btnFriendAdd").addEventListener("click", add);
  $("friendQuery").addEventListener("keydown", (e) => e.key === "Enter" && add());
  $("btnInviteAccept").addEventListener("click", () => {
    const invite = answerInvite("accept");
    setVisible("friendInvite", false);
    if (invite) onAccept(invite.room, invite.name);
  });
  $("btnInviteDecline").addEventListener("click", () => {
    answerInvite("decline");
    setVisible("friendInvite", false);
  });
  initFriends({
    getName: getPseudo,
    getStatus,
    onChange: render,
    onInvite: (invite) => {
      setText("friendInviteName", invite.name);
      setVisible("friendInvite", true);
    },
    onInviteGone: () => setVisible("friendInvite", false),
  });
}

/** `origin` : « main » (accueil, par défaut) ou « duel » ; le bouton RETOUR y ramène. */
export function openFriends(origin = "main") {
  from = origin === "duel" ? "duel" : "main";
  busy = false;
  setStatus("");
  showScreen("friendsMenu");
  render();
  syncFriends();
}

/** Une partie commence : un défi reçu est refusé (occupé), un défi envoyé s'arrête. */
export function friendsRunStarted() {
  if (answerInvite("busy")) setVisible("friendInvite", false);
  challengeStarted();
  challenged = null;
}

function setStatus(text) {
  setText("friendsStatus", text);
}

async function add() {
  const query = $("friendQuery").value.trim();
  if (busy || !query) return;
  busy = true;
  setStatus("Envoi de la demande…");
  try {
    const res = await requestFriend(query);
    $("friendQuery").value = "";
    setStatus(
      res.status === "accepted"
        ? `${res.name} et toi êtes maintenant amis !`
        : `Demande envoyée à ${res.name}.`,
    );
  } catch (e) {
    setStatus(ADD_ERRORS[e.message] || NETWORK_ERROR);
  }
  busy = false;
}

/** Action sur un ami ou une demande ; l'écran se met à jour avec la nouvelle liste. */
async function act(fn, done = "") {
  try {
    await fn();
    setStatus(done);
  } catch {
    setStatus(NETWORK_ERROR);
  }
}

async function challenge(friend) {
  if (challenged) return;
  challenged = friend;
  render();
  setStatus(`Défi envoyé à ${friend.name}… En attente de sa réponse.`);
  try {
    const room = await hostRoom(getPseudo());
    if (challenged !== friend) return leaveRoom(); // annulé entre-temps
    await sendChallenge(friend, room, (answer) => {
      if (challenged !== friend) return;
      if (answer === "accept") return setStatus(`${friend.name} a accepté ! Connexion…`);
      challenged = null;
      if (!net.connected) leaveRoom();
      setStatus((ANSWERS[answer] || ANSWERS.decline).replace("{name}", friend.name));
      render();
    });
  } catch {
    if (challenged === friend) stopChallenge();
    setStatus(NETWORK_ERROR);
  }
}

/** Quitte l'écran : un défi en attente est annulé. */
export function stopChallenge() {
  if (!challenged) return;
  challenged = null;
  cancelChallenge();
  if (!net.connected) leaveRoom();
  render();
}

// --- AFFICHAGE ---

function render() {
  const pending = friends.incoming.length;
  setText("friendsBadge", pending || "");
  setText("duelFriendsBadge", pending || "");
  const online = friends.list.filter((f) => f.online).length;
  setText("friendsOnline", online || "");
  if (currentScreen() !== "friendsMenu") return;
  const logged = canUseFriends();
  setVisible("friendsLogin", !logged);
  setVisible("friendsBody", logged);
  setText("friendCode", friends.code || "…");
  if (!logged) return;
  fill("friendsIncoming", "DEMANDES REÇUES", friends.incoming, incomingRow);
  fill(
    "friendsList",
    "MES AMIS",
    friends.list,
    friendRow,
    friends.loaded ? "Aucun ami pour l'instant." : "…",
  );
  fill("friendsOutgoing", "DEMANDES ENVOYÉES", friends.outgoing, outgoingRow);
}

/** Section titrée ; vide, elle disparaît (sauf si `empty` donne un texte à afficher). */
function fill(id, title, items, row, empty) {
  const box = $(id);
  box.replaceChildren();
  if (!items.length && !empty) return;
  box.append(el("h3", "", title));
  if (!items.length) box.append(el("p", "friends-empty", empty));
  for (const item of items) box.append(row(item));
}

function button(label, className, onClick) {
  const b = el("button", className, label);
  b.addEventListener("click", onClick);
  return b;
}

function friendRow(f) {
  const row = el("div", "friend-row");
  const state = f.online ? f.status || "menu" : "off";
  row.dataset.state = state;
  const name = el("span", "friend-name", f.name);
  const info = [f.online ? STATUS_LABELS[f.status] || STATUS_LABELS.menu : "Hors ligne"];
  if (f.rating) info.push(`${f.rating} ELO`);
  name.append(el("small", "", info.join(" · ")));
  row.append(el("span", "friend-dot"), name);
  if (challenged?.id === f.id) {
    row.append(button("ANNULER", "secondary friend-btn", stopChallenge));
    return row;
  }
  const duel = button("DÉFIER", "friend-btn", () => challenge(f));
  duel.disabled = state !== "menu" || !!challenged;
  let armed = false; // retirer un ami demande deux clics
  const remove = button("✕", "secondary friend-btn friend-remove", () => {
    if (!armed) {
      armed = true;
      remove.textContent = "RETIRER ?";
      setTimeout(() => {
        armed = false;
        remove.textContent = "✕";
      }, 3000);
      return;
    }
    act(() => removeFriend(f.id), `${f.name} ne fait plus partie de tes amis.`);
  });
  remove.setAttribute("aria-label", `Retirer ${f.name}`);
  row.append(duel, remove);
  return row;
}

function incomingRow(r) {
  const row = el("div", "friend-row");
  row.append(el("span", "friend-name", r.name));
  row.append(
    button("ACCEPTER", "friend-btn", () => act(() => respondFriend(r.id, true), `${r.name} est ton ami !`)),
    button("REFUSER", "secondary friend-btn", () => act(() => respondFriend(r.id, false))),
  );
  return row;
}

function outgoingRow(r) {
  const row = el("div", "friend-row");
  row.append(el("span", "friend-name", r.name));
  row.append(button("ANNULER", "secondary friend-btn", () => act(() => removeFriend(r.id))));
  return row;
}
