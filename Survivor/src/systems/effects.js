// Effets visuels purement cosmétiques : particules, textes flottants,
// cercles d'impact et tremblement d'écran.

import { LIMITS, VISUAL_FX } from "../config.js";
import { gfx } from "../core/canvas.js";
import { game, world } from "../core/state.js";
import { recordBest } from "../services/achievements.js";
import { playSfx } from "../services/sfx.js";
import { removeWhere } from "../utils/math.js";
import { addGridPulse, updateGridWarp } from "./gridWarp.js";

const SPARKS = VISUAL_FX.sparks;

export function addScreenShake(amount) {
  game.screenShake = amount;
}

export function addFloatingText(x, y, text, color = "#fff", size = 14, duration = 40) {
  const texts = world.floatingTexts;
  if (texts.length >= LIMITS.floatingTexts) texts.shift();
  texts.push({ x, y, text, color, size, vy: -1.5, life: duration });
}

/**
 * Étincelles : parties vite dans toutes les directions, elles ralentissent (`VISUAL_FX.sparks.friction`)
 * et raccourcissent (render/effects.js les dessine en traits orientés par leur vitesse).
 */
export function createParticles(x, y, color, count) {
  const particles = world.particles;
  count = Math.max(1, Math.round(count * gfx.particles));
  if (particles.length > LIMITS.particlesLowQuality) count = Math.min(count, 2);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = SPARKS.speed * (0.25 + Math.random() * 0.75);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 20 + Math.random() * 20,
      color,
    });
  }
  if (particles.length > LIMITS.particles) particles.splice(0, 200);
}

export function createAoEEffect(x, y, radius) {
  world.visualEffects.push({ type: "aoe", x, y, radius, life: 15, color: "#ff6600" });
}

export function createSpawnEffect(x, y, color) {
  world.visualEffects.push({ type: "spawn", x, y, radius: 10, life: 40, color });
}

const SHOCKWAVE_TICKS = 30;

/** Onde de choc : anneau épais qui s'élargit jusqu'à `radius` puis s'estompe. */
export function createShockwave(x, y, radius, color = "#ffffff") {
  const fx = world.visualEffects;
  let count = 0;
  for (const e of fx) if (e.type === "shockwave") count++;
  if (count >= LIMITS.shockwaves)
    fx.splice(
      fx.findIndex((e) => e.type === "shockwave"),
      1,
    ); // la plus ancienne
  fx.push({ type: "shockwave", x, y, radius: 0, max: radius, life: SHOCKWAVE_TICKS, color });
  addGridPulse(x, y, radius); // la grille du sol ondule sous l'explosion
}

/** Gros choc (furie d'un boss, coup lourd, renaissance) : aberration chromatique pendant quelques images. */
export function kickChroma(strength = 1) {
  game.chroma = Math.max(game.chroma || 0, Math.round(VISUAL_FX.chroma.ticks * strength));
}

/** Flash plein écran d'une couleur, qui s'estompe en quelques images. */
export function flashScreen(color, alpha) {
  game.flash = { color, alpha };
}

/** Ralenti : le temps de jeu passe à 30 % pendant `ticks` ticks. */
export function slowMotion(ticks) {
  game.slowMo = Math.max(game.slowMo, ticks);
}

// --- COMBO : enchaîner les éliminations sans pause ---

const COMBO_WINDOW = 90; // ticks (1,5 s) pour tuer le suivant
const COMBO_MILESTONES = [10, 25, 50, 100, 200, 500];

export function addComboKill(x, y) {
  game.combo++;
  game.comboTimer = COMBO_WINDOW;
  game.stats.bestCombo = Math.max(game.stats.bestCombo, game.combo);
  if (COMBO_MILESTONES.includes(game.combo)) recordBest("bestCombo", game.combo);
  if (COMBO_MILESTONES.includes(game.combo)) {
    addFloatingText(x, y - 30, `COMBO ×${game.combo} !`, "#ff2a6d", 22 + Math.min(game.combo, 100) / 10, 70);
    playSfx("combo");
  }
}

export function createHealEffect(x, y) {
  world.visualEffects.push({ type: "heal", x, y, radius: 20, life: 30, color: "#00ff00" });
}

export function updateEffects() {
  if (game.screenShake > 0) game.screenShake *= 0.9;
  if (game.slowMo > 0) game.slowMo--;
  if (game.flash && (game.flash.alpha *= 0.88) < 0.02) game.flash = null;
  if (game.comboTimer > 0 && --game.comboTimer === 0) game.combo = 0;
  if (game.chroma > 0) game.chroma--;
  ageVisuals();
}

/** Effets purement visuels (étincelles, textes, ondes...) : aussi chez un invité en coop, qui ne simule rien. */
export function ageVisuals() {
  updateGridWarp();
  for (const p of world.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= SPARKS.friction;
    p.vy *= SPARKS.friction;
    p.life--;
  }
  removeWhere(world.particles, (p) => p.life <= 0);

  for (const t of world.floatingTexts) {
    t.y += t.vy;
    t.life--;
  }
  removeWhere(world.floatingTexts, (t) => t.life <= 0);

  for (const e of world.visualEffects) {
    e.life--;
    if (e.type === "aoe") e.radius += 1;
    else if (e.type === "shockwave") e.radius = e.max * (1 - (e.life / SHOCKWAVE_TICKS) ** 2);
  }
  removeWhere(world.visualEffects, (e) => e.life <= 0);

  for (const g of world.ghosts) g.life--;
  removeWhere(world.ghosts, (g) => g.life <= 0);

  for (const b of world.bolts) b.life--;
  removeWhere(world.bolts, (b) => b.life <= 0);
  if (world.bolts.length > LIMITS.bolts) world.bolts.splice(0, world.bolts.length - LIMITS.bolts);
}
