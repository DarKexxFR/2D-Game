// Sauvegarde en ligne : la progression est copiée dans Supabase sous un code secret
// (XXXX-XXXX-XXXX). Avec ce code, le joueur la retrouve sur n'importe quel appareil.

import { STORAGE_KEYS } from "../config.js";
import { account, loadPseudo, onAccountSave, overwriteLocalSave } from "./storage.js";
import { isOnlineEnabled, rpc } from "./supabase.js";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sans 0/O, 1/I/L : pas de confusion
const UPLOAD_DELAY_MS = 3000; // regroupe les sauvegardes rapprochées en un seul envoi
const SAVE_VERSION = 1;

/** État affiché dans les Options. status : off | syncing | synced | error */
export const cloud = { status: "off", lastSync: 0 };

let uploadTimer = null;
let listeners = [];

export function onCloudChange(fn) {
  listeners.push(fn);
}

function setStatus(status) {
  cloud.status = status;
  if (status === "synced") cloud.lastSync = Date.now();
  for (const fn of listeners) fn(cloud);
}

export function getCloudCode() {
  try {
    return localStorage.getItem(STORAGE_KEYS.cloudCode);
  } catch {
    return null;
  }
}

function storeCode(code) {
  try {
    if (code) localStorage.setItem(STORAGE_KEYS.cloudCode, code);
    else localStorage.removeItem(STORAGE_KEYS.cloudCode);
  } catch {}
}

/** Met un code saisi au format XXXX-XXXX-XXXX, ou renvoie null s'il est invalide. */
export function normalizeCode(input) {
  const raw = String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (raw.length !== 12 || [...raw].some((c) => !ALPHABET.includes(c))) return null;
  return raw.match(/.{4}/g).join("-");
}

function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const raw = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
  return raw.match(/.{4}/g).join("-");
}

/** À appeler au démarrage : envoie automatiquement chaque sauvegarde si le joueur a un code. */
export function initCloudSave() {
  if (getCloudCode()) cloud.status = "synced";
  onAccountSave(scheduleUpload);
}

function scheduleUpload() {
  if (!getCloudCode() || !isOnlineEnabled()) return;
  clearTimeout(uploadTimer);
  uploadTimer = setTimeout(uploadNow, UPLOAD_DELAY_MS);
}

export async function uploadNow() {
  const code = getCloudCode();
  if (!code) return false;
  clearTimeout(uploadTimer);
  setStatus("syncing");
  try {
    await rpc("save_progress", {
      p_code: code,
      p_data: { version: SAVE_VERSION, account, pseudo: loadPseudo() },
    });
    setStatus("synced");
    return true;
  } catch (err) {
    console.warn("Sauvegarde en ligne impossible :", err);
    setStatus("error");
    return false;
  }
}

/** Crée un code pour ce joueur et envoie aussitôt sa progression. */
export async function enableCloudSave() {
  if (!getCloudCode()) storeCode(generateCode());
  return uploadNow();
}

/**
 * Récupère la progression liée à un code et remplace celle de cet appareil.
 * Renvoie "ok" (recharger la page ensuite), "invalid", "notFound" ou "error".
 */
export async function restoreFromCode(input) {
  const code = normalizeCode(input);
  if (!code) return "invalid";
  try {
    const data = await rpc("load_progress", { p_code: code });
    if (!data?.account) return "notFound";
    clearTimeout(uploadTimer);
    overwriteLocalSave(data.account, data.pseudo);
    storeCode(code);
    return "ok";
  } catch (err) {
    console.warn("Restauration impossible :", err);
    return "error";
  }
}
