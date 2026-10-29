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
  // Jungle toxique : la spore éclate en sporelets, le poseur de mines sème des mines annoncées
  spore: {
    health: 45,
    damage: 10,
    speed: 2.2,
    size: 19,
    color: "#7dff3a",
    xp: 5,
    gold: 2,
    splitTo: "sporeling",
    splitCount: 3,
  },
  sporeling: { health: 10, damage: 6, speed: 4.2, size: 9, color: "#c8ff5a", xp: 1, gold: 1 },
  bomber: { health: 55, damage: 12, speed: 2, size: 18, color: "#d4ff00", xp: 7, gold: 4 },
  // Station orbitale : le téléporteur surgit près du joueur, le drone laser tire de loin
  blinker: { health: 35, damage: 13, speed: 2.6, size: 15, color: "#c58bff", xp: 6, gold: 3 },
  laser_drone: { health: 40, damage: 16, speed: 2, size: 16, color: "#ff4fd8", xp: 7, gold: 4 },
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
  // Titan de l'orage : ses éclairs étourdissent le joueur (voir STUN dans config.js)
  storm_titan: {
    health: 1600,
    damage: 45,
    speed: 2.2,
    size: 58,
    color: "#ffe94d",
    xp: 300,
    gold: 150,
    isBoss: true,
    chest: 1, // chance de lâcher un coffre d'augmentation
    noExecute: true,
  },
  // Sentinelle prismatique : lasers tournants, éclats qui se diffractent, damier de zones
  prism: {
    health: 2000,
    damage: 48,
    speed: 1.7,
    size: 54,
    color: "#3dffd8",
    xp: 350,
    gold: 170,
    isBoss: true,
    chest: 1, // chance de lâcher un coffre d'augmentation
    noExecute: true,
  },
  // Kraken : la tête reste sous l'eau (invulnérable) tant que ses tentacules sont debout
  kraken: {
    health: 2400,
    damage: 50,
    speed: 1.2,
    size: 62,
    color: "#3d8bff",
    xp: 450,
    gold: 200,
    isBoss: true,
    chest: 1, // chance de lâcher un coffre d'augmentation
    noExecute: true,
  },
  kraken_tentacle: {
    health: 260,
    damage: 30,
    speed: 0,
    size: 50,
    color: "#b46bff",
    xp: 15,
    gold: 5,
    noExecute: true,
  },
  // Jumeaux : deux boss reliés par un lien d'énergie ; le survivant se venge (voir TWINS)
  twin_fire: {
    health: 1900,
    damage: 46,
    speed: 2.4,
    size: 46,
    color: "#ff7a1a",
    xp: 300,
    gold: 140,
    isBoss: true,
    chest: 1, // seul le dernier jumeau lâche le coffre
    noExecute: true,
  },
  twin_ice: {
    health: 1900,
    damage: 46,
    speed: 2.4,
    size: 46,
    color: "#7fd8ff",
    xp: 300,
    gold: 140,
    isBoss: true,
    chest: 1,
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
  // Nouveaux ennemis (ajoutés en fin de liste : l'aperçu du duel en ligne repère les types par leur rang)
  shield: { health: 45, damage: 10, speed: 2, size: 18, color: "#4fa8ff", xp: 6, gold: 3 },
  swarm: { health: 6, damage: 4, speed: 3.6, size: 8, color: "#ffe14d", xp: 1, gold: 1, group: 6 },
  healer: { health: 35, damage: 6, speed: 2.2, size: 15, color: "#00ff88", xp: 8, gold: 4 },
  magnet: { health: 70, damage: 10, speed: 1.8, size: 20, color: "#ff5577", xp: 9, gold: 5 },
  // Boss rangés dans systems/bosses/ (réglages dans data/bosses.js). Leurs parties (segments,
  // fleurs, clones) ont des PV fixés en part des PV du boss, pas par la vague.
  sandworm: {
    health: 2600,
    damage: 52,
    speed: 3,
    size: 52,
    color: "#ffb347",
    xp: 650,
    gold: 260,
    isBoss: true,
    chest: 1, // chance de lâcher un coffre d'augmentation
    noExecute: true,
  },
  sandworm_segment: {
    health: 100,
    damage: 30,
    speed: 0,
    size: 34,
    color: "#e8963a",
    xp: 14,
    gold: 4,
    noExecute: true,
  },
  hive_queen: {
    health: 2500,
    damage: 48,
    speed: 1.6,
    size: 58,
    color: "#ffcc33",
    xp: 700,
    gold: 280,
    isBoss: true,
    chest: 1,
    noExecute: true,
  },
  hive_flower: {
    health: 100,
    damage: 18,
    speed: 0,
    size: 30,
    color: "#9dff3d",
    xp: 12,
    gold: 3,
    noExecute: true,
  },
  chronophage: {
    health: 2800,
    damage: 50,
    speed: 1.9,
    size: 56,
    color: "#8c7bff",
    xp: 800,
    gold: 320,
    isBoss: true,
    chest: 1,
    noExecute: true,
  },
  hacker: {
    health: 3000,
    damage: 52,
    speed: 2.4,
    size: 46,
    color: "#39ff8e",
    xp: 900,
    gold: 360,
    isBoss: true,
    chest: 1,
    noExecute: true,
  },
  hacker_clone: {
    health: 100,
    damage: 26,
    speed: 2.4,
    size: 46,
    color: "#39ff8e",
    xp: 5,
    gold: 1,
    noExecute: true,
  },
  pulse_core: {
    health: 4200,
    damage: 58,
    speed: 0,
    size: 70,
    color: "#ff2a6d",
    xp: 1500,
    gold: 600,
    isBoss: true,
    chest: 1,
    noExecute: true,
  },
  // Fin de l'aventure (vagues 31 à 40) : ennemis de la Faille quantique et du Noyau stellaire
  phaser: { health: 60, damage: 16, speed: 2.8, size: 16, color: "#ff3bf0", xp: 9, gold: 4 },
  replicator: { health: 70, damage: 14, speed: 2, size: 17, color: "#00ffe0", xp: 9, gold: 4 },
  fuser: { health: 90, damage: 18, speed: 2.2, size: 18, color: "#ffb347", xp: 10, gold: 5 },
  nova: { health: 40, damage: 30, speed: 2.4, size: 15, color: "#ff5a3d", xp: 9, gold: 4 },
  // Boss de la fin de l'aventure (systems/bosses/, réglages dans data/bosses.js)
  forge: {
    health: 3600,
    damage: 56,
    speed: 1.5,
    size: 62,
    color: "#ff7a1a",
    xp: 1700,
    gold: 650,
    isBoss: true,
    chest: 1,
    noExecute: true,
  },
  forge_drone: {
    health: 100,
    damage: 24,
    speed: 3.4,
    size: 16,
    color: "#ffb35c",
    xp: 8,
    gold: 2,
    noExecute: true,
  },
  forge_golem: {
    health: 100,
    damage: 40,
    speed: 1.6,
    size: 36,
    color: "#ff5a1a",
    xp: 40,
    gold: 10,
    noExecute: true,
  },
  mirror: {
    health: 3400,
    damage: 50,
    speed: 3,
    size: 36,
    color: "#cfe8ff",
    xp: 1800,
    gold: 700,
    isBoss: true,
    chest: 1,
    noExecute: true,
  },
  mirror_echo: {
    health: 100,
    damage: 30,
    speed: 3,
    size: 30,
    color: "#8fb8ff",
    xp: 30,
    gold: 8,
    noExecute: true,
  },
  weaver: {
    health: 3800,
    damage: 54,
    speed: 1.8,
    size: 58,
    color: "#b26bff",
    xp: 1900,
    gold: 750,
    isBoss: true,
    chest: 1,
    noExecute: true,
  },
  weaver_anchor: {
    health: 100,
    damage: 0,
    speed: 0,
    size: 20,
    color: "#e0b3ff",
    xp: 15,
    gold: 3,
    noExecute: true,
  },
  architect: {
    health: 6000,
    damage: 62,
    speed: 1,
    size: 76,
    color: "#ffe9a8",
    xp: 3000,
    gold: 1200,
    isBoss: true,
    chest: 1,
    noExecute: true,
  },
};

/** Comportements des ennemis des nouveaux biomes (voir systems/enemies.js), en ticks. */
export const BIOME_FOES = {
  mine: { every: 150, range: 480, radius: 60, delay: 150, damage: 1.6 }, // poseur de mines
  blink: { every: 200, minDist: 220, landDist: 130, warn: 35 }, // téléporteur
  laser: { every: 240, range: 520, length: 700, width: 18, delay: 50, active: 14 }, // drone laser
  // Porte-bouclier : bloque les tirs reçus de face (demi-angle `arc`), tourne lentement vers le joueur
  shield: { arc: 1.1, turn: 0.025, block: 0.15 },
  // Soigneur : rend une part des PV max aux ennemis proches (pas aux boss)
  heal: { every: 150, radius: 200, amount: 0.15 },
  // Aimant : annonce (`warn`) puis attire le joueur vers lui pendant `duration` ticks
  magnet: { every: 300, range: 420, warn: 45, duration: 60, pull: 2.2 },
  // Déphaseur : visible `solid` ticks, scintille `warn` ticks, puis intouchable `phased` ticks (plus rapide)
  phase: { solid: 150, warn: 30, phased: 90, speed: 1.4 },
  // Réplicateur : se copie toutes les `every` ticks (annoncé `warn` ticks avant), au plus `max` en jeu
  // et sur `generations` générations ; une copie rapporte `copyRewards` de l'XP et de l'or
  replicate: { every: 360, warn: 60, max: 18, generations: 2, copyRewards: 0.4 },
  // Fusionneur : deux qui se touchent fusionnent (PV cumulés ×`health`, dégâts ×`damage`, taille ×`size`),
  // au plus `maxLevel` fois ; il est attiré par un autre fusionneur proche (`seek` pixels, `pull` par tick)
  fuse: { maxLevel: 2, health: 1.2, damage: 1.35, size: 1.3, seek: 220, pull: 0.7 },
  // Nova : à `range` du joueur, fonce `charge` ticks (vitesse ×`speed`), puis explose (zone annoncée)
  nova: { range: 230, charge: 32, speed: 2.6, radius: 105, delay: 45, damage: 1.2 },
};

/** Ennemis d'élite : plus gros, plus résistants, plus forts ; de plus en plus fréquents. */
export const ELITE = {
  fromWave: 8,
  chancePerWave: 0.015, // +1,5 % par vague après fromWave
  maxChance: 0.35,
  health: 4,
  damage: 1.5,
  size: 1.3,
  rewards: 3, // XP et or multipliés
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
  spore: "Spore",
  sporeling: "Sporelet",
  bomber: "Poseur de mines",
  blinker: "Téléporteur",
  laser_drone: "Drone laser",
  hydra: "Nécro-Hydre",
  hydra_spawn: "Rejeton",
  colossus: "Colosse de givre",
  void_reaper: "Faucheur du vide",
  storm_titan: "Titan de l'orage",
  prism: "Sentinelle prismatique",
  kraken: "Kraken",
  kraken_tentacle: "Tentacule",
  twin_fire: "Jumeau de feu",
  twin_ice: "Jumeau de glace",
  phantom: "Spectre",
  goblin: "Voleur doré",
  shield: "Porte-bouclier",
  swarm: "Essaim",
  healer: "Soigneur",
  magnet: "Aimant",
  sandworm: "Ver des sables",
  sandworm_segment: "Anneau du ver",
  hive_queen: "Mère-Ruche",
  hive_flower: "Fleur toxique",
  chronophage: "Chronophage",
  hacker: "Hacker",
  hacker_clone: "Clone du Hacker",
  pulse_core: "Cœur du Pulse",
  phaser: "Déphaseur",
  replicator: "Réplicateur",
  fuser: "Fusionneur",
  nova: "Nova",
  forge: "Forgeronne stellaire",
  forge_drone: "Drone de forge",
  forge_golem: "Colosse forgé",
  mirror: "Le Reflet",
  mirror_echo: "Écho du Reflet",
  weaver: "Tisseuse du vide",
  weaver_anchor: "Ancre de toile",
  architect: "L'Architecte",
};

/** Taille maximale d'un ennemi (Roi Slime grossi par BOSS_POWER, en plein saut), utile pour la grille spatiale. */
export const MAX_ENEMY_SIZE = 130;

// Mélange de fin de partie (dès la vague 8), complété par le Soigneur puis l'Aimant.
const LATE_MIX = { normal: 0.3, fast: 0.2, ranged: 0.2, tank: 0.15, kamikaze: 0.1, slime_big: 0.05 };

// Probabilités d'apparition selon la vague (première table dont `untilWave` > vague).
export const SPAWN_TABLES = [
  { untilWave: 3, weights: { normal: 0.8, fast: 0.2 } },
  { untilWave: 5, weights: { normal: 0.5, fast: 0.3, kamikaze: 0.2 } },
  { untilWave: 8, weights: { normal: 0.5, fast: 0.2, ranged: 0.2, kamikaze: 0.1 } },
  { untilWave: 10, weights: LATE_MIX },
  { untilWave: 12, weights: { ...LATE_MIX, healer: 0.08 } },
  { untilWave: Infinity, weights: { ...LATE_MIX, healer: 0.08, magnet: 0.07 } },
];

// Vagues de boss, testées dans l'ordre (premier multiple trouvé) : vagues 1 à 30, puis en Endless Pulse.
export const BOSS_WAVES = [
  { every: 40, type: "architect", warning: "L'ARCHITECTE" },
  { every: 37, type: "weaver", warning: "TISSEUSE DU VIDE" },
  { every: 35, type: "mirror", warning: "LE REFLET" },
  { every: 32, type: "forge", warning: "FORGERONNE STELLAIRE" },
  { every: 30, type: "pulse_core", warning: "CŒUR DU PULSE" },
  { every: 29, type: "hacker", warning: "LE HACKER" },
  { every: 23, type: "chronophage", warning: "CHRONOPHAGE" },
  { every: 19, type: "hive_queen", warning: "MÈRE-RUCHE" },
  { every: 17, type: "sandworm", warning: "VER DES SABLES" },
  { every: 15, type: "void_reaper", warning: "FAUCHEUR DU VIDE" },
  { every: 13, type: "twin_fire", warning: "LES JUMEAUX" },
  { every: 12, type: "hydra", warning: "NÉCRO-HYDRE" },
  { every: 11, type: "kraken", warning: "KRAKEN" },
  { every: 10, type: "colossus", warning: "COLOSSE DE GIVRE" },
  { every: 9, type: "prism", warning: "SENTINELLE PRISMATIQUE" },
  { every: 8, type: "slime_boss", warning: "ROI SLIME" },
  { every: 7, type: "storm_titan", warning: "TITAN DE L'ORAGE" },
  { every: 5, type: "boss", warning: "ŒIL DU NÉANT" },
  { every: 2, type: "miniboss", warning: "" },
];

/**
 * Fin de l'aventure (vagues 31 à 40) : déroulé fixe au lieu des multiples ci-dessus (sinon un ancien
 * boss reviendrait presque à chaque vague). Une vague absente de `waves` = des ennemis seulement.
 * `elite` : chance d'élite en plus pour les vagues de transition.
 */
export const FINALE_WAVES = {
  from: 31,
  to: 40,
  waves: {
    32: { type: "forge", warning: "FORGERONNE STELLAIRE" },
    33: { type: "miniboss", warning: "" },
    35: { type: "mirror", warning: "LE REFLET" },
    36: { type: "miniboss", warning: "" },
    37: { type: "weaver", warning: "TISSEUSE DU VIDE" },
    40: { type: "architect", warning: "L'ARCHITECTE" },
  },
  elite: { 38: 0.1, 39: 0.25 },
};

/** Boss de la vague `wave` en partie normale ({ type, warning }), ou null. */
export function bossForWave(wave) {
  if (wave <= 1) return null;
  if (wave >= FINALE_WAVES.from && wave <= FINALE_WAVES.to) return FINALE_WAVES.waves[wave] || null;
  return BOSS_WAVES.find((b) => wave % b.every === 0) || null;
}

/**
 * Boss Rush : les boss s'enchaînent sans ennemis ordinaires. Chaque boss est réglé comme à sa
 * vague habituelle (`wave`) ; après le dernier, le cycle reprend `cycleWaves` vagues plus fort.
 */
export const BOSS_RUSH = {
  order: [
    { type: "miniboss", wave: 2, warning: "CRABE BLINDÉ" },
    { type: "boss", wave: 5, warning: "ŒIL DU NÉANT" },
    { type: "storm_titan", wave: 7, warning: "TITAN DE L'ORAGE" },
    { type: "slime_boss", wave: 8, warning: "ROI SLIME" },
    { type: "prism", wave: 9, warning: "SENTINELLE PRISMATIQUE" },
    { type: "colossus", wave: 10, warning: "COLOSSE DE GIVRE" },
    { type: "kraken", wave: 11, warning: "KRAKEN" },
    { type: "hydra", wave: 12, warning: "NÉCRO-HYDRE" },
    { type: "twin_fire", wave: 13, warning: "LES JUMEAUX" },
    { type: "void_reaper", wave: 15, warning: "FAUCHEUR DU VIDE" },
    { type: "sandworm", wave: 17, warning: "VER DES SABLES" },
    { type: "hive_queen", wave: 19, warning: "MÈRE-RUCHE" },
    { type: "chronophage", wave: 23, warning: "CHRONOPHAGE" },
    { type: "hacker", wave: 29, warning: "LE HACKER" },
    { type: "pulse_core", wave: 30, warning: "CŒUR DU PULSE" },
    { type: "forge", wave: 32, warning: "FORGERONNE STELLAIRE" },
    { type: "mirror", wave: 35, warning: "LE REFLET" },
    { type: "weaver", wave: 37, warning: "TISSEUSE DU VIDE" },
    { type: "architect", wave: 40, warning: "L'ARCHITECTE" },
  ],
  cycleWaves: 40,
  spawnDelay: 120, // ticks avant l'arrivée du boss
  breather: 180, // ticks de répit entre deux boss
  heal: 0.3, // part des PV max rendue après chaque boss
  modifier: { enemyHealth: 0.6, enemyXp: 2.5 }, // pas de petits ennemis : plus d'XP, boss moins solides
};

export const BOSS_SPAWN_DELAY = 180; // ticks

/**
 * Puissance des boss (en plus de la montée par vague des ennemis) : ils combattent seuls, donc
 * plus de PV, de dégâts et de taille. Les PV grimpent encore de `healthPerWave` par vague après
 * `fromWave` : les boss tardifs sont bien plus solides. `minor` = boss qui gardent les petits
 * ennemis autour d'eux (Crabe blindé), renforcés plus légèrement.
 */
export const BOSS_POWER = {
  health: 1.6,
  healthPerWave: 0.05,
  fromWave: 5,
  damage: 1.3,
  size: 1.3,
  minor: { health: 1.2, damage: 1.1, size: 1.15 },
};

/** Roi Slime : saut annoncé (enchaîné en furie), pluie de slime collante, absorption de ses petits. */
export const SLIME_KING = {
  jumpTicks: 50,
  jumpRadius: 170,
  jumpsEnraged: 3,
  globs: 5,
  globsEnraged: 8,
  absorbRange: 380,
  absorbHeal: 0.03, // part des PV max rendue par slime absorbé
  reinforcements: 4, // petits slimes appelés s'il n'y a rien à absorber
};

/**
 * Kraken : tentacules qui sortent du sol autour du joueur ; quand toutes sont détruites, la tête
 * remonte et devient vulnérable pendant `exposed` ticks, puis replonge avec de nouvelles tentacules.
 */
export const KRAKEN = {
  tentacles: 4,
  tentaclesEnraged: 6,
  ringRadius: 280, // distance des tentacules autour du joueur
  emerge: 45, // ticks d'alerte avant qu'une tentacule ne jaillisse
  exposed: 420,
  exposedEnraged: 360,
  whirlEvery: 260, // tourbillon (attire le joueur vers la tête) quand elle est sous l'eau
  whirlDuration: 120,
  whirlPull: 1.8, // pixels par tick
};

/**
 * Jumeaux : ils tournent autour du joueur, reliés par un lien qui blesse ; « ciseaux » = ils
 * changent de côté et le lien balaie le joueur. Le survivant se venge (soin, attaques des deux).
 * Les tuer à moins de `syncWindow` ticks d'écart rapporte `syncGold` d'or.
 */
export const TWINS = {
  orbit: 280,
  gap: 1.4, // écart angulaire entre les deux (le lien passe à orbit × cos(gap / 2) du joueur)
  orbitSpeed: 0.006,
  tetherWidth: 12,
  tetherDamage: 0.35, // part des dégâts du boss
  tetherTick: 30,
  scissors: 110, // durée du croisement
  // Éclipse (attaque commune) : lasers tournants des deux jumeaux, en sens contraires
  eclipse: {
    every: 600,
    everyFury: 420,
    beams: 2,
    beamsFury: 3,
    length: 750,
    delay: 60,
    active: 150,
    spin: 0.011,
  },
  // Lien vital : toutes les `every` ticks, si l'écart de vie dépasse `gap`, le plus abîmé récupère `heal`
  vital: { every: 300, gap: 0.2, heal: 0.06 },
  // Furie commune (sous 50 % de vie à eux deux) : rotation, épaisseur du lien, cadence des attaques
  fury: { orbit: 1.6, tether: 1.5, cadence: 0.75 },
  firewall: { count: 7, spacing: 70, radius: 55, delay: 50, step: 6, pool: 180 },
  prison: { cells: 10, radius: 150, cell: 50, delay: 55, pool: 150, core: 120, coreDelay: 85 },
  ringMax: 520, // portée des ondes (Nova, Givre)
  revengeHeal: 0.35,
  revengeSpeed: 1.35,
  syncWindow: 300,
  syncGold: 150,
};

/**
 * Combat de boss : à l'arrivée du boss les petits ennemis disparaissent et plus aucun n'apparaît
 * tant qu'il est en vie (ses propres invocations restent). Sauf pour les boss de `keepMobs`.
 */
export const BOSS_ARENA = { keepMobs: ["miniboss"] };

// Mise à l'échelle par vague
export const WAVE_SCALING = {
  health: 0.35,
  damage: 0.15,
  speed: 0.03,
  maxSpeedMult: 1.8,
  // À partir de `rampFrom`, PV et dégâts grimpent en plus de façon exponentielle (×1,046 / ×1,04
  // par vague) : le joueur finit toujours par être débordé, même avec un très bon build. Montée réglée
  // pour une fin vers la vague 40 (à la vague 40, à peu près ce qu'était la vague 30 avec ×1,07 / ×1,06).
  rampFrom: 10,
  healthRamp: 1.046,
  damageRamp: 1.04,
  xp: 0.1,
  baseMobs: 30,
  mobsPerWave: 4,
  spawnInterval: 60,
  spawnIntervalPerWave: 2,
  minSpawnInterval: 5,
  spawnDistance: 600,
};
