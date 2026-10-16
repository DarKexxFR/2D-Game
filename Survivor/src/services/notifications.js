// Notifications (Web Push) : abonnement de l'appareil et rappels envoyés au serveur.
//
// Principe : le JEU décide quand prévenir, le SERVEUR ne fait qu'expédier.
//  - `buildReminders` calcule, à partir de la progression, la liste des rappels voulus avec leur heure
//    (heure locale du joueur : « série en danger » le lendemain à 19 h, quêtes le lundi...) ;
//  - `syncPush` envoie cette liste avec l'abonnement (RPC push_subscribe) ; le serveur remplace
//    l'ancienne liste de cet appareil. Rien n'est renvoyé tant que rien n'a changé ;
//  - supabase/functions/send-push expédie les rappels arrivés à échéance (voir supabase/NOTIFICATIONS.md).
// Chaque visite repousse ainsi les rappels de retour : ils ne partent qu'après une vraie absence.
// Seules les demandes d'ami viennent du serveur lui-même (déclencheur sur la table friendships).

import { LOGIN_STREAK, PUSH } from "../config.js";
import { appState, saveAppState } from "./appState.js";
import { getAccessToken, onAuthChange } from "./auth.js";
import { localDayKey } from "./loginStreak.js";
import { isIos, isStandalone, serviceWorker } from "./pwa.js";
import { account, onAccountSave } from "./storage.js";
import { isOnlineEnabled, rpc } from "./supabase.js";

const DAY_MS = 86400000;
const listeners = [];

/** Appelé quand l'état des notifications change (activation, refus, envoi...). */
export function onPushChange(fn) {
  listeners.push(fn);
}

function changed() {
  for (const fn of listeners) fn();
}

/**
 * Ce que l'appareil permet :
 *  "ok"            : notifications possibles ;
 *  "needs-install" : iPhone / iPad, possibles seulement une fois le jeu installé sur l'écran d'accueil ;
 *  "denied"        : refusées dans les réglages du navigateur ;
 *  "unsupported"   : navigateur sans notifications ;
 *  "off"           : pas configurées côté jeu (clé VAPID vide ou mode en ligne coupé).
 * @returns {"ok" | "needs-install" | "denied" | "unsupported" | "off"}
 */
export function pushSupport() {
  if (!PUSH.vapidPublicKey || !isOnlineEnabled()) return "off";
  const capable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!capable) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "ok";
}

/** Notifications actives sur cet appareil (voulues et autorisées). */
export function pushEnabled() {
  return appState.push.enabled && pushSupport() === "ok" && Notification.permission === "granted";
}

/** Proposer « Être prévenu ? » : joueur habitué, jamais refusé récemment, rien de décidé encore. */
export function shouldAskPush(now = Date.now()) {
  if (pushSupport() !== "ok" || appState.push.enabled || Notification.permission !== "default") return false;
  if (account.achievementStats.runs < PUSH.askMinRuns) return false;
  return now - appState.push.askedAt > PUSH.askCooldownDays * DAY_MS;
}

export function markPushAsked(now = Date.now()) {
  appState.push.askedAt = now;
  saveAppState();
}

/**
 * Active les notifications (à appeler sur un clic : le navigateur l'exige pour demander l'accord).
 * @returns {Promise<"ok" | "denied" | "unsupported" | "error">}
 */
export async function enablePush() {
  if (pushSupport() !== "ok") return pushSupport() === "denied" ? "denied" : "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    changed();
    return "denied";
  }
  appState.push.enabled = true;
  saveAppState();
  const ok = await syncPush({ force: true });
  changed();
  return ok ? "ok" : "error";
}

/** Désactive les notifications de cet appareil (abonnement supprimé ici et sur le serveur). */
export async function disablePush() {
  appState.push.enabled = false;
  const endpoint = appState.push.endpoint;
  appState.push.endpoint = "";
  appState.push.syncedHash = "";
  saveAppState();
  changed();
  try {
    const sub = await currentSubscription();
    await sub?.unsubscribe();
    if (endpoint) await rpc("push_unsubscribe", { p_endpoint: endpoint });
  } catch (err) {
    console.warn("Désabonnement des notifications :", err);
  }
}

/** Coche ou décoche un thème (voir PUSH.topics). */
export function setPushTopic(topic, on) {
  if (!(topic in PUSH.topics)) return;
  appState.push.topics[topic] = on;
  saveAppState();
  changed();
  scheduleSync();
}

// --- RAPPELS ---

/**
 * Date locale `days` jours après `now`, à `hour` heures pile.
 * @param {Date} now
 */
function localAt(now, days, hour) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour, 0, 0, 0);
}

/**
 * Rappels voulus à partir de la progression (fonction pure, testée seule).
 * @param {Date} [now]
 * @param {Record<string, boolean>} [topics] thèmes cochés
 * @returns {{ kind: string, at: string, data: Record<string, number> }[]}
 */
export function buildReminders(now = new Date(), topics = appState.push.topics) {
  const stats = account.achievementStats;
  if (stats.runs < 1) return []; // pas avant une première partie terminée (le tutoriel d'abord)
  const list = [];
  const add = (kind, date, data = {}) => {
    if (date.getTime() > now.getTime() + 60000) list.push({ kind, at: date.toISOString(), data });
  };

  // Série de connexion : prévenir le jour où elle serait perdue, avant minuit
  const streak = account.loginStreak;
  const today = localDayKey(now);
  const yesterday = localDayKey(localAt(now, -1, 12));
  if (streak.count > 0 && (streak.day === today || streak.day === yesterday)) {
    const next = streak.count + 1;
    const gold = LOGIN_STREAK.rewards[(next - 1) % LOGIN_STREAK.rewards.length];
    add("streak", localAt(now, streak.day === today ? 1 : 0, PUSH.streakHour), { day: next, gold });
  }

  // Nouvelles quêtes : le prochain lundi (aujourd'hui si on est lundi avant l'heure)
  const toMonday = (8 - now.getDay()) % 7;
  const monday = localAt(now, toMonday, PUSH.questsHour);
  add("quests", monday.getTime() > now.getTime() ? monday : localAt(now, 7, PUSH.questsHour));

  // Retour après une absence : repoussés à chaque visite, ils ne partent qu'après une vraie pause
  PUSH.comebackDays.forEach((days, i) =>
    add(`comeback${i + 1}`, localAt(now, days, PUSH.comebackHour), { best: stats.bestWave || 1 }),
  );

  const allowed = new Set(
    Object.entries(PUSH.topics).flatMap(([topic, t]) => (topics[topic] ? t.kinds : [])),
  );
  return list.filter((r) => allowed.has(r.kind));
}

// --- ENVOI AU SERVEUR ---

/** @returns {Promise<PushSubscription | null>} */
async function currentSubscription() {
  const reg = await serviceWorker();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Clé VAPID (base64 « URL ») en octets, comme l'attend pushManager.subscribe. */
function vapidKey() {
  const base64 = PUSH.vapidPublicKey.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Même clé (octet par octet) ? */
function sameKey(buffer, key) {
  if (!buffer) return true; // navigateur qui ne la donne pas : on garde l'abonnement
  const a = new Uint8Array(buffer);
  return a.length === key.length && a.every((v, i) => v === key[i]);
}

/**
 * Abonnement valable avec la clé VAPID actuelle. Perdu ou renouvelé par le navigateur : on en refait un ;
 * créé avec une ancienne clé (clés changées sur le serveur) : on le remplace, sinon plus rien n'arriverait.
 * @param {ServiceWorkerRegistration} reg
 */
async function ensureSubscription(reg) {
  const key = vapidKey();
  const existing = await reg.pushManager.getSubscription();
  if (existing && sameKey(existing.options?.applicationServerKey, key)) return existing;
  await existing?.unsubscribe();
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

/** Petite empreinte (rien n'est renvoyé si elle n'a pas changé). */
function hash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

let syncing = Promise.resolve(true);

/**
 * Envoie l'abonnement et les rappels au serveur (ou rien s'ils n'ont pas changé).
 * Les envois se suivent, jamais en parallèle. Renvoie false en cas d'échec.
 */
export function syncPush({ force = false } = {}) {
  syncing = syncing.then(() => doSync(force));
  return syncing;
}

async function doSync(force) {
  if (!pushEnabled()) return false;
  try {
    const reg = await serviceWorker();
    if (!reg) return false;
    const sub = await ensureSubscription(reg);
    const json = sub.toJSON();
    const topics = Object.keys(PUSH.topics).filter((t) => appState.push.topics[t]);
    const reminders = buildReminders();
    const token = await getAccessToken();
    const args = {
      p_endpoint: json.endpoint,
      p_p256dh: json.keys?.p256dh,
      p_auth: json.keys?.auth,
      p_topics: topics,
      p_reminders: reminders,
    };
    // L'heure exacte des rappels de retour bouge à chaque visite : l'empreinte ne garde que le jour
    const fingerprint = hash(
      JSON.stringify({ ...args, p_reminders: reminders.map((r) => [r.kind, r.at.slice(0, 10), r.data]) }) +
        (token ? "1" : "0"),
    );
    const fresh = Date.now() - appState.push.syncedAt < PUSH.resyncHours * 3600000;
    if (!force && fingerprint === appState.push.syncedHash && fresh) return true;
    await rpc("push_subscribe", args, token || undefined);
    Object.assign(appState.push, { endpoint: json.endpoint, syncedHash: fingerprint, syncedAt: Date.now() });
    saveAppState();
    return true;
  } catch (err) {
    console.warn("Notifications : envoi au serveur impossible :", err);
    return false;
  }
}

let timer = 0;
function scheduleSync() {
  clearTimeout(timer);
  timer = window.setTimeout(() => syncPush(), PUSH.syncDebounceMs);
}

/** Branche les envois automatiques : à l'ouverture, à chaque sauvegarde, à la (dé)connexion. */
export function initNotifications() {
  if (pushSupport() === "off") return;
  onAccountSave(scheduleSync);
  // Connexion / déconnexion : l'appareil est relié (ou plus) au compte, pour les demandes d'ami.
  // L'empreinte tient compte de la connexion : un simple renouvellement de session n'envoie rien.
  onAuthChange(scheduleSync);
  if (appState.push.enabled) syncPush();
}
