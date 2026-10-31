// Inventaire d'équipement : coffres, amélioration de niveau, prestige et équipement.
// Les données sont stockées dans le compte (services/storage.js).

import {
  CHEST_POOLS,
  CHESTS,
  DAILY_OFFER_PRICES,
  DEFAULT_EQUIPPED,
  FORGE,
  FREE_CHEST,
  ITEMS,
  MAXED_DUPLICATE_GOLD,
  MAX_PRESTIGE,
  PRESTIGE_COPIES,
  SLOTS,
  STARTER_ITEMS,
  levelUpCost,
  maxLevel,
} from "../data/items.js";
import { ADS } from "../config.js";
import { AFFIX_IDS, AFFIX_RULES, DISMANTLE, MYTHIC_AFFIXES } from "../data/pulseShards.js";
import { weightedPick } from "../utils/math.js";
import { addStat, recordBest } from "./achievements.js";
import { hash, seededRandom, todayKey } from "./daily.js";
import { account, saveAccount } from "./storage.js";

/** Garantit les objets de départ (et nettoie les objets inconnus d'anciennes sauvegardes). */
export function ensureStarterItems() {
  for (const id of Object.keys(account.items)) if (!ITEMS[id]) delete account.items[id];
  for (const id of STARTER_ITEMS) account.items[id] ??= { level: 1, prestige: 1, copies: 0 };
  migrateBoughtDrone();
  // Succès de prestige : tient compte des objets déjà améliorés avant leur ajout
  recordBest("maxPrestige", Math.max(1, ...Object.values(account.items).map((o) => o.prestige || 1)));
  for (const slot of SLOTS) {
    const id = account.equipped[slot];
    if (id && (!account.items[id] || ITEMS[id].slot !== slot))
      account.equipped[slot] = DEFAULT_EQUIPPED[slot];
  }
}

/** L'ancien drone acheté en boutique devient le familier « Drone » au même niveau, équipé. */
function migrateBoughtDrone() {
  const level = account.petLevels?.drone || 0;
  if (level <= 0) return;
  const owned = (account.items.drone ??= { level: 1, prestige: 1, copies: 0 });
  owned.level = Math.max(owned.level, Math.min(level, maxLevel(owned.prestige)));
  account.equipped.pet ??= "drone";
  account.petLevels.drone = 0;
  saveAccount();
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
  return rollChest(chest);
}

/** Coffre offert (passe de saison) : même tirage qu'un coffre acheté, sans le payer. */
export function grantChest(chestId) {
  const chest = CHESTS.find((c) => c.id === chestId);
  return chest ? rollChest(chest) : null;
}

// --- COFFRE GRATUIT ---

const FREE_INTERVAL_MS = FREE_CHEST.intervalHours * 3600 * 1000;

/** Millisecondes restantes avant le prochain coffre gratuit (0 = disponible). */
export function freeChestRemainingMs(now = Date.now()) {
  // Si l'horloge a reculé, on ne bloque pas le joueur plus d'un intervalle.
  const last = Math.min(account.lastFreeChest, now);
  return Math.max(0, last + FREE_INTERVAL_MS - now);
}

export function isFreeChestReady() {
  return freeChestRemainingMs() === 0;
}

export function openFreeChest() {
  if (!isFreeChestReady()) return null;
  account.lastFreeChest = Date.now();
  return rollChest(CHESTS.find((c) => c.id === FREE_CHEST.chestId));
}

// --- COFFRE BONUS (contre une publicité) ---

/** Coffres bonus encore disponibles aujourd'hui. */
export function adChestsLeft(day = todayKey()) {
  const used = account.adChests.day === day ? account.adChests.count : 0;
  return Math.max(0, ADS.adChestsPerDay - used);
}

/** Ouvre un coffre bonus (à appeler une fois la pub regardée en entier). */
export function openAdChest() {
  const day = todayKey();
  if (adChestsLeft(day) === 0) return null;
  const used = account.adChests.day === day ? account.adChests.count : 0;
  account.adChests = { day, count: used + 1 };
  return rollChest(CHESTS.find((c) => c.id === FREE_CHEST.chestId));
}

function rollChest(chest) {
  const rarity = weightedPick(Object.keys(chest.odds), (r) => chest.odds[r]);
  const slots = CHEST_POOLS[chest.pool || "gear"];
  const inSlots = Object.values(ITEMS).filter((it) => slots.includes(it.slot));
  const ofRarity = inSlots.filter((it) => it.rarity === rarity);
  const pool = ofRarity.length > 0 ? ofRarity : inSlots; // sécurité si une rareté n'a aucun objet
  const item = pool[Math.floor(Math.random() * pool.length)];
  addStat("chests");
  return grantItem(item);
}

/** Donne un objet : nouveau, doublon (prestige) ou or s'il est déjà au prestige maximum. */
function grantItem(item) {
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

// --- FORGE ---

/** Objets possédés de cet emplacement et de cette rareté qui ont des doublons, les plus fournis d'abord. */
function forgeSources(slot, rarity) {
  return Object.values(ITEMS)
    .filter((it) => it.slot === slot && it.rarity === rarity && account.items[it.id]?.copies > 0)
    .sort((a, b) => account.items[b.id].copies - account.items[a.id].copies);
}

/**
 * Recettes de forge d'un emplacement : [{ rarity, next, copies (doublons disponibles), cost, ready }].
 * Seulement les raretés qui ont une rareté au-dessus dans cet emplacement.
 * @param {string} slot
 */
export function forgeOptions(slot) {
  return Object.entries(FORGE.next)
    .filter(([, next]) => Object.values(ITEMS).some((it) => it.slot === slot && it.rarity === next))
    .map(([rarity, next]) => {
      const copies = forgeSources(slot, rarity).reduce((n, it) => n + account.items[it.id].copies, 0);
      const cost = FORGE.cost[rarity];
      return { rarity, next, copies, cost, ready: copies >= FORGE.copies && account.gold >= cost };
    });
}

/**
 * Forge : retire `FORGE.copies` doublons (pris aux objets qui en ont le plus) et l'or, puis donne un
 * objet au hasard de la rareté au-dessus. Renvoie { item, result, refund } comme un coffre, ou null.
 * @param {string} slot
 * @param {string} rarity
 */
export function forge(slot, rarity) {
  const option = forgeOptions(slot).find((o) => o.rarity === rarity);
  if (!option?.ready) return null;
  account.gold -= option.cost;
  let left = FORGE.copies;
  for (const it of forgeSources(slot, rarity)) {
    const owned = account.items[it.id];
    const take = Math.min(left, owned.copies);
    owned.copies -= take;
    left -= take;
    if (left === 0) break;
  }
  const pool = Object.values(ITEMS).filter((it) => it.slot === slot && it.rarity === option.next);
  addStat("forges");
  return grantItem(pool[Math.floor(Math.random() * pool.length)]);
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
  recordBest("maxPrestige", o.prestige);
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

/** Retire l'objet d'un emplacement facultatif (armure, familier). */
export function unequip(slot) {
  if (DEFAULT_EQUIPPED[slot]) return false;
  account.equipped[slot] = null;
  saveAccount();
  return true;
}

// --- ÉQUIPEMENTS ENREGISTRÉS ---

/** Enregistre l'équipement actuel dans l'emplacement `i`. */
export function saveLoadout(i) {
  account.loadouts[i] = { ...account.equipped };
  saveAccount();
  return true;
}

/** Remet un équipement enregistré (un objet qui n'est plus valable reprend la valeur par défaut). */
export function loadLoadout(i) {
  const saved = account.loadouts[i];
  if (!saved) return false;
  for (const slot of SLOTS) {
    const id = saved[slot];
    account.equipped[slot] =
      id && account.items[id] && ITEMS[id]?.slot === slot ? id : DEFAULT_EQUIPPED[slot];
  }
  saveAccount();
  return true;
}

/** L'équipement actuel correspond-il à l'emplacement `i` ? */
export function isLoadoutActive(i) {
  const saved = account.loadouts[i];
  return !!saved && SLOTS.every((slot) => (saved[slot] ?? null) === (account.equipped[slot] ?? null));
}

// --- OFFRE DU JOUR ---

/** Objet en vente aujourd'hui (le même pour tous les joueurs), hors mythiques. */
export function dailyOffer(day = todayKey()) {
  const pool = Object.values(ITEMS).filter((it) => DAILY_OFFER_PRICES[it.rarity]);
  const rand = seededRandom(hash(`survivor-offer-${day}`));
  const item = pool[Math.floor(rand() * pool.length)];
  const bought = account.dailyOffer.day === day && account.dailyOffer.bought;
  return { day, item, price: DAILY_OFFER_PRICES[item.rarity], bought };
}

/** Achète l'offre du jour (une fois par jour). Même résultat qu'un coffre, ou null. */
export function buyDailyOffer() {
  const offer = dailyOffer();
  if (offer.bought || account.gold < offer.price) return null;
  account.gold -= offer.price;
  account.dailyOffer = { day: offer.day, bought: true };
  return grantItem(offer.item);
}

// --- RECYCLAGE MYTHIQUE : DÉMANTÈLEMENT ET ATTRIBUTS DE PULSE (data/pulseShards.js) ---

/** Objets dont un doublon peut être démantelé (légendaires avec doublons), les plus fournis d'abord. */
export function dismantleSources() {
  return Object.values(ITEMS)
    .filter((it) => it.rarity === DISMANTLE.rarity && account.items[it.id]?.copies > 0)
    .sort((a, b) => account.items[b.id].copies - account.items[a.id].copies);
}

/**
 * Démantèle `count` doublons d'un objet légendaire : + `DISMANTLE.shards` Éclats de Pulse chacun.
 * Renvoie les éclats gagnés (0 si impossible).
 * @param {string} id
 * @param {number} [count]
 */
export function dismantle(id, count = 1) {
  const owned = account.items[id];
  if (!owned || ITEMS[id]?.rarity !== DISMANTLE.rarity) return 0;
  const n = Math.min(Math.max(0, Math.floor(count)), owned.copies);
  if (n === 0) return 0;
  owned.copies -= n;
  const gained = n * DISMANTLE.shards;
  account.pulseShards += gained;
  addStat("dismantled", n);
  saveAccount();
  return gained;
}

/** Attributs de Pulse d'un objet possédé (toujours `AFFIX_RULES.slots` cases, null = vide), ou null. */
export function affixesOf(id) {
  const owned = account.items[id];
  if (!owned || ITEMS[id]?.rarity !== AFFIX_RULES.rarity) return null;
  const list = Array.isArray(owned.affixes) ? owned.affixes : [];
  return Array.from({ length: AFFIX_RULES.slots }, (_, i) => (MYTHIC_AFFIXES[list[i]] ? list[i] : null));
}

/** Pose l'attribut `affix` dans la case `slot` (jamais deux fois le même attribut sur un objet). */
function setAffix(id, slot, affix, cost) {
  const current = affixesOf(id);
  if (!current || slot < 0 || slot >= current.length || account.pulseShards < cost) return false;
  if (!MYTHIC_AFFIXES[affix] || current.some((a, i) => i !== slot && a === affix)) return false;
  current[slot] = affix;
  account.items[id].affixes = current;
  account.pulseShards -= cost;
  addStat("affixRolls");
  saveAccount();
  return true;
}

/**
 * Relance au hasard l'attribut d'une case (jamais celui qu'elle avait, ni celui de l'autre case).
 * Renvoie le nouvel attribut, ou null.
 * @param {string} id
 * @param {number} slot
 */
export function rerollAffix(id, slot) {
  const current = affixesOf(id);
  if (!current) return null;
  const pool = AFFIX_IDS.filter((a) => !current.includes(a));
  const affix = pool[Math.floor(Math.random() * pool.length)];
  return affix && setAffix(id, slot, affix, AFFIX_RULES.cost.reroll) ? affix : null;
}

/**
 * Cible un attribut choisi pour une case (plus cher qu'une relance).
 * @param {string} id
 * @param {number} slot
 * @param {string} affix
 */
export function targetAffix(id, slot, affix) {
  const current = affixesOf(id);
  if (!current || current[slot] === affix) return false;
  return setAffix(id, slot, affix, AFFIX_RULES.cost.target);
}
