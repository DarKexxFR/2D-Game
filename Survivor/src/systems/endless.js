// Mode « Endless Pulse » : en survie normale, vaincre le boss final (Cœur du Pulse, vague 30) donne la
// victoire. Le joueur choisit alors de terminer la partie ou de continuer sans fin : chaque nouvelle vague
// (« pulsation ») ajoute une mutation des ennemis (data/endless.js) et augmente l'XP et l'or gagnés.
// Tout l'état vit dans `game` (game.endless, game.victoryTimer), comme le reste de la partie.

import { ENDLESS } from "../config.js";
import { emit, on } from "../core/events.js";
import { game } from "../core/state.js";
import { PULSE_MUTATORS } from "../data/endless.js";
import { addStat, recordBest } from "../services/achievements.js";
import { weightedPick } from "../utils/math.js";

/**
 * @typedef {object} EndlessState
 * @property {number} depth pulsations franchies (vagues après la victoire)
 * @property {Record<string, number>} stacks cumul de chaque mutation
 */

/**
 * Boss final vaincu (même s'il a survécu au minuteur de sa vague) : la célébration commence, puis l'écran
 * de victoire. Une seule fois par partie, et jamais une fois en Endless Pulse (il y revient tous les 30 vagues).
 */
function onFinalBossKilled() {
  if (!game.endlessAllowed || game.endless || game.victory) return;
  game.victory = true;
  game.victoryTimer = ENDLESS.victoryDelay;
  game.runGold += ENDLESS.victoryGold;
  addStat("pulseVictories");
}

on("kill", (enemy) => {
  if (enemy.type === ENDLESS.finalBoss) onFinalBossKilled();
});

/** Écran de victoire en attente : plus d'ennemis ni de minuteur de vague pendant la célébration. */
export function victoryPending() {
  return game.victoryTimer > 0;
}

/** Un tick : à la fin de la célébration, la partie s'arrête et l'écran de victoire s'ouvre. */
export function updateEndless() {
  if (game.victoryTimer > 0 && --game.victoryTimer === 0) {
    game.running = false;
    game.paused = true;
    emit("pulseVictory");
  }
}

/** « CONTINUER » : la partie reprend en Endless Pulse, à la vague suivante. */
export function enterEndless() {
  /** @type {EndlessState} */
  const state = { depth: 0, stacks: {} };
  game.endless = state;
  game.modifier = { ...game.modifier }; // le modificateur peut être partagé (difficulté) : copie avant de le muter
  addStat("endlessRuns");
  game.running = true;
  game.paused = false;
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
