// Tirs du joueur, dégâts infligés aux ennemis, aura, orbes et ultime.

import { KUNAI, MYSTERY_BOX, SURVIVAL, TICK_MS } from "../config.js";
import { gfx, view } from "../core/canvas.js";
import { mouse } from "../core/input.js";
import { emit } from "../core/events.js";
import { camera, game, player, world } from "../core/state.js";
import { GOBLIN, MAX_ENEMY_SIZE, TWINS } from "../data/enemies.js";
import { playSfx, vibrate } from "../services/sfx.js";
import { SpatialHash } from "../utils/spatialHash.js";
import { angleTo, dist } from "../utils/math.js";
import {
  addComboKill,
  addFloatingText,
  addScreenShake,
  createAoEEffect,
  createParticles,
  createShockwave,
  flashScreen,
  slowMotion,
} from "./effects.js";
import { createGem, dropBossChest, dropLootBox } from "./pickups.js";
import { chargeUltimate, heal } from "./player.js";
import { scheduleNextWave, spawnEnemy } from "./spawner.js";
import { addStat, recordKill } from "../services/achievements.js";
import { currentSkin, resolveColor } from "../services/skins.js";
import { onHit, onKill, onShot } from "./perks.js";

/** Grille des ennemis, reconstruite à chaque tick (utilisée aussi par l'IA). */
export const enemyGrid = new SpatialHash(MAX_ENEMY_SIZE);

export function rebuildEnemyGrid() {
  enemyGrid.clear();
  for (const e of world.enemies) {
    if (!e.dead && !e.submerged) enemyGrid.insert(e, e.x, e.y, e.size); // Kraken sous l'eau : intouchable
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
    if (e.dead || e.submerged) continue;
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
  if (enemy.dead || enemy.submerged) return;
  const dealt = Math.min(amount, Math.max(0, enemy.health));
  game.stats.damage[source] = (game.stats.damage[source] || 0) + dealt;
  enemy.health -= amount;
  enemy.hitTime = game.time; // flash blanc au rendu
  if (enemy.type === "goblin") stealGold(enemy);
  if (enemy.health <= 0) killEnemy(enemy);
}

export function killEnemy(enemy) {
  if (enemy.dead) return;
  enemy.dead = true; // retiré du tableau en fin de tick (voir enemies.js)
  recordKill(enemy.type, enemy.template.isBoss);
  emit("kill", enemy);
  onKill(enemy);
  playSfx("kill");

  game.score += 10;
  game.kills++;
  game.stats.kills[enemy.type] = (game.stats.kills[enemy.type] || 0) + 1;
  addComboKill(enemy.x, enemy.y);
  if (enemy.template.isBoss) bossDefeated(enemy);
  createGem(enemy.x, enemy.y, enemy.xp);
  game.runGold += Math.floor(
    enemy.gold * (1 + player.greed * 0.1) * (1 + player.goldBonus) * (game.modifier.goldMult || 1),
  );
  if (Math.random() < 0.05) dropLootBox(enemy.x, enemy.y);
  // En Boss Rush, chaque boss (même le crabe) lâche son coffre : c'est la seule source d'améliorations rares
  let chest = game.rush && enemy.template.isBoss ? 1 : enemy.template.chest;
  if (enemy.partner && !twinsDefeated(enemy)) chest = 0; // un seul coffre pour les deux jumeaux
  if (chest && Math.random() < chest) dropBossChest(enemy.x, enemy.y);

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

  // Moisson sanglante : soin plafonné dans le temps (sinon des dizaines de kills/s = invincible)
  if (
    player.evolutions.bloodHarvest &&
    game.time - (player.lastHarvest ?? -1e9) >= SURVIVAL.harvestCooldown
  ) {
    player.lastHarvest = game.time;
    heal(player.maxHealth * 0.01);
  }
  chargeUltimate();
  createParticles(enemy.x, enemy.y, enemy.color, 8);
}

/**
 * Jumeaux : renvoie vrai quand le second tombe. S'il tombe peu après son frère (`TWINS.syncWindow`),
 * bonus d'or « SYNCHRO ».
 */
function twinsDefeated(enemy) {
  enemy.diedAt = game.time;
  const other = enemy.partner;
  if (!other.dead) return false;
  addStat("twinsDefeated");
  if (game.time - other.diedAt < TWINS.syncWindow * TICK_MS) {
    game.runGold += TWINS.syncGold;
    addFloatingText(enemy.x, enemy.y - 60, `SYNCHRO ! +${TWINS.syncGold}`, "#ffd700", 24, 90);
  }
  return true;
}

/** Chaque coup sur le Voleur doré fait tomber un peu d'or (au plus toutes les 0,2 s). */
function stealGold(enemy) {
  if (game.time - (enemy.lastSteal ?? -1e9) < 200) return;
  enemy.lastSteal = game.time;
  game.runGold += GOBLIN.goldPerHit;
  addFloatingText(enemy.x, enemy.y - 20, `+${GOBLIN.goldPerHit}`, "#ffd700", 13, 30);
  createParticles(enemy.x, enemy.y, "#ffd700", 3);
}

/** Mort d'un boss : ralenti, flash, onde de choc et feu d'artifice de particules. */
function bossDefeated(enemy) {
  game.stats.bosses++;
  slowMotion(50);
  flashScreen("#ffffff", 0.55);
  createShockwave(enemy.x, enemy.y, 520, enemy.color);
  createParticles(enemy.x, enemy.y, enemy.color, 40);
  createParticles(enemy.x, enemy.y, "#ffffff", 20);
  addScreenShake(25);
  playSfx("bossDown");
  vibrate([80, 40, 160]);
}

export function killAllEnemies() {
  const enemies = world.enemies;
  const count = enemies.length; // les slimes issus des divisions survivent
  for (let i = 0; i < count; i++) if (!enemies[i].submerged) killEnemy(enemies[i]);
}

// --- TIR DU JOUEUR ---

export function shoot() {
  if (game.hex?.type === "jam") return; // duel : sort « tir coupé » de l'adversaire
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
  // Arme en couronne (Couronne de lames, évolution « Tourbillon ») : projectiles répartis tout autour
  const spread = w.ring ? (Math.PI * 2) / count : w.spread || player.multishotSpread;
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
  const proj = {
    x: player.worldX,
    y: player.worldY,
    vx: Math.cos(angle) * w.speed,
    vy: Math.sin(angle) * w.speed,
    size: ray ? Math.max(8, w.size) : w.size,
    damage: player.attack * w.damage,
    color: ray ? "#00ff88" : resolveColor(currentSkin().shot, w.color),
    pierce: player.piercing + w.pierce + (ray ? 2 : 0),
    explosion: w.explosion || 0,
    life: w.range || w.lifetime || Infinity,
    fade: w.fade || 0,
    returns: w.returns || 0,
    chain: w.chain || 0,
    type: w.returns ? "disc" : undefined,
    age: 0,
    dead: false,
  };
  onShot(proj);
  world.projectiles.push(proj);
}

export function spawnProjectile(props) {
  world.projectiles.push({ pierce: 0, explosion: 0, life: Infinity, dead: false, ...props });
}

export function updateProjectiles() {
  for (const proj of world.projectiles) {
    if (proj.returns && ++proj.age >= proj.returns) steerBack(proj);
    if (proj.dead) continue;
    proj.x += proj.vx;
    proj.y += proj.vy;
    if (
      --proj.life <= 0 ||
      proj.x < game.bounds.minX ||
      proj.x > game.bounds.maxX ||
      proj.y < game.bounds.minY ||
      proj.y > game.bounds.maxY ||
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
        if (proj.ramp) proj.damage *= 1 + proj.ramp; // Railgun ★3 : chaque ennemi transpercé renforce le tir
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
  if (enemy.template.isBoss) damage *= player.bossDamage;
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
  if (proj.chain) chainLightning(enemy, damage * 0.7, proj.chain, proj.color, source);
  onHit(proj, enemy, damage, isCrit);
}

/** Disque laser : après un moment il revient vers le joueur et peut retoucher les ennemis. */
function steerBack(proj) {
  if (proj.age === proj.returns) proj.hits?.clear();
  const d = dist(proj.x, proj.y, player.worldX, player.worldY);
  if (d < player.size + 10) {
    proj.dead = true;
    return;
  }
  const speed = Math.hypot(proj.vx, proj.vy);
  const a = angleTo(proj.x, proj.y, player.worldX, player.worldY);
  proj.vx += (Math.cos(a) * speed - proj.vx) * 0.15;
  proj.vy += (Math.sin(a) * speed - proj.vy) * 0.15;
}

const CHAIN_RANGE = 170;

/** Arc Tesla : l'éclair saute vers les ennemis proches pas encore touchés. */
export function chainLightning(from, damage, jumps, color, source) {
  const hit = new Set([from]);
  const points = [{ x: from.x, y: from.y }];
  let current = from;
  for (let j = 0; j < jumps; j++) {
    let next = null;
    let best = CHAIN_RANGE;
    for (const e of enemyGrid.query(current.x, current.y, CHAIN_RANGE)) {
      if (e.dead || hit.has(e)) continue;
      const d = dist(e.x, e.y, current.x, current.y);
      if (d < best) {
        best = d;
        next = e;
      }
    }
    if (!next) break;
    hit.add(next);
    points.push({ x: next.x, y: next.y });
    damageEnemy(next, damage, source);
    current = next;
  }
  if (points.length > 1) world.bolts.push({ points, color, life: 10 });
}

/** Explosion de zone (roquettes, plasma) : touche tous les ennemis proches sauf la cible directe. */
function explode(x, y, radius, damage, exclude, source) {
  createShockwave(x, y, radius, "#ffaa33");
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
  return player.auraRadius * (player.evolutions.inferno ? 1.6 : 1) * player.auraMult;
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
