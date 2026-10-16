// Amis : profil (pseudo, code ami), présence et demandes d'ami (fonctions de supabase/schema.sql),
// puis défis en direct. Chaque joueur connecté écoute son canal Realtime « amis-<id> ». Défier un ami
// = créer une partie de duel (services/netplay.js) et lui envoyer son code sur ce canal ; il répond sur
// le même canal. Le duel lancé est le duel en ligne habituel, classé ELO (les deux sont connectés).

import { FRIENDS } from "../config.js";
import { currentUser, getAccessToken, onAuthChange } from "./auth.js";
import { joinChannel } from "./realtime.js";
import { isOnlineEnabled, rpc } from "./supabase.js";

/** Dernière liste reçue : code ami, amis { id, name, online, status, rating }, demandes reçues / envoyées. */
export const friends = { code: "", list: [], incoming: [], outgoing: [], loaded: false };

let opts = {
  getName: () => "",
  getStatus: () => "menu", // « menu » : libre pour un défi ; « jeu » / « duel » : occupé
  onChange() {},
  onInvite(_invite) {}, // défi reçu { from, name, room }
  onInviteGone() {}, // défi annulé par l'ami ou expiré
};
let inbox = null; // canal de ce joueur
let inboxUser = null;
let syncTimer = null;
let syncing = null;
/** @type {{ from: string, name: string, room: string, timer?: ReturnType<typeof setTimeout> } | null} */
let pending = null; // défi reçu en attente de réponse
let challenge = null; // défi envoyé

const myId = () => currentUser()?.id ?? null;

export function canUseFriends() {
  return isOnlineEnabled() && !!currentUser();
}

export function initFriends(options) {
  opts = { ...opts, ...options };
  // Une session renouvelée change aussi la session : on ne repart que si le joueur change
  let user = myId();
  onAuthChange(() => {
    if (myId() === user) return;
    user = myId();
    restart();
  });
  restart();
}

/** (Re)branche la présence et le canal du joueur connecté ; tout s'arrête à la déconnexion. */
function restart() {
  clearInterval(syncTimer);
  syncTimer = null;
  inbox?.close();
  inbox = null;
  inboxUser = null;
  cancelChallenge();
  dropInvite();
  Object.assign(friends, { code: "", list: [], incoming: [], outgoing: [], loaded: false });
  opts.onChange();
  if (!canUseFriends()) return;
  syncFriends();
  syncTimer = setInterval(syncFriends, FRIENDS.syncMs);
  openInbox(myId());
}

/** Signale sa présence et récupère amis et demandes. */
export function syncFriends() {
  if (!canUseFriends()) return Promise.resolve();
  syncing ??= (async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const data = await rpc(
        "friends_sync",
        { p_name: opts.getName().slice(0, 12), p_status: opts.getStatus() },
        token,
      );
      if (!data || !canUseFriends()) return;
      Object.assign(friends, {
        code: data.code || "",
        list: data.friends || [],
        incoming: data.incoming || [],
        outgoing: data.outgoing || [],
        loaded: true,
      });
      opts.onChange();
    } catch (err) {
      console.warn("Liste d'amis indisponible :", err);
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

/** Appelle une fonction « ami » ; les refus du serveur (« ami:introuvable »...) deviennent l'erreur. */
async function call(name, args) {
  const token = await getAccessToken();
  if (!token) throw new Error("login");
  try {
    return await rpc(name, args, token);
  } catch (err) {
    throw new Error(String(err?.message).match(/ami:(\w+)/)?.[1] || "network");
  }
}

/** Demande d'ami par pseudo ou code ami. Renvoie { status: "sent" | "accepted", name }. */
export async function requestFriend(query) {
  const res = await call("friend_request", { p_query: query.trim() });
  poke(res.id);
  await syncFriends();
  return res;
}

export async function respondFriend(id, accept) {
  await call("friend_respond", { p_id: id, p_accept: accept });
  poke(id);
  await syncFriends();
}

/** Retire un ami ou annule une demande envoyée. */
export async function removeFriend(id) {
  await call("friend_remove", { p_id: id });
  poke(id);
  await syncFriends();
}

/** Prévient l'autre joueur (s'il a le jeu ouvert) que sa liste a changé. */
function poke(id) {
  if (!id) return;
  joinChannel(`amis-${id}`, () => {})
    .then((ch) => {
      ch.send("sync", { from: myId() });
      ch.close();
    })
    .catch(() => {});
}

// --- CANAL DU JOUEUR : défis reçus ---

function openInbox(user) {
  if (!user || inboxUser === user) return;
  inboxUser = user;
  const retry = () => {
    if (inboxUser !== user) return;
    inbox = null;
    inboxUser = null;
    setTimeout(() => myId() === user && openInbox(user), FRIENDS.resendMs);
  };
  joinChannel(`amis-${user}`, onInbox, retry)
    .then((ch) => {
      if (inboxUser === user) inbox = ch;
      else ch.close();
    })
    .catch(retry);
}

const isFriend = (id) => friends.list.some((f) => f.id === id);

async function onInbox(event, data) {
  if (!data || data.from === myId()) return;
  if (event === "sync") return syncFriends();
  if (event === "cancel") {
    if (pending?.room === data.room) {
      dropInvite();
      opts.onInviteGone();
    }
    return;
  }
  if (event !== "invite" || typeof data.room !== "string") return;
  if (pending?.room === data.room) return; // défi renvoyé : déjà affiché
  if (!isFriend(data.from)) await syncFriends(); // ami tout juste accepté ?
  if (!isFriend(data.from)) return;
  if (pending || opts.getStatus() !== "menu") return reply(data, "busy");
  const friend = friends.list.find((f) => f.id === data.from);
  pending = { from: data.from, name: friend.name, room: data.room };
  pending.timer = setTimeout(() => {
    dropInvite();
    opts.onInviteGone();
  }, FRIENDS.inviteMs);
  opts.onInvite(pending);
}

function reply(invite, answer) {
  inbox?.send("reply", { from: myId(), to: invite.from, room: invite.room, answer });
}

function dropInvite() {
  clearTimeout(pending?.timer);
  pending = null;
}

/** Répond au défi reçu ("accept", "decline" ou "busy") ; renvoie le défi ({ room, name }) ou null. */
export function answerInvite(answer) {
  const invite = pending;
  if (!invite) return null;
  dropInvite();
  reply(invite, answer);
  return invite;
}

// --- DÉFI ENVOYÉ ---

/**
 * Défie `friend` : `room` = code de la partie de duel déjà créée. `onAnswer` reçoit "accept",
 * "decline", "busy" ou "timeout" (sans réponse au bout de FRIENDS.inviteMs).
 */
export async function sendChallenge(friend, room, onAnswer) {
  cancelChallenge();
  const mine = { room, timers: [], channel: null };
  challenge = mine;
  const channel = await joinChannel(`amis-${friend.id}`, (event, data) => {
    if (event !== "reply" || challenge !== mine || data?.to !== myId() || data.room !== room) return;
    endChallenge(false);
    onAnswer(data.answer);
  });
  if (challenge !== mine) return channel.close();
  mine.channel = channel;
  const send = () => channel.send("invite", { from: myId(), room });
  send();
  mine.timers.push(setInterval(send, FRIENDS.resendMs));
  mine.timers.push(
    setTimeout(() => {
      if (challenge !== mine) return;
      endChallenge(true);
      onAnswer("timeout");
    }, FRIENDS.inviteMs),
  );
}

function endChallenge(notify) {
  const c = challenge;
  if (!c) return;
  challenge = null;
  for (const t of c.timers) clearInterval(t); // clearInterval arrête aussi les setTimeout
  if (!c.channel) return;
  if (notify) c.channel.send("cancel", { from: myId(), room: c.room });
  c.channel.close();
}

/** Annule le défi envoyé (l'ami est prévenu). */
export function cancelChallenge() {
  endChallenge(true);
}

/** Le duel a commencé : le défi s'arrête sans prévenir. */
export function challengeStarted() {
  endChallenge(false);
}
