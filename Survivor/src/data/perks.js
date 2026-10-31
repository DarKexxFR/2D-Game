// Effets spéciaux débloqués au prestige ★3 (un par objet) et panoplies arme + armure.
// Comportements dans systems/perks.js. Les dégâts sont des multiples de l'attaque du joueur,
// les durées en ticks (60 par seconde) et les délais (cooldown, every) en millisecondes.

export const PERK_PRESTIGE = 3;

export const PERKS = {
  // --- Armes ---
  blaster: {
    name: "Tir chargé",
    desc: "Un tir sur 5 est chargé : triple dégâts.",
    every: 5,
    damage: 3,
    size: 1.8,
  },
  smg: {
    name: "Balles incendiaires",
    desc: "15 % de chance d'enflammer l'ennemi touché.",
    chance: 0.15,
    burn: { ticks: 180, dps: 0.6 },
  },
  shotgun: {
    name: "Plombs sonnants",
    desc: "Chaque plomb a 12 % de chance d'étourdir l'ennemi 0,5 s.",
    chance: 0.12,
    stun: 30,
  },
  railgun: {
    name: "Surcharge",
    desc: "Chaque ennemi transpercé augmente les dégâts du tir de 20 %.",
    ramp: 0.2,
  },
  rocket: { name: "Charge lourde", desc: "Explosions 35 % plus larges.", explosion: 1.35 },
  plasma: {
    name: "Plasma corrosif",
    desc: "Les orbes enflamment les ennemis touchés.",
    chance: 1,
    burn: { ticks: 120, dps: 0.5 },
  },
  flamer: {
    name: "Feu persistant",
    desc: "35 % de chance d'enflammer durablement l'ennemi.",
    chance: 0.35,
    burn: { ticks: 240, dps: 0.8 },
  },
  disc: { name: "Disque vampire", desc: "Chaque ennemi touché par le disque rend 1 PV.", heal: 1 },
  tesla: { name: "Surtension", desc: "+2 rebonds d'éclair.", chain: 2 },
  blades: { name: "Lames boomerang", desc: "Les lames reviennent vers vous et retouchent.", returns: 26 },
  nova: {
    name: "Étoile filante",
    desc: "15 % de chance qu'une étoile s'abatte sur l'ennemi touché.",
    chance: 0.15,
    radius: 100,
    damage: 5,
  },

  // --- Armures ---
  vest: { name: "Réflexe", desc: "Touché : bouclier de 1 s (toutes les 8 s).", shield: 60, cooldown: 8000 },
  suit: { name: "Élan", desc: "Après un dash : +25 % de vitesse pendant 2 s.", speed: 0.25, ticks: 120 },
  plated: { name: "Blindage", desc: "Dégâts reçus réduits de 10 %.", reduce: 0.1 },
  heavy: {
    name: "Onde d'impact",
    desc: "Touché : une onde de choc repousse et blesse (toutes les 5 s).",
    radius: 170,
    damage: 3,
    push: 60,
    cooldown: 5000,
  },
  cloak: {
    name: "Traînée spectrale",
    desc: "Le dash laisse une traînée qui ralentit les ennemis.",
    life: 150,
    radius: 42,
    slow: 0.45,
    slowTicks: 90,
  },
  exo: { name: "Systèmes de secours", desc: "Sous 30 % de PV : régénération triplée.", below: 0.3, regen: 2 },
  magcoat: {
    name: "Impulsion magnétique",
    desc: "Toutes les 20 s, attire toutes les gemmes.",
    cooldown: 20000,
  },
  spiked: {
    name: "Épines volantes",
    desc: "Touché : 8 épines partent tout autour (toutes les 3 s).",
    count: 8,
    damage: 1.5,
    cooldown: 3000,
  },
  quantum: {
    name: "Critique quantique",
    desc: "Les coups critiques ont 20 % de chance de lancer un éclair.",
    chance: 0.2,
    chain: 3,
  },
  looter: { name: "Œil du pillard", desc: "+15 % d'XP.", xp: 0.15 },
  aegis: { name: "Renaissance céleste", desc: "Une fois par partie, survit à un coup mortel.", revives: 1 },

  // --- Héros ---
  pilot: { name: "As du pilotage", desc: "Compétence chargée 20 % plus vite.", charge: 0.8 },
  ninja: { name: "Dash fantôme", desc: "Le dash lance 6 kunai tout autour.", count: 6, damage: 1 },
  titan: { name: "Peau de pierre", desc: "Dégâts reçus réduits de 15 %.", reduce: 0.15 },
  mage: { name: "Brasier", desc: "Aura de feu 30 % plus large.", aura: 1.3 },
  pirate: {
    name: "Trésor caché",
    desc: "5 % de chance qu'un ennemi éliminé lâche 15 or de plus.",
    chance: 0.05,
    gold: 15,
  },
  engineer: { name: "Usine", desc: "La compétence pose 3 tourelles au lieu de 2.", turrets: 3 },
  spectre: { name: "Faim du vide", desc: "La Nova du vide soigne deux fois plus.", heal: 2 },
  seraph: { name: "Ailes de lumière", desc: "Chaque dash soigne 3 % des PV max.", heal: 0.03 },

  // --- Familiers ---
  drone: { name: "Double canon", desc: "Le drone tire deux lasers.", shots: 2 },
  collector: { name: "Prospection", desc: "+10 % d'XP.", xp: 0.1 },
  medic: { name: "Urgence", desc: "Sous 30 % de PV, soigne deux fois plus souvent.", below: 0.3 },
  reaper: { name: "Moisson", desc: "Chaque ennemi tranché rend 1 PV.", heal: 1 },
  frost: { name: "Blizzard", desc: "Gèle 5 ennemis au lieu de 3.", targets: 5 },
  guardian: { name: "Rempart", desc: "Le bouclier repousse les ennemis proches.", radius: 150, push: 70 },
  dragon: { name: "Fournaise", desc: "7 boules de feu au lieu de 5.", fireballs: 7 },
  phoenix: {
    name: "Flammes éternelles",
    desc: "Le rayon du phénix enflamme les ennemis.",
    burn: { ticks: 180, dps: 0.8 },
  },

  // --- Modules ---
  critChip: { name: "Coup fatal", desc: "Critiques ×2 au lieu de ×1,5.", critMult: 0.5 },
  magnetChip: { name: "Gemmes vitales", desc: "Chaque gemme ramassée rend 0,5 PV.", heal: 0.5 },
  fireChip: {
    name: "Frénésie",
    desc: "3 % de chance de tir frénétique (2 s) à chaque élimination.",
    chance: 0.03,
    ticks: 120,
  },
  xpChip: { name: "Second souffle", desc: "Chaque montée de niveau soigne 20 % des PV.", heal: 0.2 },
  powerChip: { name: "Tueur de boss", desc: "+20 % de dégâts contre les boss.", boss: 0.2 },
  lifeChip: { name: "Soins renforcés", desc: "Soins 25 % plus efficaces.", heal: 0.25 },
  overclock: { name: "Surcadençage", desc: "Chaque dash charge la compétence.", charge: 2 },
  singularity: {
    name: "Trou noir",
    desc: "Toutes les 10 s, aspire et broie les ennemis proches.",
    cooldown: 10000,
    radius: 280,
    damage: 8,
    pull: 0.5,
  },
};

/** Panoplies : arme + armure équipées ensemble → bonus en plus (sans condition de prestige). */
export const SETS = [
  {
    id: "stellar",
    name: "Stellaire",
    weapon: "nova",
    armor: "aegis",
    desc: "Toutes les 3 s, 5 étoiles s'abattent sur les ennemis.",
    every: 3000,
    stars: 5,
    radius: 90,
    damage: 4,
  },
  {
    id: "storm",
    name: "Tempête",
    weapon: "tesla",
    armor: "quantum",
    desc: "Toutes les 4 s, la foudre frappe 4 ennemis.",
    every: 4000,
    strikes: 4,
    damage: 3,
  },
  {
    id: "inferno",
    name: "Brasier",
    weapon: "flamer",
    armor: "heavy",
    desc: "Un anneau de flammes vous entoure.",
    auraRadius: 90,
    auraDamage: 4,
  },
  {
    id: "commando",
    name: "Commando",
    weapon: "smg",
    armor: "vest",
    desc: "+15 % de cadence.",
    fireRate: 0.15,
  },
  {
    id: "shadow",
    name: "Ombre",
    weapon: "disc",
    armor: "cloak",
    desc: "Le dash lance 3 disques tout autour.",
    discs: 3,
  },
  {
    id: "fortress",
    name: "Forteresse",
    weapon: "railgun",
    armor: "plated",
    desc: "+2 perforations et +3 défense.",
    pierce: 2,
    defense: 3,
  },
  {
    id: "demolition",
    name: "Démolition",
    weapon: "rocket",
    armor: "spiked",
    desc: "Les ennemis éliminés ont 15 % de chance d'exploser.",
    explosionChance: 0.15,
  },
  { id: "raider", name: "Pillard", weapon: "shotgun", armor: "looter", desc: "+25 % d'or.", gold: 0.25 },
  {
    id: "dancer",
    name: "Danseur de lames",
    weapon: "blades",
    armor: "suit",
    desc: "+15 % de vitesse.",
    speed: 0.15,
  },
  {
    id: "reactor",
    name: "Réacteur",
    weapon: "plasma",
    armor: "exo",
    desc: "Bouclier de 2 s toutes les 15 s.",
    every: 15000,
    shield: 120,
  },
  {
    id: "recruit",
    name: "Recrue",
    weapon: "blaster",
    armor: "magcoat",
    desc: "+10 % d'XP et +10 % d'or.",
    xp: 0.1,
    gold: 0.1,
  },
];

/** Panoplie d'un objet (arme ou armure), ou null. */
export function setOf(id) {
  return SETS.find((s) => s.weapon === id || s.armor === id) || null;
}

// --- SYNERGIES : familier + arme équipés ensemble (comportements dans systems/synergies.js) ---
// Une synergie par familier, avec une ou plusieurs armes partenaires (`weapons`) ; chaque arme en a au
// moins une. Les dégâts sont des multiples de l'attaque du joueur (ou du tir d'origine), les durées en
// millisecondes. Nouvelle synergie = une entrée ici + son comportement dans `BEHAVIORS` de systems/synergies.js.
export const SYNERGIES = [
  {
    id: "iceShatter",
    name: "Givre brisé",
    pet: "frost",
    weapons: ["railgun"],
    desc: "Les ennemis gelés touchés par le Railgun éclatent en éclats de glace.",
    color: "#9fe8ff",
    shards: 6,
    damage: 0.5, // dégâts de chaque éclat, en part du tir qui a brisé la glace
    speed: 9,
    life: 32,
  },
  {
    id: "dragonFire",
    name: "Souffle ardent",
    pet: "dragon",
    weapons: ["flamer"],
    desc: "Rayon de l'Aura de feu et portée des flammes +20 %.",
    color: "#ff5a1f",
    aura: 0.2,
    range: 0.2,
  },
  {
    id: "soulHarvest",
    name: "Moissonneuse d'âmes",
    pet: "reaper",
    weapons: ["blades"],
    desc: "Chaque élimination écarte les lames : portée des lames et orbite de la Faucheuse grandissent (max 15), retombent après 3 s sans élimination.",
    color: "#ff3355",
    maxStacks: 15,
    range: 0.04, // portée des lames en plus par cumul
    orbit: 5, // rayon d'orbite de la Faucheuse en plus par cumul (px)
    damage: 0.03, // dégâts de la Faucheuse en plus par cumul
    keep: 3000, // durée des cumuls sans nouvelle élimination
  },
  {
    id: "barrage",
    name: "Tir de barrage",
    pet: "drone",
    weapons: ["smg"],
    desc: "Le drone copie chaque tir du joueur (même angle, Multi-Tir et Ricochet compris) à 40 % des dégâts.",
    color: "#00ff88",
    damage: 0.4,
  },
  {
    id: "fatalPull",
    name: "Attraction fatale",
    pet: "collector",
    weapons: ["nova", "rocket"],
    desc: "Chaque gemme d'XP ramassée déclenche une micro-explosion autour de vous.",
    color: "#ffee00",
    radius: 70,
    damage: 0.8,
    cooldown: 90, // au plus une explosion toutes les 90 ms (beaucoup de gemmes d'un coup)
  },
  {
    id: "vitalCurrent",
    name: "Courant vital",
    pet: "medic",
    weapons: ["tesla", "plasma"],
    desc: "Chaque intervention du Médic lance un arc électrique qui rebondit sur 4 ennemis.",
    color: "#00ffcc",
    range: 320,
    damage: 2,
    jumps: 4,
  },
  {
    id: "bulwark",
    name: "Rempart offensif",
    pet: "guardian",
    weapons: ["shotgun"],
    desc: "Tant que le bouclier du Gardien tient, les plombs font +35 % de dégâts et transpercent un ennemi de plus.",
    color: "#4d9bff",
    damage: 0.35,
    pierce: 1,
  },
  {
    id: "cinders",
    name: "Cendres ardentes",
    pet: "phoenix",
    weapons: ["disc", "blaster"],
    desc: "Les tirs ont 30 % de chance d'enflammer ; un ennemi qui meurt en brûlant explose et enflamme ses voisins.",
    color: "#ff4d2e",
    chance: 0.3,
    burn: { ticks: 180, dps: 0.6 },
    radius: 80,
    damage: 1.5,
    perTick: 3, // explosions en chaîne au plus par tick
  },
];

/** Synergie entre un familier et une arme (identifiants), ou null. */
export function synergyOf(petId, weaponId) {
  return SYNERGIES.find((s) => s.pet === petId && s.weapons.includes(weaponId)) || null;
}

/** Synergies d'un objet (familier ou arme). */
export function synergiesOf(id) {
  return SYNERGIES.filter((s) => s.pet === id || s.weapons.includes(id));
}
