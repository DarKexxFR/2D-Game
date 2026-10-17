// Mode « Endless Pulse » : après la victoire sur le Cœur du Pulse (vague 30), la partie peut continuer
// sans fin. Chaque nouvelle vague ajoute une « pulsation » (mutation des ennemis) qui se cumule avec les
// précédentes ; les récompenses grimpent aussi (voir systems/endless.js et ENDLESS dans config.js).
//
// Une mutation multiplie (`mult`) ou ajoute (`add`) des valeurs de `game.modifier`, lues à l'apparition
// des ennemis (systems/spawner.js). `max` = nombre de fois qu'elle peut se cumuler.

/**
 * @typedef {object} PulseMutator
 * @property {string} id
 * @property {string} name nom affiché (bannière, pause, écran de fin)
 * @property {string} desc effet, pour la pause
 * @property {string} icon icône (data/icons.js)
 * @property {string} color
 * @property {number} weight chance d'être tirée
 * @property {number} max cumul maximum
 * @property {Record<string, number>} [mult] multiplicateurs de `game.modifier`
 * @property {Record<string, number>} [add] ajouts à `game.modifier`
 */

/** @type {PulseMutator[]} */
export const PULSE_MUTATORS = [
  {
    id: "armor",
    name: "BLINDAGE",
    desc: "PV des ennemis +20 %",
    icon: "shield",
    color: "#00ccff",
    weight: 3,
    max: 12,
    mult: { enemyHealth: 1.2 },
  },
  {
    id: "rage",
    name: "RAGE",
    desc: "Dégâts des ennemis +15 %",
    icon: "rage",
    color: "#ff3344",
    weight: 3,
    max: 12,
    mult: { enemyDamage: 1.15 },
  },
  {
    id: "haste",
    name: "HÂTE",
    desc: "Ennemis 6 % plus rapides",
    icon: "bolt",
    color: "#ffee00",
    weight: 2,
    max: 5,
    mult: { enemySpeed: 1.06 },
  },
  {
    id: "swarm",
    name: "NUÉE",
    desc: "15 % d'ennemis en plus",
    icon: "skull",
    color: "#aa66ff",
    weight: 2,
    max: 6,
    mult: { mobCount: 1.15 },
  },
  {
    id: "elite",
    name: "ÉLITES",
    desc: "Élites plus fréquentes",
    icon: "crown",
    color: "#ff2a6d",
    weight: 2,
    max: 6,
    add: { eliteShift: 3 },
  },
];
