// Arbre de talents : bonus permanents achetés avec l'or de la banque.
// Chaque talent a des rangs ; le prix augmente à chaque rang.

export const TALENTS = [
  {
    id: "power",
    name: "Puissance",
    icon: "sword",
    desc: (r) => `+${r * 5} % de dégâts`,
    max: 10,
    baseCost: 300,
    apply: (p, r) => (p.attack *= 1 + 0.05 * r),
  },
  {
    id: "vitality",
    name: "Vitalité",
    icon: "heart",
    desc: (r) => `+${r * 10} PV max`,
    max: 10,
    baseCost: 250,
    apply: (p, r) => (p.maxHealth += 10 * r),
  },
  {
    id: "agility",
    name: "Agilité",
    icon: "boot",
    desc: (r) => `+${r * 3} % de vitesse`,
    max: 5,
    baseCost: 400,
    apply: (p, r) => (p.baseSpeed *= 1 + 0.03 * r),
  },
  {
    id: "wisdom",
    name: "Sagesse",
    icon: "chartUp",
    desc: (r) => `+${r * 5} % d'XP`,
    max: 10,
    baseCost: 300,
    apply: (p, r) => (p.xpBonus += 0.05 * r),
  },
  {
    id: "fortune",
    name: "Fortune",
    icon: "coin",
    desc: (r) => `+${r * 5} % d'or`,
    max: 10,
    baseCost: 300,
    apply: (p, r) => (p.goldBonus += 0.05 * r),
  },
  {
    id: "magnetism",
    name: "Magnétisme",
    icon: "magnet",
    desc: (r) => `+${r * 20} de portée d'aimant`,
    max: 5,
    baseCost: 200,
    apply: (p, r) => (p.magnetRadius += 20 * r),
  },
  {
    id: "reroll",
    name: "Relance",
    icon: "repeat",
    desc: (r) => `${r} relance${r > 1 ? "s" : ""} des améliorations par partie`,
    max: 3,
    baseCost: 1000,
    apply: (p, r) => (p.rerolls += r),
  },
  {
    id: "revive",
    name: "Seconde chance",
    icon: "heartPlus",
    desc: () => "Revient une fois à 50 % des PV par partie",
    max: 1,
    baseCost: 5000,
    apply: (p, r) => (p.revives += r),
  },
];

/** Prix du rang suivant (rang actuel → rang + 1). */
export const talentCost = (talent, rank) => talent.baseCost * (rank + 1);

/** Applique les talents du compte au joueur en début de partie. */
export function applyTalents(player, ranks) {
  for (const t of TALENTS) {
    const r = Math.min(ranks[t.id] || 0, t.max);
    if (r > 0) t.apply(player, r);
  }
  player.health = player.maxHealth;
}
