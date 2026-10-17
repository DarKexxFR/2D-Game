// Ver des sables : une tête (le boss) suivie d'anneaux (`sandworm_segment`) qui reprennent le
// chemin qu'elle a tracé. Chaque anneau détruit arrache un morceau de vie à la tête et raccourcit
// le ver. Cycle : à l'air libre il serpente vers le joueur (crachats de sable, coup de queue), puis
// plonge (intouchable), file sous terre et ressort sous le joueur en laissant des sables mouvants.

import { game, player } from "../../core/state.js";
import { SANDWORM as S } from "../../data/bosses.js";
import { angleDiff, angleTo, clamp, dist } from "../../utils/math.js";
import { damageEnemy } from "../combat.js";
import { addScreenShake, createAoEEffect, createParticles } from "../effects.js";
import { addBeam, addCircle, addRing } from "../hazards.js";
import { clampToZone } from "../arena.js";
import {
  aim,
  enrage,
  fireEnemyProjectile,
  nextAttack,
  orphaned,
  pruneParts,
  shout,
  spawnPart,
} from "./kit.js";

const SAND = "#ffb347";

export function updateSandworm(e) {
  if (!e.segments) growBody(e);
  e.rooted = 1; // la tête se déplace elle-même (elle serpente)
  enrage(e, "#ff6a3d", 1.2, "FRÉNÉSIE DES SABLES !");
  loseSegments(e);
  if (e.eruptIn > 0) return eruptCountdown(e);
  if (e.submerged) return burrowTravel(e);
  slither(e, e.speed);
  if (--e.surfacedFor <= 0) return dive(e);
  if (--e.attackTimer > 0) return;
  e.attackTimer = S.attackEvery * (e.enraged ? 0.75 : 1);
  if (nextAttack(e, ["spit", "whip"]) === "spit") spit(e);
  else whip(e);
}

/** Anneau du ver : posé sur le chemin de la tête, il suit ses plongées. */
export function updateSandwormSegment(e) {
  e.rooted = 1;
  if (orphaned(e)) return;
  const head = e.owner;
  const i = head.segments.indexOf(e);
  const p = head.trail[Math.min(i + 1, head.trail.length - 1)] ?? head;
  e.x = p.x;
  e.y = p.y;
  e.submerged = head.submerged;
}

/** Premier tick : les anneaux sortent de terre derrière la tête. */
function growBody(e) {
  e.segments = [];
  e.trail = [{ x: e.x, y: e.y }];
  e.surfacedFor = S.surfaced;
  e.heading = aim(e);
  for (let i = 0; i < S.segments; i++) {
    const s = spawnPart(e, "sandworm_segment", e.x, e.y);
    s.health = s.maxHealth = e.maxHealth * S.segmentHealth;
    s.damage = e.damage * 0.6;
    e.segments.push(s);
  }
}

/** Anneaux détruits depuis le dernier tick : la tête perd un morceau de vie, le ver raccourcit. */
function loseSegments(e) {
  const lost = pruneParts(e.segments);
  if (lost === 0) return;
  addScreenShake(6);
  createParticles(e.x, e.y, SAND, 12);
  shout(e, "ANNEAU BRISÉ !", "#ffd700");
  damageEnemy(e, e.maxHealth * S.segmentDamage * lost, "other");
}

/**
 * Avance en serpentant : la tête tourne d'au plus `S.turn` par tick vers le joueur et dépose son
 * chemin (un point tous les `segmentGap` pixels) que suivent les anneaux.
 */
function slither(e, speed) {
  const target = angleTo(e.x, e.y, player.worldX, player.worldY);
  e.heading += clamp(angleDiff(target, e.heading), -S.turn, S.turn);
  e.x = clamp(e.x + Math.cos(e.heading) * speed, game.bounds.minX + e.size, game.bounds.maxX - e.size);
  e.y = clamp(e.y + Math.sin(e.heading) * speed, game.bounds.minY + e.size, game.bounds.maxY - e.size);
  const last = e.trail[0];
  if (dist(e.x, e.y, last.x, last.y) >= S.segmentGap) {
    e.trail.unshift({ x: e.x, y: e.y });
    e.trail.length = Math.min(e.trail.length, S.segments + 2);
  }
}

/** Crachat de sable : éventail de projectiles qui ralentissent. */
function spit(e) {
  const base = aim(e);
  const count = S.spit.count + (e.enraged ? 2 : 0);
  for (let k = 0; k < count; k++) {
    fireEnemyProjectile(e.x, e.y, base + (k - (count - 1) / 2) * S.spit.spread, S.spit.speed, {
      size: 10,
      damage: e.damage * 0.45,
      color: SAND,
      slow: S.spit.slow,
    });
  }
  shout(e, "CRACHAT !", SAND);
}

/** Coup de queue : le dernier anneau balaie un arc autour de lui. */
function whip(e) {
  const tail = e.segments[e.segments.length - 1] ?? e;
  const w = S.whip;
  const dir = Math.random() < 0.5 ? -1 : 1;
  const start = angleTo(tail.x, tail.y, player.worldX, player.worldY) - dir * 1.2;
  addBeam(tail.x, tail.y, start, e.damage * 0.7, {
    length: w.length,
    width: w.width,
    delay: w.delay,
    active: w.active,
    color: "#ff8a3d",
    spin: w.spin * dir,
  });
  shout(e, "COUP DE QUEUE !", "#ff8a3d");
}

/** Plongée : la tête et les anneaux s'enfoncent (intouchables) ; des sables mouvants restent. */
function dive(e) {
  e.submerged = true;
  e.burrowFor = S.burrow;
  e.eruptionsLeft = e.enraged ? S.eruptionsEnraged : S.eruptions;
  createParticles(e.x, e.y, SAND, 25);
  addScreenShake(8);
  shout(e, "IL S'ENFOUIT !", SAND, 22, 60);
}

/** Sous terre : il file vers le joueur, puis annonce son éruption sous lui. */
function burrowTravel(e) {
  slither(e, e.speed * S.burrowSpeed);
  if (e.burrowFor % 8 === 0) createParticles(e.x, e.y, SAND, 2);
  if (--e.burrowFor > 0) return;
  const at = clampToZone(player.worldX, player.worldY, e.size);
  e.eruptAt = at;
  e.eruptIn = S.eruptWarn;
  addCircle(at.x, at.y, S.eruptRadius, e.damage, { delay: S.eruptWarn, color: SAND });
}

/** Alerte d'éruption : le ver remonte sous la zone annoncée, puis jaillit. */
function eruptCountdown(e) {
  const at = e.eruptAt;
  e.x += (at.x - e.x) * 0.15;
  e.y += (at.y - e.y) * 0.15;
  if (--e.eruptIn > 0) return;
  e.x = at.x;
  e.y = at.y;
  addRing(e.x, e.y, 520, e.damage * 0.5, { color: SAND, speed: 7 });
  createAoEEffect(e.x, e.y, S.eruptRadius);
  addScreenShake(14);
  quicksand(e);
  if (--e.eruptionsLeft > 0) {
    e.burrowFor = Math.round(S.burrow * 0.5); // seconde éruption (furie) : il replonge aussitôt
    return;
  }
  e.submerged = false;
  e.trail = [{ x: e.x, y: e.y }];
  e.heading = aim(e) + Math.PI; // il ressort dos au joueur puis fait demi-tour
  e.surfacedFor = e.enraged ? S.surfacedEnraged : S.surfaced;
  e.attackTimer = 60;
}

/** Sables mouvants autour de l'éruption : flaques qui ralentissent. */
function quicksand(e) {
  const q = S.quicksand;
  const offset = Math.random() * Math.PI * 2;
  for (let k = 0; k < q.count; k++) {
    const a = offset + (Math.PI * 2 * k) / q.count;
    const at = clampToZone(e.x + Math.cos(a) * q.spread, e.y + Math.sin(a) * q.spread, q.radius);
    addCircle(at.x, at.y, q.radius, e.damage * 0.3, {
      delay: 20,
      color: "#c98a3a",
      pool: q.pool,
      slow: q.slow,
    });
  }
}
