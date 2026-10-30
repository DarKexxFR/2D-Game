// Rangs du duel classé : paliers d'ELO (voir services/duelRanking.js). Départ à 1000 = Bronze.
// `min` = ELO à atteindre (le premier palier commence à 0), `icon` = emblème de data/icons.js.

/**
 * @typedef {{ id: string, name: string, min: number, color: string, icon: string }} DuelRank
 * @type {DuelRank[]}
 */
export const DUEL_RANKS = [
  { id: "bronze", name: "Bronze", min: 0, color: "#e08a4a", icon: "rankBronze" },
  { id: "silver", name: "Argent", min: 1100, color: "#c8d6e5", icon: "rankSilver" },
  { id: "gold", name: "Or", min: 1250, color: "#ffd700", icon: "rankGold" },
  { id: "diamond", name: "Diamant", min: 1450, color: "#00ffff", icon: "rankDiamond" },
  { id: "predator", name: "Prédateur", min: 1700, color: "#ff2a6d", icon: "rankPredator" },
];
