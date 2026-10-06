// Primitives de dessin partagées par les modules de rendu.

import { ctx } from "../core/canvas.js";

const TAU = Math.PI * 2;

export function fillCircle(x, y, r, color, glow = 0) {
  ctx.fillStyle = color;
  if (glow) {
    ctx.shadowBlur = glow;
    ctx.shadowColor = color;
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  if (glow) ctx.shadowBlur = 0;
}

export function strokeCircle(x, y, r, color, lineWidth = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
}

export function drawText(text, x, y, font, color, align = "center") {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}
