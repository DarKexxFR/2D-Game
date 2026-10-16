// Rendu des particules, ondes de choc et textes flottants.

import { ctx } from "../core/canvas.js";
import { player, world } from "../core/state.js";
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
    if (e.type === "shockwave") {
      drawShockwave(e);
      continue;
    }
    if (e.type === "rebirth") {
      drawRebirth(e);
      continue;
    }
    const fade = e.type === "heal" ? 30 : 20;
    ctx.globalAlpha = Math.min(1, e.life / fade);
    strokeCircle(e.x, e.y, e.radius, e.color, e.type === "heal" ? 1 : 4);
  }
  ctx.globalAlpha = 1;
}

/** Onde de choc : anneau lumineux épais doublé d'un anneau fin, qui s'amincit en s'élargissant. */
function drawShockwave(e) {
  const t = e.life / 30;
  ctx.globalAlpha = t;
  ctx.shadowBlur = 15;
  ctx.shadowColor = e.color;
  strokeCircle(e.x, e.y, e.radius, e.color, 2 + 10 * t);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = t * 0.6;
  strokeCircle(e.x, e.y, e.radius * 0.8, "#ffffff", 1.5);
}

/**
 * Renaissance (retour à la vie) : colonne de lumière, halo, étincelles qui tournent et montent,
 * et ailes de feu pour le Phénix. Suit le joueur ; `t` va de 0 (début) à 1 (fin).
 */
function drawRebirth(e) {
  const x = player.worldX;
  const y = player.worldY;
  const t = 1 - e.life / e.max;
  const fade = Math.min(1, e.life / 25);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Colonne de lumière qui jaillit puis s'amincit
  const w = 70 * (1 - t) + 14;
  const h = 520;
  const beam = ctx.createLinearGradient(0, y - h, 0, y + 40);
  beam.addColorStop(0, "rgba(255,255,255,0)");
  beam.addColorStop(0.7, e.color);
  beam.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalAlpha = 0.55 * fade;
  ctx.fillStyle = beam;
  ctx.fillRect(x - w / 2, y - h, w, h + 40);
  ctx.globalAlpha = 0.8 * fade;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - w / 8, y - h, w / 4, h + 40);

  // Halo qui bat au rythme d'un cœur
  const pulse = 1 + 0.25 * Math.sin(t * Math.PI * 6);
  const halo = ctx.createRadialGradient(x, y, 0, x, y, 70 * pulse);
  halo.addColorStop(0, "rgba(255,255,255,0.9)");
  halo.addColorStop(0.4, e.color);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.7 * fade;
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, 70 * pulse, 0, Math.PI * 2);
  ctx.fill();

  // Ailes de feu du Phénix, déployées d'un battement
  if (e.kind === "phoenix") drawFireWings(x, y, t, fade, e.color);

  // Étincelles en spirale qui se resserrent puis montent
  ctx.fillStyle = e.color;
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 12;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + t * 7;
    const r = 90 * (1 - t) + 18;
    const sx = x + Math.cos(a) * r;
    const sy = y + Math.sin(a) * r * 0.5 - t * 120 - (i % 3) * 14 * t;
    ctx.globalAlpha = fade;
    ctx.fillRect(sx - 3, sy - 3, 6, 6);
  }

  // Anneau au sol qui tourne
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.9 * fade;
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  ctx.lineDashOffset = -t * 120;
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 60 + 30 * t, (60 + 30 * t) * 0.4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawFireWings(x, y, t, fade, color) {
  const open = Math.min(1, t * 3); // les ailes s'ouvrent vite
  const flap = Math.sin(t * Math.PI * 4) * 0.15;
  const span = 130 * open;
  ctx.globalAlpha = 0.75 * fade;
  for (const side of [-1, 1]) {
    const g = ctx.createLinearGradient(x, y, x + side * span, y - 40);
    g.addColorStop(0, "#fff3b0");
    g.addColorStop(0.5, color);
    g.addColorStop(1, "rgba(255,40,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.quadraticCurveTo(x + side * span * 0.5, y - 90 * open * (1 + flap), x + side * span, y - 60 * open);
    ctx.quadraticCurveTo(x + side * span * 0.7, y - 20, x + side * span * 0.85, y + 10);
    ctx.quadraticCurveTo(x + side * span * 0.4, y + 4, x, y + 8);
    ctx.closePath();
    ctx.fill();
  }
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
