// Défi quotidien : chaque jour (UTC), tout le monde joue avec le même héros, la même arme,
// le même modificateur et la même graine aléatoire. Classement mondial du jour séparé.

import { STORAGE_KEYS } from "../config.js";
import { HEROES, WEAPONS } from "../data/items.js";

export const DAILY_MODIFIERS = [
  { id: "swift", name: "Ennemis rapides", desc: "Les ennemis vont 25 % plus vite.", enemySpeed: 1.25 },
  {
    id: "glass",
    name: "Canon de verre",
    desc: "−40 % de PV, mais +50 % d'attaque.",
    playerHealth: 0.6,
    playerAttack: 1.5,
  },
  { id: "elite", name: "Élite", desc: "Ennemis +50 % de PV, +50 % d'XP.", enemyHealth: 1.5, enemyXp: 1.5 },
  {
    id: "goldRush",
    name: "Ruée vers l'or",
    desc: "Or ×2, mais pas de boîte mystère.",
    goldMult: 2,
    noMysteryBox: true,
  },
];

/** Jour courant au format AAAA-MM-JJ (UTC : le même pour tous les joueurs). */
export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** Hachage FNV-1a 32 bits d'une chaîne. */
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Générateur pseudo-aléatoire déterministe (même graine → même suite). */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailyChallenge(day = todayKey()) {
  const seed = hash(`survivor-daily-${day}`);
  const rand = seededRandom(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  return {
    day,
    seed,
    hero: pick(Object.keys(HEROES)),
    weapon: pick(Object.keys(WEAPONS)),
    modifier: pick(DAILY_MODIFIERS),
  };
}

// --- Graine pendant la partie : Math.random est remplacé le temps du défi ---

const nativeRandom = Math.random;

export function useSeed(seed) {
  Math.random = seededRandom(seed);
}

export function restoreRandom() {
  Math.random = nativeRandom;
}

// --- Meilleur score local du jour ---

export function getDailyBest(day = todayKey()) {
  try {
    const best = JSON.parse(localStorage.getItem(STORAGE_KEYS.dailyBest));
    return best?.day === day ? best : null;
  } catch {
    return null;
  }
}

/** Enregistre le score s'il bat le meilleur du jour. Renvoie true si c'est un record. */
export function saveDailyBest(day, wave, xp) {
  const best = getDailyBest(day);
  if (best && best.xp >= xp) return false;
  try {
    localStorage.setItem(STORAGE_KEYS.dailyBest, JSON.stringify({ day, wave, xp: Math.floor(xp) }));
  } catch {}
  return true;
}
