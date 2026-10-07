// Rendu du joueur, du drone, des ennemis et des projectiles (sprites néon).

import { ctx } from "../core/canvas.js";
import { game, pet, player, world } from "../core/state.js";
import { getOrbitalPositions, isOnScreen } from "../systems/combat.js";
import { fillCircle, strokeCircle } from "./draw.js";
import { drawSprite, getSprite, shade } from "./sprites.js";

const TAU = Math.PI * 2;
const HIT_FLASH_MS = 80;

// Sprite de chaque type d'ennemi et façon de l'orienter :
// "face" = tourné vers le joueur, "spin" = tourne sur lui-même, "wobble" = gélatine.
const ENEMY_LOOKS = {
  normal: { sprite: "normal", mode: "face" },
  fast: { sprite: "fast", mode: "face" },
  tank: { sprite: "tank", mode: "face" },
  ranged: { sprite: "ranged", mode: "face" },
  kamikaze: { sprite: "kamikaze", mode: "spin", spin: 0.012 },
  miniboss: { sprite: "miniboss", mode: "face" },
  boss: { sprite: "boss", mode: "spin", spin: 0.0015 },
  slime_boss: { sprite: "slime_king", mode: "wobble" },
  slime_big: { sprite: "slime", mode: "wobble" },
  slime_small: { sprite: "slime", mode: "wobble" },
};

let lastX = 0;
let lastY = 0;

export function drawPlayer(now) {
  const { worldX: x, worldY: y, size } = player;
  const moving = Math.hypot(x - lastX, y - lastY) > 0.5;
  lastX = x;
  lastY = y;

  for (const g of world.ghosts) {
    ctx.globalAlpha = g.life / 30;
    drawShip(g.x, g.y, size, player.aimAngle, "#00ffff", false, now);
  }
  ctx.globalAlpha = 1;

  if (player.auraRadius > 0) {
    ctx.beginPath();
    ctx.arc(x, y, player.auraRadius, 0, TAU);
    ctx.fillStyle = "rgba(255, 100, 0, 0.08)";
    ctx.fill();
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -now / 40;
    ctx.strokeStyle = "rgba(255, 120, 0, 0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (player.buffs.shield > 0) {
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#0088ff";
    strokeCircle(x, y, size + 12, "#0088ff", 3);
    ctx.globalAlpha = 0.12;
    fillCircle(x, y, size + 12, "#0088ff");
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
  if (player.buffs.frenzy > 0) fillCircle(x, y, size + 5, "rgba(255, 0, 0, 0.2)");

  drawArmor(x, y, size, now);
  const bodyColor = player.isDashing ? "#ffffff" : player.hasRayGun ? "#00ff88" : "#00ccff";
  drawWeapon(x, y, size);
  drawShip(x, y, size, player.aimAngle, bodyColor, moving || player.isDashing, now);

  if (pet.active) drawDrone(pet.x, pet.y, pet.size, now);

  for (const orb of getOrbitalPositions()) {
    drawSprite(ctx, getSprite("bullet", 7, "#00ffff"), orb.x, orb.y);
  }

  if (player.isUltReady) {
    strokeCircle(x, y, size + 18 + Math.sin(now / 100) * 4, "rgba(255, 170, 0, 0.6)", 3);
  }
}

/** Vaisseau du joueur, orienté vers la visée, réacteur allumé quand il bouge. */
function drawShip(x, y, r, angle, color, thrust, now) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  if (thrust) {
    const len = r * (0.9 + Math.sin(now / 30) * 0.25);
    const flame = ctx.createLinearGradient(-r * 0.5, 0, -r * 0.5 - len, 0);
    flame.addColorStop(0, "#ffffff");
    flame.addColorStop(0.3, color);
    flame.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, -r * 0.3);
    ctx.lineTo(-r * 0.5 - len, 0);
    ctx.lineTo(-r * 0.45, r * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  const hull = () => {
    ctx.beginPath();
    ctx.moveTo(r * 1.25, 0);
    ctx.lineTo(-r * 0.35, -r * 0.95);
    ctx.lineTo(-r * 0.75, -r * 0.85);
    ctx.lineTo(-r * 0.45, 0);
    ctx.lineTo(-r * 0.75, r * 0.85);
    ctx.lineTo(-r * 0.35, r * 0.95);
    ctx.closePath();
  };
  ctx.lineJoin = "round";
  ctx.fillStyle = "#06223a";
  hull();
  ctx.fill();
  ctx.shadowBlur = 18;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  hull();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Lignes de coque et cockpit
  ctx.strokeStyle = "rgba(0, 204, 255, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.6);
  ctx.lineTo(r * 0.3, -r * 0.2);
  ctx.moveTo(-r * 0.3, r * 0.6);
  ctx.lineTo(r * 0.3, r * 0.2);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.shadowBlur = 10;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.ellipse(r * 0.35, 0, r * 0.28, r * 0.16, 0, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

/** Drone de combat : losange avec anneau qui tourne. */
function drawDrone(x, y, s, now) {
  ctx.save();
  ctx.translate(x, y + Math.sin(now / 250) * 3);
  ctx.shadowBlur = 10;
  ctx.shadowColor = "#00ff88";
  ctx.strokeStyle = "#00ff88";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.lineDashOffset = now / 30;
  ctx.beginPath();
  ctx.arc(0, 0, s * 1.2, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#003322";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.8);
  ctx.lineTo(s * 0.8, 0);
  ctx.lineTo(0, s * 0.8);
  ctx.lineTo(-s * 0.8, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.22, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
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
  ctx.fillRect(size * 0.7, -thick / 2, len + size * 0.3, thick);
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(size + len - 3, -thick / 2, 3, thick);
  if (p >= 4) {
    // Rails latéraux
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(size * 0.7 + 2, -thick / 2 - 2, len, 1.5);
    ctx.fillRect(size * 0.7 + 2, thick / 2 + 0.5, len, 1.5);
  }
  ctx.restore();
}

export function drawEnemies() {
  const now = performance.now();
  for (const e of world.enemies) {
    if (!isOnScreen(e.x, e.y, e.size)) continue;
    const look = ENEMY_LOOKS[e.type] || ENEMY_LOOKS.normal;
    const base = e.template.size;
    const scale = e.size / base;
    const flash = game.time - (e.hitTime ?? -1e9) < HIT_FLASH_MS ? "flash" : "";
    const sprite = getSprite(look.sprite, base, e.color, flash);
    const t = now + (e.phase || 0) * 1000;

    if (look.mode === "wobble") {
      const w = Math.sin(t / 160) * 0.08;
      drawSprite(ctx, sprite, e.x, e.y, 0, scale * (1 + w), scale * (1 - w));
    } else if (look.mode === "spin") {
      const pulse = e.type === "kamikaze" ? 1 + Math.sin(t / 60) * 0.08 : 1;
      drawSprite(ctx, sprite, e.x, e.y, t * look.spin, scale * pulse);
    } else {
      const angle = Math.atan2(player.worldY - e.y, player.worldX - e.x);
      drawSprite(ctx, sprite, e.x, e.y, angle, scale * (1 + Math.sin(t / 140) * 0.04));
    }

    if (e.health < e.maxHealth) drawHealthBar(e);
  }
}

/** Barre de vie, seulement une fois blessé ; plus large et lumineuse pour les boss. */
function drawHealthBar(e) {
  const boss = e.template.isBoss;
  const w = boss ? Math.max(80, e.size * 2) : 30;
  const h = boss ? 6 : 4;
  const pct = Math.max(0, Math.min(1, e.health / e.maxHealth));
  const left = e.x - w / 2;
  const top = e.y - e.size - (boss ? 22 : 12);
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(left - 1, top - 1, w + 2, h + 2);
  ctx.fillStyle = boss ? "#ff0040" : "#ff3366";
  if (boss) {
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#ff0040";
  }
  ctx.fillRect(left, top, w * pct, h);
  ctx.shadowBlur = 0;
}

export function drawProjectiles() {
  ctx.lineCap = "round";
  for (const p of world.projectiles) {
    if (p.type === "kunai") {
      drawKunai(p);
      continue;
    }
    // Traînée puis projectile lumineux
    ctx.strokeStyle = p.color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = p.size * 1.2;
    ctx.beginPath();
    ctx.moveTo(p.x - p.vx * 1.8, p.y - p.vy * 1.8);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawSprite(ctx, getSprite("bullet", roundSize(p.size), p.color), p.x, p.y);
  }
  for (const p of world.enemyProjectiles) {
    if (!isOnScreen(p.x, p.y, p.size)) continue;
    drawSprite(ctx, getSprite("bullet", roundSize(p.size), p.color), p.x, p.y);
  }
}

/** Kunai : lame effilée avec anneau au pommeau. */
function drawKunai(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.atan2(p.vy, p.vx));
  ctx.shadowBlur = 10;
  ctx.shadowColor = p.color;
  ctx.fillStyle = "#ffe6f6";
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(0, -4);
  ctx.lineTo(-2, 0);
  ctx.lineTo(0, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = shade("#ff55cc", 0.6);
  ctx.fillRect(-8, -1.5, 6, 3);
  ctx.beginPath();
  ctx.arc(-10, 0, 2.5, 0, TAU);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

/** Arrondit une taille au demi-pixel pour limiter le nombre de sprites en cache. */
function roundSize(s) {
  return Math.max(2, Math.round(s * 2) / 2);
}
