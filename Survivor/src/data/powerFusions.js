// FUSIONS DE POUVOIRS : deux pouvoirs montés assez haut (`POWER_FUSION_RULES.minLevel`) se fondent en un seul
// emplacement (data/upgrades.js : `p.mergedPowers`). Chaque pouvoir garde son niveau et ses effets, et peut
// encore monter jusqu'à son maximum ; la fusion ajoute un bonus (`apply`). Un pouvoir ne se fond qu'une fois.
// Les évolutions de pouvoirs (EVOLUTIONS) fondent aussi leurs deux pouvoirs.
//
// Nouvelle fusion = une entrée ici (deux pouvoirs de UPGRADES, jamais une carte corrompue) : la carte, la
// recette, l'aide « vers une fusion » et l'affichage du build se font seuls.

import { STAT_CAPS } from "../config.js";

export const POWER_FUSION_RULES = {
  minLevel: 3, // niveau exigé de chaque pouvoir (ou son maximum s'il est plus bas)
};

/**
 * @typedef {{ id: string, name: string, icon: string, desc: string, powers: [string, string],
 *   apply: (p: any) => void }} PowerFusion
 */

/** @type {PowerFusion[]} */
export const POWER_FUSIONS = [
  {
    id: "fuPredator",
    name: "Prédateur",
    icon: "target",
    desc: "+12% Attaque, +40% Dégâts critiques",
    powers: ["Force Brute", "Sniper"],
    apply: (p) => {
      p.attack *= 1.12;
      p.critMultiplier += 0.4;
    },
  },
  {
    id: "fuColossus",
    name: "Colosse",
    icon: "heartPlus",
    desc: "+150 PV max, +3 PV / sec",
    powers: ["Vitalité", "Régénération"],
    apply: (p) => {
      p.maxHealth += 150;
      p.health += 150;
      p.regen += 3;
    },
  },
  {
    id: "fuComet",
    name: "Comète",
    icon: "boot",
    desc: "+8% Vitesse, dash explosif plus large et plus fort",
    powers: ["Bottes Légères", "Dash explosif"],
    apply: (p) => {
      p.baseSpeed = Math.min(STAT_CAPS.speed, p.baseSpeed * 1.08);
      p.dashBlast++;
    },
  },
  {
    id: "fuGoldRain",
    name: "Pluie d'or",
    icon: "coin",
    desc: "+30% Portée de ramassage, +40% Gain d'or",
    powers: ["Aimant", "Avidité"],
    apply: (p) => {
      p.magnetRadius = Math.min(STAT_CAPS.magnet, p.magnetRadius * 1.3);
      p.greed += 0.4;
    },
  },
  {
    id: "fuShockwave",
    name: "Onde de choc",
    icon: "impact",
    desc: "+15% de chance d'explosion, +50% Force de recul",
    powers: ["Recul", "Explosion"],
    apply: (p) => {
      p.explosionChance += 0.15;
      p.knockbackMult += 0.5;
    },
  },
  {
    id: "fuIceShards",
    name: "Éclats de givre",
    icon: "snowflake",
    desc: "+1 rebond, ralentissement plus fort",
    powers: ["Givre", "Ricochet"],
    apply: (p) => {
      p.ricochet++;
      p.frost++;
    },
  },
  {
    id: "fuHawkEye",
    name: "Œil du faucon",
    icon: "eye",
    desc: "+8% Chance de critique, tirs traversent +2 ennemis",
    powers: ["Œil critique", "Perçage"],
    apply: (p) => {
      p.critChance += 0.08;
      p.piercing += 2;
    },
  },
  {
    id: "fuBurst",
    name: "Rafale",
    icon: "smg",
    desc: "-10% Cooldown tir, +8% Attaque",
    powers: ["Mitraillette", "Pulsar"],
    apply: (p) => {
      p.attackSpeed = Math.max(STAT_CAPS.attackSpeed, p.attackSpeed * 0.9);
      p.attack *= 1.08;
    },
  },
  {
    id: "fuFortress",
    name: "Forteresse",
    icon: "shield",
    desc: "Bouclier rechargé plus vite, +60% Dégâts renvoyés",
    powers: ["Bouclier d'énergie", "Épines"],
    apply: (p) => {
      p.energyShield++;
      p.thorns += 0.6;
    },
  },
  {
    id: "fuSolarAvatar",
    name: "Avatar solaire",
    icon: "flame",
    desc: "+10% Attaque, aura de feu plus large et plus forte",
    powers: ["Aura de Feu", "Divinité"],
    apply: (p) => {
      p.attack *= 1.1;
      p.auraRadius += 40;
      p.auraDamage += 10;
    },
  },
  {
    id: "fuLivingStorm",
    name: "Orage vivant",
    icon: "bolt",
    desc: "Éclairs plus fréquents, novas plus fréquentes",
    powers: ["Arc électrique", "Surtension"],
    apply: (p) => {
      p.arc++;
      p.surge++;
    },
  },
  {
    id: "fuWarThirst",
    name: "Soif de guerre",
    icon: "rage",
    desc: "+20 Attaque, +4% Vol de vie",
    powers: ["Berserker", "Vampirisme"],
    apply: (p) => {
      p.attack += 20;
      p.vampirism = Math.min(0.25, p.vampirism + 0.04); // la carte Vampirisme s'arrête à 20 %
    },
  },
  {
    id: "fuCleaver",
    name: "Couperet",
    icon: "skull",
    desc: "Exécution sous +5% de PV en plus, +8% Attaque",
    powers: ["Exécution", "Kunai"],
    apply: (p) => {
      p.executionThreshold += 0.05;
      p.attack *= 1.08;
    },
  },
  {
    id: "fuConstellation",
    name: "Constellation",
    icon: "orbit",
    desc: "+10% Attaque, -8% Cooldown tir",
    powers: ["Orbe Protecteur", "Multi-Tir"],
    apply: (p) => {
      p.attack *= 1.1;
      p.attackSpeed = Math.max(STAT_CAPS.attackSpeed, p.attackSpeed * 0.92);
    },
  },
];
