// Outils de tracé des coques détaillées (render/ships.js, render/skinShips.js) : plaques néon, traits,
// cockpit, feux de position. Coordonnées en pixels, nez vers la droite. Sans dépendance au canvas du jeu.

import { glow, neonBody, noGlow, polygon } from "./neon.js";

export const TAU = Math.PI * 2;
export const PINK = "#ff2a6d";
export const VIOLET = "#aa66ff";
export const CYAN = "#00ffff";
export const GOLD = "#ffd700";
export const ORANGE = "#ff8a00";

/** Coque au fond sombre teinté et au contour lumineux. */
export function plate(c, points, color, line = 2, blur = 10) {
  neonBody(c, () => polygon(c, points), color, line, blur);
}

/** Points exprimés en rayons → pixels. */
export function scaled(points, r) {
  return points.map(([x, y]) => [x * r, y * r]);
}

/** Même forme des deux côtés de l'axe (y → -y). */
export function mirror(points) {
  return points.map(([x, y]) => [x, -y]);
}

export function line(c, color, width, ...pts) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
}

export function cockpit(c, x, y, rx, ry, color) {
  glow(c, color, 8);
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  c.fill();
  noGlow(c);
  c.fillStyle = color;
  c.globalAlpha = 0.45;
  c.beginPath();
  c.ellipse(x - rx * 0.25, y, rx * 0.6, ry * 0.6, 0, 0, TAU);
  c.fill();
  c.globalAlpha = 1;
}

/** Petit feu de position (fixe, dans le cache). */
export function light(c, x, y, s, color) {
  glow(c, color, 6);
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, s, 0, TAU);
  c.fill();
  noGlow(c);
}
