// Rendu des particules, ondes de choc et textes flottants.

import { ctx } from "../core/canvas.js";
import { world } from "../core/state.js";
import { strokeCircle } from "./draw.js";

export function drawParticles() {
  for (const p of world.particles) {
    ctx.globalAlpha = Math.min(1, p.life / 30);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.globalAlpha = 1;
}

export function drawVisualEffects() {
  for (const e of world.visualEffects) {
    const fade = e.type === "heal" ? 30 : 20;
    ctx.globalAlpha = Math.min(1, e.life / fade);
    strokeCircle(e.x, e.y, e.radius, e.color, e.type === "heal" ? 1 : 4);
  }
  ctx.globalAlpha = 1;
}

export function drawFloatingTexts() {
  ctx.textAlign = "center";
  ctx.shadowColor = "black";
  ctx.shadowBlur = 2;
  for (const t of world.floatingTexts) {
    ctx.globalAlpha = Math.min(1, t.life / 20);
    ctx.fillStyle = t.color;
    ctx.font = `bold ${t.size}px Orbitron`;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}
