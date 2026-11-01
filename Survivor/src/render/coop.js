// Coop : vaisseaux de toute l'équipe (pseudo, joueur à terre et sa réanimation), flèches vers les
// coéquipiers hors de l'écran.

import { COOP } from "../config.js";
import { ctx, view } from "../core/canvas.js";
import { camera, player } from "../core/state.js";
import { memberObj, party, presentMembers, withMember } from "../systems/party.js";
import { drawText, strokeCircle } from "./draw.js";
import { drawPlayer } from "./entities.js";

/** Vaisseau(x) du joueur : seul hors coop, toute l'équipe en coop (celui de cet appareil par-dessus). */
export function drawPlayers(now) {
  if (!party.active) return drawPlayer(now);
  const order = presentMembers().filter((k) => k !== party.local);
  if (!party.members[party.local]?.gone) order.push(party.local);
  order.forEach((k, i) => withMember(k, () => drawMember(k, now, i === 0)));
}

function drawMember(k, now, shared) {
  if (typeof player.worldX !== "number" || !player.buffs) return; // pas encore reçu (invité)
  const m = party.members[k];
  const { worldX: x, worldY: y, size } = player;
  if (player.downed) {
    ctx.globalAlpha = 0.35;
    drawPlayer(now, shared);
    ctx.globalAlpha = 1;
    drawRevive(x, y, size, m.color, now);
  } else drawPlayer(now, shared);
  if (k !== party.local) {
    ctx.globalAlpha = 0.9;
    drawText(m.name, x, y - size - 16, "bold 11px Orbitron, sans-serif", m.color);
    ctx.globalAlpha = 1;
  }
}

/** Joueur à terre : cercle de réanimation qui se remplit quand un coéquipier reste à côté. */
function drawRevive(x, y, size, color, now) {
  const r = COOP.reviveRadius;
  ctx.globalAlpha = 0.35 + Math.sin(now / 200) * 0.15;
  ctx.setLineDash([6, 6]);
  strokeCircle(x, y, r, color, 2);
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  const pct = Math.min(1, (player.reviveProgress || 0) / COOP.reviveTicks);
  if (pct > 0) {
    ctx.beginPath();
    ctx.arc(x, y, size + 10, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  drawText(
    pct > 0 ? "RÉANIMATION..." : "À TERRE",
    x,
    y + size + 22,
    "bold 10px Orbitron, sans-serif",
    pct > 0 ? "#00ff88" : "#ff2a6d",
  );
}

/** Flèches au bord de l'écran vers les coéquipiers hors champ (couleur du joueur, rouge s'il est à terre). */
export function drawTeamPointers(now) {
  if (!party.active) return;
  const cx = view.width / 2;
  const cy = view.height / 2;
  const margin = 28;
  for (const k of presentMembers()) {
    if (k === party.local) continue;
    const p = memberObj(k);
    if (typeof p.worldX !== "number") continue;
    const sx = p.worldX - camera.x;
    const sy = p.worldY - camera.y;
    if (sx > 0 && sx < view.width && sy > 0 && sy < view.height) continue;
    const a = Math.atan2(sy - cy, sx - cx);
    const d = Math.min(
      (cx - margin) / Math.abs(Math.cos(a) || 1e-6),
      (cy - margin) / Math.abs(Math.sin(a) || 1e-6),
    );
    const color = p.downed ? "#ff2a6d" : party.members[k].color;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
    ctx.globalAlpha = p.downed ? 0.6 + Math.sin(now / 120) * 0.4 : 0.85;
    ctx.rotate(a);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-7, -9);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-7, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
