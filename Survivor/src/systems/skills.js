// Compétence active du héros (touche R / bouton ULT), chargée en tuant des ennemis.
// Chaque héros a la sienne ; le Pilote garde l'onde de choc d'origine.

import { ULTIMATE } from "../config.js";
import { game, player, world } from "../core/state.js";
import { playSfx, vibrate } from "../services/sfx.js";
import { angleTo, dist, removeWhere } from "../utils/math.js";
import { damageEnemy, enemyGrid, getNearestEnemy, rebuildEnemyGrid, spawnProjectile } from "./combat.js";
import { addFloatingText, addScreenShake, createAoEEffect, createParticles } from "./effects.js";

export const SKILLS = {
  shockwave: { name: "Onde de choc", activate: shockwave },
  shadowClones: { name: "Clones d'ombre", activate: shadowClones },
  earthquake: { name: "Séisme", activate: earthquake },
  meteorRain: { name: "Pluie de météores", activate: meteorRain },
  cannon: { name: "Coup de canon", activate: cannon },
};

export function heroSkill() {
  return SKILLS[player.hero?.skill] || SKILLS.shockwave;
}

export function activateSkill() {
  if (!player.isUltReady) return;
  player.ultCharge = 0;
  player.isUltReady = false;
  vibrate(150);
  rebuildEnemyGrid(); // déclenchée hors du tick : la grille doit refléter les ennemis actuels
  heroSkill().activate();
}

export function updateSkills() {
  updateClones();
  updateMeteors();
}

/** Ennemis dans un rayon autour d'un point (copie : on peut les tuer pendant le parcours). */
function enemiesNear(x, y, radius) {
  return enemyGrid.query(x, y, radius).filter((e) => !e.dead && dist(e.x, e.y, x, y) < radius + e.size);
}

// --- PILOTE : onde de choc ---

function shockwave() {
  addScreenShake(20);
  playSfx("ultimate");
  createAoEEffect(player.worldX, player.worldY, 400);
  for (const e of enemiesNear(player.worldX, player.worldY, ULTIMATE.radius)) {
    const a = angleTo(player.worldX, player.worldY, e.x, e.y);
    e.x += Math.cos(a) * ULTIMATE.knockback;
    e.y += Math.sin(a) * ULTIMATE.knockback;
    addFloatingText(e.x, e.y, "ULT!", "#ff6600", 24);
    damageEnemy(e, ULTIMATE.damage);
  }
}

// --- NINJA : clones d'ombre qui lancent des kunai ---

const CLONES = { count: 3, duration: 360, radius: 70, cooldown: 300, damage: 1.2 };

function shadowClones() {
  playSfx("dash");
  addFloatingText(player.worldX, player.worldY - 40, "CLONES D'OMBRE !", "#ff55cc", 22, 60);
  for (let i = 0; i < CLONES.count; i++) {
    world.clones.push({ x: player.worldX, y: player.worldY, slot: i, life: CLONES.duration, lastShot: 0 });
  }
}

function updateClones() {
  for (const c of world.clones) {
    c.life--;
    const a = game.time / 600 + (Math.PI * 2 * c.slot) / CLONES.count;
    c.x += (player.worldX + Math.cos(a) * CLONES.radius - c.x) * 0.2;
    c.y += (player.worldY + Math.sin(a) * CLONES.radius - c.y) * 0.2;
    if (game.time - c.lastShot < CLONES.cooldown) continue;
    const target = getNearestEnemy(c.x, c.y, 500);
    if (!target) continue;
    c.lastShot = game.time;
    const angle = angleTo(c.x, c.y, target.x, target.y);
    spawnProjectile({
      x: c.x,
      y: c.y,
      vx: Math.cos(angle) * 14,
      vy: Math.sin(angle) * 14,
      size: 7,
      damage: player.attack * CLONES.damage,
      color: "#ff55cc",
      pierce: 2,
      type: "kunai",
    });
  }
  removeWhere(world.clones, (c) => c.life <= 0);
}

// --- TITAN : séisme qui étourdit ---

const QUAKE = { radius: 320, damage: 160, stun: 120 };

function earthquake() {
  addScreenShake(28);
  playSfx("explosion");
  addFloatingText(player.worldX, player.worldY - 40, "SÉISME !", "#ffaa00", 26, 60);
  for (const r of [120, 220, QUAKE.radius]) createAoEEffect(player.worldX, player.worldY, r);
  createParticles(player.worldX, player.worldY, "#ffaa00", 30);
  for (const e of enemiesNear(player.worldX, player.worldY, QUAKE.radius)) {
    e.stun = e.template.isBoss ? QUAKE.stun / 3 : QUAKE.stun;
    damageEnemy(e, QUAKE.damage);
  }
}

// --- MAGE : pluie de météores ---

const METEORS = { count: 14, spread: 420, radius: 85, damage: 120, fall: 50 };

function meteorRain() {
  playSfx("ultimate");
  addFloatingText(player.worldX, player.worldY - 40, "PLUIE DE MÉTÉORES !", "#aa66ff", 22, 60);
  const targets = enemiesNear(player.worldX, player.worldY, METEORS.spread);
  for (let i = 0; i < METEORS.count; i++) {
    // Vise en priorité les ennemis présents, sinon un point au hasard autour du joueur
    const t = targets[i % Math.max(1, targets.length)];
    const x = t ? t.x : player.worldX + (Math.random() - 0.5) * METEORS.spread * 2;
    const y = t ? t.y : player.worldY + (Math.random() - 0.5) * METEORS.spread * 2;
    world.meteors.push({ x, y, delay: METEORS.fall + i * 6, total: METEORS.fall + i * 6 });
  }
}

function updateMeteors() {
  for (const m of world.meteors) {
    if (--m.delay > 0) continue;
    createAoEEffect(m.x, m.y, METEORS.radius);
    createParticles(m.x, m.y, "#ff8844", 12);
    addScreenShake(4);
    playSfx("explosion");
    for (const e of enemiesNear(m.x, m.y, METEORS.radius)) damageEnemy(e, METEORS.damage);
  }
  removeWhere(world.meteors, (m) => m.delay <= 0);
}

// --- PIRATE : boulet de canon explosif ---

function cannon() {
  playSfx("explosion");
  addScreenShake(12);
  addFloatingText(player.worldX, player.worldY - 40, "FEU !", "#ffd700", 26, 50);
  const a = player.aimAngle;
  spawnProjectile({
    x: player.worldX + Math.cos(a) * 30,
    y: player.worldY + Math.sin(a) * 30,
    vx: Math.cos(a) * 9,
    vy: Math.sin(a) * 9,
    size: 22,
    damage: 300 + player.attack * 6,
    color: "#ffd700",
    pierce: 99,
    explosion: 130,
    type: "cannon",
  });
}
