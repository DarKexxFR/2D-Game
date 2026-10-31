// Toundra de glace : plaques de verglas géométriques (hexagones, losanges). Sur une plaque, le vaisseau
// va plus vite (ANOMALIES.ice.speed) mais garde son élan : il ne reprend qu'une petite part de la
// direction voulue à chaque tick (`grip`), donc il glisse. Hors de la glace, contrôle normal.

import { player } from "../../core/state.js";
import { scatter } from "./scatter.js";

/** @param {any} a @param {any} def @param {boolean} arena @param {any} zone */
export function layout(a, def, arena, zone) {
  const count = arena ? def.platesInArena : def.plates;
  const [min, max] = def.size;
  const spots = scatter(count, zone, { margin: 0.08, gap: arena ? 0.4 : 0.22, clear: max + 60 });
  a.items = spots.map((p) => ({
    ...p,
    x: 0,
    y: 0,
    r: min + Math.random() * (max - min),
    sides: Math.random() < 0.5 ? 6 : 4,
    rot: Math.random() * Math.PI,
  }));
  a.vx = 0;
  a.vy = 0;
  a.onIce = false;
}

/** @param {any} a */
export function update(a) {
  a.onIce = a.items.some((p) => onPlate(p, player.worldX, player.worldY));
}

/** Sur la glace : la vitesse ne suit la direction voulue que peu à peu (inertie), mais va plus vite. */
export function steer(a, def, vx, vy) {
  if (!a.onIce) {
    a.vx = vx;
    a.vy = vy;
    return { x: vx, y: vy };
  }
  const grip = player.isDashing ? def.dashGrip : def.grip;
  a.vx += (vx * def.speed - a.vx) * grip;
  a.vy += (vy * def.speed - a.vy) * grip;
  return { x: a.vx, y: a.vy };
}

/**
 * Le point (x, y) est-il sur la plaque (polygone régulier de rayon `r`, `sides` côtés, tourné de
 * `rot`) ? Dedans quand sa distance à chaque côté est inférieure à l'apothème.
 */
export function onPlate(p, x, y) {
  const dx = x - p.x;
  const dy = y - p.y;
  if (dx * dx + dy * dy > p.r * p.r) return false;
  const apothem = p.r * Math.cos(Math.PI / p.sides);
  for (let k = 0; k < p.sides; k++) {
    const n = p.rot + ((2 * k + 1) * Math.PI) / p.sides;
    if (dx * Math.cos(n) + dy * Math.sin(n) > apothem) return false;
  }
  return true;
}
