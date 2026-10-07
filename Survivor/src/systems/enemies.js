// IA des ennemis : déplacement, séparation, attaques et comportements de boss.

import { game, player, world } from "../core/state.js";
import { MAX_ENEMY_SIZE } from "../data/enemies.js";
import { playSfx } from "../services/sfx.js";
import { angleTo, dist, removeWhere } from "../utils/math.js";
import { damageEnemy, enemyGrid, killEnemy } from "./combat.js";
import { addFloatingText, addScreenShake, createAoEEffect } from "./effects.js";
import { isProtected, takeDamage } from "./player.js";
import { spawnEnemy } from "./spawner.js";

const CONTACT_DAMAGE_COOLDOWN = 500; // ms

const BOSS_BEHAVIORS = {
  miniboss: updateMiniboss,
  boss: updateBoss,
  slime_boss: updateSlimeBoss,
  hydra: updateHydra,
};

const HYDRA_HEAD_SPREAD = [-0.8, 0, 0.8]; // angle des 3 têtes autour de la direction du joueur
const HYDRA_SUMMONS = 6;

export function updateEnemies() {
  const enemies = world.enemies;
  const count = enemies.length; // les ennemis apparus pendant ce tick bougeront au suivant
  for (let i = 0; i < count; i++) {
    const e = enemies[i];
    if (e.dead) continue;
    if (e.stun > 0) {
      e.stun--; // étourdi par le Séisme du Titan : ne bouge ni n'attaque
      continue;
    }
    BOSS_BEHAVIORS[e.type]?.(e);
    const d = dist(player.worldX, player.worldY, e.x, e.y);
    if (e.type === "scorpion") updateScorpion(e, d);
    moveEnemy(e, d);
    if (e.type === "ranged") rangedAttack(e, d);
    if (d < player.size + e.size) handleContact(e);
  }
  updateEnemyProjectiles();
  removeWhere(enemies, (e) => e.dead);
}

function moveEnemy(e, distToPlayer) {
  let tx = player.worldX;
  let ty = player.worldY;
  if (e.type === "fast") {
    // Anticipe légèrement la position du joueur
    tx += (player.worldX - e.x) * 0.2;
    ty += (player.worldY - e.y) * 0.2;
  } else if (e.type === "ranged") {
    if (distToPlayer < 250) {
      // Trop près : recule
      tx = e.x - (player.worldX - e.x);
      ty = e.y - (player.worldY - e.y);
    } else if (distToPlayer <= 350) {
      // Bonne distance : reste sur place
      tx = e.x;
      ty = e.y;
    }
  }

  const a = Math.atan2(ty - e.y, tx - e.x);
  let mx = Math.cos(a);
  let my = Math.sin(a);

  // Séparation : repousse les ennemis qui se chevauchent (via la grille spatiale)
  for (const other of enemyGrid.query(e.x, e.y, e.size + MAX_ENEMY_SIZE)) {
    if (other === e || other.dead) continue;
    const d = dist(e.x, e.y, other.x, other.y);
    if (d > 0 && d < e.size + other.size) {
      mx += ((e.x - other.x) / d) * 1.5;
      my += ((e.y - other.y) / d) * 1.5;
    }
  }

  const len = Math.hypot(mx, my);
  if (len > 0) {
    e.x += (mx / len) * e.speed;
    e.y += (my / len) * e.speed;
  }
}

function rangedAttack(e, distToPlayer) {
  if (distToPlayer >= e.attackRange || game.time - e.lastShot <= e.shootCooldown) return;
  e.lastShot = game.time;
  const a = angleTo(e.x, e.y, player.worldX, player.worldY);
  fireEnemyProjectile(e.x, e.y, a, 6, { size: 6, damage: e.damage, color: "#ff0000" });
}

function handleContact(e) {
  if (e.type === "kamikaze") {
    takeDamage(e.damage);
    createAoEEffect(e.x, e.y, 40);
    playSfx("explosion");
    killEnemy(e);
    return;
  }
  if (isProtected() || game.time - e.lastDamage <= CONTACT_DAMAGE_COOLDOWN) return;

  const dmg = Math.max(1, e.damage - player.defense);
  takeDamage(dmg);
  if (e.type === "golem") freezePlayer();
  e.lastDamage = game.time;
  const a = angleTo(player.worldX, player.worldY, e.x, e.y);
  e.x += Math.cos(a) * 20;
  e.y += Math.sin(a) * 20;
  if (player.thorns > 0) {
    addFloatingText(e.x, e.y, Math.round(dmg * player.thorns), "#aa00ff", 12);
    damageEnemy(e, dmg * player.thorns);
  }
}

// --- ENNEMIS DES BIOMES ---

const SCORPION_LUNGE = { range: 170, duration: 14, speed: 3.2, cooldown: 100 };

/** Scorpion : à portée, il bondit brusquement sur le joueur. */
function updateScorpion(e, distToPlayer) {
  e.lungeCooldown = (e.lungeCooldown ?? 0) - 1;
  if (e.lunge > 0) {
    if (--e.lunge === 0) e.speed = e.baseSpeed;
    return;
  }
  if (distToPlayer < SCORPION_LUNGE.range && e.lungeCooldown <= 0) {
    e.lunge = SCORPION_LUNGE.duration;
    e.lungeCooldown = SCORPION_LUNGE.cooldown;
    e.speed = e.baseSpeed * SCORPION_LUNGE.speed;
  }
}

/** Golem de glace : son contact gèle (ralentit) le joueur. */
function freezePlayer() {
  if (player.buffs.slow <= 0) addFloatingText(player.worldX, player.worldY - 30, "GELÉ !", "#9fe8ff", 16, 40);
  player.buffs.slow = 90;
}

// --- BOSS ---

function updateMiniboss(e) {
  if (--e.skillTimer > 0) return;
  const base = angleTo(e.x, e.y, player.worldX, player.worldY);
  for (const offset of [-0.3, 0, 0.3]) {
    fireEnemyProjectile(e.x, e.y, base + offset, 7, {
      size: 14,
      damage: e.damage,
      color: "#ff6600",
      splitIn: 70,
    });
  }
  e.skillTimer = 100;
  addFloatingText(e.x, e.y, "TIR!", "#ffaa00", 14, 30);
}

function updateBoss(e) {
  const enraged = e.health < e.maxHealth * 0.5;
  if (enraged) {
    e.color = "#ff0000";
    e.speed = e.baseSpeed * 1.5;
  }
  if (--e.skillTimer > 0) return;
  // Tir en spirale
  fireEnemyProjectile(e.x, e.y, game.time / 200, 6, {
    size: 10,
    damage: e.damage,
    color: enraged ? "#ff0000" : "#aa00ff",
  });
  e.skillTimer = enraged ? 5 : 10;
}

function updateSlimeBoss(e) {
  e.skillTimer--;
  if (!e.isCharging) {
    if (e.skillTimer <= 0) {
      e.isCharging = true;
      e.skillTimer = 40;
      addFloatingText(e.x, e.y, "JUMP!", "#00ff00", 24, 40);
      for (let i = 0; i < 3; i++) spawnEnemy("slime_small", e.x, e.y);
    }
    return;
  }
  // Saut vers le joueur puis onde de choc
  e.x += (player.worldX - e.x) * 0.1;
  e.y += (player.worldY - e.y) * 0.1;
  e.size = 90;
  if (e.skillTimer <= 0) {
    e.isCharging = false;
    e.size = 80;
    e.skillTimer = 300;
    createAoEEffect(e.x, e.y, 200);
    addScreenShake(10);
    if (dist(player.worldX, player.worldY, e.x, e.y) < 200 && player.buffs.shield <= 0) takeDamage(40);
  }
}

/**
 * Positions des 3 têtes de la Nécro-Hydre (partagées entre la logique et le rendu) :
 * tournées vers le joueur, elles ondulent au bout de leur cou.
 */
export function hydraHeads(e) {
  const facing = angleTo(e.x, e.y, player.worldX, player.worldY);
  return HYDRA_HEAD_SPREAD.map((spread, i) => {
    const a = facing + spread + Math.sin(game.time / 400 + i * 2) * 0.15;
    const reach = e.size * (1.7 + Math.sin(game.time / 300 + i) * 0.1);
    return { x: e.x + Math.cos(a) * reach, y: e.y + Math.sin(a) * reach, angle: a };
  });
}

function updateHydra(e) {
  const enraged = e.health < e.maxHealth * 0.5;
  if (enraged && !e.summoned) {
    // À mi-vie : invoque des rejetons et devient plus agressive
    e.summoned = true;
    e.color = "#ff2266";
    e.speed = e.baseSpeed * 1.3;
    for (let i = 0; i < HYDRA_SUMMONS; i++) {
      const a = (Math.PI * 2 * i) / HYDRA_SUMMONS;
      spawnEnemy("hydra_spawn", e.x + Math.cos(a) * 90, e.y + Math.sin(a) * 90);
    }
    addFloatingText(e.x, e.y - e.size, "INVOCATION !", "#ff2266", 24, 60);
    addScreenShake(8);
  }
  if (--e.skillTimer > 0) return;
  // Les têtes crachent à tour de rôle une salve de 3 projectiles
  e.headTurn = ((e.headTurn ?? -1) + 1) % HYDRA_HEAD_SPREAD.length;
  const head = hydraHeads(e)[e.headTurn];
  const aim = angleTo(head.x, head.y, player.worldX, player.worldY);
  for (const offset of [-0.15, 0, 0.15]) {
    fireEnemyProjectile(head.x, head.y, aim + offset, 6, { size: 9, damage: e.damage * 0.6, color: e.color });
  }
  e.skillTimer = enraged ? 25 : 45;
}

// --- PROJECTILES ENNEMIS ---

function fireEnemyProjectile(x, y, angle, speed, props) {
  world.enemyProjectiles.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    dead: false,
    ...props,
  });
}

function updateEnemyProjectiles() {
  const list = world.enemyProjectiles;
  const count = list.length;
  for (let i = 0; i < count; i++) {
    const p = list[i];
    p.x += p.vx;
    p.y += p.vy;

    // Les gros projectiles du miniboss éclatent en 4 après un délai
    if (p.splitIn !== undefined && --p.splitIn <= 0) {
      for (let k = 0; k < 4; k++) {
        fireEnemyProjectile(p.x, p.y, (Math.PI / 2) * k, 5, { size: 8, damage: p.damage, color: "#ff6600" });
      }
      p.dead = true;
      continue;
    }

    const d = dist(p.x, p.y, player.worldX, player.worldY);
    if (d < player.size) {
      if (!isProtected()) takeDamage(p.damage);
      p.dead = true;
    } else if (d > 700) {
      p.dead = true;
    }
  }
  removeWhere(list, (p) => p.dead);
}
