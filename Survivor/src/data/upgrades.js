// Liste des améliorations proposées à chaque montée de niveau.
// `canApply(p)` filtre les cartes proposées, `apply(p)` modifie le joueur.

import { STAT_CAPS } from "../config.js";
import { createHealEffect } from "../systems/effects.js";
import { WEAPONS } from "./items.js";
import { SIDE_WEAPONS, SIDE_WEAPON_IDS, SIDE_WEAPON_RULES, sideWeaponOf } from "./sideWeapons.js";

export const UPGRADES = [
  // --- COMMUNES ---
  {
    name: "Force Brute",
    rarity: "common",
    icon: "sword",
    desc: "+4 Attaque",
    apply: (p) => (p.attack += 4),
  },
  {
    name: "Vitalité",
    rarity: "common",
    icon: "heart",
    desc: "+50 HP Max",
    apply: (p) => {
      p.maxHealth += 50;
      p.health += 50;
      createHealEffect(p.worldX, p.worldY);
    },
  },
  {
    name: "Bottes Légères",
    rarity: "common",
    icon: "boot",
    desc: "+10% Vitesse",
    canApply: (p) => p.baseSpeed < STAT_CAPS.speed,
    apply: (p) => (p.baseSpeed *= 1.1),
  },
  {
    name: "Aimant",
    rarity: "common",
    icon: "magnet",
    desc: "+50% Portée",
    canApply: (p) => p.magnetRadius < STAT_CAPS.magnet,
    apply: (p) => (p.magnetRadius *= 1.5),
  },
  {
    name: "Avidité",
    rarity: "common",
    icon: "coin",
    desc: "+20% Gain d'Or",
    apply: (p) => (p.greed += 0.2),
  },
  {
    name: "Recul",
    rarity: "common",
    icon: "impact",
    desc: "+50% Force de Recul",
    apply: (p) => (p.knockbackMult += 0.5),
  },

  // --- RARES ---
  {
    name: "Aura de Feu",
    rarity: "rare",
    icon: "flame",
    desc: "Dégâts de zone constants",
    apply: (p) => {
      if (p.auraRadius === 0) {
        p.auraRadius = 100;
        p.auraDamage = 5;
      } else {
        p.auraRadius += 20;
        p.auraDamage += 3;
      }
    },
  },
  {
    name: "Mitraillette",
    rarity: "rare",
    icon: "smg",
    desc: "-15% Cooldown Tir",
    canApply: (p) => p.attackSpeed > STAT_CAPS.attackSpeed,
    apply: (p) => (p.attackSpeed *= 0.85),
  },
  {
    name: "Sniper",
    rarity: "rare",
    icon: "target",
    desc: "+20% Crit & Dégâts",
    canApply: (p) => p.critChance < 0.8,
    apply: (p) => {
      p.critChance += 0.2;
      p.attack += 5;
    },
  },
  {
    name: "Perçage",
    rarity: "rare",
    icon: "pierce",
    desc: "Balles traversent +1 ennemi",
    canApply: (p) => p.piercing < 5,
    apply: (p) => (p.piercing += 1),
  },
  {
    name: "Régénération",
    rarity: "rare",
    icon: "heartPlus",
    desc: "+1 HP / sec",
    apply: (p) => (p.regen += 1),
  },

  // --- ÉPIQUES ---
  {
    name: "Orbe Protecteur",
    rarity: "epic",
    icon: "orbit",
    desc: "+1 Projectile Rotatif",
    canApply: (p) => p.orbitals < 6,
    apply: (p) => p.orbitals++,
  },
  {
    name: "Kunai",
    rarity: "epic",
    icon: "kunai",
    desc: "Lance automatiquement +1 kunai perçant",
    canApply: (p) => (p.inventory.Kunai || 0) < 5,
    apply: () => {},
  },
  {
    name: "Multi-Tir",
    rarity: "epic",
    icon: "multishot",
    desc: "+1 Projectile (Max 5)",
    // Le nombre de projectiles est dérivé de l'inventaire (voir combat.js)
    canApply: (p) => (p.inventory["Multi-Tir"] || 0) < 4,
    apply: () => {},
  },
  {
    name: "Épines",
    rarity: "epic",
    icon: "thorns",
    desc: "Renvoie 50% des dégâts",
    canApply: (p) => p.thorns < 2.0,
    apply: (p) => (p.thorns += 0.5),
  },
  {
    name: "Explosion",
    rarity: "epic",
    icon: "bomb",
    desc: "20% chance boum ennemis",
    canApply: (p) => p.explosionChance < 1.0,
    apply: (p) => (p.explosionChance += 0.2),
  },

  // --- LÉGENDAIRES ---
  {
    name: "Vampirisme",
    rarity: "legendary",
    icon: "drop",
    desc: "2% Vol de Vie par tir",
    canApply: (p) => p.vampirism < 0.2,
    apply: (p) => (p.vampirism += 0.02),
  },
  {
    name: "Berserker",
    rarity: "legendary",
    icon: "rage",
    desc: "+30 Dégâts, -20% HP",
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
    desc: "Tout +15%",
    apply: (p) => {
      p.attack *= 1.15;
      p.maxHealth *= 1.15;
      p.health += 20;
      p.baseSpeed *= 1.15;
    },
  },
  {
    name: "Exécution",
    rarity: "legendary",
    icon: "skull",
    desc: "Tue instantanément < 20% HP",
    canApply: (p) => p.executionThreshold < 0.6,
    apply: (p) => (p.executionThreshold += 0.2),
  },
];

// --- CORROMPUES : gros bonus contre un malus (risque / récompense) ---
// Une seule fois par partie chacune ; jamais dans un coffre de boss ni un sanctuaire maudit.
// `malus` est affiché en rouge sous la description.
const once =
  (name, extra = (/** @type {any} */ p) => true) =>
  (p) =>
    !p.inventory[name] && extra(p);
const BLOOD_PACT = { ms: 5000, heal: 0.012 }; // soin par gemme : 1,2 % des PV max

export const CORRUPTED_UPGRADES = [
  {
    name: "Surcharge moteur",
    rarity: "corrupted",
    icon: "bolt",
    desc: "+35% Vitesse de déplacement",
    malus: "Dash désactivé",
    canApply: once("Surcharge moteur", (p) => p.baseSpeed < STAT_CAPS.speed),
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
    canApply: once("Singularité"),
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
    canApply: once("Pacte de sang"),
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
    canApply: once("Cœur de verre"),
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
    canApply: once("Fièvre de l'or"),
    apply: (p) => {
      p.goldBonus += 0.6;
      p.damageTaken *= 1.2;
    },
  },
];

// --- ÉVOLUTIONS : amélioration au maximum + amélioration partenaire → super-arme ---
// Elles sont proposées en priorité à la montée de niveau dès que la recette est complète.
const count = (p, name) => p.inventory[name] || 0;
const evolution = ({ id, name, icon, desc, base, baseMax, partner }) => ({
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
    baseMax: 5,
    partner: "Multi-Tir",
  }),
  evolution({
    id: "inferno",
    name: "Enfer",
    icon: "flame",
    desc: "Aura immense qui brûle deux fois plus vite et plus fort.",
    base: "Aura de Feu",
    baseMax: 5,
    partner: "Explosion",
  }),
  evolution({
    id: "guardianRing",
    name: "Anneau gardien",
    icon: "orbit",
    desc: "Orbes géants, plus rapides, qui frappent 5 fois plus fort.",
    base: "Orbe Protecteur",
    baseMax: 6,
    partner: "Épines",
  }),
  evolution({
    id: "bloodHarvest",
    name: "Moisson sanglante",
    icon: "drop",
    desc: "Les éliminations rendent jusqu'à 5 % de vos PV max par seconde.",
    base: "Vampirisme",
    baseMax: 5,
    partner: "Régénération",
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

const ALL_EVOLUTIONS = [...WEAPON_EVOLUTIONS, ...SIDE_EVOLUTIONS, ...EVOLUTIONS];
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
  if (upgrade.rarity === "evolution") return [];
  const has = (name) => count(p, name) >= 1;
  return ALL_EVOLUTIONS.filter((e) => {
    if (p.evolutions[e.id]) return false;
    if (e.weapon) return e.partner === upgrade.name && p.weapon?.id === e.weapon;
    return (e.partner === upgrade.name && has(e.base)) || (e.base === upgrade.name && has(e.partner));
  });
}

export function applyUpgrade(upgrade, p) {
  upgrade.apply(p);
  p.inventory[upgrade.name] = (p.inventory[upgrade.name] || 0) + 1;
}
