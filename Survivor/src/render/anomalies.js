// Dessin des anomalies de biome (systems/anomalies/) et du Marchand Noir (systems/blackMarket.js).
// Peu d'objets à la fois : lueur = tracé plus large et transparent dessous (pas de shadowBlur).

import { BLACK_MARKET } from "../config.js";
import { ctx } from "../core/canvas.js";
import { game, player, world } from "../core/state.js";
import { ANOMALIES } from "../data/anomalies.js";
import { isOnScreen } from "../systems/combat.js";
import { drawText, fillCircle, strokeCircle } from "./draw.js";
import { drawSprite, getSprite } from "./sprites.js";

const TAU = Math.PI * 2;

/** Au sol, sous tout le reste : plaques de verglas, portails. */
export function drawAnomalyGround(now) {
  const a = game.anomaly;
  if (!a) return;
  if (a.id === "ice") drawIce(a, ANOMALIES.ice, now);
  else if (a.id === "portals") drawPortals(a, ANOMALIES.portals, now);
}

/** Au-dessus du sol, sous les ennemis : tourelles de la station. */
export function drawAnomalyObjects(now) {
  const a = game.anomaly;
  if (a?.id === "turrets") drawStationTurrets(a, ANOMALIES.turrets, now);
}

function polygon(x, y, r, sides, rot) {
  ctx.beginPath();
  for (let k = 0; k < sides; k++) {
    const t = rot + (k * TAU) / sides;
    const px = x + Math.cos(t) * r;
    const py = y + Math.sin(t) * r;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawIce(a, def, now) {
  for (const p of a.items) {
    if (!isOnScreen(p.x, p.y, p.r)) continue;
    const rot = p.rot;
    polygon(p.x, p.y, p.r, p.sides, rot);
    ctx.fillStyle = "rgba(170, 235, 255, 0.13)";
    ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Reflets : deux traits parallèles qui glissent lentement
    ctx.save();
    polygon(p.x, p.y, p.r * 0.96, p.sides, rot);
    ctx.clip();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 10;
    const shift = ((now / 40 + p.x) % (p.r * 4)) - p.r * 2;
    for (const off of [0, 26]) {
      ctx.beginPath();
      ctx.moveTo(p.x - p.r + shift + off, p.y + p.r);
      ctx.lineTo(p.x + p.r + shift + off, p.y - p.r);
      ctx.stroke();
    }
    ctx.restore();
    // Facettes : lignes du centre vers les sommets
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < p.sides; k++) {
      const t = rot + (k * TAU) / p.sides;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(t) * p.r, p.y + Math.sin(t) * p.r);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawPortals(a, def, now) {
  for (const [i, p] of a.items.entries()) {
    if (!isOnScreen(p.x, p.y, def.radius * 2)) continue;
    const locked = a.lock === i;
    const color = locked ? def.exitColor : def.color;
    const spin = now / 400 + i;
    ctx.globalAlpha = 0.14 + Math.sin(now / 200 + i) * 0.04;
    fillCircle(p.x, p.y, def.radius * 1.35, color);
    ctx.globalAlpha = 0.3;
    strokeCircle(p.x, p.y, def.radius, color, 9);
    ctx.globalAlpha = 1;
    strokeCircle(p.x, p.y, def.radius, color, 2.5);
    // Anneau en pointillés qui tourne, cœur sombre
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(spin);
    ctx.setLineDash([12, 10]);
    strokeCircle(0, 0, def.radius * 0.7, "#ffffff", 2);
    ctx.setLineDash([]);
    ctx.restore();
    fillCircle(p.x, p.y, def.radius * 0.45, "rgba(10, 0, 20, 0.85)");
    // Flèche vers le coin opposé
    const opp = a.items[a.items.length - 1 - i];
    const ang = Math.atan2(opp.y - p.y, opp.x - p.x);
    ctx.save();
    ctx.translate(p.x + Math.cos(ang) * def.radius * 1.55, p.y + Math.sin(ang) * def.radius * 1.55);
    ctx.rotate(ang);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -7);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function drawStationTurrets(a, def, now) {
  for (const t of a.items) {
    if (!isOnScreen(t.x, t.y, def.radius)) continue;
    const hacked = t.state === "hacked";
    const color = hacked ? def.hackedColor : t.state === "cooldown" ? "#6d6585" : def.color;
    // Cercle de piratage (pointillés tant qu'elle est neutre)
    ctx.globalAlpha = hacked ? 0.1 : 0.06;
    fillCircle(t.x, t.y, def.radius, color);
    ctx.globalAlpha = 0.7;
    ctx.setLineDash(hacked ? [] : [8, 8]);
    strokeCircle(t.x, t.y, def.radius, color, 1.5);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // Socle hexagonal + canon (sprite des tourelles de l'Ingénieur)
    polygon(t.x, t.y, 24, 6, Math.PI / 6);
    ctx.fillStyle = "#140a24";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    drawSprite(ctx, getSprite("turret", 16, color), t.x, t.y, t.angle);
    // Jauge : piratage en cours, ou temps piraté restant
    const pct = t.state === "idle" ? t.progress / def.hack : hacked ? t.timer / def.duration : 0;
    if (pct > 0) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = hacked ? def.hackedColor : "#ffffff";
      ctx.beginPath();
      ctx.arc(t.x, t.y, 34, -Math.PI / 2, -Math.PI / 2 + TAU * pct);
      ctx.stroke();
    }
    if (t.state === "idle" && t.progress > 0) {
      drawText("PIRATAGE…", t.x, t.y - 46, "bold 12px Orbitron", "#ffffff");
    } else if (t.state === "idle" && Math.floor(now / 600) % 2 === 0) {
      drawText("PIRATABLE", t.x, t.y - 46, "bold 10px Orbitron", def.color);
    }
  }
}

/** Marchand Noir : silhouette encapuchonnée sur un tapis violet ; flèche près du joueur s'il est hors champ. */
export function drawMerchants(now) {
  const M = BLACK_MARKET;
  for (const m of world.merchants) {
    if (!isOnScreen(m.x, m.y, M.radius)) {
      drawArrow(m);
      continue;
    }
    const bob = Math.sin(now / 300) * 3;
    ctx.globalAlpha = 0.12;
    fillCircle(m.x, m.y, M.radius, M.color);
    ctx.globalAlpha = 0.8;
    ctx.setLineDash([6, 8]);
    strokeCircle(m.x, m.y, M.radius, M.color, 1.5);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // Cape
    const y = m.y + bob;
    ctx.fillStyle = "#0b0614";
    ctx.strokeStyle = M.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(m.x, y - 42);
    ctx.quadraticCurveTo(m.x + 20, y - 34, m.x + 22, y + 18);
    ctx.lineTo(m.x - 22, y + 18);
    ctx.quadraticCurveTo(m.x - 20, y - 34, m.x, y - 42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Yeux dorés sous la capuche
    fillCircle(m.x - 6, y - 22, 2.6, "#ffd700");
    fillCircle(m.x + 6, y - 22, 2.6, "#ffd700");
    // Carte qui flotte
    ctx.save();
    ctx.translate(m.x + 30, y - 30 + Math.sin(now / 200) * 4);
    ctx.rotate(0.25);
    ctx.fillStyle = "rgba(255, 170, 0, 0.85)";
    ctx.fillRect(-7, -10, 14, 20);
    ctx.strokeStyle = "#ff1f4b";
    ctx.lineWidth = 2;
    ctx.strokeRect(-7, -10, 14, 20);
    ctx.restore();
    drawText("MARCHAND NOIR", m.x, m.y - 58 + bob, "bold 11px Orbitron", M.color);
  }
}

function drawArrow(m) {
  const a = Math.atan2(m.y - player.worldY, m.x - player.worldX);
  ctx.save();
  ctx.translate(player.worldX + Math.cos(a) * 70, player.worldY + Math.sin(a) * 70);
  ctx.rotate(a);
  ctx.fillStyle = BLACK_MARKET.color;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-6, -7);
  ctx.lineTo(-6, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
