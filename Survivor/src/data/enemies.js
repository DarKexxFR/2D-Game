// Définition des ennemis, des tables d'apparition et des vagues de boss.

export const ENEMY_TYPES = {
  normal: { health: 20, damage: 8, speed: 2.5, size: 15, color: "#a23bdb", xp: 2, gold: 1 },
  fast: { health: 12, damage: 6, speed: 4.2, size: 12, color: "#ff9944", xp: 3, gold: 2 },
  tank: { health: 80, damage: 15, speed: 1.8, size: 25, color: "#9944ff", xp: 8, gold: 5 },
  ranged: {
    health: 15,
    damage: 12,
    speed: 2.0,
    size: 14,
    color: "#44ff44",
    xp: 4,
    gold: 3,
    attackRange: 300,
    shootCooldown: 1500,
  },
  kamikaze: { health: 1, damage: 45, speed: 5.0, size: 12, color: "#ff3300", xp: 10, gold: 1 },
  miniboss: {
    health: 150,
    damage: 25,
    speed: 3.9,
    size: 35,
    color: "#ffaa00",
    xp: 50,
    gold: 20,
    isBoss: true,
    chest: 0.25, // chance de lâcher un coffre d'augmentation
  },
  boss: {
    health: 1200,
    damage: 55,
    speed: 3.2,
    size: 65,
    color: "#aa00ff",
    xp: 200,
    gold: 100,
    isBoss: true,
    chest: 1, // chance de lâcher un coffre d'augmentation
    noExecute: true,
  },
  slime_boss: {
    health: 2000,
    damage: 45,
    speed: 1.5,
    size: 80,
    color: "#00ff00",
    xp: 400,
    gold: 150,
    isBoss: true,
    chest: 1, // chance de lâcher un coffre d'augmentation
    noExecute: true,
    splitTo: "slime_big",
    splitCount: 4,
  },
  slime_big: {
    health: 150,
    damage: 20,
    speed: 2.5,
    size: 40,
    color: "#44ff44",
    xp: 20,
    gold: 10,
    splitTo: "slime_small",
    splitCount: 3,
  },
  // Ennemis propres aux biomes (voir data/biomes.js)
  scorpion: { health: 40, damage: 14, speed: 3, size: 16, color: "#ff6a00", xp: 6, gold: 3 },
  golem: { health: 160, damage: 20, speed: 1.4, size: 28, color: "#7fdfff", xp: 12, gold: 6 },
  hydra: {
    health: 3000,
    damage: 50,
    speed: 1.6,
    size: 60,
    color: "#bb33ff",
    xp: 600,
    gold: 250,
    isBoss: true,
    chest: 1, // chance de lâcher un coffre d'augmentation
    noExecute: true,
  },
  hydra_spawn: { health: 25, damage: 10, speed: 4.5, size: 11, color: "#cc66ff", xp: 4, gold: 2 },
  slime_small: { health: 50, damage: 10, speed: 4.5, size: 18, color: "#88ff88", xp: 5, gold: 2 },
  colossus: {
    health: 2600,
    damage: 50,
    speed: 1.3,
    size: 70,
    color: "#9fe8ff",
    xp: 500,
    gold: 200,
    isBoss: true,
    chest: 1, // chance de lâcher un coffre d'augmentation
    noExecute: true,
  },
  void_reaper: {
    health: 3600,
    damage: 55,
    speed: 2.3,
    size: 48,
    color: "#ff3d7f",
    xp: 800,
    gold: 300,
    isBoss: true,
    chest: 1, // chance de lâcher un coffre d'augmentation
    noExecute: true,
  },
  phantom: { health: 30, damage: 12, speed: 4, size: 13, color: "#ff7ab0", xp: 4, gold: 2 },
  // Voleur doré : s'enfuit, lâche de l'or quand on le touche (voir systems/enemies.js)
  goblin: {
    health: 90,
    damage: 0,
    speed: 3.4,
    size: 16,
    color: "#ffd700",
    xp: 60,
    gold: 150,
    noExecute: true,
    chest: 1,
  },
};

/** Voleur doré : apparition en début de vague, durée avant fuite, or lâché par coup. */
export const GOBLIN = { fromWave: 3, chance: 0.3, lifetime: 900, goldPerHit: 3, spawnDistance: 380 };

/** Noms affichés (statistiques de fin de partie). */
export const ENEMY_NAMES = {
  normal: "Drone-insecte",
  fast: "Éclaireur",
  tank: "Blindé",
  ranged: "Tourelle",
  kamikaze: "Kamikaze",
  miniboss: "Crabe blindé",
  boss: "Œil du néant",
  slime_boss: "Roi Slime",
  slime_big: "Gros slime",
  slime_small: "Petit slime",
  scorpion: "Scorpion",
  golem: "Golem de glace",
  hydra: "Nécro-Hydre",
  hydra_spawn: "Rejeton",
  colossus: "Colosse de givre",
  void_reaper: "Faucheur du vide",
  phantom: "Spectre",
  goblin: "Voleur doré",
};

/** Taille maximale d'un ennemi (slime boss en saut), utile pour la grille spatiale. */
export const MAX_ENEMY_SIZE = 90;

// Probabilités d'apparition selon la vague (première table dont `untilWave` > vague).
export const SPAWN_TABLES = [
  { untilWave: 3, weights: { normal: 0.8, fast: 0.2 } },
  { untilWave: 5, weights: { normal: 0.5, fast: 0.3, kamikaze: 0.2 } },
  { untilWave: 8, weights: { normal: 0.5, fast: 0.2, ranged: 0.2, kamikaze: 0.1 } },
  {
    untilWave: Infinity,
    weights: { normal: 0.3, fast: 0.2, ranged: 0.2, tank: 0.15, kamikaze: 0.1, slime_big: 0.05 },
  },
];

// Vagues de boss, testées dans l'ordre.
export const BOSS_WAVES = [
  { every: 15, type: "void_reaper", warning: "FAUCHEUR DU VIDE" },
  { every: 12, type: "hydra", warning: "NÉCRO-HYDRE" },
  { every: 10, type: "colossus", warning: "COLOSSE DE GIVRE" },
  { every: 8, type: "slime_boss", warning: "ROI SLIME" },
  { every: 5, type: "boss", warning: "ŒIL DU NÉANT" },
  { every: 2, type: "miniboss", warning: "" },
];

export const BOSS_SPAWN_DELAY = 180; // ticks

// Mise à l'échelle par vague
export const WAVE_SCALING = {
  health: 0.35,
  damage: 0.15,
  speed: 0.03,
  maxSpeedMult: 1.4,
  xp: 0.1,
  baseMobs: 30,
  mobsPerWave: 4,
  spawnInterval: 60,
  spawnIntervalPerWave: 2,
  minSpawnInterval: 5,
  spawnDistance: 600,
};
