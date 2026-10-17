// Saison mensuelle et passe gratuit : une saison par mois UTC (la même pour tout le monde, comme son
// classement), 30 paliers de récompenses (data/season.js) gagnés avec l'XP de saison : parties terminées
// et quêtes hebdomadaires. L'état vit dans `account.season`, donc il suit le compte en ligne.
//
// Changement de mois : les récompenses atteintes mais pas encore récupérées sont données d'office
// (`rolledOver`, annoncé par l'accueil), puis le passe repart de zéro avec le thème de la nouvelle saison.

import { DIFFICULTIES, SEASON } from "../config.js";
import { emit, on } from "../core/events.js";
import { SEASON_THEMES, tierReward } from "../data/season.js";
import { grantChest } from "./inventory.js";
import { grantSkin } from "./skins.js";
import { todayKey } from "./daily.js";
import { account, saveAccount } from "./storage.js";

/**
 * @typedef {object} SeasonState
 * @property {string} id mois de la saison (AAAA-MM, UTC)
 * @property {number} xp XP de saison gagnée
 * @property {number[]} claimed paliers dont la récompense est récupérée
 * @property {string} firstRunDay dernier jour (UTC) où le bonus de première partie a été donné
 */

const pad = (n) => String(n).padStart(2, "0");

/** Saison (mois UTC) d'une date. */
export function seasonKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

/** Numéro de saison : 1 pour `SEASON.firstMonth`, puis +1 par mois. */
export function seasonNumber(key) {
  const [y, m] = key.split("-").map(Number);
  const [y0, m0] = SEASON.firstMonth.split("-").map(Number);
  return Math.max(1, (y - y0) * 12 + (m - m0) + 1);
}

export function seasonTheme(key) {
  return SEASON_THEMES[(seasonNumber(key) - 1) % SEASON_THEMES.length];
}

/** Millisecondes avant la fin de la saison (1er du mois suivant, 0 h UTC). */
export function seasonTimeLeft(now = new Date()) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - now.getTime();
}

const tierOf = (xp) => Math.min(SEASON.tiers, Math.floor(xp / SEASON.tierXp));

/** Récompenses données d'office au changement de saison (pour l'annonce à l'accueil). */
let rolledOver = null;

/** @returns {SeasonState} */
function state() {
  const key = seasonKey();
  const s = account.season;
  const valid = typeof s?.id === "string" && Array.isArray(s.claimed);
  // Même saison, ou horloge de l'appareil en retard sur la saison enregistrée : on ne perd rien
  if (valid && s.id >= key) return s;
  if (valid) {
    const granted = claimReached(s);
    if (granted.length > 0) rolledOver = { number: seasonNumber(s.id), rewards: granted };
  }
  account.season = { id: key, xp: 0, claimed: [], firstRunDay: "" };
  saveAccount();
  return account.season;
}

/** Récompenses de l'ancienne saison données au changement de mois (une seule fois), sinon null. */
export function takeRolledOver() {
  state();
  const out = rolledOver;
  rolledOver = null;
  return out;
}

// --- RÉCOMPENSES ---

/**
 * Donne la récompense d'un palier. Renvoie ce qui a été obtenu, pour l'affichage :
 * { tier, type, amount?, chest?, item?, result?, skin? }.
 */
function grant(s, tier) {
  const reward = tierReward(tier);
  s.claimed.push(tier);
  if (reward.type === "gold") {
    account.gold += reward.amount;
    return { tier, type: "gold", amount: reward.amount };
  }
  if (reward.type === "chest") {
    const outcome = grantChest(reward.chest);
    return { tier, type: "chest", chest: reward.chest, item: outcome?.item, result: outcome?.result };
  }
  const value = seasonTheme(s.id)[reward.part];
  if (grantSkin(`${reward.part}:${value}`)) return { tier, type: "skin", part: reward.part, skin: value };
  account.gold += SEASON.duplicateGold; // déjà possédé (thème revenu) : de l'or à la place
  return { tier, type: "gold", amount: SEASON.duplicateGold, duplicate: value };
}

/** Récupère tous les paliers atteints et pas encore récupérés d'une saison. */
function claimReached(s) {
  const granted = [];
  for (let tier = 1; tier <= tierOf(s.xp); tier++)
    if (!s.claimed.includes(tier)) granted.push(grant(s, tier));
  if (granted.length > 0) saveAccount();
  return granted;
}

/** Récupère la récompense d'un palier atteint. Renvoie ce qui a été obtenu, ou null. */
export function claimTier(tier) {
  const s = state();
  if (tier < 1 || tier > tierOf(s.xp) || s.claimed.includes(tier)) return null;
  const out = grant(s, tier);
  saveAccount();
  return out;
}

/** « TOUT RÉCUPÉRER » : chaque palier atteint pas encore récupéré. */
export function claimAllTiers() {
  return claimReached(state());
}

export function claimableTiers() {
  const s = state();
  return tierOf(s.xp) - s.claimed.filter((t) => t <= tierOf(s.xp)).length;
}

// --- XP DE SAISON ---

/** Ajoute de l'XP de saison ; annonce chaque nouveau palier atteint. */
export function addSeasonXp(amount) {
  const xp = Math.max(0, Math.floor(amount));
  if (xp === 0) return 0;
  const s = state();
  const before = tierOf(s.xp);
  s.xp = Math.min(s.xp + xp, SEASON.tiers * SEASON.tierXp);
  const after = tierOf(s.xp);
  saveAccount();
  for (let tier = before + 1; tier <= after; tier++) emit("seasonTier", tier);
  return xp;
}

/**
 * XP de saison d'une partie terminée (survie, défi du jour, Boss Rush, duel), plus le bonus de la
 * première partie du jour. Renvoie { xp, firstOfDay }.
 */
export function addRunSeasonXp({ wave, bosses, kills, difficulty = "normal", pulse = 0 }) {
  const r = SEASON.run;
  const mult = DIFFICULTIES[difficulty]?.rewards ?? 1;
  const base = Math.min(r.max, wave * r.perWave + bosses * r.perBoss + kills * r.perKill) * mult;
  let xp = base + pulse * r.perPulse;
  const s = state();
  const day = todayKey();
  const firstOfDay = s.firstRunDay !== day;
  if (firstOfDay) {
    s.firstRunDay = day;
    xp += SEASON.firstRunOfDay;
  }
  return { xp: addSeasonXp(xp), firstOfDay };
}

on("questClaimed", ({ allDone }) => addSeasonXp(SEASON.perQuest + (allDone ? SEASON.questBonus : 0)));

// --- ÉTAT POUR L'ÉCRAN DU PASSE ---

export function getSeason() {
  const s = state();
  const tier = tierOf(s.xp);
  const maxed = tier >= SEASON.tiers;
  const theme = seasonTheme(s.id);
  return {
    id: s.id,
    number: seasonNumber(s.id),
    theme,
    xp: s.xp,
    tier,
    maxed,
    xpInTier: maxed ? SEASON.tierXp : s.xp - tier * SEASON.tierXp,
    tierXp: SEASON.tierXp,
    timeLeft: seasonTimeLeft(),
    claimable: claimableTiers(),
    tiers: Array.from({ length: SEASON.tiers }, (_, i) => ({
      tier: i + 1,
      reward: tierReward(i + 1),
      reached: i + 1 <= tier,
      claimed: s.claimed.includes(i + 1),
    })),
  };
}
