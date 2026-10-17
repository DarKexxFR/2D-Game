// Passe de saison : une saison par mois, 30 paliers de récompenses gagnés avec l'XP de saison
// (parties, quêtes : voir services/season.js et SEASON dans config.js). Le passe est gratuit.
// Chaque saison a un thème (tirés à tour de rôle) et ses deux skins exclusifs : la traînée au palier
// `trailTier`, la forme de coque au dernier palier. Ces skins ne s'achètent pas (`season: true` dans
// data/skins.js) ; un joueur qui les possède déjà reçoit `SEASON.duplicateGold` or à la place.

/** @typedef {{ name: string, color: string, hull: string, trail: string }} SeasonTheme */

/** @type {SeasonTheme[]} */
export const SEASON_THEMES = [
  { name: "Néon", color: "#00ffff", hull: "nova", trail: "comet" },
  { name: "Brasier", color: "#ff7a1a", hull: "blaze", trail: "embers" },
  { name: "Néant", color: "#aa66ff", hull: "rift", trail: "hex" },
  { name: "Orage", color: "#ffee00", hull: "thunder", trail: "bolt" },
];

/**
 * Récompense d'un palier :
 *  { type: "gold", amount } · { type: "chest", chest } (identifiant de CHESTS, data/items.js)
 *  · { type: "skin", part: "hull" | "trail" } (le skin du thème de la saison).
 * @typedef {{ type: "gold", amount: number } | { type: "chest", chest: string } | { type: "skin", part: "hull" | "trail" }} SeasonReward
 */

/** Paliers spéciaux (les autres donnent de l'or, de plus en plus). @type {Record<number, SeasonReward>} */
const SPECIAL_TIERS = {
  3: { type: "chest", chest: "basic" },
  6: { type: "chest", chest: "pet" },
  9: { type: "chest", chest: "module" },
  10: { type: "skin", part: "trail" },
  13: { type: "chest", chest: "premium" },
  16: { type: "chest", chest: "hero" },
  19: { type: "chest", chest: "premium" },
  22: { type: "chest", chest: "legendary" },
  25: { type: "gold", amount: 2500 },
  27: { type: "chest", chest: "legendary" },
  29: { type: "chest", chest: "mythic" },
  30: { type: "skin", part: "hull" },
};

export const TRAIL_TIER = 10;
export const HULL_TIER = 30;

/** Récompense du palier `tier` (1 à 30). @returns {SeasonReward} */
export function tierReward(tier) {
  return SPECIAL_TIERS[tier] || { type: "gold", amount: 100 + Math.floor(tier / 5) * 50 };
}
