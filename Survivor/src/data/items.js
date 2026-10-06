// Catalogue de l'équipement (armes, armures), des coffres et règles de progression.
//
// Chaque objet possédé a un NIVEAU (amélioré avec de l'or) et un PRESTIGE ★
// (augmenté en consommant des doublons). Le prestige débloque des niveaux
// supplémentaires, multiplie la puissance et rend l'objet plus imposant à l'écran.

export const SLOTS = ["weapon", "armor"];

export const MAX_PRESTIGE = 5;
const MAX_ARMOR_SPEED = 0.3; // bonus de vitesse plafonné à +30 %
export const LEVELS_PER_PRESTIGE = 10; // ★1 → niveau 10 max, ★5 → niveau 50 max
export const LEVEL_BONUS = 0.02; // +2 % par niveau
export const PRESTIGE_BONUS = 0.15; // +15 % par étoile (max ★5 niv. 50 ≈ ×3,2)
/** Doublons nécessaires pour passer de ★n à ★n+1 (index = prestige actuel). */
export const PRESTIGE_COPIES = [0, 1, 2, 3, 5];

const RARITY_COST = { common: 1, rare: 2, epic: 4, legendary: 8 };
export const levelUpCost = (item, level) => Math.floor(40 * level * RARITY_COST[item.rarity]);
export const maxLevel = (prestige) => prestige * LEVELS_PER_PRESTIGE;
export const powerMult = (level, prestige) =>
  (1 + (level - 1) * LEVEL_BONUS) * (1 + (prestige - 1) * PRESTIGE_BONUS);
/** Or rendu si on obtient un doublon d'un objet déjà au prestige maximum. */
export const MAXED_DUPLICATE_GOLD = { common: 50, rare: 120, epic: 300, legendary: 800 };

// --- ARMES : elles remplacent le tir de base ---
// damage / cooldown sont des multiplicateurs de l'attaque et de la cadence du joueur.
export const WEAPONS = {
  blaster: {
    name: "Blaster",
    icon: "🔫",
    rarity: "common",
    desc: "Tir simple et fiable.",
    damage: 1,
    cooldown: 1,
    projectiles: 1,
    spread: 0,
    speed: 10,
    size: 5,
    pierce: 0,
    color: "#ffff00",
  },
  smg: {
    name: "Mitrailleur",
    icon: "🔥",
    rarity: "rare",
    desc: "Cadence infernale, balles légères et imprécises.",
    damage: 0.45,
    cooldown: 0.35,
    projectiles: 1,
    spread: 0,
    inaccuracy: 0.15,
    speed: 12,
    size: 4,
    pierce: 0,
    color: "#ffaa00",
  },
  shotgun: {
    name: "Fusil à pompe",
    icon: "💥",
    rarity: "rare",
    desc: "Une gerbe de plombs à courte portée.",
    damage: 0.6,
    cooldown: 1.6,
    projectiles: 5,
    spread: 0.16,
    speed: 11,
    size: 5,
    pierce: 0,
    range: 32, // durée de vie en ticks
    color: "#ff6600",
  },
  railgun: {
    name: "Railgun",
    icon: "⚡",
    rarity: "epic",
    desc: "Lent mais transperce tout sur son passage.",
    damage: 3,
    cooldown: 2,
    projectiles: 1,
    spread: 0,
    speed: 22,
    size: 4,
    pierce: 5,
    color: "#00ffff",
  },
  rocket: {
    name: "Lance-roquettes",
    icon: "🚀",
    rarity: "epic",
    desc: "Roquettes explosives qui touchent une zone.",
    damage: 2,
    cooldown: 1.8,
    projectiles: 1,
    spread: 0,
    speed: 7,
    size: 8,
    pierce: 0,
    explosion: 80,
    color: "#ff3300",
  },
  plasma: {
    name: "Canon plasma",
    icon: "🌀",
    rarity: "legendary",
    desc: "Orbes de plasma perçants qui explosent à l'impact.",
    damage: 1.4,
    cooldown: 0.6,
    projectiles: 1,
    spread: 0,
    speed: 12,
    size: 9,
    pierce: 2,
    explosion: 45,
    color: "#ff00ff",
  },
};

// --- ARMURES : bonus de statistiques ---
export const ARMORS = {
  vest: {
    name: "Gilet tactique",
    icon: "🦺",
    rarity: "common",
    desc: "Protection de base.",
    stats: { health: 30, defense: 1 },
    color: "#88aa88",
  },
  suit: {
    name: "Combinaison légère",
    icon: "🥋",
    rarity: "rare",
    desc: "Légère et souple : on court plus vite.",
    stats: { health: 20, speed: 0.08 },
    color: "#00ccff",
  },
  plated: {
    name: "Armure renforcée",
    icon: "🛡️",
    rarity: "rare",
    desc: "Plaques d'acier : encaisse mieux les coups.",
    stats: { health: 40, defense: 3 },
    color: "#aaaaaa",
  },
  heavy: {
    name: "Cuirasse lourde",
    icon: "🏰",
    rarity: "epic",
    desc: "Énorme résistance, mais ralentit.",
    stats: { health: 100, defense: 6, speed: -0.05 },
    color: "#cc8833",
  },
  cloak: {
    name: "Cape spectrale",
    icon: "👻",
    rarity: "epic",
    desc: "Vitesse et dash rechargé plus vite.",
    stats: { health: 40, speed: 0.12, dashCooldown: 0.25 },
    color: "#aa66ff",
  },
  exo: {
    name: "Exosquelette",
    icon: "🤖",
    rarity: "legendary",
    desc: "Technologie ultime : tout est amélioré.",
    stats: { health: 120, defense: 8, speed: 0.1, regen: 2 },
    color: "#ffd700",
  },
};

export const ITEMS = {
  ...Object.fromEntries(Object.entries(WEAPONS).map(([id, w]) => [id, { ...w, id, slot: "weapon" }])),
  ...Object.fromEntries(Object.entries(ARMORS).map(([id, a]) => [id, { ...a, id, slot: "armor" }])),
};

export const STARTER_ITEMS = ["blaster"];

// --- COFFRES ---
export const CHESTS = [
  { id: "basic", name: "Coffre basique", icon: "📦", cost: 250, odds: { common: 70, rare: 25, epic: 5 } },
  {
    id: "premium",
    name: "Coffre premium",
    icon: "🎁",
    cost: 1000,
    odds: { common: 30, rare: 45, epic: 20, legendary: 5 },
  },
  {
    id: "legendary",
    name: "Coffre légendaire",
    icon: "👑",
    cost: 3000,
    odds: { rare: 40, epic: 45, legendary: 15 },
  },
];

/** Statistiques effectives d'une arme selon son niveau et son prestige. */
export function weaponStats(id, level, prestige) {
  const w = WEAPONS[id];
  const mult = powerMult(level, prestige);
  return {
    ...w,
    id,
    level,
    prestige,
    damage: w.damage * mult,
    // Le prestige rend les projectiles plus gros et plus visibles
    size: w.size * (1 + (prestige - 1) * 0.15),
  };
}

/** Bonus effectifs d'une armure (les malus ne grandissent pas avec la puissance). */
export function armorStats(id, level, prestige) {
  const a = ARMORS[id];
  const mult = powerMult(level, prestige);
  const stats = {};
  for (const [k, v] of Object.entries(a.stats)) stats[k] = v > 0 ? v * mult : v;
  if (stats.dashCooldown) stats.dashCooldown = Math.min(0.6, stats.dashCooldown);
  if (stats.speed) stats.speed = Math.min(MAX_ARMOR_SPEED, stats.speed);
  return { ...a, id, level, prestige, stats };
}
