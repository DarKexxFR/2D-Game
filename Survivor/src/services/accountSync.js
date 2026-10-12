// Sauvegarde liée au compte (Google / e-mail) : la progression suit le joueur sur tous ses appareils.
//
// Pour ne jamais écraser une progression en silence, chaque appareil retient la dernière version
// échangée avec le serveur (date + signature). À la connexion et au démarrage :
//  - le serveur n'a rien                          → on envoie la progression de l'appareil ;
//  - le serveur n'a pas bougé depuis              → on envoie la progression de l'appareil ;
//  - le serveur a bougé, pas l'appareil (ou appareil vierge) → on récupère celle du compte ;
//  - les deux ont bougé                           → le joueur choisit (conflit).

import { STARTER_ITEMS } from "../data/items.js";
import { STORAGE_KEYS } from "../config.js";
import { currentUser, getAccessToken, onAuthChange } from "./auth.js";
import { account, loadPseudo, onAccountSave, overwriteLocalSave } from "./storage.js";
import { rpc } from "./supabase.js";

const UPLOAD_DELAY_MS = 3000; // regroupe les sauvegardes rapprochées (le serveur en refuse 2 en 2 s)
const SAVE_VERSION = 1;

/** État affiché dans les Options. status : off | checking | syncing | synced | error | conflict */
export const accountSync = { status: "off", conflict: null };

let pendingRemote = null; // progression du compte en attente du choix du joueur
let ready = false; // les envois automatiques n'ont lieu qu'après la première comparaison
let uploadTimer = null;
const listeners = [];

export function onAccountSyncChange(fn) {
  listeners.push(fn);
}

function setStatus(status, conflict = null) {
  accountSync.status = status;
  accountSync.conflict = conflict;
  for (const fn of listeners) fn(accountSync);
}

// --- Repère de la dernière synchronisation de cet appareil ---

function readMark() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.accountSync) || "null");
  } catch {
    return null;
  }
}

function writeMark(savedAt, acc) {
  try {
    const mark = { userId: currentUser()?.id, savedAt, sig: signature(acc) };
    localStorage.setItem(STORAGE_KEYS.accountSync, JSON.stringify(mark));
  } catch {}
}

/** Ce qui compte dans une progression (on ignore les horodatages comme le coffre gratuit). */
function signature(acc) {
  const { level, currentXp, gold, items, talents, achievements } = acc;
  return JSON.stringify({ level, currentXp, gold, items, talents, achievements });
}

/** Appareil sans progression : rien à perdre en récupérant celle du compte. */
function isFresh(acc) {
  const extraItems = Object.keys(acc.items || {}).filter((id) => !STARTER_ITEMS.includes(id));
  return (acc.level || 1) <= 1 && !acc.currentXp && !acc.gold && extraItems.length === 0;
}

/** Résumé montré au joueur pour choisir entre deux progressions. */
export function summarize(acc) {
  return {
    level: acc.level || 1,
    gold: acc.gold || 0,
    items: Object.keys(acc.items || {}).length,
    bestWave: acc.achievementStats?.bestWave || 1,
  };
}

// --- Synchronisation ---

/** Au démarrage : branche les envois automatiques et vérifie la progression du compte connecté. */
export function initAccountSync() {
  onAccountSave(scheduleUpload);
  onAuthChange((session) => {
    if (session) return;
    ready = false; // déconnexion : plus d'envoi
    clearTimeout(uploadTimer);
    setStatus("off");
  });
}

/**
 * Compare la progression de l'appareil et celle du compte. Renvoie :
 * "uploaded" | "synced" | "restored" (recharger la page) | "conflict" | "error" | "off".
 */
export async function syncAccount() {
  ready = false;
  const user = currentUser();
  if (!user) return "off";
  setStatus("checking");
  try {
    const token = await getAccessToken();
    if (!token) throw new Error("session expirée");
    const remote = await rpc("load_account_progress", {}, token);
    if (!remote?.account) return await uploadAndMark();

    const mark = readMark();
    const known = mark?.userId === user.id;
    const remoteChanged = !known || mark.savedAt !== remote.savedAt;
    const localChanged = !known || mark.sig !== signature(account);
    if (!remoteChanged) return localChanged ? await uploadAndMark() : finish("synced");
    if (!localChanged || isFresh(account) || signature(account) === signature(remote.account)) {
      return adopt(remote);
    }
    pendingRemote = remote;
    setStatus("conflict", { local: summarize(account), remote: summarize(remote.account) });
    return "conflict";
  } catch (err) {
    console.warn("Synchronisation du compte impossible :", err);
    setStatus("error");
    return "error";
  }
}

function finish(status) {
  ready = true;
  setStatus("synced");
  return status;
}

/** Remplace la progression de l'appareil par celle du compte (prise en compte au rechargement). */
function adopt(remote) {
  clearTimeout(uploadTimer);
  overwriteLocalSave(remote.account, remote.pseudo);
  writeMark(remote.savedAt, remote.account);
  setStatus("synced");
  return "restored";
}

/** Choix du joueur en cas de conflit : "local" (cet appareil) ou "remote" (le compte). */
export async function resolveConflict(choice) {
  const remote = pendingRemote;
  if (!remote) return "error";
  pendingRemote = null;
  if (choice === "remote") return adopt(remote);
  try {
    return await uploadAndMark();
  } catch (err) {
    console.warn("Envoi impossible :", err);
    setStatus("error");
    return "error";
  }
}

async function uploadAndMark() {
  const token = await getAccessToken();
  if (!token) throw new Error("session expirée");
  setStatus("syncing");
  const savedAt = Date.now();
  await rpc(
    "save_account_progress",
    { p_data: { version: SAVE_VERSION, account, pseudo: loadPseudo(), savedAt } },
    token,
  );
  writeMark(savedAt, account);
  return finish("uploaded");
}

function scheduleUpload() {
  if (!ready || !currentUser()) return;
  clearTimeout(uploadTimer);
  uploadTimer = setTimeout(async () => {
    try {
      await uploadAndMark();
    } catch (err) {
      console.warn("Sauvegarde du compte impossible :", err);
      setStatus("error");
    }
  }, UPLOAD_DELAY_MS);
}

/** Droit à l'effacement : supprime la sauvegarde du compte (celle de l'appareil reste). */
export async function deleteAccountProgress() {
  const token = await getAccessToken();
  if (!token) return false;
  try {
    ready = false;
    clearTimeout(uploadTimer);
    await rpc("delete_account_progress", {}, token);
    localStorage.removeItem(STORAGE_KEYS.accountSync);
    setStatus("off");
    return true;
  } catch (err) {
    console.warn("Suppression impossible :", err);
    return false;
  }
}
