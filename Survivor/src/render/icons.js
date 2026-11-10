// Icônes (data/icons.js) dessinées sur un canvas : trait néon + parties pleines, Path2D en cache.

import { ICONS, ICON_GRID, ICON_STROKE, iconName } from "../data/icons.js";

/** @type {Map<string, { s: Path2D | null, f: Path2D | null }>} */
const cache = new Map();

function paths(name) {
  let p = cache.get(name);
  if (!p) {
    const { s, f } = ICONS[name];
    cache.set(name, (p = { s: s ? new Path2D(s) : null, f: f ? new Path2D(f) : null }));
  }
  return p;
}

/**
 * Dessine l'icône centrée en (x, y), de côté `size`, avec une lueur `glow` (0 = aucune).
 * @param {CanvasRenderingContext2D} c
 */
export function drawIcon(c, name, x, y, size, color, glow = 0) {
  const { s, f } = paths(iconName(name));
  const k = size / ICON_GRID;
  c.save();
  c.translate(x - size / 2, y - size / 2);
  c.scale(k, k);
  c.fillStyle = color;
  c.strokeStyle = color;
  c.lineWidth = ICON_STROKE;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.shadowBlur = glow;
  c.shadowColor = color;
  if (s) c.stroke(s);
  if (f) c.fill(f);
  c.restore();
}
