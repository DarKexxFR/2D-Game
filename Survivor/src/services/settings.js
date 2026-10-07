// Préférences du joueur (menu Options), sauvegardées séparément de la progression.

import { STORAGE_KEYS } from "../config.js";

const isTouch = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

const DEFAULTS = {
  musicVolume: 0.3,
  sfxVolume: 0.6,
  vibration: true,
  quality: isTouch ? "medium" : "high", // low | medium | high
  keyBindings: null, // touches personnalisées { action: [touches] } (voir core/input.js), null = défaut
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
