// Recyclage mythique (Forge) : les doublons d'objets légendaires se démantèlent en « Éclats de Pulse »,
// qui servent à relancer (au hasard) ou à cibler (au choix) les attributs de Pulse d'un objet mythique.
// Logique dans services/inventory.js (dismantle, rerollAffix, targetAffix), écran dans ui/forgePulse.js,
// bonus appliqués en début de partie par systems/equipment.js.

/** Démantèlement : rareté acceptée et éclats rendus par doublon. */
export const DISMANTLE = { rarity: "legendary", shards: 10 };

/** Attributs de Pulse : emplacements par objet mythique et prix en éclats. */
export const AFFIX_RULES = {
  rarity: "mythic",
  slots: 2,
  cost: { reroll: 15, target: 45 },
};

/**
 * Attributs possibles d'un objet mythique. `stats` utilise les mêmes clés que les bonus d'armure
 * (voir applyStats dans systems/equipment.js), en valeurs fixes (ni le niveau ni le prestige ne les changent).
 * Nouvel attribut = une entrée ici.
 */
export const MYTHIC_AFFIXES = {
  power: { name: "Puissance", text: "+8 % de dégâts", stats: { damage: 0.08 } },
  cadence: { name: "Cadence", text: "+7 % de cadence", stats: { fireRate: 0.07 } },
  precision: { name: "Précision", text: "+5 % de coups critiques", stats: { crit: 0.05 } },
  vitality: { name: "Vitalité", text: "+35 PV max", stats: { health: 35 } },
  regen: { name: "Régénération", text: "+1,5 PV par seconde", stats: { regen: 1.5 } },
  armor: { name: "Blindage", text: "+3 défense", stats: { defense: 3 } },
  wisdom: { name: "Savoir", text: "+10 % d'XP", stats: { xp: 0.1 } },
  fortune: { name: "Fortune", text: "+12 % d'or", stats: { gold: 0.12 } },
  magnet: { name: "Attraction", text: "+50 de portée d'aimant", stats: { magnet: 50 } },
  hunter: { name: "Chasseur de boss", text: "+12 % de dégâts contre les boss", stats: { boss: 0.12 } },
};

export const AFFIX_IDS = Object.keys(MYTHIC_AFFIXES);
