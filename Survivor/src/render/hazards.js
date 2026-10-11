// Rendu des attaques de zone des boss (alerte puis impact), des coffres de boss,
// des tourelles de l'Ingénieur et des éclairs (Arc Tesla, Cristal de givre).

import { ctx } from "../core/canvas.js";
import { world } from "../core/state.js";
import { fillCircle, strokeCircle } from "./draw.js";
import { drawSprite, getSprite } from "./sprites.js";

const TAU = Math.PI * 2;

export function drawHazards(now) {
  for (const h of world.hazards) DRAWERS[h.kind](h, now);
  ctx.globalAlpha = 1;
}

const DRAWERS = {
  /** Zone ronde : disque qui se remplit depuis le centre jusqu'à l'impact, puis flaque. */
  circle(h, now) {
    if (h.delay > 0) {
      const t = 1 - h.delay / h.total;
      ctx.globalAlpha = 0.12;
      fillCircle(h.x, h.y, h.radius, h.color);
      ctx.globalAlpha = 0.3 + t * 0.4;
      fillCircle(h.x, h.y, h.radius * t, h.color);
      ctx.globalAlpha = 0.6 + Math.sin(now / 60) * 0.3;
      strokeCircle(h.x, h.y, h.radius, h.color, 2);
      return;
    }
    // Flaque qui bouillonne
    ctx.globalAlpha = Math.min(0.2, h.pool / 60) * (0.8 + Math.sin(now / 150 + h.x) * 0.2);
    fillCircle(h.x, h.y, h.radius, h.color);
    ctx.globalAlpha = Math.min(0.7, h.pool / 40);
    strokeCircle(h.x, h.y, h.radius * (0.92 + Math.sin(now / 200) * 0.05), h.color, 1.5);
  },

  /** Laser : trait pointillé d'alerte qui s'épaissit, puis rayon éclatant. */
  beam(h, now) {
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.angle);
    if (h.delay > 0) {
      const t = 1 - h.delay / h.total;
      ctx.globalAlpha = 0.1 + t * 0.15;
      ctx.fillStyle = h.color;
      ctx.fillRect(0, -h.width / 2, h.length, h.width);
      ctx.globalAlpha = 0.5 + t * 0.5;
      ctx.strokeStyle = h.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 10]);
      ctx.lineDashOffset = -now / 20;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(h.length, 0);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const flicker = 0.85 + Math.sin(now / 25) * 0.15;
      ctx.globalAlpha = 0.45 * flicker;
      ctx.fillStyle = h.color;
      ctx.shadowBlur = 25;
      ctx.shadowColor = h.color;
      ctx.fillRect(0, -h.width / 2, h.length, h.width);
      ctx.globalAlpha = flicker;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, -h.width / 6, h.length, h.width / 3);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  },

  /** Onde de choc qui s'élargit. */
  ring(h) {
    ctx.globalAlpha = 0.25;
    strokeCircle(h.x, h.y, h.radius, h.color, h.width);
    ctx.globalAlpha = 0.9;
    ctx.shadowBlur = 15;
    ctx.shadowColor = h.color;
    strokeCircle(h.x, h.y, h.radius, "#ffffff", 3);
    ctx.shadowBlur = 0;
  },
};

/** Coffre de boss : caisse dorée qui flotte dans un faisceau de lumière. */
export function drawBossChests(now) {
  for (const c of world.bossChests) {
    const bob = Math.sin(now / 250) * 4;
    const beam = ctx.createLinearGradient(c.x, c.y - 260, c.x, c.y);
    beam.addColorStop(0, "rgba(255, 215, 0, 0)");
    beam.addColorStop(1, "rgba(255, 215, 0, 0.35)");
    ctx.fillStyle = beam;
    ctx.fillRect(c.x - 22, c.y - 260, 44, 260);
    ctx.globalAlpha = 0.35 + Math.sin(now / 200) * 0.15;
    fillCircle(c.x, c.y + 18, 30, "#ffd700");
    ctx.globalAlpha = 1;
    for (let i = 0; i < 4; i++) {
      const a = now / 600 + (TAU * i) / 4;
      fillCircle(c.x + Math.cos(a) * 36, c.y + bob + Math.sin(a) * 12, 2.5, "#fff6b0");
    }
    drawSprite(ctx, getSprite("bossChest", c.size, "#ffd700"), c.x, c.y + bob);
  }
}

/** Tourelles de l'Ingénieur : socle hexagonal et canon orienté. */
export function drawTurrets(now) {
  for (const t of world.turrets) {
    ctx.globalAlpha = t.life < 60 ? (Math.floor(now / 80) % 2 ? 0.4 : 1) : 1; // clignote avant de disparaître
    drawSprite(ctx, getSprite("turret", 14, "#00ff88"), t.x, t.y, t.angle);
  }
  ctx.globalAlpha = 1;
}

/** Éclairs en zigzag entre plusieurs points. */
export function drawBolts() {
  ctx.lineCap = "round";
  for (const b of world.bolts) {
    ctx.globalAlpha = b.life / 10;
    ctx.strokeStyle = b.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = b.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.points[0].x, b.points[0].y);
    for (let i = 1; i < b.points.length; i++) {
      const p0 = b.points[i - 1];
      const p1 = b.points[i];
      for (let k = 1; k <= 3; k++) {
        const t = k / 4;
        const jitter = (Math.random() - 0.5) * 18;
        ctx.lineTo(p0.x + (p1.x - p0.x) * t + jitter, p0.y + (p1.y - p0.y) * t + jitter);
      }
      ctx.lineTo(p1.x, p1.y);
    }
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}
