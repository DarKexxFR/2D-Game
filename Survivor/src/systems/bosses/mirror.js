// Le Reflet : il se tient à l'opposé du joueur (symétrie autour du centre de l'arène) et copie son
// arsenal : les tirs de son arme, une contre-attaque par arme d'appoint (à tour de rôle) et ses dashs.
// En furie, un Écho (`mirror_echo`, partie du boss) se place à angle droit et tire lui aussi.

import { game, player } from "../../core/state.js";
import { MIRROR as M } from "../../data/bosses.js";
import { sideWeaponIds } from "../../data/sideWeapons.js";
import { dist } from "../../utils/math.js";
import { createParticles } from "../effects.js";
import { addBeam, addCircle, addRing } from "../hazards.js";
import { arenaCenter, clampToZone } from "../arena.js";
import { aim, enrage, fireEnemyProjectile, orphaned, shout, spawnPart } from "./kit.js";

export function updateMirror(e) {
  e.rooted = 1; // il se déplace lui-même (symétrie, dash copié)
  if (enrage(e, "#ffffff", 1.15, "DOUBLE REFLET !")) summonEcho(e);
  e.barTag = e.echo && !e.echo.dead ? "REFLET ×2" : "";
  copyDash(e);
  if (e.dashing > 0) dashStep(e);
  else follow(e, 0);
  if (--e.attackTimer > 0) return;
  e.attackTimer = M.attackEvery * (e.enraged ? 0.8 : 1);
  e.turn = (e.turn ?? 0) + 1;
  if (e.turn % 2) copyShots(e, e.damage);
  else counter(e);
}

/** Écho du Reflet : même jeu, un quart de tour plus loin, tombe avec lui. */
export function updateMirrorEcho(e) {
  e.rooted = 1;
  if (orphaned(e)) return;
  follow(e, Math.PI / 2);
  e.fireIn = (e.fireIn ?? M.echo.fireEvery) - 1;
  if (e.fireIn > 0) return;
  e.fireIn = M.echo.fireEvery;
  copyShots(e, e.owner.damage * 0.8);
}

/** Va vers la position miroir du joueur (tournée de `rot` autour du centre de l'arène). */
function follow(e, rot) {
  const c = arenaCenter();
  const dx = player.worldX - c.x;
  const dy = player.worldY - c.y;
  const cos = Math.cos(Math.PI + rot);
  const sin = Math.sin(Math.PI + rot);
  let tx = c.x + dx * cos - dy * sin;
  let ty = c.y + dx * sin + dy * cos;
  // Joueur au centre : le miroir tomberait sur lui, il garde ses distances
  const d = dist(tx, ty, player.worldX, player.worldY);
  if (d < M.minDist) {
    const a = d > 0 ? Math.atan2(ty - player.worldY, tx - player.worldX) : aim(e) + Math.PI;
    tx = player.worldX + Math.cos(a) * M.minDist;
    ty = player.worldY + Math.sin(a) * M.minDist;
  }
  ({ x: tx, y: ty } = clampToZone(tx, ty, e.size));
  e.x += (tx - e.x) * M.follow;
  e.y += (ty - e.y) * M.follow;
}

/** Le joueur dashe : le Reflet dashe aussi, droit sur lui. */
function copyDash(e) {
  if (!player.isDashing) {
    e.copiedDash = false;
    return;
  }
  if (e.copiedDash || game.time < (e.dashReadyAt ?? 0)) return;
  e.copiedDash = true;
  e.dashing = M.dash.ticks;
  e.dashAngle = aim(e);
  e.dashReadyAt = game.time + M.dash.cooldown * (1000 / 60);
  createParticles(e.x, e.y, e.color, 8);
}

function dashStep(e) {
  e.dashing--;
  const step = e.baseSpeed * M.dash.speed;
  const at = clampToZone(e.x + Math.cos(e.dashAngle) * step, e.y + Math.sin(e.dashAngle) * step, e.size);
  e.x = at.x;
  e.y = at.y;
  if (e.dashing % 3 === 0) createParticles(e.x, e.y, e.color, 2);
}

/** Copie des tirs de l'arme du joueur : même nombre de projectiles, même éventail (ou couronne). */
function copyShots(e, damage) {
  const w = player.weapon;
  const count = Math.min(M.shots.max, (w?.projectiles ?? 1) + (player.inventory["Multi-Tir"] || 0));
  const spread = w?.ring ? (Math.PI * 2) / count : Math.max(w?.spread || 0, M.shots.spread);
  const speed = Math.max(3, (w?.speed ?? 8) * M.shots.speed);
  const base = aim(e);
  for (let i = 0; i < count; i++) {
    fireEnemyProjectile(e.x, e.y, base + (i - (count - 1) / 2) * spread, speed, {
      size: Math.max(6, (w?.size ?? 6) * 0.9),
      damage: damage * M.shots.damage,
      color: w?.color ?? e.color,
      from: e,
    });
  }
}

function summonEcho(e) {
  const at = clampToZone(e.x + 60, e.y, e.size);
  e.echo = spawnPart(e, "mirror_echo", at.x, at.y);
  e.echo.health = e.echo.maxHealth = e.maxHealth * M.echo.health;
}

/** Contre-attaque : imite à tour de rôle chaque arme d'appoint du joueur (sinon une salve d'éclats). */
function counter(e) {
  const ids = sideWeaponIds(player);
  const id = ids.length ? ids[(e.counterTurn = ((e.counterTurn ?? -1) + 1) % ids.length)] : "shards";
  const c = M.counters[id] || M.counters.shards;
  const dmg = e.damage * c.damage;
  if (id === "missiles") {
    for (let k = 0; k < c.count; k++) {
      fireEnemyProjectile(e.x, e.y, aim(e) + Math.PI + (k - (c.count - 1) / 2) * 0.5, c.speed, {
        size: 9,
        damage: dmg,
        color: "#ff8a3d",
        homing: c.homing,
        life: c.life,
      });
    }
  } else if (id === "mines") {
    for (let k = 0; k < c.count; k++) {
      const a = (Math.PI * 2 * k) / c.count;
      const at = clampToZone(player.worldX + Math.cos(a) * 90, player.worldY + Math.sin(a) * 90, c.radius);
      addCircle(at.x, at.y, c.radius, dmg, { delay: c.delay + k * 8, color: "#ff2a6d" });
    }
  } else if (id === "lightning") {
    for (let k = 0; k < c.count; k++) {
      const off = k === 0 ? 0 : c.spread;
      const a = Math.random() * Math.PI * 2;
      const at = clampToZone(player.worldX + Math.cos(a) * off, player.worldY + Math.sin(a) * off, c.radius);
      addCircle(at.x, at.y, c.radius, dmg, { delay: c.delay, color: "#ffe14d" });
    }
  } else if (id === "pulse") {
    addRing(e.x, e.y, c.max, dmg, { color: "#00ffff", speed: c.speed });
  } else if (id === "beam") {
    for (let k = 0; k < c.beams; k++) {
      addBeam(e.x, e.y, aim(e) + Math.PI / 2 + (Math.PI * 2 * k) / c.beams, dmg, {
        length: c.length,
        width: c.width,
        delay: c.delay,
        active: c.active,
        spin: c.spin,
        color: "#aa66ff",
      });
    }
  } else if (id === "whip") {
    addBeam(e.x, e.y, aim(e), dmg, {
      length: c.length,
      width: c.width,
      delay: c.delay,
      active: c.active,
      color: "#00ff88",
    });
  } else {
    const offset = Math.random();
    for (let k = 0; k < c.count; k++) {
      fireEnemyProjectile(e.x, e.y, offset + (Math.PI * 2 * k) / c.count, c.speed, {
        size: 8,
        damage: dmg,
        color: e.color,
      });
    }
  }
  shout(e, id === "shards" ? "ÉCLATS !" : "COPIE !", e.color);
}
