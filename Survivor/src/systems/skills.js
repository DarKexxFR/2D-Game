// Compétence active du héros (touche R / bouton ULT), chargée en tuant des ennemis.
// Chaque héros a la sienne ; le Pilote garde l'onde de choc d'origine.

import { ULTIMATE } from "../config.js";
import { game, player, world } from "../core/state.js";
import { playSfx, vibrate } from "../services/sfx.js";
import { angleTo, dist, removeWhere } from "../utils/math.js";
import { damageEnemy, enemyGrid, getNearestEnemy, rebuildEnemyGrid, spawnProjectile } from "./combat.js";
import { heal, isStunned } from "./player.js";
import { perk } from "./perks.js";
import {
  addFloatingText,
  addScreenShake,
  createAoEEffect,
  createParticles,
  createShockwave,
  flashScreen,
} from "./effects.js";
import { knockEnemy, pullEnemy } from "./knockback.js";

export const SKILLS = {
  shockwave: { name: "Onde de choc", activate: shockwave },
  shadowClones: { name: "Clones d'ombre", activate: shadowClones },
  earthquake: { name: "Séisme", activate: earthquake },
  meteorRain: { name: "Pluie de météores", activate: meteorRain },
  cannon: { name: "Coup de canon", activate: cannon },
  turrets: { name: "Tourelles", activate: turrets },
  voidNova: { name: "Nova du vide", activate: voidNova },
  judgment: { name: "Jugement céleste", activate: judgment },
};

export function heroSkill() {
  return SKILLS[player.hero?.skill] || SKILLS.shockwave;
}

export function activateSkill() {
  if (!player.isUltReady || isStunned()) return;
  player.ultCharge = 0;
  player.isUltReady = false;
  vibrate(150);
  rebuildEnemyGrid(); // déclenchée hors du tick : la grille doit refléter les ennemis actuels
  heroSkill().activate();
}

export function updateSkills() {
  updateClones();
  updateMeteors();
  updateTurrets();
}

/** Ennemis dans un rayon autour d'un point (copie : on peut les tuer pendant le parcours). */
function enemiesNear(x, y, radius) {
  return enemyGrid.query(x, y, radius).filter((e) => !e.dead && dist(e.x, e.y, x, y) < radius + e.size);
}

// --- PILOTE : onde de choc ---

function shockwave() {
  addScreenShake(20);
  playSfx("ultimate");
  flashScreen("#ff8800", 0.3);
  createShockwave(player.worldX, player.worldY, ULTIMATE.radius, "#ff8800");
  createAoEEffect(player.worldX, player.worldY, 400);
  for (const e of enemiesNear(player.worldX, player.worldY, ULTIMATE.radius)) {
    const a = angleTo(player.worldX, player.worldY, e.x, e.y);
    knockEnemy(e, a, ULTIMATE.knockback);
    addFloatingText(e.x, e.y, "ULT!", "#ff6600", 24);
    damageEnemy(e, ULTIMATE.damage, "skill");
  }
}

// --- NINJA : clones d'ombre qui lancent des kunai ---

const CLONES = { count: 3, duration: 360, radius: 70, cooldown: 300, damage: 1.2 };

function shadowClones() {
  playSfx("skillNinja");
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
      source: "skill",
    });
  }
  removeWhere(world.clones, (c) => c.life <= 0);
}

// --- TITAN : séisme qui étourdit ---

const QUAKE = { radius: 320, damage: 160, stun: 120 };

function earthquake() {
  addScreenShake(28);
  playSfx("skillTitan");
  flashScreen("#ffaa00", 0.35);
  addFloatingText(player.worldX, player.worldY - 40, "SÉISME !", "#ffaa00", 26, 60);
  createShockwave(player.worldX, player.worldY, QUAKE.radius, "#ffaa00");
  createParticles(player.worldX, player.worldY, "#ffaa00", 30);
  for (const e of enemiesNear(player.worldX, player.worldY, QUAKE.radius)) {
    e.stun = e.template.isBoss ? QUAKE.stun / 3 : QUAKE.stun;
    damageEnemy(e, QUAKE.damage, "skill");
  }
}

// --- MAGE : pluie de météores ---

const METEORS = { count: 14, spread: 420, radius: 85, damage: 120, fall: 50 };

function meteorRain() {
  playSfx("skillMage");
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
    playSfx("meteor");
    for (const e of enemiesNear(m.x, m.y, METEORS.radius)) damageEnemy(e, METEORS.damage, "skill");
  }
  removeWhere(world.meteors, (m) => m.delay <= 0);
}

// --- PIRATE : boulet de canon explosif ---

function cannon() {
  playSfx("skillPirate");
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
    source: "skill",
  });
}

// --- INGÉNIEUR : tourelles automatiques ---

const TURRETS = { count: 2, duration: 480, offset: 70, range: 420, cooldown: 220, damage: 0.9 };

function turrets() {
  playSfx("skillTitan");
  addFloatingText(player.worldX, player.worldY - 40, "TOURELLES !", "#00ff88", 22, 60);
  const count = perk("engineer")?.turrets || TURRETS.count;
  for (let i = 0; i < count; i++) {
    const a = player.aimAngle + Math.PI / 2 + (Math.PI * 2 * i) / count;
    const x = player.worldX + Math.cos(a) * TURRETS.offset;
    const y = player.worldY + Math.sin(a) * TURRETS.offset;
    world.turrets.push({ x, y, life: TURRETS.duration, lastShot: 0, angle: 0 });
    createShockwave(x, y, 50, "#00ff88");
  }
}

function updateTurrets() {
  for (const t of world.turrets) {
    t.life--;
    if (game.time - t.lastShot < TURRETS.cooldown) continue;
    const target = getNearestEnemy(t.x, t.y, TURRETS.range);
    if (!target) continue;
    t.lastShot = game.time;
    t.angle = angleTo(t.x, t.y, target.x, target.y);
    spawnProjectile({
      x: t.x,
      y: t.y,
      vx: Math.cos(t.angle) * 13,
      vy: Math.sin(t.angle) * 13,
      size: 5,
      damage: player.attack * TURRETS.damage,
      color: "#00ff88",
      pierce: 1,
      source: "skill",
    });
  }
  removeWhere(world.turrets, (t) => t.life <= 0);
}

// --- SPECTRE : nova du vide (aspire, blesse et soigne) ---

const NOVA = { radius: 380, pull: 0.65, damage: 140, attackMult: 3, healPerHit: 3, maxHeal: 0.3 };

function voidNova() {
  playSfx("ultimate");
  addScreenShake(16);
  flashScreen("#8a6cff", 0.35);
  addFloatingText(player.worldX, player.worldY - 40, "NOVA DU VIDE !", "#8a6cff", 24, 60);
  const { worldX: x, worldY: y } = player;
  createShockwave(x, y, NOVA.radius, "#8a6cff");
  let healed = 0;
  for (const e of enemiesNear(x, y, NOVA.radius)) {
    // Aspiré vers le joueur (pas les boss)
    pullEnemy(e, x, y, NOVA.pull);
    createParticles(e.x, e.y, "#8a6cff", 3);
    damageEnemy(e, NOVA.damage + player.attack * NOVA.attackMult, "skill");
    healed += NOVA.healPerHit;
  }
  heal(Math.min(healed, player.maxHealth * NOVA.maxHeal) * (perk("spectre")?.heal || 1));
}

// --- ARCHANGE : jugement céleste (foudroie les ennemis proches, soigne et protège) ---

const JUDGMENT = { targets: 14, range: 560, damage: 200, attackMult: 5, radius: 70, heal: 0.15, shield: 90 };

function judgment() {
  playSfx("ultimate");
  addScreenShake(18);
  flashScreen("#fff0b3", 0.4);
  addFloatingText(player.worldX, player.worldY - 40, "JUGEMENT CÉLESTE !", "#fff0b3", 24, 60);
  const targets = enemiesNear(player.worldX, player.worldY, JUDGMENT.range)
    .sort((a, b) => b.health - a.health) // les plus coriaces d'abord
    .slice(0, JUDGMENT.targets);
  for (const t of targets) {
    world.bolts.push({
      points: [
        { x: t.x, y: t.y - 420 },
        { x: t.x - 18, y: t.y - 200 },
        { x: t.x, y: t.y },
      ],
      color: "#fff0b3",
      life: 16,
    });
    createAoEEffect(t.x, t.y, JUDGMENT.radius);
    createParticles(t.x, t.y, "#fff0b3", 8);
    for (const e of enemiesNear(t.x, t.y, JUDGMENT.radius)) {
      damageEnemy(e, JUDGMENT.damage + player.attack * JUDGMENT.attackMult, "skill");
    }
  }
  heal(player.maxHealth * JUDGMENT.heal);
  player.buffs.shield = Math.max(player.buffs.shield, JUDGMENT.shield);
}
