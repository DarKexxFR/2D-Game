// Préférences du joueur (menu Options), sauvegardées séparément de la progression.

import { STORAGE_KEYS } from "../config.js";

const isTouch = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

const DEFAULTS = {
  musicVolume: 0.3,
  sfxVolume: 0.6,
  vibration: true,
  shotOpacity: 1, // opacité des tirs du joueur (Options), de SHOT_OPACITY.min à 1
  quality: "auto", // auto | low | medium | high (AUTO : suit l'appareil, voir core/quality.js)
  autoLevel: null, // niveau retenu par l'AUTO (low | medium | high), null = celui de l'appareil
  // Effets visuels (Options > Effets visuels, voir config.js VISUAL_FX) ; coupés en qualité basse
  fxGrid: true, // grille du sol qui se déforme
  fxBloom: !isTouch, // halo lumineux global (le plus coûteux : désactivé d'office sur téléphone)
  fxCrt: true, // vignette et lignes d'écran (CSS, sans coût)
  fxChroma: true, // aberration chromatique aux gros chocs
  keyBindings: null, // touches personnalisées { action: [touches] } (voir core/input.js), null = défaut
  gamepad: true, // manette prise en compte (Options)
  padVibration: true, // vibrations de la manette (Options)
};

export const settings = { ...DEFAULTS };

const listeners = [];
/** Appelé à chaque changement de réglage (et une fois au chargement). */
export function onSettingsChange(fn) {
  listeners.push(fn);
  fn(settings);
}

export function loadSettings() {
  try {
    Object.assign(settings, JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || "{}"));
  } catch {
    // Réglages illisibles : on garde les valeurs par défaut.
  }
}

export function updateSettings(changes) {
  Object.assign(settings, changes);
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  } catch {}
  for (const fn of listeners) fn(settings);
}

loadSettings();
