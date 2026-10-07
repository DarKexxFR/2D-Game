// Déplacement, dash, buffs, vie et expérience du joueur.

import { MAP_BOUNDS } from "../config.js";
import { view } from "../core/canvas.js";
import { emit } from "../core/events.js";
import { keys, touchMove } from "../core/input.js";
import { camera, game, player, world } from "../core/state.js";
import { playSfx, vibrate } from "../services/sfx.js";
import { clamp } from "../utils/math.js";
import { addFloatingText, addScreenShake, createParticles, createSpawnEffect } from "./effects.js";
import { recordPlayerLevel } from "../services/achievements.js";

const FROST_SLOW = 0.55; // vitesse quand le joueur est gelé par un golem

export function updatePlayer() {
  updateBuffs();
  updateRegen();
  updateDash();
  move();
  camera.x = player.worldX - view.width / 2;
  camera.y = player.worldY - view.height / 2;
}

function updateBuffs() {
  const b = player.buffs;
  if (b.frenzy > 0) b.frenzy--;
  if (b.shield > 0) b.shield--;
  if (b.magnet > 0) b.magnet--;
  if (b.slow > 0) b.slow--;
  if (b.overcharge > 0 && --b.overcharge === 0) {
    addFloatingText(player.worldX, player.worldY, "FIN SURCHARGE", "#ccc");
  }
}

function updateRegen() {
  if (player.regen <= 0) return;
  if (++game.regenTimer > 60) {
    heal(player.regen);
    game.regenTimer = 0;
  }
}

function updateDash() {
  if (player.dashCooldownTimer > 0) player.dashCooldownTimer--;
  if (keys["space"] && player.dashCooldownTimer <= 0 && !player.isDashing) {
    player.isDashing = true;
    player.dashTimer = player.dashDuration;
    player.dashCooldownTimer = player.dashCooldown;
    createParticles(player.worldX, player.worldY, "#fff", 10);
    playSfx("dash");
  }
  if (player.isDashing) {
    player.speed = player.dashSpeed;
    player.dashTimer--;
    if (player.dashTimer % 2 === 0) {
      world.ghosts.push({ x: player.worldX, y: player.worldY, life: 10 });
    }
    if (player.dashTimer <= 0) player.isDashing = false;
  } else {
    player.speed = player.baseSpeed * (player.buffs.slow > 0 ? FROST_SLOW : 1);
  }
}

function move() {
  let dx = 0;
  let dy = 0;
  if (keys["z"] || keys["w"]) dy = -1;
  if (keys["s"]) dy = 1;
  if (keys["q"] || keys["a"]) dx = -1;
  if (keys["d"]) dx = 1;
  if (dx !== 0 && dy !== 0) {
    dx *= Math.SQRT1_2;
    dy *= Math.SQRT1_2;
  }
  if (dx === 0 && dy === 0) {
    // Joystick tactile (analogique)
    dx = touchMove.x;
    dy = touchMove.y;
  }
  const r = player.size;
  player.worldX = clamp(player.worldX + dx * player.speed, MAP_BOUNDS.minX + r, MAP_BOUNDS.maxX - r);
  player.worldY = clamp(player.worldY + dy * player.speed, MAP_BOUNDS.minY + r, MAP_BOUNDS.maxY - r);
}

/** Le joueur est-il invulnérable aux coups « normaux » (contact, projectiles) ? */
export function isProtected() {
  return player.isDashing || player.buffs.shield > 0;
}

export function heal(amount) {
  player.health = Math.min(player.maxHealth, player.health + amount);
}

export function takeDamage(amount) {
  if (game.over) return;
  player.health -= amount;
  playSfx("hurt");
  vibrate(40);
  addScreenShake(5);
  addFloatingText(player.worldX, player.worldY - 20, `-${Math.round(amount)}`, "#ff0000", 16);
  if (player.health <= 0 && player.revives > 0) {
    // Talent « Seconde chance »
    player.revives--;
    player.health = player.maxHealth * 0.5;
    player.buffs.shield = 120;
    addFloatingText(player.worldX, player.worldY - 40, "SECONDE CHANCE !", "#00ffcc", 26, 90);
    addScreenShake(10);
    return;
  }
  if (player.health <= 0) {
    game.over = true;
    playSfx("death");
    vibrate(300);
    game.running = false;
    emit("playerDied");
  }
}

export function gainXp(amount) {
  amount *= 1 + player.xpBonus;
  player.xp += amount;
  game.totalRunXp += amount;
  if (player.xp < player.xpToNextLevel) return;

  player.xp -= player.xpToNextLevel;
  player.level++;
  recordPlayerLevel(player.level);
  player.xpToNextLevel = Math.floor(player.xpToNextLevel * 1.3);
  addFloatingText(player.worldX, player.worldY - 50, "LEVEL UP!", "#ffd700", 30, 100);
  playSfx("levelUp");
  vibrate([30, 40, 30]);
  createSpawnEffect(player.worldX, player.worldY, "#ffd700");
  emit("levelUp");
}

export function chargeUltimate() {
  if (player.isUltReady) return;
  player.ultCharge++;
  if (player.ultCharge >= player.maxUltCharge) {
    player.ultCharge = player.maxUltCharge;
    player.isUltReady = true;
    addFloatingText(player.worldX, player.worldY, "COMPÉTENCE PRÊTE (R) !", "#ffaa00", 30, 60);
  }
}
