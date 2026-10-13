// Attaques de zone des boss, toujours annoncées avant de frapper (le joueur peut esquiver,
// le dash et le bouclier protègent) :
//  - circle : zone ronde qui se remplit puis explose (et peut laisser une flaque) ;
//  - beam   : laser en ligne droite, d'abord un trait fin d'alerte puis le rayon ;
//  - ring   : onde de choc qui s'élargit, à franchir au dash.
// Option `stun` (ticks) : un coup étourdit le joueur (Titan de l'orage).

import { TICK_MS } from "../config.js";
import { game, player, world } from "../core/state.js";
import { playSfx } from "../services/sfx.js";
import { dist, removeWhere } from "../utils/math.js";
import { addScreenShake, createParticles, createShockwave } from "./effects.js";
import { isProtected, stunPlayer, takeDamage } from "./player.js";

const POOL_TICK = 30; // une flaque blesse au plus toutes les 0,5 s
const BEAM_TICK = 12; // un laser actif blesse au plus toutes les 0,2 s

/** Zone ronde : alerte pendant `delay` ticks, puis dégâts ; `pool` = durée de la flaque restante. */
export function addCircle(
  x,
  y,
  radius,
  damage,
  { delay = 60, color = "#ff2a6d", pool = 0, slow = 0, stun = 0 } = {},
) {
  world.hazards.push({
    kind: "circle",
    x,
    y,
    radius,
    damage,
    delay,
    total: delay,
    color,
    pool,
    slow,
    stun,
    hit: 0,
  });
}

/** Laser depuis (x, y) dans la direction `angle` ; `spin` = rotation par tick une fois actif. */
export function addBeam(
  x,
  y,
  angle,
  damage,
  { length = 1400, width = 34, delay = 55, active = 28, color = "#ff0040", spin = 0, stun = 0 } = {},
) {
  world.hazards.push({
    kind: "beam",
    x,
    y,
    angle,
    length,
    width,
    damage,
    delay,
    total: delay,
    active,
    color,
    spin,
    stun,
    hit: 0,
  });
}

/** Onde de choc circulaire qui s'élargit jusqu'à `max`. */
export function addRing(
  x,
  y,
  max,
  damage,
  { speed = 7, width = 26, color = "#9fe8ff", slow = 0, stun = 0 } = {},
) {
  world.hazards.push({
    kind: "ring",
    x,
    y,
    radius: 0,
    max,
    speed,
    width,
    damage,
    color,
    slow,
    stun,
    done: false,
  });
}

export function updateHazards() {
  for (const h of world.hazards) UPDATERS[h.kind](h);
  removeWhere(world.hazards, (h) => h.done);
}

function hurt(h) {
  if (isProtected()) return;
  takeDamage(h.damage);
  if (h.slow) player.buffs.slow = Math.max(player.buffs.slow, h.slow);
  if (h.stun) stunPlayer(h.stun);
}

const UPDATERS = {
  circle(h) {
    if (h.delay > 0) {
      if (--h.delay === 0) {
        createShockwave(h.x, h.y, h.radius, h.color);
        createParticles(h.x, h.y, h.color, 10);
        addScreenShake(5);
        playSfx("explosion");
        if (dist(player.worldX, player.worldY, h.x, h.y) < h.radius + player.size * 0.5) hurt(h);
        if (h.pool <= 0) h.done = true;
      }
      return;
    }
    // Flaque : petits dégâts réguliers tant qu'on reste dedans
    if (--h.pool <= 0) h.done = true;
    if (game.time - h.hit < POOL_TICK * TICK_MS) return;
    if (dist(player.worldX, player.worldY, h.x, h.y) < h.radius) {
      h.hit = game.time;
      if (!isProtected()) takeDamage(h.damage * 0.25);
    }
  },

  beam(h) {
    if (h.delay > 0) {
      if (--h.delay > 0) return;
      if (h.damage <= 0) {
        h.done = true; // simple trait d'alerte (charge du crabe)
        return;
      }
      addScreenShake(8);
      playSfx("explosion");
    }
    h.angle += h.spin; // laser tournant (Sentinelle prismatique)
    if (--h.active <= 0) h.done = true;
    if (game.time - h.hit < BEAM_TICK * TICK_MS) return;
    if (distToBeam(h, player.worldX, player.worldY) < h.width / 2 + player.size * 0.5) {
      h.hit = game.time;
      hurt(h);
    }
  },

  ring(h) {
    h.radius += h.speed;
    if (h.radius >= h.max) h.done = true;
    if (h.hitPlayer) return;
    const d = dist(player.worldX, player.worldY, h.x, h.y);
    if (Math.abs(d - h.radius) < h.width / 2 + player.size * 0.5) {
      h.hitPlayer = true; // une seule fois par onde
      hurt(h);
    }
  },
};

/** Distance d'un point au segment du laser. */
export function distToBeam(h, px, py) {
  const dx = Math.cos(h.angle);
  const dy = Math.sin(h.angle);
  const t = Math.max(0, Math.min(h.length, (px - h.x) * dx + (py - h.y) * dy));
  return Math.hypot(px - (h.x + dx * t), py - (h.y + dy * t));
}
