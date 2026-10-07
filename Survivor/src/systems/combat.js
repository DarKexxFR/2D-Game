// Tirs du joueur, dégâts infligés aux ennemis, aura, orbes et ultime.

import { KUNAI, MAP_BOUNDS, MYSTERY_BOX } from "../config.js";
import { gfx, view } from "../core/canvas.js";
import { mouse } from "../core/input.js";
import { camera, game, player, world } from "../core/state.js";
import { MAX_ENEMY_SIZE } from "../data/enemies.js";
import { playSfx } from "../services/sfx.js";
import { SpatialHash } from "../utils/spatialHash.js";
import { angleTo, dist } from "../utils/math.js";
import { addFloatingText, addScreenShake, createAoEEffect, createParticles } from "./effects.js";
import { createGem, dropLootBox } from "./pickups.js";
import { chargeUltimate, heal } from "./player.js";
import { scheduleNextWave, spawnEnemy } from "./spawner.js";
import { recordKill } from "../services/achievements.js";

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
    x - size < camera.x + view.width + margin &&
    y + size > camera.y - margin &&
    y - size < camera.y + view.height + margin
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

/** Inflige des dégâts ; `source` sert aux statistiques de fin de partie. */
export function damageEnemy(enemy, amount, source = "other") {
  if (enemy.dead) return;
  const dealt = Math.min(amount, Math.max(0, enemy.health));
  game.stats.damage[source] = (game.stats.damage[source] || 0) + dealt;
  enemy.health -= amount;
  enemy.hitTime = game.time; // flash blanc au rendu
  if (enemy.health <= 0) killEnemy(enemy);
}

export function killEnemy(enemy) {
  if (enemy.dead) return;
  enemy.dead = true; // retiré du tableau en fin de tick (voir enemies.js)
  recordKill(enemy.template.isBoss);
  playSfx("kill");

  game.score += 10;
  game.kills++;
  game.stats.kills[enemy.type] = (game.stats.kills[enemy.type] || 0) + 1;
  if (enemy.template.isBoss) game.stats.bosses++;
  createGem(enemy.x, enemy.y, enemy.xp);
  game.runGold += Math.floor(
    enemy.gold * (1 + player.greed * 0.1) * (1 + player.goldBonus) * (game.modifier.goldMult || 1),
  );
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
      damageEnemy(e, player.attack * 2, "explosion");
    }
  }

  if (player.evolutions.bloodHarvest) heal(player.maxHealth * 0.01);
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
    angle = angleTo(view.width / 2, view.height / 2, mouse.x, mouse.y);
  }
  player.lastAttack = game.time;
  player.aimAngle = angle;
  playSfx("shoot");

  // Projectiles de l'arme + bonus Multi-Tir
  const w = player.weapon;
  const extra = player.inventory["Multi-Tir"] || 0;
  const count = w.projectiles + extra;
  const spread = w.spread || player.multishotSpread;
  for (let i = 0; i < count; i++) {
    const jitter = w.inaccuracy ? (Math.random() - 0.5) * w.inaccuracy : 0;
    createPlayerProjectile(angle + (i - (count - 1) / 2) * spread + jitter);
  }
}

const BLADE_STORM = { count: 16, cooldown: 500, damage: 1.5, size: 9 };

export function throwKunai() {
  const count = player.inventory.Kunai || 0;
  if (player.evolutions.bladeStorm) return throwBladeStorm();
  if (count === 0 || game.time - player.lastKunaiAttack < KUNAI.cooldown) return;

  const target = getNearestEnemy(player.worldX, player.worldY);
  if (!target) return;

  player.lastKunaiAttack = game.time;
  const angle = angleTo(player.worldX, player.worldY, target.x, target.y);
  for (let i = 0; i < count; i++) {
    const spread = (i - (count - 1) / 2) * player.multishotSpread;
    const kunaiAngle = angle + spread;
    world.projectiles.push({
      x: player.worldX,
      y: player.worldY,
      vx: Math.cos(kunaiAngle) * KUNAI.projectileSpeed,
      vy: Math.sin(kunaiAngle) * KUNAI.projectileSpeed,
      size: 7,
      damage: player.attack * KUNAI.damageMultiplier,
      color: "#ff55cc",
      pierce: 1,
      type: "kunai",
      dead: false,
    });
  }
}

/** Évolution « Tempête de lames » : une couronne de kunai qui transpercent tout. */
function throwBladeStorm() {
  if (game.time - player.lastKunaiAttack < BLADE_STORM.cooldown) return;
  player.lastKunaiAttack = game.time;
  const offset = game.time / 300; // la couronne tourne d'une salve à l'autre
  for (let i = 0; i < BLADE_STORM.count; i++) {
    const a = offset + (Math.PI * 2 * i) / BLADE_STORM.count;
    spawnProjectile({
      x: player.worldX,
      y: player.worldY,
      vx: Math.cos(a) * KUNAI.projectileSpeed,
      vy: Math.sin(a) * KUNAI.projectileSpeed,
      size: BLADE_STORM.size,
      damage: player.attack * KUNAI.damageMultiplier * BLADE_STORM.damage,
      color: "#ffd0f0",
      pierce: 99,
      type: "kunai",
    });
  }
}

function createPlayerProjectile(angle) {
  const ray = player.hasRayGun;
  const w = player.weapon;
  world.projectiles.push({
    x: player.worldX,
    y: player.worldY,
    vx: Math.cos(angle) * w.speed,
    vy: Math.sin(angle) * w.speed,
    size: ray ? Math.max(8, w.size) : w.size,
    damage: player.attack * w.damage,
    color: ray ? "#00ff88" : w.color,
    pierce: player.piercing + w.pierce + (ray ? 2 : 0),
    explosion: w.explosion || 0,
    life: w.range || Infinity,
    dead: false,
  });
}

export function spawnProjectile(props) {
  world.projectiles.push({ pierce: 0, explosion: 0, life: Infinity, dead: false, ...props });
}

export function updateProjectiles() {
  for (const proj of world.projectiles) {
    proj.x += proj.vx;
    proj.y += proj.vy;
    if (
      --proj.life <= 0 ||
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
  playSfx("hit");
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
  if (gfx.damageNumbers)
    addFloatingText(
      enemy.x,
      enemy.y,
      Math.round(damage) + (isCrit ? "!" : ""),
      isCrit ? "#d000ff" : "#fff",
      isCrit ? 20 : 14,
    );
  if (player.vampirism > 0 && Math.random() < 0.3) heal(damage * player.vampirism);
  const source = proj.source || (proj.type === "kunai" ? "kunai" : "weapon");
  damageEnemy(enemy, damage, source);
  if (proj.explosion) explode(proj.x, proj.y, proj.explosion, damage * 0.6, enemy, source);
}

/** Explosion de zone (roquettes, plasma) : touche tous les ennemis proches sauf la cible directe. */
function explode(x, y, radius, damage, exclude, source) {
  createAoEEffect(x, y, radius);
  playSfx("explosion");
  addScreenShake(3);
  for (const e of enemyGrid.query(x, y, radius).slice()) {
    if (e === exclude || e.dead || dist(e.x, e.y, x, y) >= radius + e.size) continue;
    damageEnemy(e, damage, source);
  }
}

// --- CAPACITÉS PASSIVES ---

/** Rayon effectif de l'aura (l'évolution « Enfer » l'agrandit). */
export function auraRadius() {
  return player.auraRadius * (player.evolutions.inferno ? 1.6 : 1);
}

export function updateAura() {
  const inferno = player.evolutions.inferno;
  const radius = auraRadius();
  if (radius <= 0 || game.time - player.lastAuraTick <= (inferno ? 250 : 500)) return;
  player.lastAuraTick = game.time;
  const damage = player.auraDamage * (inferno ? 2 : 1);
  let hit = false;
  for (const e of enemyGrid.query(player.worldX, player.worldY, radius).slice()) {
    if (e.dead || dist(e.x, e.y, player.worldX, player.worldY) >= radius) continue;
    if (gfx.damageNumbers) addFloatingText(e.x, e.y, Math.round(damage), "#ff6600", 12, 20);
    damageEnemy(e, damage, "aura");
    hit = true;
  }
  if (hit) createAoEEffect(player.worldX, player.worldY, radius);
}

/** Positions monde des orbes (partagées entre logique et rendu). */
/** Orbes : taille, dégâts et vitesse (l'évolution « Anneau gardien » les renforce). */
export function orbitalStats() {
  return player.evolutions.guardianRing
    ? { size: 14, damage: 10, spin: 0.09, radius: player.orbitalRadius * 1.4, push: 9 }
    : { size: 10, damage: 2, spin: 0.05, radius: player.orbitalRadius, push: 5 };
}

export function getOrbitalPositions() {
  const out = [];
  const { radius } = orbitalStats();
  for (let k = 0; k < player.orbitals; k++) {
    const angle = player.orbitalAngle + ((Math.PI * 2) / player.orbitals) * k;
    out.push({
      angle,
      x: player.worldX + Math.cos(angle) * radius,
      y: player.worldY + Math.sin(angle) * radius,
    });
  }
  return out;
}

export function updateOrbitals() {
  if (player.orbitals <= 0) return;
  const o = orbitalStats();
  player.orbitalAngle += o.spin;
  for (const orb of getOrbitalPositions()) {
    for (const e of enemyGrid.query(orb.x, orb.y, o.size).slice()) {
      if (e.dead || dist(e.x, e.y, orb.x, orb.y) >= e.size + o.size) continue;
      e.x += Math.cos(orb.angle) * o.push;
      e.y += Math.sin(orb.angle) * o.push;
      damageEnemy(e, o.damage, "orbit");
    }
  }
}
