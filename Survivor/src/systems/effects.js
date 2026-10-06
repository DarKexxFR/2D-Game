// Effets visuels purement cosmétiques : particules, textes flottants,
// cercles d'impact et tremblement d'écran.

import { LIMITS } from "../config.js";
import { gfx } from "../core/canvas.js";
import { game, world } from "../core/state.js";
import { removeWhere } from "../utils/math.js";

export function addScreenShake(amount) {
  game.screenShake = amount;
}

export function addFloatingText(x, y, text, color = "#fff", size = 14, duration = 40) {
  const texts = world.floatingTexts;
  if (texts.length >= LIMITS.floatingTexts) texts.shift();
  texts.push({ x, y, text, color, size, vy: -1.5, life: duration });
}

export function createParticles(x, y, color, count) {
  const particles = world.particles;
  count = Math.max(1, Math.round(count * gfx.particles));
  if (particles.length > LIMITS.particlesLowQuality) count = Math.min(count, 2);
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.5) * 5,
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

export function createHealEffect(x, y) {
  world.visualEffects.push({ type: "heal", x, y, radius: 20, life: 30, color: "#00ff00" });
}

export function updateEffects() {
  if (game.screenShake > 0) game.screenShake *= 0.9;

  for (const p of world.particles) {
    p.x += p.vx;
    p.y += p.vy;
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
  }
  removeWhere(world.visualEffects, (e) => e.life <= 0);

  for (const g of world.ghosts) g.life--;
  removeWhere(world.ghosts, (g) => g.life <= 0);
}
