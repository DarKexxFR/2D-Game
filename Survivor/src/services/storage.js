// Persistance locale (localStorage) : compte, pseudo et classement.

import { ACCOUNT_SCALING, LIMITS, STORAGE_KEYS, droneCost } from "../config.js";

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
  petLevels: { drone: 0 },
  // Équipement possédé : { [id]: { level, prestige, copies } }
  items: {},
  equipped: { weapon: "blaster", armor: null },
  lastFreeChest: 0, // horodatage (ms) du dernier coffre gratuit ouvert
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
  account.equipped = { weapon: "blaster", armor: null, ...saved.equipped };
  account.lastFreeChest = saved.lastFreeChest || 0;
}

export function saveAccount() {
  writeJSON(STORAGE_KEYS.save, account);
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

/** Achète ou améliore un familier. Renvoie true si l'achat a réussi. */
export function upgradePet(id) {
  const level = account.petLevels[id] || 0;
  const cost = droneCost(level);
  if (account.gold < cost) return false;
  account.gold -= cost;
  account.petLevels[id] = level + 1;
  saveAccount();
  return true;
}

export function resetProgress() {
  try {
    localStorage.removeItem(STORAGE_KEYS.save);
  } catch {}
}

// --- PSEUDO ---

export const DEFAULT_PSEUDO = "Survivor";

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
