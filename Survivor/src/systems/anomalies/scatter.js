// Placement des objets d'une anomalie : points (u, v) relatifs à la zone de combat.

import { player } from "../../core/state.js";

/**
 * `count` points (u, v) répartis dans `zone` (entre `margin` et 1 - margin), à au moins `gap` les uns
 * des autres quand c'est possible (sinon le meilleur essai), et à plus de `clear` px du joueur (rien
 * ne doit apparaître sous son vaisseau).
 * @param {number} count
 * @param {{ minX: number, maxX: number, minY: number, maxY: number }} zone
 */
export function scatter(count, zone, { margin = 0.1, gap = 0.2, clear = 300 } = {}) {
  const w = zone.maxX - zone.minX;
  const h = zone.maxY - zone.minY;
  const pu = (player.worldX - zone.minX) / w;
  const pv = (player.worldY - zone.minY) / h;
  const points = [];
  for (let i = 0; i < count; i++) {
    let best = null;
    let bestScore = -1;
    for (let tries = 0; tries < 40; tries++) {
      const u = margin + Math.random() * (1 - 2 * margin);
      const v = margin + Math.random() * (1 - 2 * margin);
      let score = Math.hypot((u - pu) * w, (v - pv) * h) < clear ? 0 : 1;
      for (const p of points) score = Math.min(score, Math.hypot(p.u - u, p.v - v) / gap);
      if (score > bestScore) [best, bestScore] = [{ u, v }, score];
      if (score >= 1) break;
    }
    points.push(best);
  }
  return points;
}
