// Inventaire d'équipement : coffres, amélioration de niveau, prestige et équipement.
// Les données sont stockées dans le compte (services/storage.js).

import {
  CHESTS,
  ITEMS,
  MAXED_DUPLICATE_GOLD,
  MAX_PRESTIGE,
  PRESTIGE_COPIES,
  STARTER_ITEMS,
  levelUpCost,
  maxLevel,
} from "../data/items.js";
import { weightedPick } from "../utils/math.js";
import { account, saveAccount } from "./storage.js";

/** Garantit les objets de départ (et nettoie les objets inconnus d'anciennes sauvegardes). */
export function ensureStarterItems() {
  for (const id of Object.keys(account.items)) if (!ITEMS[id]) delete account.items[id];
  for (const id of STARTER_ITEMS) account.items[id] ??= { level: 1, prestige: 1, copies: 0 };
  for (const slot of ["weapon", "armor"]) {
    const id = account.equipped[slot];
    if (id && !account.items[id]) account.equipped[slot] = slot === "weapon" ? STARTER_ITEMS[0] : null;
  }
}

export function getOwned(id) {
  return account.items[id] || null;
}

export function getEquipped(slot) {
  const id = account.equipped[slot];
  return id && account.items[id] ? { id, ...account.items[id] } : null;
}

// --- COFFRES ---

/**
 * Ouvre un coffre. Renvoie { item, result } où result vaut :
 *  "new" (nouvel objet), "copy" (doublon stocké pour le prestige),
 *  "gold" (doublon d'un objet déjà ★max, converti en or), ou null si pas assez d'or.
 */
export function openChest(chestId) {
  const chest = CHESTS.find((c) => c.id === chestId);
  if (!chest || account.gold < chest.cost) return null;
  account.gold -= chest.cost;

  const rarity = weightedPick(Object.keys(chest.odds), (r) => chest.odds[r]);
  const pool = Object.values(ITEMS).filter((it) => it.rarity === rarity);
  const item = pool[Math.floor(Math.random() * pool.length)];

  let result;
  let refund = 0;
  const owned = account.items[item.id];
  if (!owned) {
    account.items[item.id] = { level: 1, prestige: 1, copies: 0 };
    result = "new";
  } else if (owned.prestige >= MAX_PRESTIGE) {
    refund = MAXED_DUPLICATE_GOLD[item.rarity];
    account.gold += refund;
    result = "gold";
  } else {
    owned.copies++;
    result = "copy";
  }
  saveAccount();
  return { item, result, refund };
}

// --- NIVEAU ---

export function canLevelUp(id) {
  const o = account.items[id];
  return !!o && o.level < maxLevel(o.prestige);
}

export function levelUpPrice(id) {
  const o = account.items[id];
  return o ? levelUpCost(ITEMS[id], o.level) : Infinity;
}

export function levelUp(id) {
  if (!canLevelUp(id)) return false;
  const cost = levelUpPrice(id);
  if (account.gold < cost) return false;
  account.gold -= cost;
  account.items[id].level++;
  saveAccount();
  return true;
}

// --- PRESTIGE ---

export function prestigeCopiesNeeded(id) {
  const o = account.items[id];
  return o && o.prestige < MAX_PRESTIGE ? PRESTIGE_COPIES[o.prestige] : Infinity;
}

export function canPrestige(id) {
  const o = account.items[id];
  return !!o && o.prestige < MAX_PRESTIGE && o.copies >= prestigeCopiesNeeded(id);
}

export function prestigeUp(id) {
  if (!canPrestige(id)) return false;
  const o = account.items[id];
  o.copies -= prestigeCopiesNeeded(id);
  o.prestige++;
  saveAccount();
  return true;
}

// --- ÉQUIPEMENT ---

export function equip(id) {
  const item = ITEMS[id];
  if (!item || !account.items[id]) return false;
  account.equipped[item.slot] = id;
  saveAccount();
  return true;
}

export function unequipArmor() {
  account.equipped.armor = null;
  saveAccount();
}
