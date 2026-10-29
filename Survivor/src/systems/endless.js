// Mode « Endless Pulse » : en survie normale, vaincre le boss final (l'Architecte, vague 40) lance l'Endless
// Pulse sans arrêter la partie (simple annonce, choix du propriétaire : pas d'écran de victoire). Chaque
// nouvelle vague (« pulsation ») ajoute une mutation des ennemis (data/endless.js) et augmente l'XP et l'or
// gagnés. Tout l'état vit dans `game.endless`, comme le reste de la partie.

import { ENDLESS } from "../config.js";
import { emit, on } from "../core/events.js";
import { game } from "../core/state.js";
import { PULSE_MUTATORS } from "../data/endless.js";
import { addStat, recordBest } from "../services/achievements.js";
import { weightedPick } from "../utils/math.js";

/**
 * @typedef {object} EndlessState
 * @property {number} depth pulsations franchies (vagues après le boss final)
 * @property {Record<string, number>} stacks cumul de chaque mutation
 */

on("kill", (enemy) => {
  if (enemy.type === ENDLESS.finalBoss) enterEndless();
});

/**
 * Boss final vaincu (même s'il a survécu au minuteur de sa vague) : la partie continue en Endless Pulse.
 * Une seule fois par partie (il revient toutes les 40 vagues), en survie normale seulement.
 */
export function enterEndless() {
  if (!game.endlessAllowed || game.endless) return;
  /** @type {EndlessState} */
  const state = { depth: 0, stacks: {} };
  game.endless = state;
  game.modifier = { ...game.modifier }; // le modificateur peut être partagé (difficulté) : copie avant de le muter
  addStat("pulseVictories");
  addStat("endlessRuns");
  emit("endlessStart");
}

/** Nouvelle vague en Endless Pulse : une pulsation de plus, une mutation de plus, des récompenses en hausse. */
export function onEndlessWave() {
  const state = game.endless;
  if (!state) return;
  state.depth++;
  const mod = game.modifier;
  const boost = 1 + ENDLESS.rewardPerDepth;
  mod.enemyXp = (mod.enemyXp ?? 1) * boost;
  mod.goldMult = (mod.goldMult ?? 1) * boost;
  const added = [];
  for (let i = 0; i < ENDLESS.mutatorsPerWave; i++) {
    const pool = PULSE_MUTATORS.filter((m) => (state.stacks[m.id] || 0) < m.max);
    if (pool.length === 0) break;
    const mutator = weightedPick(pool, (m) => m.weight);
    applyMutator(mutator);
    added.push(mutator);
  }
  recordBest("bestPulse", state.depth);
  emit("pulseWave", { depth: state.depth, mutators: added });
}

function applyMutator(m) {
  const mod = game.modifier;
  for (const [k, v] of Object.entries(m.mult || {})) mod[k] = (mod[k] ?? 1) * v;
  for (const [k, v] of Object.entries(m.add || {})) mod[k] = (mod[k] ?? 0) + v;
  game.endless.stacks[m.id] = (game.endless.stacks[m.id] || 0) + 1;
}

/** Mutations actives (pause, écran de fin) : [{ name, desc, color, icon, count }]. */
export function activeMutators() {
  const stacks = game.endless?.stacks || {};
  return PULSE_MUTATORS.filter((m) => stacks[m.id]).map((m) => ({ ...m, count: stacks[m.id] }));
}
