// Persistance locale (localStorage) : compte, pseudo et classement.

import { ACCOUNT_SCALING, LIMITS, STORAGE_KEYS } from "../config.js";
import { DEFAULT_EQUIPPED } from "../data/items.js";

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage indisponible (navigation privée...) : on continue sans sauvegarder.
  }
}

// --- COMPTE ---

export const account = {
  level: 1,
  currentXp: 0,
  nextLevelXp: ACCOUNT_SCALING.baseXpToLevel,
  gold: 0,
  petLevels: { drone: 0 }, // ancien drone acheté en boutique (converti en familier au chargement)
  // Équipement possédé : { [id]: { level, prestige, copies } }
  items: {},
  equipped: { ...DEFAULT_EQUIPPED },
  lastFreeChest: 0, // horodatage (ms) du dernier coffre gratuit ouvert
  talents: {}, // rang de chaque talent : { [id]: rang }
  achievements: [],
  achievementStats: { kills: 0, bosses: 0, runs: 0, bestWave: 1, bestLevel: 1 },
};

export function loadAccount() {
  const saved = readJSON(STORAGE_KEYS.save, null);
  if (!saved) return;
  account.level = saved.level || 1;
  account.currentXp = saved.currentXp || 0;
  account.nextLevelXp = saved.nextLevelXp || ACCOUNT_SCALING.baseXpToLevel;
  account.gold = saved.gold || 0;
  account.petLevels = { drone: 0, ...saved.petLevels };
  account.items = saved.items || {};
  account.equipped = { ...DEFAULT_EQUIPPED, ...saved.equipped };
  account.lastFreeChest = saved.lastFreeChest || 0;
  account.talents = { ...saved.talents };
  account.achievements = Array.isArray(saved.achievements) ? saved.achievements : [];
  account.achievementStats = {
    kills: 0,
    bosses: 0,
    runs: 0,
    bestWave: 1,
    bestLevel: 1,
    ...saved.achievementStats,
  };
}

const saveListeners = [];

/** Appelé après chaque sauvegarde locale (utilisé par la sauvegarde en ligne). */
export function onAccountSave(fn) {
  saveListeners.push(fn);
}

export function saveAccount() {
  writeJSON(STORAGE_KEYS.save, account);
  for (const fn of saveListeners) fn();
}

/** Remplace la sauvegarde locale par une sauvegarde récupérée (prise en compte au rechargement). */
export function overwriteLocalSave(save, pseudo) {
  writeJSON(STORAGE_KEYS.save, save);
  if (pseudo) savePseudo(pseudo);
}

export function addAccountRewards(xp, gold) {
  account.gold += gold;
  account.currentXp += xp;
  while (account.currentXp >= account.nextLevelXp) {
    account.currentXp -= account.nextLevelXp;
    account.level++;
    account.nextLevelXp = Math.floor(account.nextLevelXp * ACCOUNT_SCALING.xpGrowth);
  }
  saveAccount();
}

export function resetProgress() {
  try {
    localStorage.removeItem(STORAGE_KEYS.save);
  } catch {}
}

// --- PSEUDO ---

export const DEFAULT_PSEUDO = "Joueur";

export function loadPseudo() {
  try {
    return localStorage.getItem(STORAGE_KEYS.pseudo) || DEFAULT_PSEUDO;
  } catch {
    return DEFAULT_PSEUDO;
  }
}

export function savePseudo(pseudo) {
  try {
    localStorage.setItem(STORAGE_KEYS.pseudo, pseudo);
  } catch {}
}

// --- CLASSEMENT ---

export function getLeaderboard() {
  return readJSON(STORAGE_KEYS.leaderboard, []);
}

/** Enregistre un score et renvoie true s'il entre dans le top. */
export function saveToLeaderboard(name, wave, xp, lvl) {
  const entry = { name, wave, xp, lvl, date: Date.now() };
  const lb = [...getLeaderboard(), entry].sort((a, b) => b.xp - a.xp).slice(0, LIMITS.leaderboard);
  writeJSON(STORAGE_KEYS.leaderboard, lb);
  return lb.includes(entry);
}

/** Achète le rang suivant d'un talent. Renvoie true si l'achat a réussi. */
export function buyTalent(talent, cost) {
  const rank = account.talents[talent.id] || 0;
  if (rank >= talent.max || account.gold < cost) return false;
  account.gold -= cost;
  account.talents[talent.id] = rank + 1;
  saveAccount();
  return true;
}
