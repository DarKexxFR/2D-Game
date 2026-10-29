// Réglages des boss rangés dans systems/bosses/ (un fichier par boss). Durées en ticks (60 par
// seconde), distances en pixels, dégâts en part des dégâts du boss.

/**
 * Ver des sables (vague 17) : un long corps en segments qui serpente. Chaque segment détruit
 * arrache `segmentDamage` de la vie de la tête. Il plonge (intouchable), file sous terre vers le
 * joueur et ressort sous lui (zone annoncée), en laissant des sables mouvants.
 */
export const SANDWORM = {
  segments: 8,
  segmentGap: 40, // distance entre deux segments le long du chemin de la tête
  segmentHealth: 0.05, // PV d'un segment, en part des PV max de la tête
  segmentDamage: 0.07, // vie arrachée à la tête par segment détruit
  turn: 0.045, // virage maximal de la tête par tick (il serpente au lieu de foncer droit)
  surfaced: 420, // ticks à l'air libre avant de plonger
  surfacedEnraged: 330,
  burrow: 110, // ticks sous terre avant l'éruption
  burrowSpeed: 1.8, // vitesse sous terre (multiplie la vitesse de la tête)
  eruptWarn: 55,
  eruptRadius: 150,
  eruptions: 1, // éruptions d'affilée (deux en furie)
  eruptionsEnraged: 2,
  quicksand: { count: 4, radius: 85, spread: 170, pool: 300, slow: 45 },
  attackEvery: 110,
  spit: { count: 7, spread: 0.16, speed: 5.5, slow: 60 },
  whip: { length: 320, width: 34, delay: 35, active: 50, spin: 0.045 },
};

/**
 * Mère-Ruche (vague 19) : elle plante des fleurs toxiques (parties du boss) dont le poison
 * s'étend au sol ; chaque fleur en vie lui donne une carapace qui réduit les dégâts reçus.
 */
export const HIVE = {
  cycle: ["bloom", "pollen", "swirl", "pollen"],
  attackEvery: 120,
  flowers: 3,
  flowersEnraged: 4,
  maxFlowers: 6,
  flowerHealth: 0.04, // PV d'une fleur, en part des PV max de la reine
  plantDelay: 50, // alerte avant qu'une fleur ne sorte de terre
  plantRadius: 250, // distance des fleurs autour du joueur
  aura: { start: 40, max: 170, grow: 0.45, damage: 0.18, tick: 30 }, // poison au sol autour d'une fleur
  armorPerFlower: 0.2,
  armorPerFlowerEnraged: 0.25,
  maxArmor: 0.75,
  pollen: { count: 6, countEnraged: 9, speed: 3.2, homing: 0.035, life: 240, damage: 0.4 },
  swirl: { count: 16, countEnraged: 22, speed: 3.6, turn: 0.016, damage: 0.4 },
};

/**
 * Chronophage (vague 23) : il manipule le temps. Bulles où les tirs du joueur ralentissent,
 * cadran de zones qui explosent l'une après l'autre, pendule, retour du joueur là où il était
 * 3 s plus tôt. « Rembobinage » : s'il perd moins de `minLoss` de sa vie en `every` ticks, il en
 * récupère `restore`. En furie, ses attaques de zone se répètent (« écho ») `echo` ticks plus tard.
 */
export const CHRONO = {
  cycle: ["dial", "bubbles", "rewind", "dial", "pendulum", "bubbles"],
  attackEvery: 120,
  dial: { count: 12, radius: 230, outer: 380, zone: 66, delay: 45, step: 6, damage: 0.8 },
  bubbles: { count: 3, radius: 150, spread: 230, duration: 360, factor: 0.25 },
  rewind: { back: 180, warn: 40, blast: 45, radius: 110, damage: 1 },
  pendulum: { length: 900, width: 40, amp: 1.15, speed: 0.045, delay: 50, active: 210, damage: 0.6 },
  rewindHealth: { every: 420, minLoss: 0.06, restore: 0.5 },
  echo: 90,
};

/**
 * Hacker (vague 29) : il pirate le joueur. Commandes inversées (« GLITCH »), pare-feu qui
 * l'enferme avant une purge, zones de brouillage qui coupent le tir, paquets de données, sauts
 * réseau. En furie, il se cache parmi des clones holographiques (seul le vrai prend les dégâts
 * du boss ; un clone tombe en quelques coups).
 */
export const HACKER = {
  cycle: ["packets", "glitch", "firewall", "jam", "teleport", "packets", "firewall"],
  attackEvery: 110,
  glitch: { warn: 50, duration: 150 },
  firewall: { gap: 95, length: 1000, width: 24, delay: 55, active: 125, purge: 90, damage: 0.6 },
  jam: { zones: 4, radius: 110, spread: 210, delay: 40, pool: 300, damage: 0.4 },
  packets: { streams: 3, spread: 0.4, bullets: 6, speed: 4, step: 0.85, damage: 0.45 },
  teleport: { distance: 320, warn: 30, burst: 10 },
  clones: { count: 3, health: 0.035, shuffleEvery: 300, respawn: 480, fireEvery: 150 },
};

/**
 * Cœur du Pulse (vague 30, il ouvre les dix dernières vagues) : immobile au centre de l'arène, il bat de plus en plus
 * vite. Chaque battement déclenche le pas suivant du motif de sa phase ; à chaque phase l'arène
 * se resserre (`arena` = part de sa taille). Pas « - » = battement sans attaque.
 */
export const PULSE_CORE = {
  phases: [
    { below: 1, beat: 60, arena: 1, pattern: ["ring", "-", "arteries", "-", "ring", "-", "clots", "-"] },
    {
      below: 0.66,
      beat: 46,
      arena: 0.8,
      pattern: ["ring", "arteries", "-", "clots", "ring", "veins", "-", "clots"],
    },
    {
      below: 0.33,
      beat: 34,
      arena: 0.62,
      pattern: ["ring", "arteries", "clots", "veins", "ring", "clots", "arteries", "veins"],
    },
  ],
  ring: { max: 900, speed: 7, damage: 0.45 },
  arteries: { beams: 4, beamsLast: 6, width: 30, active: 22, damage: 0.6 },
  clots: { count: 5, radius: 75, spread: 170, damage: 0.7 },
  veins: { count: 16, countLast: 24, speed: 4, damage: 0.45 },
  keepAway: 320, // distance minimale au joueur quand il prend place au centre de l'arène
};

/**
 * Forgeronne stellaire (vague 32) : enclumes qui tombent sur le joueur (zones annoncées, métal en fusion
 * au sol), drones de forge (parties du boss) qu'elle soude ensuite en un colosse forgé, gerbes d'étincelles.
 * En furie (« FOURNAISE »), chaque attaque libère en plus une onde de chaleur.
 */
export const FORGE = {
  cycle: ["anvils", "drones", "sparks", "anvils", "weld", "sparks"],
  attackEvery: 115,
  anvils: { count: 5, countEnraged: 8, radius: 80, spread: 210, delay: 55, pool: 150, damage: 0.9 },
  drones: { count: 4, countEnraged: 6, health: 0.025, max: 8 }, // PV en part des PV max de la Forgeronne
  weld: { min: 2, health: 1.5, warn: 50 }, // colosse = PV des drones soudés ×`health`
  sparks: { streams: 3, spread: 0.32, bullets: 5, speed: 4.6, step: 0.8, damage: 0.4 },
  furnace: { max: 520, speed: 5, damage: 0.4 },
};

/**
 * Le Reflet (vague 35) : il se place à l'opposé du joueur (symétrie autour du centre de l'arène) et copie
 * son arsenal : tirs de son arme, une contre-attaque par arme d'appoint, et un dash quand le joueur
 * dashe. En furie, un Écho (partie du boss) le rejoint et tire aussi.
 */
export const MIRROR = {
  attackEvery: 95,
  follow: 0.035, // part de l'écart rattrapée chaque tick vers la position miroir
  minDist: 220, // ne vient jamais plus près que ça par la symétrie (sinon il fonce)
  shots: { max: 7, speed: 0.6, damage: 0.45, spread: 0.18 }, // vitesse = part de celle de l'arme du joueur
  dash: { ticks: 20, speed: 4.5, cooldown: 90 },
  echo: { health: 0.18, fireEvery: 140 },
  // Contre-attaques, une par arme d'appoint du joueur (sans arme d'appoint : « shards »)
  counters: {
    missiles: { count: 4, speed: 3.4, homing: 0.03, life: 220, damage: 0.45 },
    mines: { count: 4, radius: 70, delay: 60, damage: 0.8 },
    lightning: { count: 3, radius: 60, spread: 160, delay: 40, damage: 0.8 },
    pulse: { max: 420, speed: 6, damage: 0.5 },
    beam: { beams: 2, length: 700, width: 20, delay: 50, active: 120, spin: 0.018, damage: 0.5 },
    whip: { length: 420, width: 50, delay: 40, active: 25, damage: 0.8 },
    shards: { count: 14, speed: 4, damage: 0.4 },
  },
};

/**
 * Tisseuse du vide (vague 37) : elle plante des ancres (parties du boss) autour du joueur puis tend
 * des fils laser de l'une à l'autre : une cage avec toujours une sortie. Fils collants qui ralentissent,
 * portails (téléportation annoncée). Chaque ancre détruite l'étourdit un instant (« FIL ROMPU »).
 */
export const WEAVER = {
  cycle: ["anchors", "weave", "web", "portal", "weave", "web"],
  attackEvery: 120,
  anchors: { count: 4, countEnraged: 6, radius: 300, health: 0.03, max: 6, delay: 45 },
  weave: { width: 18, delay: 60, active: 130, damage: 0.55 },
  web: { count: 12, countEnraged: 18, speed: 3.6, slow: 70, damage: 0.35 },
  portal: { distance: 360, warn: 40, burst: 14, damage: 0.4 },
  snapStun: 60, // étourdissement de la Tisseuse quand une ancre tombe
};

/**
 * L'Architecte (vague 40, boss final) : quatre phases (sous 75, 50 puis 25 % de vie) qui reprennent les
 * attaques des boss passés ; l'arène se resserre à chaque phase. Sa mort lance l'Endless Pulse.
 */
export const ARCHITECT = {
  phases: [
    { below: 1, every: 110, arena: 1, cycle: ["grid", "ring", "orbs", "grid", "clots"], name: "PLAN" },
    { below: 0.75, every: 95, arena: 0.88, cycle: ["storm", "prism", "rain", "grid", "orbs"], name: "ÉCHOS" },
    {
      below: 0.5,
      every: 85,
      arena: 0.76,
      cycle: ["glitch", "bubbles", "prism", "storm", "grid", "rain"],
      name: "RÉÉCRITURE",
    },
    {
      below: 0.25,
      every: 70,
      arena: 0.64,
      cycle: ["grid", "storm", "prism", "orbs", "clots", "ring", "rain"],
      name: "EFFONDREMENT",
    },
  ],
  grid: { lines: 3, gap: 170, length: 1400, width: 26, delay: 60, active: 30, damage: 0.6 },
  ring: { max: 900, speed: 6.5, damage: 0.45 },
  orbs: { count: 8, speed: 3.2, homing: 0.025, life: 260, damage: 0.4 },
  clots: { count: 6, radius: 75, spread: 200, delay: 50, damage: 0.7 },
  storm: { count: 4, radius: 70, spread: 180, delay: 50, stun: 45, damage: 0.6 }, // Titan de l'orage
  prism: { beams: 3, length: 900, width: 24, delay: 55, active: 160, spin: 0.014, damage: 0.5 }, // Sentinelle
  rain: { count: 6, radius: 85, spread: 230, delay: 55, pool: 160, slow: 45, damage: 0.5 }, // Roi Slime
  glitch: { warn: 50, duration: 120 }, // Hacker
  bubbles: { count: 2, radius: 150, spread: 220, duration: 300, factor: 0.3 }, // Chronophage
  keepAway: 340,
};
