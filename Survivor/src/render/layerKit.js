// Outils des pièces animées des ennemis et des boss (render/bossLayers.js, render/bossParts.js,
// render/mobLayers.js) : traits néon sans flou (halo = trait large et transparent), anneaux, arcs,
// éclairs. Tout est tracé dans `ctx`, en coordonnées monde.

import { ctx } from "../core/canvas.js";

export const TAU = Math.PI * 2;
const CHARGE_TICKS = 40; // les repères s'allument pendant les 40 derniers ticks avant une attaque

/** 0 → 1 à l'approche de la prochaine attaque de l'ennemi. */
export function charge(e) {
  const t = Math.min(e.attackTimer ?? Infinity, e.skillTimer ?? Infinity);
  if (!(t < CHARGE_TICKS) || t < 0) return 0;
  return 1 - t / CHARGE_TICKS;
}

/** Trait néon sans flou : halo large et transparent, puis trait net. */
export function neonStroke(color, width, alpha = 1) {
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha * 0.25;
  ctx.lineWidth = width * 3;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Trait simple (pour les petits ennemis, nombreux à l'écran : pas de halo). */
export function thinStroke(color, width, alpha = 1) {
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Anneau en pointillés qui tourne. */
export function dashedRing(x, y, radius, color, width, dash, offset, alpha) {
  ctx.setLineDash(dash);
  ctx.lineDashOffset = offset;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  neonStroke(color, width, alpha);
  ctx.setLineDash([]);
}

/** Arcs (segments d'anneau) qui tournent : `count` plaques de `span` radians. */
export function arcPlates(x, y, radius, count, span, rot, color, width, alpha) {
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const a = rot + (i * TAU) / count;
    ctx.moveTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    ctx.arc(x, y, radius, a, a + span);
  }
  neonStroke(color, width, alpha);
}

/** Ajoute au tracé courant un éclair de (x0, y0) à (x1, y1) : `n` zigzags d'amplitude `amp`. */
export function zigzagPath(x0, y0, x1, y1, n, amp, seed = 0) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.moveTo(x0, y0);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const k = (i % 2 ? 1 : -1) * amp * (0.5 + 0.5 * Math.abs(Math.sin(seed * 1.3 + i * 2.1)));
    ctx.lineTo(x0 + dx * t + nx * k, y0 + dy * t + ny * k);
  }
  ctx.lineTo(x1, y1);
}

/** Ajoute au tracé un polygone régulier centré (x, y). */
export function polyPath(x, y, sides, radius, rot = 0) {
  for (let i = 0; i <= sides; i++) {
    const a = rot + (i * TAU) / sides;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
}

/** Ajoute au tracé un losange orienté selon `a`, centré (x, y). */
export function diamondPath(x, y, a, long, wide) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  ctx.moveTo(x + c * long, y + s * long);
  ctx.lineTo(x - s * wide, y + c * wide);
  ctx.lineTo(x - c * long, y - s * long);
  ctx.lineTo(x + s * wide, y - c * wide);
  ctx.closePath();
}
