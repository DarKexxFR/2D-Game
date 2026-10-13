// Rendu du duel : arène, traînées de dash, les deux vaisseaux avec leur nom et leur barre de vie.

import { VERSUS } from "../config.js";
import { ctx } from "../core/canvas.js";
import { game } from "../core/state.js";
import { arenaBounds, versus, withFighter } from "../systems/versus.js";
import { drawShip, drawPlayer } from "./entities.js";
import { drawText, strokeCircle } from "./draw.js";

const HIT_FLASH_MS = 120;

export function drawVersus(now) {
  drawArena(now);
  for (const t of versus.trails) {
    ctx.globalAlpha = t.life / 30;
    drawShip(t.x, t.y, 20, t.angle, t.color, false, now);
  }
  ctx.globalAlpha = 1;
  for (const f of versus.fighters) {
    if (!f.alive) continue;
    withFighter(f, () => drawPlayer(now));
    if (game.time - f.hitTime < HIT_FLASH_MS) strokeCircle(f.worldX, f.worldY, f.size + 6, "#ffffff", 3);
    drawLabel(f);
  }
}

function drawArena(now) {
  const b = arenaBounds();
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  ctx.fillStyle = "rgba(10, 0, 25, 0.35)";
  ctx.fillRect(b.minX, b.minY, w, h);
  // Ligne médiane aux couleurs des deux joueurs
  const wide = w >= h;
  ctx.globalAlpha = 0.25 + Math.sin(now / 400) * 0.05;
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 10]);
  ctx.strokeStyle = "#aa66ff";
  ctx.beginPath();
  if (wide) {
    ctx.moveTo(0, b.minY);
    ctx.lineTo(0, b.maxY);
  } else {
    const cy = (b.minY + b.maxY) / 2;
    ctx.moveTo(b.minX, cy);
    ctx.lineTo(b.maxX, cy);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  ctx.lineWidth = 4;
  ctx.shadowBlur = 18;
  ctx.shadowColor = "#aa66ff";
  ctx.strokeStyle = "#aa66ff";
  ctx.strokeRect(b.minX, b.minY, w, h);
  ctx.shadowBlur = 0;
}

function drawLabel(f) {
  const x = f.worldX;
  const y = f.worldY - f.size - 22;
  const color = VERSUS.colors[f.index];
  drawText(`J${f.index + 1}`, x, y - 8, "bold 12px Orbitron, sans-serif", color);
  const bw = 46;
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(x - bw / 2, y, bw, 5);
  ctx.fillStyle = color;
  ctx.fillRect(x - bw / 2, y, bw * Math.max(0, f.health / f.maxHealth), 5);
}
