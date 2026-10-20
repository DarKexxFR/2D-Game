// Statistiques de fréquentation anonymes : combien de joueurs, combien de temps ils restent, ce qu'ils
// jouent. Chaque appareil reçoit un identifiant tiré au hasard (jamais lié au compte ni au pseudo) ; une
// session = une ouverture du jeu. Rien n'est lu côté joueur : le serveur range les compteurs (RPC
// `track_session` / `track_run`, voir supabase/schema.sql) et seule la page stats.html, réservée aux
// administrateurs, les affiche. Le joueur peut couper l'envoi dans les Options.
//
// Temps compté : « actif » = onglet visible et joueur présent (une partie en cours, ou un clic / une
// touche depuis moins de ANALYTICS.idleMs) ; « en partie » = partie en cours, hors pause.

import { ANALYTICS } from "../config.js";
import { appState, saveAppState } from "./appState.js";
import { isOnlineEnabled, request } from "./supabase.js";

/**
 * @typedef {object} RunReport
 * @property {string} mode "normal", "daily", "rush" ou "duel"
 * @property {string} difficulty
 * @property {number} wave
 * @property {number} pulse pulsations franchies en Endless Pulse
 * @property {number} level niveau atteint en partie
 * @property {number} kills
 * @property {number} seconds durée de la partie (temps de jeu)
 * @property {string} hero
 * @property {string} weapon
 * @property {string} killer nom de ce qui a tué le joueur ("" si victoire ou abandon)
 * @property {boolean} victory boss final vaincu
 */

const session = {
  id: "",
  active: 0, // secondes
  play: 0,
  runs: 0,
  lastInput: 0,
  dirty: false,
};

let isPlaying = () => false;
let isLoggedIn = () => false;
let timer = null;
let beat = null;

const enabled = () => ANALYTICS.enabled && isOnlineEnabled() && appState.analytics.enabled;

/** Identifiant anonyme de l'appareil, tiré au premier lancement. */
function deviceId() {
  if (!appState.analytics.id) {
    appState.analytics.id = crypto.randomUUID();
    saveAppState();
  }
  return appState.analytics.id;
}

/**
 * Démarre le suivi de la session. `playing` : une partie tourne (hors pause) ; `loggedIn` : compte connecté
 * (seulement « oui / non », pour savoir quelle part des joueurs se connecte).
 */
export function initAnalytics({ playing, loggedIn }) {
  isPlaying = playing;
  isLoggedIn = loggedIn;
  session.id = crypto.randomUUID();
  session.lastInput = Date.now();
  const touch = () => (session.lastInput = Date.now());
  for (const type of ["pointerdown", "keydown", "touchstart", "wheel"]) {
    addEventListener(type, touch, { passive: true, capture: true });
  }
  // Onglet caché ou fermé : on envoie ce qui a été compté (keepalive : la requête survit à la fermeture)
  document.addEventListener("visibilitychange", () => document.hidden && flush(true));
  addEventListener("pagehide", () => flush(true));
  if (!enabled()) return;
  start();
}

function start() {
  clearInterval(timer);
  clearInterval(beat);
  timer = setInterval(count, 1000);
  beat = setInterval(() => flush(false), ANALYTICS.heartbeatMs);
  session.dirty = true;
  flush(false); // la session existe dès l'ouverture : un joueur qui repart tout de suite compte aussi
}

function stop() {
  clearInterval(timer);
  clearInterval(beat);
  timer = beat = null;
}

/** Une seconde de plus : active si l'onglet est visible et le joueur présent, en partie si elle tourne. */
function count() {
  if (document.hidden) return;
  const playing = isPlaying();
  if (playing || Date.now() - session.lastInput < ANALYTICS.idleMs) {
    session.active++;
    session.dirty = true;
  }
  if (playing) session.play++;
}

/** Envoie les compteurs (cumulés depuis l'ouverture : un envoi perdu est rattrapé par le suivant). */
function flush(leaving) {
  if (!enabled() || !session.dirty) return;
  session.dirty = false;
  send(
    "track_session",
    {
      p_session: session.id,
      p_device: deviceId(),
      p_active: session.active,
      p_play: session.play,
      p_runs: session.runs,
      p_mobile: matchMedia("(pointer: coarse)").matches,
      p_installed: matchMedia("(display-mode: standalone)").matches,
      p_logged: isLoggedIn(),
      p_lang: (navigator.language || "").slice(0, 10),
      p_host: location.hostname.slice(0, 60),
    },
    leaving,
  );
}

/** Fin de partie : résumé envoyé aussitôt (mode, vague, durée, cause de la mort...). */
export function trackRun(/** @type {RunReport} */ run) {
  if (!enabled()) return;
  session.runs++;
  session.dirty = true;
  flush(false); // la session doit exister avant la partie (track_run la vérifie)
  send("track_run", {
    p_session: session.id,
    p_device: deviceId(),
    p_mode: run.mode,
    p_difficulty: run.difficulty,
    p_wave: run.wave,
    p_pulse: run.pulse,
    p_level: run.level,
    p_kills: run.kills,
    p_seconds: Math.round(run.seconds),
    p_hero: run.hero,
    p_weapon: run.weapon,
    p_killer: run.killer.slice(0, 40),
    p_victory: run.victory,
  });
}

/** @type {Promise<unknown>} */
let queue = Promise.resolve();

/** Envois l'un après l'autre (la session est créée avant ses parties) ; une erreur ne gêne jamais le jeu. */
function send(name, args, keepalive = false) {
  const body = JSON.stringify(args);
  queue = queue
    .then(() => request(`rpc/${name}`, { method: "POST", body, keepalive }))
    .catch(() => {
      session.dirty = true; // réessayé au prochain envoi
    });
}

/**
 * Identifiants anonymes de l'appareil et de la session, pour les rapports d'erreurs (services/errorReports.js) ;
 * null si les statistiques sont refusées ou Supabase absent : rien ne doit alors partir.
 */
export function analyticsIdentity() {
  if (!enabled() || !session.id) return null;
  return { device: deviceId(), session: session.id };
}

/** Options : statistiques anonymes acceptées ou non sur cet appareil. */
export function analyticsEnabled() {
  return appState.analytics.enabled;
}

export function setAnalyticsEnabled(on) {
  appState.analytics.enabled = on;
  saveAppState();
  if (on && session.id) start();
  else stop();
}
