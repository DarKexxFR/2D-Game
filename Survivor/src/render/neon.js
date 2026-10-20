// Outils de tracé des sprites néon (render/sprites.js, render/bossShapes.js) : corps sombre teinté
// au contour lumineux, polygones, points et yeux lumineux. La lueur (shadowBlur) suit la qualité.

import { gfx } from "../core/gfx.js";

const TAU = Math.PI * 2;

export function glow(c, color, blur) {
  if (!gfx.shadows) return;
  c.shadowColor = color;
  c.shadowBlur = blur;
}

export function noGlow(c) {
  c.shadowBlur = 0;
}

/** Corps néon : intérieur sombre teinté + contour lumineux. */
export function neonBody(c, path, color, line = 2.5, blur = 12) {
  c.fillStyle = shade(color, 0.22);
  path();
  c.fill();
  glow(c, color, blur);
  c.strokeStyle = color;
  c.lineWidth = line;
  path();
  c.stroke();
  noGlow(c);
}

export function polygon(c, points) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
}

export function regular(c, sides, r, rot = 0) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (TAU * i) / sides;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  polygon(c, pts);
}

export function dot(c, x, y, r, color, blur = 8) {
  glow(c, color, blur);
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
  noGlow(c);
}

/** Œil lumineux : pupille blanche entourée de la couleur. */
export function eye(c, x, y, r, color) {
  dot(c, x, y, r, color, 10);
  dot(c, x + r * 0.25, y, r * 0.5, "#ffffff", 0);
}

/** Assombrit une couleur hexadécimale (#rrggbb) : k = 0 → noir, 1 → identique. */
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r}, ${g}, ${b})`;
}
