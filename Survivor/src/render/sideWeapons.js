// Rendu des armes d'appoint : mines posées, faisceaux tournants, coups de fouet et missiles.
// Pas de shadowBlur : ces formes se dessinent par dizaines à forte cadence (lueur = trait large transparent).

import { ctx } from "../core/canvas.js";
import { player, world } from "../core/state.js";
import { SIDE_WEAPONS, sideStats } from "../data/sideWeapons.js";
import { beamSegments } from "../systems/sideWeapons.js";
import { fillCircle, strokeCircle } from "./draw.js";

const TAU = Math.PI * 2;

/** Mines : clignotent tant qu'elles ne sont pas armées, puis pulsent doucement. */
export function drawMines(now) {
  for (const m of world.mines) {
    const armed = m.arm <= 0;
    const blink = armed ? 0.6 + Math.sin(now / 180) * 0.25 : Math.floor(now / 90) % 2 ? 0.35 : 0.9;
    ctx.globalAlpha = 0.12;
    fillCircle(m.x, m.y, 16, m.color);
    ctx.globalAlpha = blink;
    strokeCircle(m.x, m.y, 9, m.color, 2);
    fillCircle(m.x, m.y, 3.5, armed ? m.color : "#ffffff");
    for (let k = 0; k < 4; k++) {
      const a = (TAU * k) / 4 + now / 900;
      fillCircle(m.x + Math.cos(a) * 12, m.y + Math.sin(a) * 12, 1.8, m.color);
    }
  }
  ctx.globalAlpha = 1;
}

/** Faisceaux du Faisceau rotatif, partant du vaisseau. */
export function drawBeams(now) {
  const w = player.sideWeapons?.find((x) => x.id === "beam");
  if (!w) return;
  const s = sideStats(w, player);
  const color = SIDE_WEAPONS.beam.color;
  const flicker = 0.85 + Math.sin(now / 40) * 0.15;
  ctx.lineCap = "round";
  for (const g of beamSegments(w, s)) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.18 * flicker;
    ctx.lineWidth = 16;
    line(player.worldX, player.worldY, g.x2, g.y2);
    ctx.globalAlpha = 0.9 * flicker;
    ctx.lineWidth = 4;
    line(player.worldX, player.worldY, g.x2, g.y2);
    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1.5;
    line(player.worldX, player.worldY, g.x2, g.y2);
    ctx.globalAlpha = 0.6 * flicker;
    fillCircle(g.x2, g.y2, 5, color);
  }
  ctx.globalAlpha = 1;
}

/** Coups de fouet : arc lumineux qui s'efface en quelques ticks. */
export function drawSlashes() {
  ctx.lineCap = "round";
  for (const s of world.slashes) {
    const t = s.life / 12; // 1 → 0
    const r = s.range * (0.75 + (1 - t) * 0.25);
    ctx.strokeStyle = s.color;
    ctx.globalAlpha = 0.25 * t;
    ctx.lineWidth = 18;
    arc(s.x, s.y, r, s.angle, s.arc);
    ctx.globalAlpha = t;
    ctx.lineWidth = 4;
    arc(s.x, s.y, r, s.angle, s.arc);
    ctx.strokeStyle = "#eafff4";
    ctx.lineWidth = 1.5;
    arc(s.x, s.y, r - 6, s.angle, s.arc * 0.8);
  }
  ctx.globalAlpha = 1;
}

/** Missile chercheur : petit corps orienté, flamme à l'arrière. */
export function drawMissile(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.atan2(p.vy, p.vx));
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.ellipse(-9, 0, 9, 3.5, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(2, -3.5);
  ctx.lineTo(-5, -3.5);
  ctx.lineTo(-7, -6);
  ctx.lineTo(-7, 6);
  ctx.lineTo(-5, 3.5);
  ctx.lineTo(2, 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function arc(x, y, r, angle, width) {
  ctx.beginPath();
  ctx.arc(x, y, r, angle - width / 2, angle + width / 2);
  ctx.stroke();
}
