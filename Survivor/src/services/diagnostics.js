// Journal de diagnostic : pour comprendre un bug à partir de ce que le joueur a vécu.
//
// - Journal : les dernières lignes de la session (écrans ouverts, vague, boss, événements du jeu, erreurs,
//   images lentes...), gardées en mémoire et sur l'appareil. Après un rechargement, celui de la session
//   précédente reste lisible (« le jeu a gelé, j'ai relancé »).
// - Erreurs : toute exception non rattrapée, promesse rejetée sans traitement, module qui ne charge pas, ou
//   boucle du jeu arrêtée (rapport « gel ») devient un rapport : message, pile d'appels, état du jeu à cet
//   instant, fin du journal, appareil et version. Une même erreur (même empreinte) n'est rapportée qu'une
//   fois par session, et au plus DIAGNOSTICS.maxReportsPerSession rapports.
// - Les rapports partent vers Supabase par services/errorReports.js (si le joueur accepte les statistiques
//   anonymes) ; le journal complet se copie depuis les Options (journalText) pour l'envoyer à la main.
//
// Ce module est le premier importé par main.js : ses écouteurs sont posés avant le chargement du reste du jeu.
// Il ne dépend d'aucun module du jeu : l'état est fourni par main.js (setDiagnosticContext, watch).

import { BUILD } from "../build.js";
import { DIAGNOSTICS, STORAGE_KEYS } from "../config.js";
import { onAny } from "../core/events.js";

/** @typedef {[number, string, string]} JournalLine horodatage (ms), catégorie, texte */

/**
 * @typedef {object} ErrorReport
 * @property {string} id identifiant du rapport
 * @property {string} kind "error" (exception), "rejection" (promesse), "load" (fichier), "freeze" (boucle arrêtée)
 * @property {string} fingerprint empreinte : même erreur au même endroit = même empreinte
 * @property {string} message
 * @property {string} stack pile d'appels (adresses du site retirées)
 * @property {number} at horodatage (ms)
 * @property {string} build version du jeu
 * @property {Record<string, any>} context état du jeu au moment de l'erreur
 * @property {JournalLine[]} journal fin du journal
 * @property {Record<string, any>} device appareil et navigateur (sans identifiant)
 * @property {number} count nombre de fois vue pendant la session
 * @property {boolean} sent envoyé au serveur
 */

/**
 * @typedef {object} DiagSession
 * @property {string} id
 * @property {number} start
 * @property {string} build
 * @property {JournalLine[]} lines
 * @property {ErrorReport[]} reports
 */

const newId = () =>
  typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : String(Date.now() + Math.random());

/** @type {DiagSession} */
const session = { id: newId(), start: Date.now(), build: BUILD, lines: [], reports: [] };
/** @type {DiagSession | null} session précédente (relue sur l'appareil) */
let previous = null;
/** @type {((report: ErrorReport) => void)[]} */
const reportListeners = [];
/** @type {() => Record<string, any>} */
let contextProvider = () => ({});
/** @type {{ label: string, get: () => unknown, last: string | undefined }[]} */
const watchers = [];
/** Images de la boucle du jeu (voir markFrame) */
const frames = { last: 0, count: 0, second: 0, fps: 0, freezeReported: false };
let saveTimer = 0;
/** @type {Map<string, number>} erreurs vues pendant la session (empreinte → nombre de fois) */
const occurrences = new Map();
/** @type {Map<string, number>} dernière ligne notée par logThrottled (clé → horodatage) */
const throttled = new Map();

// --- JOURNAL ---

/** Ajoute une ligne au journal (catégorie courte : "écran", "partie", "erreur"...). */
export function logEvent(category, message) {
  session.lines.push([Date.now(), category, String(message).slice(0, 200)]);
  if (session.lines.length > DIAGNOSTICS.journalSize) session.lines.shift();
  scheduleSave();
}

/** Comme logEvent, au plus une fois toutes les `ms` pour une même clé (situations qui durent). */
export function logThrottled(key, category, message, ms = 10_000) {
  const now = Date.now();
  if (now - (throttled.get(key) || 0) < ms) return;
  throttled.set(key, now);
  logEvent(category, message);
}

/** Fournit l'état du jeu joint aux rapports (appelé au moment de l'erreur, jamais à chaque image). */
export function setDiagnosticContext(provider) {
  contextProvider = provider;
}

/** Suit une valeur : chaque changement est noté dans le journal (« vague : 7 », « boss : Kraken »...). */
export function watch(label, get) {
  watchers.push({ label, get, last: undefined });
}

function pollWatchers() {
  for (const w of watchers) {
    let value;
    try {
      value = String(w.get() ?? "—");
    } catch (err) {
      value = `illisible (${err?.message})`;
    }
    if (value === w.last) continue;
    w.last = value;
    logEvent(w.label, value);
  }
}

/** Résumé court d'un événement du jeu pour le journal. */
function describe(payload) {
  if (payload === undefined || payload === null) return "";
  if (typeof payload !== "object") return String(payload);
  const parts = [];
  for (const key of ["name", "id", "type", "kind", "label", "level", "depth", "wave"]) {
    const v = payload[key];
    if (v !== undefined && v !== null && typeof v !== "object") parts.push(`${key}=${v}`);
  }
  return parts.join(" ");
}

onAny((event, payload) => {
  if (DIAGNOSTICS.quietEvents.includes(event)) return;
  const detail = describe(payload);
  logEvent("événement", detail ? `${event} (${detail})` : event);
});

// --- ERREURS ---

/** Pile d'appels sans l'adresse du site (plus courte, et la même partout). */
function cleanStack(stack) {
  return String(stack || "")
    .replace(/(?:https?|chrome-extension|moz-extension):\/\/[^/\s)]+/g, "")
    .slice(0, DIAGNOSTICS.stackMax);
}

/** Première ligne de la pile qui désigne un fichier : « fonction@fichier » sans ligne ni colonne. */
function topFrame(stack) {
  for (const line of stack.split("\n")) {
    const m = line.match(/(?:at\s+(?:(\S+)\s+\()?|^(\S*)@)([^()\s]+?\.js)(?::\d+)*\)?\s*$/);
    if (m) return `${m[1] || m[2] || "?"}@${m[3]}`;
  }
  return "";
}

/** Empreinte d'une erreur : sorte + message (nombres effacés) + fonction et fichier d'origine. */
function fingerprint(kind, message, stack) {
  const text = `${kind}|${message.replace(/\d+/g, "#").slice(0, 120)}|${topFrame(stack)}`;
  let h = 0x811c9dc5; // FNV-1a 32 bits
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function safeContext() {
  try {
    return { ...contextProvider(), fps: frames.fps };
  } catch (err) {
    return { unavailable: String(err?.message || err) };
  }
}

/**
 * Note une erreur dans le journal et en fait un rapport (une fois par empreinte et par session).
 * Utilisable aussi pour une erreur rattrapée qu'on veut voir remonter.
 * @param {unknown} error Error ou autre valeur levée
 * @param {string} [kind]
 */
export function captureError(error, kind = "error") {
  try {
    const err = /** @type {any} */ (error);
    const message = String(err?.message ?? err ?? "Erreur inconnue").slice(0, 300);
    const stack = cleanStack(err?.stack);
    const print = fingerprint(kind, message, stack);
    // Une erreur qui se répète (à chaque image...) ne remplit pas le journal : seulement comptée
    const times = (occurrences.get(print) || 0) + 1;
    occurrences.set(print, times);
    const known = session.reports.find((r) => r.fingerprint === print);
    if (known) known.count = times;
    if (times > 1) return;
    logEvent("erreur", `${kind} : ${message}`);
    if (session.reports.length >= DIAGNOSTICS.maxReportsPerSession) return;
    /** @type {ErrorReport} */
    const report = {
      id: newId(),
      kind,
      fingerprint: print,
      message,
      stack,
      at: Date.now(),
      build: BUILD,
      context: safeContext(),
      journal: session.lines.slice(-DIAGNOSTICS.sentLines),
      device: deviceInfo(),
      count: 1,
      sent: false,
    };
    session.reports.push(report);
    save();
    for (const fn of reportListeners) fn(report);
  } catch {
    // Le diagnostic ne doit jamais provoquer d'erreur à son tour.
  }
}

/** Nouveau rapport (services/errorReports.js l'envoie). */
export function onReport(fn) {
  reportListeners.push(fn);
}

/** Rapports pas encore envoyés : ceux de cette session et de la précédente (envoi impossible, onglet fermé...). */
export function unsentReports() {
  return [...(previous?.reports || []), ...session.reports].filter((r) => !r.sent);
}

export function markSent(report) {
  report.sent = true;
  save();
}

addEventListener(
  "error",
  (/** @type {Event} */ e) => {
    if (e instanceof ErrorEvent) return captureError(e.error ?? e.message, "error");
    // Fichier qui ne charge pas (module manquant, déploiement incomplet...) : écouteur en capture
    const el = /** @type {HTMLScriptElement | HTMLLinkElement} */ (e.target);
    if (el?.tagName === "SCRIPT" || el?.tagName === "LINK") {
      const src = /** @type {any} */ (el).src || /** @type {any} */ (el).href || "";
      captureError(new Error(`Fichier non chargé : ${cleanStack(src)}`), "load");
    }
  },
  true,
);
addEventListener("unhandledrejection", (e) => captureError(e.reason, "rejection"));

// Messages d'erreur et avertissements de la console : notés dans le journal (pas de rapport)
for (const level of /** @type {const} */ (["error", "warn"])) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    logEvent(`console.${level}`, args.map((a) => (a instanceof Error ? a.message : String(a))).join(" "));
    original(...args);
  };
}

// --- BOUCLE DU JEU : IMAGES LENTES ET GEL ---

/**
 * Appelé à la fin de chaque image par main.js (`start` = performance.now() au début de l'image).
 * Note les images lentes et les blocages du jeu, compte les images par seconde.
 */
export function markFrame(start) {
  const now = performance.now();
  const duration = now - start;
  const gap = frames.last ? start - frames.last : 0;
  if (!document.hidden && gap > 1000)
    logThrottled("gap", "lenteur", `jeu bloqué ${Math.round(gap)} ms`, 5000);
  else if (!document.hidden && duration > DIAGNOSTICS.slowFrameMs)
    logThrottled("frame", "lenteur", `image ${Math.round(duration)} ms`, 5000);
  if (frames.freezeReported) {
    frames.freezeReported = false;
    logEvent("boucle", "images reparties");
  }
  frames.last = now;
  frames.count++;
  if (now - frames.second >= 1000) {
    frames.fps = frames.count;
    frames.count = 0;
    frames.second = now;
  }
}

/** Onglet visible mais plus aucune image : la boucle du jeu s'est arrêtée (le jeu paraît figé). */
function checkFreeze() {
  if (document.hidden || !frames.last || frames.freezeReported) return;
  const idle = performance.now() - frames.last;
  if (idle < DIAGNOSTICS.freezeMs) return;
  frames.freezeReported = true;
  captureError(new Error(`Boucle du jeu arrêtée depuis ${Math.round(idle / 1000)} s`), "freeze");
}

document.addEventListener("visibilitychange", () => {
  // Onglet caché : plus d'images, c'est normal ; on repart de zéro au retour
  if (frames.last) frames.last = performance.now();
  logEvent("onglet", document.hidden ? "caché" : "visible");
  if (document.hidden) save();
});
addEventListener("pagehide", () => save());

setInterval(() => {
  pollWatchers();
  checkFreeze();
}, DIAGNOSTICS.watchMs);

// --- APPAREIL ---

/** Navigateur et système en clair (« Chrome 141 », « Android 14 »), sans la chaîne complète du navigateur. */
function parseAgent(ua) {
  /** @type {[string, RegExp][]} */
  const browsers = [
    ["Edge", /Edg(?:A|iOS)?\/(\d+)/],
    ["Opera", /OPR\/(\d+)/],
    ["Samsung", /SamsungBrowser\/(\d+)/],
    ["Firefox", /(?:Firefox|FxiOS)\/(\d+)/],
    ["Chrome", /(?:Chrome|CriOS)\/(\d+)/],
    ["Safari", /Version\/(\d+).*Safari/],
  ];
  const found = browsers.find(([, re]) => re.test(ua));
  const browser = found ? `${found[0]} ${ua.match(found[1])[1]}` : "autre";
  const android = ua.match(/Android (\d+)/);
  const ios = ua.match(/(?:iPhone|iPad|iPod).*? OS (\d+)/);
  const os = android
    ? `Android ${android[1]}`
    : ios
      ? `iOS ${ios[1]}`
      : /CrOS/.test(ua)
        ? "ChromeOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X/.test(ua)
            ? "macOS"
            : /Linux/.test(ua)
              ? "Linux"
              : "autre";
  return { browser, os };
}

export function deviceInfo() {
  const nav = /** @type {any} */ (navigator);
  return {
    ...parseAgent(navigator.userAgent),
    mobile: matchMedia("(pointer: coarse)").matches,
    installed: matchMedia("(display-mode: standalone)").matches,
    screen: `${innerWidth}x${innerHeight}`,
    dpr: Math.round(devicePixelRatio * 100) / 100,
    memory: nav.deviceMemory ?? null,
    cores: navigator.hardwareConcurrency ?? null,
    lang: (navigator.language || "").slice(0, 10),
    host: location.hostname.slice(0, 60),
  };
}

// --- ENREGISTREMENT SUR L'APPAREIL ---

function scheduleSave() {
  if (!saveTimer) saveTimer = setTimeout(save, DIAGNOSTICS.saveMs);
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  try {
    const keep = (/** @type {DiagSession} */ s) => ({ ...s, lines: s.lines.slice(-DIAGNOSTICS.savedLines) });
    localStorage.setItem(
      STORAGE_KEYS.diagnostics,
      JSON.stringify({ session: keep(session), previous: previous && keep(previous) }),
    );
  } catch {
    // Stockage plein ou indisponible : le journal reste en mémoire.
  }
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.diagnostics) || "null");
    if (saved?.session?.lines) {
      previous = saved.session;
      // Rapports encore plus anciens jamais envoyés : on n'en garde pas plus de DIAGNOSTICS.pendingMax
      const older = (saved.previous?.reports || []).filter((r) => !r.sent);
      previous.reports = [...older, ...(previous.reports || [])].slice(-DIAGNOSTICS.pendingMax);
    }
  } catch {
    previous = null;
  }
}

load();
logEvent("session", `ouverture · version ${BUILD}`);
// Erreurs survenues avant ce module (écran de chargement, voir boot.js)
for (const err of window.__bootErrors || []) captureError(err, "error");

// --- EXPORT TEXTE (Options : COPIER LE JOURNAL) ---

const clock = (ms) => {
  const d = new Date(ms);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
};

const flat = (obj) =>
  Object.entries(obj || {})
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(" · ");

function sessionText(s, title) {
  const out = [`=== ${title} · ${new Date(s.start).toLocaleString("fr-FR")} · version ${s.build} ===`];
  for (const r of s.reports) {
    out.push(
      `--- ${r.kind.toUpperCase()} ${r.fingerprint} à ${clock(r.at)}${r.count > 1 ? ` (×${r.count})` : ""} ---`,
      r.message,
      r.stack,
      `État : ${flat(r.context)}`,
    );
  }
  out.push("--- Journal ---", ...s.lines.map(([t, c, m]) => `${clock(t)} [${c}] ${m}`));
  return out.join("\n");
}

/** Journal complet en texte (à coller dans un message pour signaler un bug). */
export function journalText() {
  const parts = [
    "LAST PULSE · JOURNAL DE DIAGNOSTIC",
    `Appareil : ${flat(deviceInfo())}`,
    `État : ${flat(safeContext())}`,
    "",
    sessionText(session, "Session en cours"),
  ];
  if (previous) parts.push("", sessionText(previous, "Session précédente"));
  return parts.join("\n");
}

// Depuis la console du navigateur : copy(lastPulseJournal())
window.lastPulseJournal = journalText;
