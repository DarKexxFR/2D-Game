// Ralenti de la mort : les dernières secondes de la partie sont gardées en mémoire (vaisseau,
// ennemis, tirs, attaques de zone) pour être rejouées depuis l'écran de fin (render/killCam.js).
// Une image toutes les KILL_CAM.every ticks, seulement autour du vaisseau ; état rangé dans `game`.

import { KILL_CAM, TICK_MS } from "../config.js";
import { game, player, world } from "../core/state.js";
import { ENEMY_NAMES } from "../data/enemies.js";

const MAX_FRAMES = Math.ceil((KILL_CAM.seconds * 1000) / TICK_MS / KILL_CAM.every);

// Champs lus par drawEnemies (render/entities.js)
const ENEMY_FIELDS = [
  "id",
  "type",
  "template",
  "x",
  "y",
  "size",
  "color",
  "phase",
  "elite",
  "enraged",
  "health",
  "maxHealth",
  "submerged",
  "whirl",
  "facing",
  "magnetWarn",
  "pulling",
  "stun",
  "hitTime",
];

// Ce qui blesse sans être un ennemi (événements de carte)
const OTHER_KILLERS = {
  rock: "Astéroïde",
  drop: "Pluie acide",
  star: "Étoile filante",
  vortex: "Trou noir",
};

function copyEnemy(e) {
  const c = {};
  for (const k of ENEMY_FIELDS) c[k] = e[k];
  return c;
}

const near = (o, r = 0) =>
  Math.abs(o.x - player.worldX) < KILL_CAM.range + r && Math.abs(o.y - player.worldY) < KILL_CAM.range + r;

/** À chaque tick d'une partie (hors duel) : garde une image toutes les KILL_CAM.every ticks. */
export function recordKillCam() {
  const kc = game.killCam;
  if (kc.tick++ % KILL_CAM.every !== 0) return;
  const enemies = [];
  for (const e of world.enemies) {
    if (!e.dead && near(e, e.size) && enemies.length < KILL_CAM.maxEnemies) enemies.push(copyEnemy(e));
  }
  const shots = [];
  for (const p of world.projectiles) {
    if (shots.length >= KILL_CAM.maxShots) break;
    if (!p.dead && near(p)) {
      shots.push({ type: p.type, x: p.x, y: p.y, vx: p.vx, vy: p.vy, size: p.size, color: p.color });
    }
  }
  const enemyShots = [];
  for (const p of world.enemyProjectiles) {
    if (enemyShots.length >= KILL_CAM.maxShots) break;
    if (!p.dead && near(p)) {
      enemyShots.push({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, size: p.size, color: p.color, scythe: p.scythe });
    }
  }
  kc.frames.push({
    t: game.time,
    wave: game.wave,
    x: player.worldX,
    y: player.worldY,
    angle: player.aimAngle || 0,
    health: Math.max(0, player.health) / player.maxHealth,
    dash: player.isDashing,
    shield: player.buffs.shield > 0,
    enemies,
    shots,
    enemyShots,
    hazards: world.hazards.map((h) => ({ ...h })),
  });
  if (kc.frames.length > MAX_FRAMES) kc.frames.shift();
}

/**
 * Coup fatal : retient qui l'a porté. `source` = l'ennemi lui-même, son type, ou un événement de
 * carte (OTHER_KILLERS) ; sans source (tir, attaque de zone), c'est le boss en vie, s'il y en a un.
 */
export function noteKiller(source) {
  let enemy = typeof source === "object" && source ? source : null;
  let key = enemy ? enemy.type : source;
  if (!key) {
    for (const e of world.enemies) {
      if (!e.dead && e.template?.isBoss && (!enemy || e.maxHealth > enemy.maxHealth)) enemy = e;
    }
    key = enemy?.type;
  }
  game.killCam.killer = {
    id: enemy?.id ?? null, // entouré pendant le ralenti
    name: OTHER_KILLERS[key] || ENEMY_NAMES[key] || "Un ennemi",
    boss: !!enemy?.template?.isBoss,
    health: enemy ? Math.max(0, enemy.health) / enemy.maxHealth : null,
  };
}

export function hasKillCam() {
  return game.killCam.frames.length >= 2;
}
