// Rendu du joueur, du drone, des ennemis et des projectiles.

import { ctx } from "../core/canvas.js";
import { pet, player, world } from "../core/state.js";
import { getOrbitalPositions, isOnScreen } from "../systems/combat.js";
import { fillCircle, strokeCircle } from "./draw.js";

export function drawPlayer(now) {
  const { worldX: x, worldY: y, size } = player;

  for (const g of world.ghosts) {
    fillCircle(g.x, g.y, size, `rgba(0, 255, 255, ${g.life / 30})`);
  }

  if (player.auraRadius > 0) {
    ctx.beginPath();
    ctx.arc(x, y, player.auraRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 100, 0, 0.1)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 100, 0, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (player.buffs.shield > 0) {
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#0088ff";
    strokeCircle(x, y, size + 10, "#0088ff", 3);
    ctx.shadowBlur = 0;
  }
  if (player.buffs.frenzy > 0) fillCircle(x, y, size + 5, "rgba(255, 0, 0, 0.2)");

  drawArmor(x, y, size, now);
  const bodyColor = player.isDashing ? "#ffffff" : player.hasRayGun ? "#00ff88" : "#00ccff";
  fillCircle(x, y, size, bodyColor, 20);
  if (!player.isDashing) fillCircle(x, y, size / 2, "#003355");
  drawWeapon(x, y, size);

  if (pet.active) {
    ctx.fillStyle = "#00ff88";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#00ff88";
    ctx.fillRect(pet.x - pet.size / 2, pet.y - pet.size / 2, pet.size, pet.size);
    ctx.shadowBlur = 0;
  }

  for (const orb of getOrbitalPositions()) fillCircle(orb.x, orb.y, 8, "#00ffff", 10);

  if (player.isUltReady) {
    strokeCircle(x, y, size + 18 + Math.sin(now / 100) * 4, "rgba(255, 170, 0, 0.6)", 3);
  }
}

/** Armure : plus le prestige est haut, plus elle est épaisse, lumineuse et ornée. */
function drawArmor(x, y, size, now) {
  const a = player.armor;
  if (!a) return;
  const p = a.prestige;
  ctx.save();
  ctx.shadowBlur = 6 + p * 4;
  ctx.shadowColor = a.color;
  strokeCircle(x, y, size + 3 + p, a.color, 2 + p);

  if (p >= 3) {
    // Pointes en orbite
    const count = 4 + p * 2;
    const r = size + 8 + p * 1.5;
    const rot = now / 900;
    ctx.fillStyle = a.color;
    for (let i = 0; i < count; i++) {
      const ang = rot + (Math.PI * 2 * i) / count;
      ctx.beginPath();
      ctx.arc(x + Math.cos(ang) * r, y + Math.sin(ang) * r, 1.5 + p * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (p >= 5) {
    // Halo doré pulsant
    ctx.globalAlpha = 0.5;
    strokeCircle(x, y, size + 18 + Math.sin(now / 200) * 3, "#ffd700", 2);
  }
  ctx.restore();
}

/** Canon de l'arme orienté vers la visée ; taille et éclat selon le prestige. */
function drawWeapon(x, y, size) {
  const w = player.weapon;
  if (!w) return;
  const p = w.prestige;
  const len = 10 + p * 4;
  const thick = 5 + p * 1.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(player.aimAngle);
  ctx.shadowBlur = 4 + p * 4;
  ctx.shadowColor = w.color;
  ctx.fillStyle = w.color;
  ctx.fillRect(size * 0.5, -thick / 2, len, thick);
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(size * 0.5 + len - 3, -thick / 2, 3, thick);
  if (p >= 4) {
    // Rails latéraux
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(size * 0.5 + 2, -thick / 2 - 2, len - 4, 1.5);
    ctx.fillRect(size * 0.5 + 2, thick / 2 + 0.5, len - 4, 1.5);
  }
  ctx.restore();
}

export function drawEnemies() {
  for (const e of world.enemies) {
    if (!isOnScreen(e.x, e.y, e.size)) continue;
    fillCircle(e.x, e.y, e.size, e.color, 10);

    // Yeux
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(e.x - e.size * 0.3, e.y - e.size * 0.2, e.size * 0.15, 0, Math.PI * 2);
    ctx.arc(e.x + e.size * 0.3, e.y - e.size * 0.2, e.size * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Barre de vie
    const w = 40;
    const pct = Math.max(0, Math.min(1, e.health / e.maxHealth));
    const top = e.y - e.size - 12;
    ctx.fillStyle = "#220000";
    ctx.fillRect(e.x - w / 2, top, w, 5);
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(e.x - w / 2, top, w * pct, 5);
  }
}

export function drawProjectiles() {
  for (const p of world.projectiles) fillCircle(p.x, p.y, p.size, p.color, 15);
  for (const p of world.enemyProjectiles) {
    if (isOnScreen(p.x, p.y, p.size)) fillCircle(p.x, p.y, p.size, p.color, 10);
  }
}
