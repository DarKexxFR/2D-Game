// Liste des améliorations proposées à chaque montée de niveau.
// `canApply(p)` filtre les cartes proposées, `apply(p)` modifie le joueur.
//
// POUVOIRS : chaque amélioration (UPGRADES) et chaque carte corrompue est un pouvoir. Un joueur en porte
// au plus `POWER_RULES.slots` ; reprendre la carte d'un pouvoir possédé le fait monter de niveau
// (jusqu'à `max`, par défaut `POWER_RULES.maxLevel`). Emplacements pleins = seules les cartes des
// pouvoirs possédés (et les armes d'appoint, évolutions, fusions) sont proposées. Le niveau d'un pouvoir
// est son nombre dans `p.inventory`, comme avant.

import { STAT_CAPS } from "../config.js";
import { createHealEffect } from "../systems/effects.js";
import { WEAPONS } from "./items.js";
import { CARD_EFFECTS as C } from "./cardEffects.js";
import {
  SIDE_FUSIONS,
  SIDE_WEAPONS,
  SIDE_WEAPON_IDS,
  SIDE_WEAPON_RULES,
  sideWeaponOf,
} from "./sideWeapons.js";

export const POWER_RULES = {
  slots: 6, // pouvoirs différents au plus par partie
  maxLevel: 5, // niveau maximum par défaut d'un pouvoir
  // Tout est au maximum : cartes de secours (ui/upgradeMenu.js) à la place des pouvoirs
  filler: { heal: 0.3, gold: 30, goldPerWave: 6 },
};

/** Niveau du pouvoir (ou de la carte) `name` chez `p` : 0 s'il ne le possède pas. */
const count = (p, name) => p.inventory[name] || 0;

/** Noms des pouvoirs (remplis plus bas, une fois les listes définies). */
const POWER_NAMES = new Set();

/** Pouvoirs possédés par `p` (noms), dans l'ordre où il les a pris. */
export const ownedPowers = (p) => Object.keys(p.inventory).filter((name) => POWER_NAMES.has(name));

/**
 * Déclare un pouvoir : niveau maximum, emplacement libre exigé pour le prendre, puis la condition
 * propre à la carte (`canApply`, plafonds de statistiques).
 * @param {any} def
 */
function power(def) {
  const max = def.max ?? POWER_RULES.maxLevel;
  const extra = def.canApply;
  return {
    ...def,
    max,
    power: true,
    /** @param {any} p */
    canApply: (p) => {
      const level = count(p, def.name);
      if (level >= max) return false;
      if (level === 0 && ownedPowers(p).length >= POWER_RULES.slots) return false;
      return !extra || extra(p);
    },
  };
}

// Valeurs par niveau : moins de pouvoirs, donc chaque niveau compte plus qu'une ancienne carte.
export const UPGRADES = [
  // --- COMMUNES ---
  {
    name: "Force Brute",
    rarity: "common",
    icon: "sword",
    desc: "+6 Attaque",
    apply: (p) => (p.attack += 6),
  },
  {
    name: "Vitalité",
    rarity: "common",
    icon: "heart",
    desc: "+80 HP Max",
    apply: (p) => {
      p.maxHealth += 80;
      p.health += 80;
      createHealEffect(p.worldX, p.worldY);
    },
  },
  {
    name: "Bottes Légères",
    rarity: "common",
    icon: "boot",
    desc: "+12% Vitesse",
    canApply: (p) => p.baseSpeed < STAT_CAPS.speed,
    apply: (p) => (p.baseSpeed *= 1.12),
  },
  {
    name: "Aimant",
    rarity: "common",
    icon: "magnet",
    desc: "+60% Portée de ramassage",
    canApply: (p) => p.magnetRadius < STAT_CAPS.magnet,
    apply: (p) => (p.magnetRadius *= 1.6),
  },
  {
    name: "Avidité",
    rarity: "common",
    icon: "coin",
    desc: "+30% Gain d'Or",
    apply: (p) => (p.greed += 0.3),
  },
  {
    name: "Recul",
    rarity: "common",
    icon: "impact",
    desc: "+75% Force de Recul",
    apply: (p) => (p.knockbackMult += 0.75),
  },
  {
    name: "Givre",
    rarity: "common",
    icon: "snowflake",
    desc: `Vos tirs ralentissent les ennemis touchés (-${Math.round(C.frost.slow * 100)}% de vitesse par niveau)`,
    max: C.frost.max,
    apply: (p) => p.frost++,
  },
  {
    name: "Œil critique",
    rarity: "common",
    icon: "eye",
    desc: "+10% Chance de critique, +30% Dégâts critiques",
    canApply: (p) => p.critChance < 0.8,
    apply: (p) => {
      p.critChance += 0.1;
      p.critMultiplier += 0.3;
    },
  },

  // --- RARES ---
  {
    name: "Aura de Feu",
    rarity: "rare",
    icon: "flame",
    desc: "Dégâts de zone constants (plus large et plus forte à chaque niveau)",
    apply: (p) => {
      if (p.auraRadius === 0) {
        p.auraRadius = 110;
        p.auraDamage = 8;
      } else {
        p.auraRadius += 25;
        p.auraDamage += 5;
      }
    },
  },
  {
    name: "Mitraillette",
    rarity: "rare",
    icon: "smg",
    desc: "-18% Cooldown Tir",
    canApply: (p) => p.attackSpeed > STAT_CAPS.attackSpeed,
    apply: (p) => (p.attackSpeed *= 0.82),
  },
  {
    name: "Sniper",
    rarity: "rare",
    icon: "target",
    desc: "+15% Crit, +7 Attaque",
    canApply: (p) => p.critChance < 0.8,
    apply: (p) => {
      p.critChance += 0.15;
      p.attack += 7;
    },
  },
  {
    name: "Perçage",
    rarity: "rare",
    icon: "pierce",
    desc: "Balles traversent +1 ennemi",
    apply: (p) => (p.piercing += 1),
  },
  {
    name: "Régénération",
    rarity: "rare",
    icon: "heartPlus",
    desc: "+2 HP / sec",
    apply: (p) => (p.regen += 2),
  },
  {
    name: "Ricochet",
    rarity: "rare",
    icon: "repeat",
    desc: "Vos tirs rebondissent vers un ennemi proche (+1 rebond)",
    max: C.ricochet.max,
    apply: (p) => p.ricochet++,
  },
  {
    name: "Bouclier d'énergie",
    rarity: "rare",
    icon: "shield",
    desc: `Bloque un coup toutes les ${C.energyShield.seconds} s (-${C.energyShield.perCard} s par niveau)`,
    max: C.energyShield.max,
    apply: (p) => p.energyShield++,
  },
  {
    name: "Dash explosif",
    rarity: "rare",
    icon: "bomb",
    desc: "Le dash fait exploser les ennemis autour de vous (plus large et plus fort à chaque niveau)",
    max: C.dashBlast.max,
    canApply: (p) => !p.noDash,
    apply: (p) => p.dashBlast++,
  },

  // --- ÉPIQUES ---
  {
    name: "Orbe Protecteur",
    rarity: "epic",
    icon: "orbit",
    desc: "Projectiles rotatifs autour de vous (2 au niveau 1, puis +1)",
    canApply: (p) => p.orbitals < 6,
    apply: (p) => (p.orbitals = Math.min(6, p.orbitals + (count(p, "Orbe Protecteur") === 0 ? 2 : 1))),
  },
  {
    name: "Kunai",
    rarity: "epic",
    icon: "kunai",
    desc: "Lance automatiquement +1 kunai perçant",
    apply: () => {},
  },
  {
    name: "Multi-Tir",
    rarity: "epic",
    icon: "multishot",
    desc: "+1 Projectile",
    // Le nombre de projectiles est dérivé du niveau du pouvoir (voir combat.js)
    max: 4,
    apply: () => {},
  },
  {
    name: "Épines",
    rarity: "epic",
    icon: "thorns",
    desc: "Renvoie 60% des dégâts reçus",
    apply: (p) => (p.thorns += 0.6),
  },
  {
    name: "Explosion",
    rarity: "epic",
    icon: "bomb",
    desc: "+20% de chance que l'ennemi touché explose",
    canApply: (p) => p.explosionChance < 1.0,
    apply: (p) => (p.explosionChance += 0.2),
  },
  {
    name: "Arc électrique",
    rarity: "epic",
    icon: "bolt",
    desc: `+${Math.round(C.arc.chance * 100)}% de chance qu'un tir foudroie ${C.arc.jumps} ennemis voisins`,
    max: C.arc.max,
    apply: (p) => p.arc++,
  },
  {
    name: "Pulsar",
    rarity: "epic",
    icon: "star",
    desc: `Un tir sur ${C.pulsar.every} est géant : plus gros, ${C.pulsar.damage}× plus fort, perçant (un de moins par niveau)`,
    max: C.pulsar.max,
    apply: (p) => p.pulsar++,
  },

  // --- LÉGENDAIRES ---
  {
    name: "Vampirisme",
    rarity: "legendary",
    icon: "drop",
    desc: "+4% Vol de Vie par tir",
    canApply: (p) => p.vampirism < 0.2,
    apply: (p) => (p.vampirism += 0.04),
  },
  {
    name: "Berserker",
    rarity: "legendary",
    icon: "rage",
    desc: "+30 Dégâts, -20% HP",
    max: 3,
    canApply: (p) => p.maxHealth > 100,
    apply: (p) => {
      p.attack += 30;
      p.maxHealth *= 0.8;
      p.health = Math.min(p.health, p.maxHealth);
    },
  },
  {
    name: "Divinité",
    rarity: "legendary",
    icon: "sparkle",
    desc: "Attaque, PV max et vitesse +18%",
    apply: (p) => {
      p.attack *= 1.18;
      p.maxHealth *= 1.18;
      p.health += 30;
      p.baseSpeed *= 1.18;
    },
  },
  {
    name: "Exécution",
    rarity: "legendary",
    icon: "skull",
    desc: "Tue instantanément sous +20% de PV (hors boss)",
    max: 3,
    apply: (p) => (p.executionThreshold += 0.2),
  },
  {
    name: "Surtension",
    rarity: "legendary",
    icon: "pulse",
    desc: `Toutes les ${C.surge.kills} éliminations, une nova foudroie tout autour (-${C.surge.perCard} par niveau)`,
    max: C.surge.max,
    apply: (p) => p.surge++,
  },
].map(power);

// --- CORROMPUES : gros bonus contre un malus (risque / récompense) ---
// Pouvoirs à un seul niveau (une fois par partie chacun, ils prennent un emplacement) ; jamais dans un
// coffre de boss ni un sanctuaire maudit. `malus` est affiché en rouge sous la description.
const BLOOD_PACT = { ms: 5000, heal: 0.012 }; // soin par gemme : 1,2 % des PV max

export const CORRUPTED_UPGRADES = [
  {
    name: "Surcharge moteur",
    rarity: "corrupted",
    icon: "bolt",
    desc: "+35% Vitesse de déplacement",
    malus: "Dash désactivé",
    canApply: (p) => p.baseSpeed < STAT_CAPS.speed,
    apply: (p) => {
      p.baseSpeed *= 1.35;
      p.noDash = true;
      p.isDashing = false;
    },
  },
  {
    name: "Singularité",
    rarity: "corrupted",
    icon: "blackhole",
    desc: "+50% Taille des tirs et des explosions",
    malus: "-25% Cadence de tir",
    apply: (p) => {
      p.projScale *= 1.5;
      p.attackSpeed /= 0.75;
    },
  },
  {
    name: "Pacte de sang",
    rarity: "corrupted",
    icon: "drop",
    desc: "Après un coup reçu, les gemmes d'XP soignent pendant 5 s",
    malus: "-15% XP gagnée",
    apply: (p) => {
      p.bloodPact = BLOOD_PACT;
      p.xpBonus -= 0.15;
    },
  },
  {
    name: "Cœur de verre",
    rarity: "corrupted",
    icon: "impact",
    desc: "+50% Dégâts",
    malus: "Soins réduits de moitié",
    apply: (p) => {
      p.attack *= 1.5;
      p.healMult *= 0.5;
    },
  },
  {
    name: "Fièvre de l'or",
    rarity: "corrupted",
    icon: "coin",
    desc: "+60% Or gagné",
    malus: "+20% Dégâts reçus",
    apply: (p) => {
      p.goldBonus += 0.6;
      p.damageTaken *= 1.2;
    },
  },
  {
    name: "Dette de temps",
    rarity: "corrupted",
    icon: "repeat",
    desc: "Compétence chargée deux fois plus vite",
    malus: "Dash deux fois plus long à recharger",
    apply: (p) => {
      p.ultGain *= 2;
      p.dashCooldown *= 2;
    },
  },
  {
    name: "Furie aveugle",
    rarity: "corrupted",
    icon: "rage",
    desc: "+40% Dégâts et +20% Cadence de tir",
    malus: "Champ de vision réduit",
    apply: (p) => {
      p.attack *= 1.4;
      p.attackSpeed *= 0.8;
      p.blind = true;
    },
  },
].map((u) => power({ ...u, max: 1 }));

for (const u of [...UPGRADES, ...CORRUPTED_UPGRADES]) POWER_NAMES.add(u.name);

/** Niveau maximum d'un pouvoir d'après son nom. */
const powerMax = (name) => UPGRADES.find((u) => u.name === name)?.max ?? POWER_RULES.maxLevel;

// --- ÉVOLUTIONS : pouvoir au niveau maximum + pouvoir partenaire → super-arme ---
// Elles sont proposées en priorité à la montée de niveau dès que la recette est complète.
const evolution = ({ id, name, icon, desc, base, baseMax = powerMax(base), partner }) => ({
  id,
  name,
  icon,
  desc,
  rarity: "evolution",
  base,
  partner,
  recipe: `${base} niv. ${baseMax} + ${partner}`,
  canApply: (p) => !p.evolutions[id] && count(p, base) >= baseMax && count(p, partner) >= 1,
  apply: (p) => (p.evolutions[id] = true),
});

export const EVOLUTIONS = [
  evolution({
    id: "bladeStorm",
    name: "Tempête de lames",
    icon: "shuriken",
    desc: "Des kunai partent dans toutes les directions et transpercent tout.",
    base: "Kunai",
    partner: "Multi-Tir",
  }),
  evolution({
    id: "inferno",
    name: "Enfer",
    icon: "flame",
    desc: "Aura immense qui brûle deux fois plus vite et plus fort.",
    base: "Aura de Feu",
    partner: "Explosion",
  }),
  evolution({
    id: "guardianRing",
    name: "Anneau gardien",
    icon: "orbit",
    desc: "Orbes géants, plus rapides, qui frappent 5 fois plus fort.",
    base: "Orbe Protecteur",
    partner: "Épines",
  }),
  evolution({
    id: "bloodHarvest",
    name: "Moisson sanglante",
    icon: "drop",
    desc: "Les éliminations rendent jusqu'à 5 % de vos PV max par seconde.",
    base: "Vampirisme",
    partner: "Régénération",
  }),
  evolution({
    id: "absoluteZero",
    name: "Zéro absolu",
    icon: "snowflake",
    desc: "Vos tirs gèlent net les ennemis (les boss ralentissent) et les ennemis gelés prennent +30% de dégâts.",
    base: "Givre",
    partner: "Arc électrique",
  }),
  evolution({
    id: "stellarStorm",
    name: "Tempête stellaire",
    icon: "star",
    desc: "Novas deux fois plus grandes et deux fois plus souvent ; chaque tir géant explose.",
    base: "Pulsar",
    partner: "Surtension",
  }),
];

// --- ÉVOLUTIONS D'ARMES : arme équipée + amélioration partenaire → arme évoluée pour la partie ---
// `stats(w)` reçoit l'arme actuelle (dégâts déjà multipliés par le niveau et le prestige).
const weaponEvolution = ({ id, name, desc, weapon, partner, count: needed, stats }) => ({
  id,
  name,
  icon: WEAPONS[weapon].icon,
  desc,
  rarity: "evolution",
  weapon,
  partner,
  recipe: `${WEAPONS[weapon].name} équipé + ${partner} ×${needed}`,
  canApply: (p) => !p.evolutions[id] && p.weapon?.id === weapon && count(p, partner) >= needed,
  apply: (p) => evolveWeapon(p, id, name, stats),
});

/** Remplace l'arme du joueur par sa version évoluée (la couleur reste celle de l'arme ou du duel). */
function evolveWeapon(p, id, name, stats) {
  const old = p.weapon;
  p.weapon = { ...old, ...stats(old), name, evolved: id, color: old.color };
  p.attackSpeed *= p.weapon.cooldown / old.cooldown;
  p.evolutions[id] = true;
}

export const WEAPON_EVOLUTIONS = [
  weaponEvolution({
    id: "solarBlaster",
    name: "Blaster solaire",
    desc: "Trois rayons plus gros et plus forts qui traversent un ennemi.",
    weapon: "blaster",
    partner: "Force Brute",
    count: 3,
    stats: (w) => ({
      projectiles: 3,
      spread: 0.14,
      damage: w.damage * 1.3,
      size: w.size * 1.3,
      pierce: w.pierce + 1,
    }),
  }),
  weaponEvolution({
    id: "leadStorm",
    name: "Ouragan de plomb",
    desc: "Deux canons, cadence encore plus folle, balles précises et perçantes.",
    weapon: "smg",
    partner: "Mitraillette",
    count: 2,
    stats: (w) => ({
      projectiles: 2,
      spread: 0.08,
      inaccuracy: 0.06,
      cooldown: w.cooldown * 0.75,
      damage: w.damage * 1.25,
      pierce: w.pierce + 1,
    }),
  }),
  weaponEvolution({
    id: "stormCannon",
    name: "Canon tempête",
    desc: "Neuf plombs perçants qui portent bien plus loin.",
    weapon: "shotgun",
    partner: "Recul",
    count: 2,
    stats: (w) => ({ projectiles: 9, spread: 0.11, range: 44, pierce: w.pierce + 1, damage: w.damage * 1.2 }),
  }),
  weaponEvolution({
    id: "ionLance",
    name: "Lance ionique",
    desc: "Un rayon géant qui traverse tout, plus fort et plus rapide.",
    weapon: "railgun",
    partner: "Perçage",
    count: 3,
    stats: (w) => ({ damage: w.damage * 1.6, pierce: 99, size: w.size * 1.6, cooldown: w.cooldown * 0.75 }),
  }),
  weaponEvolution({
    id: "missileRain",
    name: "Pluie de missiles",
    desc: "Trois roquettes en éventail aux explosions bien plus larges.",
    weapon: "rocket",
    partner: "Explosion",
    count: 2,
    stats: (w) => ({ projectiles: 3, spread: 0.3, explosion: 120, cooldown: w.cooldown * 0.85 }),
  }),
  weaponEvolution({
    id: "supernova",
    name: "Supernova",
    desc: "Des orbes énormes qui explosent sur une zone deux fois plus grande.",
    weapon: "plasma",
    partner: "Sniper",
    count: 2,
    stats: (w) => ({ explosion: 90, size: w.size * 1.5, damage: w.damage * 1.35 }),
  }),
  weaponEvolution({
    id: "dragonBreath",
    name: "Souffle du dragon",
    desc: "Quatre jets de flammes plus longs qui traversent des rangées entières.",
    weapon: "flamer",
    partner: "Aura de Feu",
    count: 2,
    stats: (w) => ({ projectiles: 4, range: 36, pierce: 5, damage: w.damage * 1.3 }),
  }),
  weaponEvolution({
    id: "whirlwind",
    name: "Tourbillon",
    desc: "Trois disques lancés tout autour de vous, plus forts et plus durables.",
    weapon: "disc",
    partner: "Orbe Protecteur",
    count: 2,
    stats: (w) => ({ projectiles: 3, ring: true, damage: w.damage * 1.3, lifetime: 240 }),
  }),
  weaponEvolution({
    id: "ionStorm",
    name: "Tempête ionique",
    desc: "Les éclairs rebondissent sur 8 ennemis, plus vite et plus fort.",
    weapon: "tesla",
    partner: "Multi-Tir",
    count: 2,
    stats: (w) => ({ chain: 8, damage: w.damage * 1.25, cooldown: w.cooldown * 0.8 }),
  }),
  weaponEvolution({
    id: "chaosWheel",
    name: "Roue du chaos",
    desc: "Dix lames plus fortes qui traversent des rangées entières.",
    weapon: "blades",
    partner: "Kunai",
    count: 2,
    stats: (w) => ({ projectiles: 10, pierce: w.pierce + 3, damage: w.damage * 1.3 }),
  }),
  weaponEvolution({
    id: "starfall",
    name: "Pluie d'étoiles",
    desc: "Cinq étoiles aux explosions géantes qui foudroient 4 ennemis voisins.",
    weapon: "nova",
    partner: "Divinité",
    count: 1,
    stats: (w) => ({ projectiles: 5, spread: 0.16, explosion: 85, chain: 4, damage: w.damage * 1.3 }),
  }),
];

// --- ARMES D'APPOINT (data/sideWeapons.js) : une carte par arme, reprise à chaque niveau ---
// Nouvelle arme seulement s'il reste un emplacement libre ; la carte affiche ce que le niveau suivant apporte.
export const SIDE_WEAPON_CARDS = SIDE_WEAPON_IDS.map((id) => {
  const def = SIDE_WEAPONS[id];
  return {
    name: def.name,
    rarity: "weapon",
    icon: def.icon,
    desc: def.desc,
    sideWeapon: id,
    max: SIDE_WEAPON_RULES.maxLevel,
    /** @param {any} p */
    describe: (p) => {
      const w = sideWeaponOf(p, id);
      return w
        ? def.levels[w.level].desc
        : `Nouvelle arme : ${def.desc[0].toLowerCase()}${def.desc.slice(1)}`;
    },
    canApply: (p) => {
      const w = sideWeaponOf(p, id);
      return w ? w.level < SIDE_WEAPON_RULES.maxLevel : p.sideWeapons.length < SIDE_WEAPON_RULES.slots;
    },
    apply: (p) => {
      const w = sideWeaponOf(p, id);
      if (w) w.level++;
      else p.sideWeapons.push({ id, level: 1, timer: 0, angle: 0 });
    },
  };
});

// Évolution d'une arme d'appoint : niveau maximum + carte partenaire.
export const SIDE_EVOLUTIONS = SIDE_WEAPON_IDS.map((id) => {
  const def = SIDE_WEAPONS[id];
  return evolution({
    id: def.evolution.id,
    name: def.evolution.name,
    icon: def.icon,
    desc: def.evolution.desc,
    base: def.name,
    baseMax: SIDE_WEAPON_RULES.maxLevel,
    partner: def.evolution.partner,
  });
});

// --- FUSIONS : deux armes d'appoint au niveau maximum → une seule arme (data/sideWeapons.js SIDE_FUSIONS) ---
// Proposées en priorité comme les évolutions ; la fusion libère un emplacement d'arme d'appoint.
const topLevelMaxed = (p, id) =>
  p.sideWeapons.some((w) => w.id === id && !w.parts && w.level >= SIDE_WEAPON_RULES.maxLevel);

export const SIDE_FUSION_CARDS = Object.entries(SIDE_FUSIONS).map(([id, f]) => ({
  id,
  name: f.name,
  icon: f.icon,
  desc: `${f.desc} Les deux armes deviennent une seule, renforcée : un emplacement se libère.`,
  rarity: "fusion",
  parts: f.parts,
  recipe: f.parts.map((w) => `${SIDE_WEAPONS[w].name} niv. ${SIDE_WEAPON_RULES.maxLevel}`).join(" + "),
  canApply: (p) => !p.evolutions[id] && f.parts.every((w) => topLevelMaxed(p, w)),
  apply: (p) => fuseSideWeapons(p, id, f.parts),
}));

/** Remplace les deux armes d'appoint par leur fusion (à la place de la première). */
function fuseSideWeapons(p, id, ids) {
  const parts = ids.map((w) => p.sideWeapons.find((x) => x.id === w));
  const at = p.sideWeapons.indexOf(parts[0]);
  p.sideWeapons = p.sideWeapons.filter((w) => !parts.includes(w));
  p.sideWeapons.splice(at, 0, { id, level: SIDE_WEAPON_RULES.maxLevel, timer: 0, angle: 0, parts });
  p.evolutions[id] = true;
}

/** @type {any[]} évolutions d'armes, d'armes d'appoint, d'améliorations et fusions (formes différentes) */
const ALL_EVOLUTIONS = [...SIDE_FUSION_CARDS, ...WEAPON_EVOLUTIONS, ...SIDE_EVOLUTIONS, ...EVOLUTIONS];
const ALL_CARDS = [...UPGRADES, ...SIDE_WEAPON_CARDS, ...CORRUPTED_UPGRADES];

/** Texte d'une carte pour `p` (une arme d'appoint décrit son prochain niveau). */
export const cardDesc = (u, p) => (u.describe ? u.describe(p) : u.desc);

/** Carte (amélioration, arme d'appoint ou corrompue) d'après son nom, ou undefined. */
export const cardByName = (name) => ALL_CARDS.find((u) => u.name === name);

/** Toutes les évolutions obtenues par `p` (armes équipées, armes d'appoint, améliorations). */
export const ownedEvolutions = (p) => ALL_EVOLUTIONS.filter((e) => p.evolutions[e.id]);

export function availableUpgrades(p) {
  return ALL_CARDS.filter((u) => !u.canApply || u.canApply(p));
}

export function availableEvolutions(p) {
  return ALL_EVOLUTIONS.filter((e) => e.canApply(p));
}

/**
 * Évolutions encore à obtenir dont la carte `upgrade` est un ingrédient, l'autre ingrédient étant déjà
 * possédé : arme équipée (évolution d'arme), ou l'autre amélioration de la recette au moins une fois.
 */
export function evolutionsFor(upgrade, p) {
  if (upgrade.rarity === "evolution" || upgrade.rarity === "fusion") return [];
  const has = (name) => count(p, name) >= 1;
  return ALL_EVOLUTIONS.filter((e) => {
    if (p.evolutions[e.id]) return false;
    if (e.parts) return false; // fusion : deux armes au maximum, pas une carte partenaire
    if (e.weapon) return e.partner === upgrade.name && p.weapon?.id === e.weapon;
    return (e.partner === upgrade.name && has(e.base)) || (e.base === upgrade.name && has(e.partner));
  });
}

export function applyUpgrade(upgrade, p) {
  upgrade.apply(p);
  if (upgrade.filler) return; // carte de secours : ni pouvoir ni niveau
  p.inventory[upgrade.name] = (p.inventory[upgrade.name] || 0) + 1;
}
