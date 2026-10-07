// Liste des améliorations proposées à chaque montée de niveau.
// `canApply(p)` filtre les cartes proposées, `apply(p)` modifie le joueur.

import { STAT_CAPS } from "../config.js";
import { createHealEffect } from "../systems/effects.js";

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

// --- ÉVOLUTIONS : amélioration au maximum + amélioration partenaire → super-arme ---
// Elles sont proposées en priorité à la montée de niveau dès que la recette est complète.
const count = (p, name) => p.inventory[name] || 0;
const evolution = ({ id, name, icon, desc, base, baseMax, partner }) => ({
  id,
  name,
  icon,
  desc,
  rarity: "evolution",
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
    desc: "Chaque ennemi tué rend 1 % de vos PV max.",
    base: "Vampirisme",
    baseMax: 5,
    partner: "Régénération",
  }),
];

export function availableUpgrades(p) {
  return UPGRADES.filter((u) => !u.canApply || u.canApply(p));
}

export function availableEvolutions(p) {
  return EVOLUTIONS.filter((e) => e.canApply(p));
}

export function applyUpgrade(upgrade, p) {
  upgrade.apply(p);
  p.inventory[upgrade.name] = (p.inventory[upgrade.name] || 0) + 1;
}
