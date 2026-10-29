// Tisseuse du vide : elle plante des ancres (`weaver_anchor`, parties du boss) autour du joueur puis tend
// des fils laser de l'une à l'autre : une cage dont un côté reste toujours ouvert. Fils collants (tirs qui
// ralentissent), portails (téléportation annoncée puis salve). Chaque ancre détruite l'étourdit un
// instant (« FIL ROMPU ») : c'est le moment de frapper.

import { player } from "../../core/state.js";
import { WEAVER as W } from "../../data/bosses.js";
import { angleTo, dist } from "../../utils/math.js";
import { addScreenShake, createParticles } from "../effects.js";
import { addBeam, addCircle } from "../hazards.js";
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

const THREAD = "#e0b3ff";

export function updateWeaver(e) {
  e.anchors ??= [];
  e.planting ??= [];
  enrage(e, "#ff5cf4", 1.2, "TOILE INFINIE !");
  if (pruneParts(e.anchors) > 0) snap(e);
  plantPending(e);
  if (e.portalTo) return portalCountdown(e);
  if (--e.attackTimer > 0) return;
  e.attackTimer = W.attackEvery * (e.enraged ? 0.8 : 1);
  let attack = nextAttack(e, W.cycle);
  if (attack === "weave" && e.anchors.length < 3) attack = "anchors";
  if (attack === "anchors" && e.anchors.length + e.planting.length >= W.anchors.max) attack = "weave";
  if (attack === "anchors") anchors(e);
  else if (attack === "weave") weave(e);
  else if (attack === "web") web(e);
  else portal(e);
}

/** Ancre de toile : immobile, elle tombe avec la Tisseuse. */
export function updateWeaverAnchor(e) {
  e.rooted = 1;
  orphaned(e);
}

/** Ancre détruite : la Tisseuse est sonnée un instant. */
function snap(e) {
  e.stun = Math.max(e.stun || 0, W.snapStun);
  shout(e, "FIL ROMPU !", "#ffffff", 20, 50);
  addScreenShake(5);
}

/** Ancres : annoncées en cercle autour du joueur, elles sortent ensuite du sol. */
function anchors(e) {
  const a = W.anchors;
  const count = Math.min(e.enraged ? a.countEnraged : a.count, a.max - e.anchors.length - e.planting.length);
  const offset = Math.random() * Math.PI * 2;
  for (let k = 0; k < count; k++) {
    const ang = offset + (Math.PI * 2 * k) / count;
    const at = clampToZone(
      player.worldX + Math.cos(ang) * a.radius,
      player.worldY + Math.sin(ang) * a.radius,
      30,
    );
    addCircle(at.x, at.y, 40, e.damage * 0.4, { delay: a.delay, color: THREAD });
    e.planting.push({ ...at, in: a.delay });
  }
  shout(e, "ANCRES !", THREAD);
}

function plantPending(e) {
  for (let i = e.planting.length - 1; i >= 0; i--) {
    const p = e.planting[i];
    if (--p.in > 0) continue;
    e.planting.splice(i, 1);
    const anchor = spawnPart(e, "weaver_anchor", p.x, p.y);
    anchor.health = anchor.maxHealth = e.maxHealth * W.anchors.health;
    e.anchors.push(anchor);
  }
}

/**
 * Tissage : fils laser d'une ancre à la suivante (tri par angle autour du joueur). Le fil qui fait face à
 * la plus grande ouverture n'est pas tendu : la cage a toujours une sortie.
 */
function weave(e) {
  const w = W.weave;
  const list = [...e.anchors].sort(
    (a, b) =>
      angleTo(player.worldX, player.worldY, a.x, a.y) - angleTo(player.worldX, player.worldY, b.x, b.y),
  );
  const exit = Math.floor(Math.random() * list.length);
  for (let i = 0; i < list.length; i++) {
    if (i === exit) continue;
    const from = list[i];
    const to = list[(i + 1) % list.length];
    addBeam(from.x, from.y, angleTo(from.x, from.y, to.x, to.y), e.damage * w.damage, {
      length: dist(from.x, from.y, to.x, to.y),
      width: w.width,
      delay: w.delay,
      active: w.active,
      color: THREAD,
    });
  }
  shout(e, "TISSAGE !", THREAD, 20, 50);
}

/** Fils collants : couronne de tirs lents qui ralentissent le joueur touché. */
function web(e) {
  const c = W.web;
  const count = e.enraged ? c.countEnraged : c.count;
  const base = aim(e);
  for (let k = 0; k < count; k++) {
    fireEnemyProjectile(e.x, e.y, base + (Math.PI * 2 * k) / count, c.speed, {
      size: 9,
      damage: e.damage * c.damage,
      color: "#f2d9ff",
      slow: c.slow,
    });
  }
  shout(e, "TOILE !", "#f2d9ff");
}

/** Portail : point d'arrivée annoncé près du joueur, puis elle y surgit avec une salve. */
function portal(e) {
  const p = W.portal;
  const a = Math.random() * Math.PI * 2;
  e.portalTo = clampToZone(
    player.worldX + Math.cos(a) * p.distance,
    player.worldY + Math.sin(a) * p.distance,
    e.size,
  );
  e.portalIn = p.warn;
  shout(e, "PORTAIL !", "#ff5cf4");
}

function portalCountdown(e) {
  e.rooted = 1;
  if (e.portalIn % 4 === 0) createParticles(e.portalTo.x, e.portalTo.y, "#ff5cf4", 3);
  if (--e.portalIn > 0) return;
  createParticles(e.x, e.y, e.color, 16);
  e.x = e.portalTo.x;
  e.y = e.portalTo.y;
  e.portalTo = null;
  createParticles(e.x, e.y, e.color, 16);
  const p = W.portal;
  const offset = Math.random();
  for (let k = 0; k < p.burst; k++) {
    fireEnemyProjectile(e.x, e.y, offset + (Math.PI * 2 * k) / p.burst, 4, {
      size: 8,
      damage: e.damage * p.damage,
      color: "#ff5cf4",
    });
  }
}
