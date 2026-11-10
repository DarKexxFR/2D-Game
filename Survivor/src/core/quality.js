// Qualité graphique effective. Le réglage `quality` des Options vaut "low", "medium", "high" ou "auto" :
// en AUTO, le niveau suit l'appareil. Il part du dernier niveau retenu (`settings.autoLevel`, sinon la valeur
// par défaut de l'appareil), baisse d'un cran quand les images deviennent trop lentes pendant la partie et
// remonte quand tout redevient fluide (réglages AUTO_QUALITY de config.js).
// Module sans canvas ni DOM : canvas.js applique le niveau (gfx, définition), audio.js le lit pour la musique.

import { AUTO_QUALITY } from "../config.js";
import { settings, updateSettings } from "../services/settings.js";

/** @typedef {"low" | "medium" | "high"} QualityLevel */

/** @type {QualityLevel[]} */
export const QUALITY_LEVELS = ["low", "medium", "high"];

const isTouch =
  typeof window !== "undefined" &&
  (window.matchMedia?.("(pointer: coarse)").matches || navigator.maxTouchPoints > 0);

/** Niveau de départ de l'AUTO sur cet appareil (celui qu'avaient les Options avant l'AUTO). */
export const DEVICE_LEVEL = isTouch ? "medium" : "high";

/** @param {string} v @returns {v is QualityLevel} */
const isLevel = (v) => QUALITY_LEVELS.includes(/** @type {QualityLevel} */ (v));

/** Niveau réellement appliqué (en AUTO : celui choisi par la mesure des images). */
export function qualityLevel(s = settings) {
  if (isLevel(s.quality)) return s.quality;
  return isLevel(s.autoLevel) ? s.autoLevel : DEVICE_LEVEL;
}

export const isAutoQuality = (s = settings) => s.quality === "auto";

// --- Mesure des images (état de la session, propre à l'appareil) ---

const probe = { count: 0, sum: 0, sumSq: 0, slow: 0, fast: 0, last: 0, raisedAt: -Infinity, noRaise: false };

/** @type {((level: QualityLevel, from: QualityLevel, why: string) => void)[]} */
const listeners = [];
/** Appelé quand l'AUTO change de niveau (journal de diagnostic). */
export function onAutoQualityChange(fn) {
  listeners.push(fn);
}

/** Oublie la mesure en cours (début de partie, retour d'une pause : la première image est toujours longue). */
export function resetFrameProbe() {
  Object.assign(probe, { count: 0, sum: 0, sumSq: 0, slow: 0, fast: 0, last: 0 });
}

/**
 * Une image de la partie (à appeler à chaque image où le jeu tourne vraiment : ni pause, ni menu).
 * `now` = horodatage de requestAnimationFrame. Sans effet hors AUTO.
 * @param {number} now
 */
export function sampleFrame(now) {
  if (!isAutoQuality()) return;
  const dt = probe.last ? now - probe.last : 0;
  probe.last = now;
  if (dt <= 0 || dt > AUTO_QUALITY.ignoreMs) return;
  probe.count++;
  probe.sum += dt;
  probe.sumSq += dt * dt;
  if (probe.count < AUTO_QUALITY.window) return;
  const avg = probe.sum / probe.count;
  const jitter = Math.sqrt(Math.max(0, probe.sumSq / probe.count - avg * avg));
  probe.count = probe.sum = probe.sumSq = 0;
  judgeWindow(avg, jitter, now);
}

/** Bilan d'une mesure : baisse, remonte ou garde le niveau. */
function judgeWindow(avg, jitter, now) {
  const C = AUTO_QUALITY;
  const capped = Math.abs(avg - C.capMs) < C.capTolerance && jitter < C.capJitter;
  if (avg > C.slowMs && !capped) {
    probe.fast = 0;
    if (++probe.slow < C.slowWindows) return;
    probe.slow = 0;
    // Remonté puis aussitôt trop lent : ce niveau ne tient pas, on ne remonte plus de la session
    if (now - probe.raisedAt < C.bounceMs) probe.noRaise = true;
    step(-1, `${Math.round(1000 / avg)} images/s`);
  } else if (avg < C.fastMs) {
    probe.slow = 0;
    if (probe.noRaise || ++probe.fast < C.fastWindows) return;
    probe.fast = 0;
    if (step(1, "fluide")) probe.raisedAt = now;
  } else probe.slow = probe.fast = 0;
}

/** Change le niveau AUTO d'un cran (retenu pour la prochaine session). Renvoie vrai s'il a changé. */
function step(dir, why) {
  const from = qualityLevel();
  const to = QUALITY_LEVELS[QUALITY_LEVELS.indexOf(from) + dir];
  if (!to) return false;
  updateSettings({ autoLevel: to });
  for (const fn of listeners) fn(to, from, why);
  return true;
}

/** Tests et diagnostic : état de la mesure. */
export function probeState() {
  return { ...probe, level: qualityLevel() };
}
