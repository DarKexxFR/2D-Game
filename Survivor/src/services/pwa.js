// Application installable (PWA) : service worker (sw.js), installation depuis le navigateur et
// récompense de la première ouverture depuis l'icône. Aucune boutique d'applications.
//
// Selon l'appareil, l'installation passe par :
//  - "prompt" : Chrome, Edge, Android... proposent leur propre fenêtre (événement beforeinstallprompt) ;
//  - "ios"    : iPhone / iPad, à la main (Partager › Sur l'écran d'accueil), on affiche la marche à suivre ;
//  - "installed" : le jeu tourne déjà depuis son icône ;
//  - "unavailable" : navigateur sans installation (Firefox sur PC...).

import { PWA } from "../config.js";
import { account, saveAccount } from "./storage.js";

/**
 * Événement d'installation de Chrome / Edge (pas encore dans les types du DOM).
 * @typedef {Event & { prompt: () => Promise<void>, userChoice: Promise<{ outcome: string }> }} InstallPromptEvent
 */

/** @type {InstallPromptEvent | null} */
let deferredPrompt = null;
let justInstalled = false;
/** @type {Promise<ServiceWorkerRegistration | null>} */
let registration = Promise.resolve(null);
const listeners = [];

/** `ready` : fichiers du jeu gardés par le service worker (jouable hors connexion). */
export const offline = { ready: false };

/** Appelé quand l'installation devient possible, est faite ou refusée. */
export function onPwaChange(fn) {
  listeners.push(fn);
}

function changed() {
  for (const fn of listeners) fn();
}

/** Le jeu est ouvert depuis son icône (plein écran ou fenêtre d'application). */
export function isStandalone() {
  const nav = /** @type {Navigator & { standalone?: boolean }} */ (navigator);
  return (
    nav.standalone === true ||
    ["fullscreen", "standalone", "minimal-ui"].some((m) => matchMedia(`(display-mode: ${m})`).matches)
  );
}

/** iPhone, iPod ou iPad (les iPad récents se présentent comme un Mac tactile). */
export function isIos() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** @returns {"installed" | "prompt" | "ios" | "unavailable"} */
export function installState() {
  if (justInstalled || isStandalone()) return "installed";
  if (deferredPrompt) return "prompt";
  if (isIos()) return "ios";
  return "unavailable";
}

/** Ouvre la fenêtre d'installation du navigateur. Renvoie "accepted", "dismissed" ou "unavailable". */
export async function promptInstall() {
  const prompt = deferredPrompt;
  if (!prompt) return "unavailable";
  deferredPrompt = null; // la fenêtre ne peut servir qu'une fois
  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") justInstalled = true;
    return outcome === "accepted" ? "accepted" : "dismissed";
  } catch {
    return "unavailable";
  } finally {
    changed();
  }
}

/** Bouton « Installer » de l'accueil : seulement à un joueur qui a déjà fini une partie. */
export function canOfferInstall() {
  const state = installState();
  return (state === "prompt" || state === "ios") && account.achievementStats.runs >= PWA.offerMinRuns;
}

/**
 * Première ouverture depuis l'icône : verse la récompense (une fois par compte).
 * Renvoie l'or gagné (0 si rien à verser).
 */
export function claimInstallReward() {
  if (!isStandalone() || account.appInstalled) return 0;
  account.appInstalled = true;
  account.gold += PWA.installReward;
  saveAccount();
  return PWA.installReward;
}

/** Enregistrement du service worker (null si le navigateur n'en a pas ou l'a refusé). */
export function serviceWorker() {
  return registration;
}

/** Démarre le service worker et écoute les événements d'installation. */
export function initPwa() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // pas de mini-bandeau du navigateur : le jeu propose l'installation au bon moment
    deferredPrompt = /** @type {InstallPromptEvent} */ (e);
    changed();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    justInstalled = true;
    changed();
  });
  registration = registerServiceWorker();
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return null;
  try {
    const reg = await navigator.serviceWorker.register("sw.js", { scope: "./" });
    if (!reg) return null; // enregistrement bloqué (navigation privée, réglages, tests)
    warmCache(reg).catch(() => {});
    return reg;
  } catch (err) {
    console.warn("Service worker indisponible :", err);
    return null;
  }
}

/**
 * Premier chargement : les fichiers déjà chargés l'ont été avant le service worker. On lui en donne
 * la liste pour qu'il les garde (le jeu marche alors hors connexion dès la visite suivante).
 * @param {ServiceWorkerRegistration} reg
 */
async function warmCache(reg) {
  const worker = reg.active || (await navigator.serviceWorker.ready).active;
  if (!worker) return;
  const urls = [
    location.href.split("#")[0],
    ...performance.getEntriesByType("resource").map((e) => e.name),
  ].filter((url) => url.startsWith(location.origin) || url.includes("fonts.g"));
  const channel = new MessageChannel();
  channel.port1.onmessage = () => (offline.ready = true);
  worker.postMessage({ type: "warm", urls }, [channel.port2]);
}
