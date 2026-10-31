// Cœur Cybernétique : arbre de passifs au-delà des talents, débloqué au niveau de compte `unlock.level`
// ou après avoir battu la vague `unlock.wave - 1`. Chaque nœud s'achète une fois avec de l'or ; avant une
// partie, au plus `activeSlots` nœuds sont actifs. Quatre branches de trois paliers : un palier demande
// le palier d'avant de la même branche (`requires`).
//
// `effects` est déclaratif, lu par systems/cyberCore.js :
//  - damage, fireRate, xp, gold, crit : bonus en part (0,2 = +20 %), négatifs = malus ;
//  - healthPct : PV max en part ; defense, regen : valeurs fixes ; speed : vitesse en part ;
//  - dashCooldown : recharge du dash en part (0,3 = 30 % plus courte) ; ultCharge : compétence (0,25 = 25 % plus vite) ;
//  - manualDamage : dégâts de l'arme en tir manuel (tir auto coupé, touche T) ;
//  - lowHealth : { below, damage } dégâts en plus sous une part des PV max ;
//  - shrineHold : ticks à tenir dans un sanctuaire maudit (au lieu de CURSED_SHRINE.hold) ;
//  - sideWeapons : armes d'appoint aléatoires au départ.
// Nouveau nœud = une entrée ici (et, pour un nouvel effet, sa lecture dans systems/cyberCore.js).

export const CYBER_CORE = {
  unlock: { level: 20, wave: 31 }, // niveau de compte 20 OU record de vague 31 (vague 30 battue)
  activeSlots: 3,
  /** Modes où le Cœur s'applique (comme les talents : jamais en défi du jour ; le duel passe par "normal"). */
  modes: ["normal", "rush"],
};

export const CORE_BRANCHES = [
  { id: "assault", name: "Assaut", color: "#ff2a6d", icon: "sword" },
  { id: "survival", name: "Survie", color: "#00ff88", icon: "shield" },
  { id: "fortune", name: "Fortune", color: "#ffd700", icon: "coin" },
  { id: "tech", name: "Technique", color: "#aa66ff", icon: "cpu" },
];

export const CORE_NODES = [
  // --- Assaut ---
  {
    id: "manualAim",
    branch: "assault",
    tier: 1,
    name: "Viseur manuel",
    desc: "Le tir manuel (tir auto coupé, touche T) inflige +25 % de dégâts.",
    cost: 4000,
    effects: { manualDamage: 0.25 },
  },
  {
    id: "overdrive",
    branch: "assault",
    tier: 2,
    requires: "manualAim",
    name: "Surrégime",
    desc: "+20 % de cadence, mais -10 % de vitesse.",
    cost: 8000,
    effects: { fireRate: 0.2, speed: -0.1 },
  },
  {
    id: "glassCannon",
    branch: "assault",
    tier: 3,
    requires: "overdrive",
    name: "Canon de verre",
    desc: "+35 % de dégâts, mais -25 % de PV max.",
    cost: 15000,
    effects: { damage: 0.35, healthPct: -0.25 },
  },
  // --- Survie ---
  {
    id: "nanoRegen",
    branch: "survival",
    tier: 1,
    name: "Nanorégénération",
    desc: "+2 PV par seconde, mais -10 % d'XP.",
    cost: 4000,
    effects: { regen: 2, xp: -0.1 },
  },
  {
    id: "rampart",
    branch: "survival",
    tier: 2,
    requires: "nanoRegen",
    name: "Rempart",
    desc: "+5 défense, mais -10 % de dégâts.",
    cost: 8000,
    effects: { defense: 5, damage: -0.1 },
  },
  {
    id: "lastStand",
    branch: "survival",
    tier: 3,
    requires: "rampart",
    name: "Dernier carré",
    desc: "Sous 30 % de PV, vos coups infligent +40 % de dégâts.",
    cost: 15000,
    effects: { lowHealth: { below: 0.3, damage: 0.4 } },
  },
  // --- Fortune ---
  {
    id: "arsenal",
    branch: "fortune",
    tier: 1,
    name: "Arsenal de départ",
    desc: "Commence la partie avec 1 arme d'appoint aléatoire, mais -20 % d'or.",
    cost: 4000,
    effects: { sideWeapons: 1, gold: -0.2 },
  },
  {
    id: "goldRush",
    branch: "fortune",
    tier: 2,
    requires: "arsenal",
    name: "Ruée vers l'or",
    desc: "+30 % d'or, mais -15 % de PV max.",
    cost: 8000,
    effects: { gold: 0.3, healthPct: -0.15 },
  },
  {
    id: "scholar",
    branch: "fortune",
    tier: 3,
    requires: "goldRush",
    name: "Érudit",
    desc: "+25 % d'XP, mais -10 % de cadence.",
    cost: 15000,
    effects: { xp: 0.25, fireRate: -0.1 },
  },
  // --- Technique ---
  {
    id: "ritualist",
    branch: "tech",
    tier: 1,
    name: "Rituel express",
    desc: "Les sanctuaires maudits se tiennent 3 s au lieu de 5 s.",
    cost: 4000,
    effects: { shrineHold: 180 },
  },
  {
    id: "thrusters",
    branch: "tech",
    tier: 2,
    requires: "ritualist",
    name: "Propulseurs",
    desc: "Dash rechargé 30 % plus vite, mais -10 % de PV max.",
    cost: 8000,
    effects: { dashCooldown: 0.3, healthPct: -0.1 },
  },
  {
    id: "capacitor",
    branch: "tech",
    tier: 3,
    requires: "thrusters",
    name: "Condensateur",
    desc: "Compétence chargée 25 % plus vite et +5 % de critiques, mais -10 % de vitesse.",
    cost: 15000,
    effects: { ultCharge: 0.25, crit: 0.05, speed: -0.1 },
  },
];

/** Nœud par identifiant. */
export const CORE_NODE = Object.fromEntries(CORE_NODES.map((n) => [n.id, n]));
