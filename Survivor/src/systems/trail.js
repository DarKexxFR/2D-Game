// Traînée cosmétique du vaisseau (skin) : points laissés derrière lui quand il bouge.
// Les mêmes fonctions servent en partie (world.trail) et dans l'aperçu de l'écran Skins.

import { TRAIL } from "../data/skins.js";
import { player, world } from "../core/state.js";
import { currentSkin, shipLook } from "../services/skins.js";

/** Ajoute un point derrière un vaisseau de rayon `size` qui se déplace de (dx, dy). */
export function pushTrailPoint(list, x, y, dx, dy, size, look) {
  if (look.trail === "none") return;
  const len = Math.hypot(dx, dy) || 1;
  const back = size * 0.55;
  const spread = look.trail === "sparks" || look.trail === "pixels" ? size * 0.5 : size * 0.15;
  list.push({
    x: x - (dx / len) * back + (Math.random() - 0.5) * spread,
    y: y - (dy / len) * back + (Math.random() - 0.5) * spread,
    // Petite dérive vers l'arrière (étincelles, flammes)
    vx: (-dx / len) * 0.6 + (Math.random() - 0.5) * 0.8,
    vy: (-dy / len) * 0.6 + (Math.random() - 0.5) * 0.8,
    size,
    style: look.trail,
    color: look.trailColor,
    life: TRAIL.life,
    seed: Math.random(),
  });
  if (list.length > TRAIL.max) list.splice(0, list.length - TRAIL.max);
}

/** Fait vieillir les points (à appeler une fois par tick). */
export function ageTrail(list) {
  let w = 0;
  for (const p of list) {
    p.x += p.vx;
    p.y += p.vy;
    if (--p.life > 0) list[w++] = p;
  }
  list.length = w;
}

let lastX = null;
let lastY = null;
let tick = 0;

/** En partie : sème la traînée du joueur quand il bouge. */
export function updateTrail() {
  ageTrail(world.trail);
  const { worldX: x, worldY: y } = player;
  const dx = lastX === null ? 0 : x - lastX;
  const dy = lastY === null ? 0 : y - lastY;
  lastX = x;
  lastY = y;
  if (Math.hypot(dx, dy) < 0.5 || ++tick % TRAIL.every) return;
  pushTrailPoint(world.trail, x, y, dx, dy, player.size, shipLook(player.hero, currentSkin()));
}
