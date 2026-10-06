// Tirs du joueur, dégâts infligés aux ennemis, aura, orbes et ultime.

import { MAP_BOUNDS, MYSTERY_BOX, ULTIMATE } from "../config.js";
import { canvas } from "../core/canvas.js";
import { mouse } from "../core/input.js";
import { camera, game, player, world } from "../core/state.js";
import { MAX_ENEMY_SIZE } from "../data/enemies.js";
import { SpatialHash } from "../utils/spatialHash.js";
import { angleTo, dist } from "../utils/math.js";
import { addFloatingText, addScreenShake, createAoEEffect, createParticles } from "./effects.js";
import { createGem, dropLootBox } from "./pickups.js";
import { chargeUltimate, heal } from "./player.js";
import { scheduleNextWave, spawnEnemy } from "./spawner.js";

/** Grille des ennemis, reconstruite à chaque tick (utilisée aussi par l'IA). */
export const enemyGrid = new SpatialHash(MAX_ENEMY_SIZE);

export function rebuildEnemyGrid() {
  enemyGrid.clear();
  for (const e of world.enemies) {
    if (!e.dead) enemyGrid.insert(e, e.x, e.y, e.size);
  }
}

export function isOnScreen(x, y, size, margin = 100) {
  return (
    x + size > camera.x - margin &&
    x - size < camera.x + canvas.width + margin &&
    y + size > camera.y - margin &&
    y - size < camera.y + canvas.height + margin
  );
}

export function getNearestEnemy(x, y, maxDist = Infinity) {
  let nearest = null;
  let best = maxDist;
  for (const e of world.enemies) {
    if (e.dead) continue;
    const d = dist(e.x, e.y, x, y);
    if (d < best) {
      best = d;
      nearest = e;
    }
  }
  return nearest;
}

// --- DÉGÂTS ---

export function damageEnemy(enemy, amount) {
  if (enemy.dead) return;
  enemy.health -= amount;
  if (enemy.health <= 0) killEnemy(enemy);
}

export function killEnemy(enemy) {
  if (enemy.dead) return;
  enemy.dead = true; // retiré du tableau en fin de tick (voir enemies.js)

  game.score += 10;
  game.kills++;
  createGem(enemy.x, enemy.y, enemy.xp);
  game.runGold += Math.floor(enemy.gold * (1 + player.greed * 0.1));
  if (Math.random() < 0.05) dropLootBox(enemy.x, enemy.y);

  const t = enemy.template;
  if (game.isBossWave && t.isBoss && !world.enemies.some((e) => !e.dead && e.template.isBoss)) {
    scheduleNextWave();
  }

  if (t.splitTo) {
    for (let i = 0; i < t.splitCount; i++) {
      spawnEnemy(t.splitTo, enemy.x + (Math.random() - 0.5) * 20, enemy.y + (Math.random() - 0.5) * 20);
    }
    addFloatingText(enemy.x, enemy.y, "DIVISION!", "#00ff00", 14, 30);
  }

  if (player.explosionChance > 0 && Math.random() < player.explosionChance) {
    createAoEEffect(enemy.x, enemy.y, 60);
    for (const e of enemyGrid.query(enemy.x, enemy.y, 60).slice()) {
      if (e.dead || dist(e.x, e.y, enemy.x, enemy.y) >= 60) continue;
      addFloatingText(e.x, e.y, "BOOM", "#ffaa00", 14);
      damageEnemy(e, player.attack * 2);
    }
  }

  chargeUltimate();
  createParticles(enemy.x, enemy.y, enemy.color, 8);
}

export function killAllEnemies() {
  const enemies = world.enemies;
  const count = enemies.length; // les slimes issus des divisions survivent
  for (let i = 0; i < count; i++) killEnemy(enemies[i]);
}

// --- TIR DU JOUEUR ---

export function shoot() {
  let fireRate = player.buffs.overcharge > 0 ? MYSTERY_BOX.overchargeAttackSpeed : player.attackSpeed;
  if (player.buffs.frenzy > 0) fireRate /= 3;
  if (game.time - player.lastAttack < fireRate) return;

  let angle;
  if (player.autoShoot) {
    const target = getNearestEnemy(player.worldX, player.worldY);
    if (!target) return;
    angle = angleTo(player.worldX, player.worldY, target.x, target.y);
  } else {
    angle = angleTo(canvas.width / 2, canvas.height / 2, mouse.x, mouse.y);
  }
  player.lastAttack = game.time;

  const count = 1 + (player.inventory["Multi-Tir"] || 0);
  for (let i = 0; i < count; i++) {
    createPlayerProjectile(angle + (i - (count - 1) / 2) * player.multishotSpread);
  }
}

function createPlayerProjectile(angle) {
  const ray = player.hasRayGun;
  world.projectiles.push({
    x: player.worldX,
    y: player.worldY,
    vx: Math.cos(angle) * player.projectileSpeed,
    vy: Math.sin(angle) * player.projectileSpeed,
    size: ray ? 8 : 5,
    damage: player.attack,
    color: ray ? "#00ff88" : "#ffff00",
    pierce: player.piercing + (ray ? 2 : 0),
    dead: false,
  });
}

export function spawnProjectile(props) {
  world.projectiles.push({ pierce: 0, dead: false, ...props });
}

export function updateProjectiles() {
  for (const proj of world.projectiles) {
    proj.x += proj.vx;
    proj.y += proj.vy;
    if (
      proj.x < MAP_BOUNDS.minX ||
      proj.x > MAP_BOUNDS.maxX ||
      proj.y < MAP_BOUNDS.minY ||
      proj.y > MAP_BOUNDS.maxY ||
      !isOnScreen(proj.x, proj.y, 200)
    ) {
      proj.dead = true;
      continue;
    }
    const candidates = enemyGrid.query(proj.x, proj.y, proj.size);
    for (const enemy of candidates) {
      if (enemy.dead || proj.hits?.has(enemy)) continue;
      if (dist(enemy.x, enemy.y, proj.x, proj.y) >= enemy.size + proj.size) continue;
      hitEnemy(proj, enemy);
      // Comme dans la version d'origine, une balle qui tue continue sa course.
      if (enemy.dead) break;
      if (proj.pierce > 0) {
        proj.pierce--;
        (proj.hits ??= new Set()).add(enemy);
      } else {
        proj.dead = true;
      }
      break;
    }
  }
  let w = 0;
  for (const p of world.projectiles) if (!p.dead) world.projectiles[w++] = p;
  world.projectiles.length = w;
}

function hitEnemy(proj, enemy) {
  let damage = proj.damage;
  const isCrit = Math.random() < player.critChance;
  if (isCrit) {
    damage *= player.critMultiplier;
    addScreenShake(2);
  }
  if (
    player.executionThreshold > 0 &&
    enemy.health / enemy.maxHealth < player.executionThreshold &&
    !enemy.template.noExecute
  ) {
    damage = enemy.health + 999;
    addFloatingText(enemy.x, enemy.y, "EXEC!", "#ff0000", 20);
  }

  const k = angleTo(proj.x, proj.y, enemy.x, enemy.y);
  enemy.x += Math.cos(k) * 10 * player.knockbackMult;
  enemy.y += Math.sin(k) * 10 * player.knockbackMult;
  addFloatingText(
    enemy.x,
    enemy.y,
    Math.round(damage) + (isCrit ? "!" : ""),
    isCrit ? "#d000ff" : "#fff",
    isCrit ? 20 : 14,
  );
  if (player.vampirism > 0 && Math.random() < 0.3) heal(damage * player.vampirism);
  damageEnemy(enemy, damage);
}

// --- CAPACITÉS PASSIVES ---

export function updateAura() {
  if (player.auraRadius <= 0 || game.time - player.lastAuraTick <= 500) return;
  player.lastAuraTick = game.time;
  let hit = false;
  for (const e of enemyGrid.query(player.worldX, player.worldY, player.auraRadius).slice()) {
    if (e.dead || dist(e.x, e.y, player.worldX, player.worldY) >= player.auraRadius) continue;
    addFloatingText(e.x, e.y, Math.round(player.auraDamage), "#ff6600", 12, 20);
    damageEnemy(e, player.auraDamage);
    hit = true;
  }
  if (hit) createAoEEffect(player.worldX, player.worldY, player.auraRadius);
}

/** Positions monde des orbes (partagées entre logique et rendu). */
export function getOrbitalPositions() {
  const out = [];
  for (let k = 0; k < player.orbitals; k++) {
    const angle = player.orbitalAngle + ((Math.PI * 2) / player.orbitals) * k;
    out.push({
      angle,
      x: player.worldX + Math.cos(angle) * player.orbitalRadius,
      y: player.worldY + Math.sin(angle) * player.orbitalRadius,
    });
  }
  return out;
}

export function updateOrbitals() {
  if (player.orbitals <= 0) return;
  player.orbitalAngle += 0.05;
  for (const orb of getOrbitalPositions()) {
    for (const e of enemyGrid.query(orb.x, orb.y, 10).slice()) {
      if (e.dead || dist(e.x, e.y, orb.x, orb.y) >= e.size + 10) continue;
      e.x += Math.cos(orb.angle) * 5;
      e.y += Math.sin(orb.angle) * 5;
      damageEnemy(e, 2);
    }
  }
}

export function activateUltimate() {
  if (!player.isUltReady) return;
  player.ultCharge = 0;
  player.isUltReady = false;
  addScreenShake(20);
  createAoEEffect(player.worldX, player.worldY, 400);
  for (const e of enemyGrid.query(player.worldX, player.worldY, ULTIMATE.radius).slice()) {
    if (e.dead || dist(e.x, e.y, player.worldX, player.worldY) >= ULTIMATE.radius) continue;
    const a = angleTo(player.worldX, player.worldY, e.x, e.y);
    e.x += Math.cos(a) * ULTIMATE.knockback;
    e.y += Math.sin(a) * ULTIMATE.knockback;
    addFloatingText(e.x, e.y, "ULT!", "#ff6600", 24);
    damageEnemy(e, ULTIMATE.damage);
  }
}
