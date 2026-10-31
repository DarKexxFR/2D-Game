// Réglages des cartes d'amélioration à effet (data/upgrades.js), appliqués par systems/cardEffects.js.
// `max` = niveau maximum du pouvoir (POWER_RULES.maxLevel dans data/upgrades.js) ; durées en ticks (60 par seconde) sauf mention contraire.

export const CARD_EFFECTS = {
  // Givre : ralentit l'ennemi touché (vitesse ×(1 - slow × cartes)) pendant `ticks`
  frost: { max: 5, slow: 0.12, ticks: 60, color: "#9fe8ff" },
  // Ricochet : après un coup, le tir repart vers l'ennemi le plus proche (dans `range`), dégâts ×`damage`
  ricochet: { max: 5, range: 260, damage: 0.8 },
  // Bouclier d'énergie : bloque un coup toutes les `seconds` s, `perCard` s de moins par carte en plus
  energyShield: { max: 5, seconds: 12, perCard: 2, color: "#5fd3ff" },
  // Dash explosif : explosion de rayon `radius` (+`radiusPerCard`), dégâts = attaque × (`damage` × cartes)
  dashBlast: { max: 5, radius: 120, radiusPerCard: 25, damage: 3 },
  // Arc électrique : chance par tir (× cartes) de lancer un éclair sur `jumps` ennemis voisins
  arc: { max: 5, chance: 0.15, jumps: 3, damage: 0.6, color: "#7df9ff" },
  // Pulsar : un tir sur `every` (- 1 par carte en plus) est géant
  pulsar: { max: 5, every: 5, size: 2.5, damage: 3, pierce: 3, color: "#fff27a" },
  // Surtension : nova toutes les `kills` éliminations (- `perCard` par carte en plus)
  surge: { max: 5, kills: 15, perCard: 3, radius: 260, damage: 4, color: "#7df9ff" },
  // Évolution « Zéro absolu » : gel net (ticks), ralenti des boss, dégâts en plus sur les gelés
  absoluteZero: { freeze: 60, bossSlow: 0.5, bonus: 0.3, cooldown: 90 },
  // Évolution « Tempête stellaire » : novas plus grandes et plus fréquentes, tirs géants qui explosent
  stellarStorm: { radius: 2, kills: 0.5, explosion: 90 },
  // Carte corrompue « Furie aveugle » : rayon de vision (pixels) autour du vaisseau
  blind: { radius: 260 },
};
