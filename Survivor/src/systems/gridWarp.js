// Grille du sol « vivante » : chaque grosse explosion lance une onde qui pousse les nœuds de la grille
// vers l'extérieur (render/gridWarp.js la dessine). Purement visuel : les ondes vivent dans
// `world.gridPulses` (propre à chaque partie d'un duel, sauvegardée vide avec la partie).

import { VISUAL_FX } from "../config.js";
import { world } from "../core/state.js";
import { removeWhere } from "../utils/math.js";

const G = VISUAL_FX.grid;

/**
 * Onde partant de (x, y) ; `radius` = rayon de l'explosion, qui règle sa force et sa portée.
 * Au-delà de `VISUAL_FX.grid.pulses` ondes, la plus ancienne disparaît.
 */
export function addGridPulse(x, y, radius) {
  const pulses = world.gridPulses;
  if (!pulses || !(radius > 0)) return;
  if (pulses.length >= G.pulses) pulses.shift();
  const amp = Math.min(G.maxShift * 1.6, radius * G.perRadius + 4);
  pulses.push({ x, y, amp, reach: radius * 2 + 220, age: 0 });
}

export function updateGridWarp() {
  const pulses = world.gridPulses;
  if (!pulses?.length) return;
  for (const p of pulses) p.age++;
  removeWhere(pulses, (p) => p.age >= G.life);
}
