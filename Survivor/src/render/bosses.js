// Rendu propre aux boss de systems/bosses/ : corps du Ver des sables, poison des fleurs de la
// Mère-Ruche, trajet du « retour arrière » du Chronophage, battement du Cœur du Pulse et effets du
// Hacker sur le vaisseau (commandes inversées, tir brouillé).

import { ctx } from "../core/canvas.js";
import { game, player, world } from "../core/state.js";
import { fillCircle, strokeCircle } from "./draw.js";

const BEAT_MS = 220; // durée du gonflement du Cœur à chaque battement

/** Échelle du Cœur du Pulse : il se gonfle à chaque battement puis revient. */
export function beatScale(e) {
  if (e.beatAt === undefined) return 1;
  return 1 + 0.14 * Math.max(0, 1 - (game.time - e.beatAt) / BEAT_MS);
}

/** Sous les ennemis : ce qui relie ou entoure les parties de boss. */
export function drawBossUnderlays(now) {
  for (const e of world.enemies) {
    if (e.dead) continue;
    if (e.type === "sandworm" && e.segments?.length) drawWormBody(e);
    else if (e.type === "hive_flower" && e.aura) drawToxicAura(e, now);
    else if (e.type === "chronophage" && e.rewindIn > 0 && e.rewindTo) drawRewindPath(e, now);
    else if (e.type === "weaver" && e.anchors?.length > 1) drawThreads(e, now);
    else if (e.type === "weaver" && e.portalTo) drawPortal(e.portalTo, now);
  }
  ctx.globalAlpha = 1;
}

/** Fils de la Tisseuse : traits fins entre elle et ses ancres (la vraie cage, ce sont les lasers). */
function drawThreads(e, now) {
  ctx.globalAlpha = 0.25 + Math.sin(now / 200) * 0.05;
  ctx.strokeStyle = "#e0b3ff";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const a of e.anchors) {
    if (a.dead) continue;
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(a.x, a.y);
  }
  ctx.stroke();
  if (e.portalTo) drawPortal(e.portalTo, now);
}

/** Portail de la Tisseuse : spirale à l'endroit où elle va surgir. */
function drawPortal(at, now) {
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 3; i++) {
    const k = (now / 600 + i / 3) % 1;
    strokeCircle(at.x, at.y, 50 * (1 - k) + 8, "#ff5cf4", 2);
  }
}

/** Corps du ver : un cordon épais qui relie la tête à ses anneaux. */
function drawWormBody(e) {
  ctx.globalAlpha = e.submerged ? 0.15 : 0.55;
  ctx.strokeStyle = e.color;
  ctx.lineWidth = e.segments[0].size * 1.1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(e.x, e.y);
  for (const s of e.segments) ctx.lineTo(s.x, s.y);
  ctx.stroke();
  ctx.lineCap = "butt";
}

/** Poison d'une fleur : nappe verte qui s'étend, contour en pointillés. */
function drawToxicAura(e, now) {
  ctx.globalAlpha = 0.13 + Math.sin(now / 300 + e.x) * 0.03;
  fillCircle(e.x, e.y, e.aura, e.color);
  ctx.globalAlpha = 0.55;
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -now / 50;
  strokeCircle(e.x, e.y, e.aura, e.color, 2);
  ctx.setLineDash([]);
}

/** Retour arrière : pointillés dorés du vaisseau vers l'endroit où il va être ramené. */
function drawRewindPath(e, now) {
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = "#ffd27a";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  ctx.lineDashOffset = now / 30;
  ctx.beginPath();
  ctx.moveTo(player.worldX, player.worldY);
  ctx.lineTo(e.rewindTo.x, e.rewindTo.y);
  ctx.stroke();
  ctx.setLineDash([]);
  strokeCircle(e.rewindTo.x, e.rewindTo.y, player.size + 4, "#ffd27a", 2);
}

/**
 * Vaisseau piraté : alerte (anneau rose qui clignote), commandes inversées (éclats de pixels
 * décalés) ou tir brouillé (signal barré au-dessus du vaisseau).
 */
export function drawPlayerGlitch(x, y, size, now) {
  const b = player.buffs;
  if (b.glitchWarn > 0 && Math.floor(now / 90) % 2 === 0) {
    ctx.globalAlpha = 0.8;
    strokeCircle(x, y, size + 10, "#ff2a6d", 3);
  }
  if (b.glitch > 0) {
    const t = Math.floor(now / 70);
    for (let i = 0; i < 6; i++) {
      // Éclats pseudo-aléatoires mais stables sur 70 ms
      const k = Math.sin(t * 12.9898 + i * 78.233) * 43758.5453;
      const rx = (k - Math.floor(k) - 0.5) * size * 3;
      const ry = Math.sin(k) * 0.5 * size * 2.4;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = i % 2 ? "#ff2a6d" : "#39ff8e";
      ctx.fillRect(x + rx, y + ry, 4 + (i % 3) * 3, 3);
    }
  }
  if (b.jammed > 0) {
    const cy = y - size - 16;
    ctx.globalAlpha = 0.9;
    strokeCircle(x, cy, 7, "#39ff8e", 2);
    ctx.strokeStyle = "#ff2a6d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 6, cy + 6);
    ctx.lineTo(x + 6, cy - 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
