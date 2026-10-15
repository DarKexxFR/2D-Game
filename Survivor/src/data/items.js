// Catalogue de l'équipement (armes, armures), des coffres et règles de progression.
//
// Chaque objet possédé a un NIVEAU (amélioré avec de l'or) et un PRESTIGE ★
// (augmenté en consommant des doublons). Le prestige débloque des niveaux
// supplémentaires, multiplie la puissance et rend l'objet plus imposant à l'écran.

export const SLOTS = ["weapon", "armor", "hero", "pet"];
/** Emplacement toujours occupé → objet par défaut (les autres peuvent rester vides). */
export const DEFAULT_EQUIPPED = { weapon: "blaster", armor: null, hero: "pilot", pet: null };

export const MAX_PRESTIGE = 5;
const MAX_SPEED_BONUS = 0.3; // bonus de vitesse plafonné à +30 %
export const LEVELS_PER_PRESTIGE = 10; // ★1 → niveau 10 max, ★5 → niveau 50 max
export const LEVEL_BONUS = 0.02; // +2 % par niveau
export const PRESTIGE_BONUS = 0.15; // +15 % par étoile (max ★5 niv. 50 ≈ ×3,2)
/** Doublons nécessaires pour passer de ★n à ★n+1 (index = prestige actuel). */
export const PRESTIGE_COPIES = [0, 1, 2, 3, 5];

const RARITY_COST = { common: 1, rare: 2, epic: 4, legendary: 8, mythic: 16 };
export const levelUpCost = (item, level) => Math.floor(40 * level * RARITY_COST[item.rarity]);
export const maxLevel = (prestige) => prestige * LEVELS_PER_PRESTIGE;
export const powerMult = (level, prestige) =>
  (1 + (level - 1) * LEVEL_BONUS) * (1 + (prestige - 1) * PRESTIGE_BONUS);
/** Or rendu si on obtient un doublon d'un objet déjà au prestige maximum. */
export const MAXED_DUPLICATE_GOLD = { common: 50, rare: 120, epic: 300, legendary: 800, mythic: 2000 };

// --- ARMES : elles remplacent le tir de base ---
// damage / cooldown sont des multiplicateurs de l'attaque et de la cadence du joueur.
export const WEAPONS = {
  blaster: {
    name: "Blaster",
    icon: "blaster",
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
    icon: "smg",
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
    icon: "shotgun",
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
    icon: "railgun",
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
    icon: "rocket",
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
    icon: "plasma",
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
  flamer: {
    name: "Lance-flammes",
    icon: "flamer",
    rarity: "rare",
    desc: "Un torrent de flammes à courte portée qui traverse les ennemis.",
    damage: 0.3,
    cooldown: 0.2,
    projectiles: 2,
    spread: 0.14,
    inaccuracy: 0.35,
    speed: 8,
    size: 6,
    pierce: 2,
    range: 24,
    color: "#ff7a1a",
  },
  disc: {
    name: "Disque laser",
    icon: "disc",
    rarity: "epic",
    desc: "Un disque tranchant qui revient vers vous en touchant tout sur son passage.",
    damage: 1.5,
    cooldown: 1.4,
    projectiles: 1,
    spread: 0,
    speed: 11,
    size: 10,
    pierce: 99,
    returns: 30, // ticks avant le retour
    lifetime: 180, // ticks (3 s) avant de disparaître
    fade: 30, // ticks de fondu à la fin de sa vie
    color: "#00ff88",
  },
  tesla: {
    name: "Arc Tesla",
    icon: "tesla",
    rarity: "legendary",
    desc: "Éclairs qui rebondissent d'ennemi en ennemi.",
    damage: 1.1,
    cooldown: 0.75,
    projectiles: 1,
    spread: 0,
    speed: 15,
    size: 5,
    pierce: 0,
    chain: 4, // rebonds
    color: "#66ccff",
  },
  blades: {
    name: "Couronne de lames",
    icon: "blades",
    rarity: "epic",
    desc: "Six lames lancées tout autour de vous qui traversent les ennemis.",
    damage: 0.7,
    cooldown: 1.5,
    projectiles: 6,
    ring: true, // projectiles répartis sur 360°
    speed: 9,
    size: 7,
    pierce: 2,
    range: 40,
    color: "#ff8844",
  },
  nova: {
    name: "Lance-étoiles",
    icon: "star",
    rarity: "mythic",
    desc: "Trois étoiles perçantes qui explosent et foudroient les ennemis voisins.",
    damage: 1.5,
    cooldown: 0.7,
    projectiles: 3,
    spread: 0.18,
    speed: 13,
    size: 8,
    pierce: 3,
    explosion: 55,
    chain: 2,
    color: "#ff3b30",
  },
};

// --- ARMURES : bonus de statistiques ---
export const ARMORS = {
  vest: {
    name: "Gilet tactique",
    icon: "vest",
    rarity: "common",
    desc: "Protection de base.",
    stats: { health: 30, defense: 1 },
    color: "#88aa88",
  },
  suit: {
    name: "Combinaison légère",
    icon: "feather",
    rarity: "rare",
    desc: "Légère et souple : on court plus vite.",
    stats: { health: 20, speed: 0.08 },
    color: "#00ccff",
  },
  plated: {
    name: "Armure renforcée",
    icon: "shield",
    rarity: "rare",
    desc: "Plaques d'acier : encaisse mieux les coups.",
    stats: { health: 40, defense: 3 },
    color: "#aaaaaa",
  },
  heavy: {
    name: "Cuirasse lourde",
    icon: "helmet",
    rarity: "epic",
    desc: "Énorme résistance, mais ralentit.",
    stats: { health: 100, defense: 6, speed: -0.05 },
    color: "#cc8833",
  },
  cloak: {
    name: "Cape spectrale",
    icon: "ghost",
    rarity: "epic",
    desc: "Vitesse et dash rechargé plus vite.",
    stats: { health: 40, speed: 0.12, dashCooldown: 0.25 },
    color: "#aa66ff",
  },
  exo: {
    name: "Exosquelette",
    icon: "robot",
    rarity: "legendary",
    desc: "Technologie ultime : tout est amélioré.",
    stats: { health: 120, defense: 8, speed: 0.1, regen: 2 },
    color: "#ffd700",
  },
  magcoat: {
    name: "Manteau aimanté",
    icon: "magnet",
    rarity: "common",
    desc: "Attire les gemmes de plus loin.",
    stats: { health: 15, magnet: 60 },
    color: "#ffee55",
  },
  spiked: {
    name: "Carapace à épines",
    icon: "thorns",
    rarity: "epic",
    desc: "Renvoie une partie des coups au corps-à-corps.",
    stats: { health: 50, defense: 3, thorns: 0.6 },
    color: "#ff5577",
  },
  quantum: {
    name: "Noyau quantique",
    icon: "atom",
    rarity: "legendary",
    desc: "Régénération, coups critiques et vitesse.",
    stats: { health: 90, crit: 0.1, regen: 2.5, speed: 0.08 },
    color: "#00ffcc",
  },
  looter: {
    name: "Sac de pillard",
    icon: "backpack",
    rarity: "rare",
    desc: "Plus d'or à chaque élimination et des gemmes attirées de plus loin.",
    stats: { health: 25, magnet: 40, gold: 0.2 },
    color: "#ffcc33",
  },
  aegis: {
    name: "Égide céleste",
    icon: "aegis",
    rarity: "mythic",
    desc: "Armure des étoiles : énorme protection, régénération, vitesse et coups critiques.",
    stats: { health: 170, defense: 10, speed: 0.12, regen: 3, crit: 0.08 },
    color: "#ff3b30",
  },
};

// --- HÉROS : personnage jouable (forme et couleur du vaisseau + bonus) ---
// `stats` suit les mêmes règles que les armures ; `startUpgrades` sont données au départ.
export const HEROES = {
  pilot: {
    name: "Pilote",
    icon: "ship",
    rarity: "common",
    desc: "Équilibré, sans point faible.",
    stats: {},
    hull: "arrow",
    skill: "shockwave",
    color: "#00ccff",
  },
  ninja: {
    name: "Ninja",
    icon: "shuriken",
    rarity: "rare",
    desc: "Très rapide, dash rechargé bien plus vite. Commence avec le Kunai.",
    stats: { speed: 0.15, dashCooldown: 0.4, health: -20 },
    startUpgrades: ["Kunai"],
    hull: "dart",
    skill: "shadowClones",
    color: "#ff55cc",
  },
  titan: {
    name: "Titan",
    icon: "titan",
    rarity: "rare",
    desc: "Colosse blindé : énormément de PV et de défense, mais lent.",
    stats: { health: 120, defense: 4, speed: -0.12 },
    size: 26,
    hull: "heavy",
    skill: "earthquake",
    color: "#ffaa00",
  },
  mage: {
    name: "Mage",
    icon: "mage",
    rarity: "epic",
    desc: "Commence avec une Aura de Feu renforcée.",
    stats: { auraDamage: 4 },
    startUpgrades: ["Aura de Feu"],
    hull: "orb",
    skill: "meteorRain",
    color: "#aa66ff",
  },
  pirate: {
    name: "Pirate",
    icon: "anchor",
    rarity: "legendary",
    desc: "Pille tout : +50 % d'or et +10 % de coups critiques.",
    stats: { gold: 0.5, crit: 0.1 },
    hull: "corsair",
    skill: "cannon",
    color: "#ffd700",
  },
  engineer: {
    name: "Ingénieur",
    icon: "wrench",
    rarity: "epic",
    desc: "Robuste, commence avec un Orbe Protecteur. Déploie des tourelles.",
    stats: { health: 30, defense: 2 },
    startUpgrades: ["Orbe Protecteur"],
    hull: "engineer",
    skill: "turrets",
    color: "#00ff88",
  },
  spectre: {
    name: "Spectre",
    icon: "spectre",
    rarity: "legendary",
    desc: "Rapide et critique, vole la vie. Aspire les ennemis dans le vide.",
    stats: { speed: 0.1, crit: 0.08 },
    startUpgrades: ["Vampirisme"],
    hull: "spectre",
    skill: "voidNova",
    color: "#8a6cff",
  },
};

// --- FAMILIERS : compagnon qui suit le joueur ---
export const PETS = {
  drone: {
    name: "Drone de combat",
    icon: "drone",
    rarity: "common",
    desc: "Tire des lasers sur l'ennemi le plus proche.",
    power: { damage: 8, cooldown: 800 },
    color: "#00ff88",
  },
  collector: {
    name: "Collecteur",
    icon: "magnet",
    rarity: "rare",
    desc: "Attire les gemmes de très loin et rapporte plus d'or.",
    power: { magnet: 150, gold: 0.15 },
    color: "#ffee00",
  },
  medic: {
    name: "Médic",
    icon: "medic",
    rarity: "rare",
    desc: "Soigne le joueur toutes les 3 secondes.",
    power: { heal: 4, cooldown: 3000 },
    color: "#00ffcc",
  },
  reaper: {
    name: "Faucheuse",
    icon: "scythe",
    rarity: "epic",
    desc: "Tourne autour de vous et tranche les ennemis qu'elle touche.",
    power: { damage: 10, radius: 80 },
    color: "#ff3355",
  },
  frost: {
    name: "Cristal de givre",
    icon: "snowflake",
    rarity: "rare",
    desc: "Gèle sur place les 3 ennemis les plus proches toutes les 2,5 s.",
    power: { damage: 5, freeze: 50, cooldown: 2500 },
    color: "#9fe8ff",
  },
  guardian: {
    name: "Gardien",
    icon: "guardian",
    rarity: "epic",
    desc: "Vous protège d'un bouclier toutes les 10 secondes.",
    power: { shield: 90, cooldown: 10000 },
    color: "#4d9bff",
  },
  dragon: {
    name: "Dragonnet",
    icon: "dragon",
    rarity: "legendary",
    desc: "Crache une gerbe de boules de feu explosives.",
    power: { damage: 9, cooldown: 1300 },
    color: "#ff5a1f",
  },
};

const withSlot = (table, slot) => Object.entries(table).map(([id, v]) => [id, { ...v, id, slot }]);
export const ITEMS = Object.fromEntries([
  ...withSlot(WEAPONS, "weapon"),
  ...withSlot(ARMORS, "armor"),
  ...withSlot(HEROES, "hero"),
  ...withSlot(PETS, "pet"),
]);

export const STARTER_ITEMS = ["blaster", "pilot"];

// --- COFFRES ---
/** Coffre gratuit : quel coffre et toutes les combien d'heures. */
export const FREE_CHEST = { chestId: "basic", intervalHours: 4 };

/** Emplacements tirés par chaque type de coffre. */
export const CHEST_POOLS = { gear: ["weapon", "armor"], hero: ["hero"], pet: ["pet"] };

export const CHESTS = [
  {
    id: "basic",
    name: "Coffre basique",
    icon: "chest",
    color: "#00ccff",
    cost: 250,
    odds: { common: 70, rare: 25, epic: 5 },
  },
  {
    id: "premium",
    name: "Coffre premium",
    icon: "gem",
    color: "#ff44ff",
    cost: 1000,
    odds: { common: 30, rare: 45, epic: 20, legendary: 5 },
  },
  {
    id: "legendary",
    name: "Coffre légendaire",
    icon: "crown",
    color: "#ffd700",
    cost: 3000,
    odds: { rare: 38, epic: 44, legendary: 15, mythic: 3 },
  },
  {
    id: "mythic",
    name: "Coffre mythique",
    icon: "mythicChest",
    color: "#ff3b30",
    cost: 6000,
    odds: { epic: 45, legendary: 40, mythic: 15 },
  },
  {
    id: "hero",
    pool: "hero",
    name: "Coffre Héros",
    icon: "heroChest",
    color: "#ff55cc",
    cost: 1500,
    odds: { rare: 65, epic: 27, legendary: 8 },
  },
  {
    id: "pet",
    pool: "pet",
    name: "Coffre Familier",
    icon: "paw",
    color: "#00ff88",
    cost: 800,
    odds: { common: 50, rare: 35, epic: 12, legendary: 3 },
  },
];

/** Regroupement des coffres dans la boutique. */
export const CHEST_GROUPS = [
  { title: "Armes & armures", ids: ["basic", "premium", "legendary", "mythic"] },
  { title: "Héros & familiers", ids: ["hero", "pet"] },
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
  return { ...a, id, level, prestige, stats: scaleStats(a.stats, level, prestige) };
}

/** Bonus effectifs d'un héros (mêmes règles que les armures). */
export function heroStats(id, level, prestige) {
  const h = HEROES[id];
  return { ...h, id, level, prestige, stats: scaleStats(h.stats, level, prestige) };
}

/** Puissance effective d'un familier : dégâts, soins, portée... (les délais ne changent pas). */
export function petStats(id, level, prestige) {
  const p = PETS[id];
  const mult = powerMult(level, prestige);
  const power = {};
  for (const [k, v] of Object.entries(p.power)) power[k] = k === "cooldown" ? v : v * mult;
  return { ...p, id, level, prestige, power };
}

/** Les bonus grandissent avec la puissance, les malus non ; vitesse et dash plafonnés. */
function scaleStats(base, level, prestige) {
  const mult = powerMult(level, prestige);
  const stats = {};
  for (const [k, v] of Object.entries(base)) stats[k] = v > 0 ? v * mult : v;
  if (stats.dashCooldown) stats.dashCooldown = Math.min(0.6, stats.dashCooldown);
  if (stats.speed) stats.speed = Math.min(MAX_SPEED_BONUS, stats.speed);
  return stats;
}
