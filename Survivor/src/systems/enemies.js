// IA des ennemis : déplacement, séparation, attaques et comportements de boss.

import { game, player, world } from "../core/state.js";
import { GOBLIN, MAX_ENEMY_SIZE } from "../data/enemies.js";
import { playSfx } from "../services/sfx.js";
import { MAP_BOUNDS, SURVIVAL } from "../config.js";
import { angleTo, clamp, dist, removeWhere } from "../utils/math.js";
import { damageEnemy, enemyGrid, killEnemy } from "./combat.js";
import { addFloatingText, addScreenShake, createAoEEffect, createParticles } from "./effects.js";
import { addBeam, addCircle, addRing } from "./hazards.js";
import { isProtected, takeDamage } from "./player.js";
import { spawnEnemy } from "./spawner.js";

const CONTACT_DAMAGE_COOLDOWN = 500; // ms

const BOSS_BEHAVIORS = {
  miniboss: updateMiniboss,
  boss: updateBoss,
  slime_boss: updateSlimeBoss,
  hydra: updateHydra,
  colossus: updateColossus,
  void_reaper: updateVoidReaper,
  goblin: updateGoblin,
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
    if (e.dead) continue; // le Voleur doré a pu s'enfuir
    const d = dist(player.worldX, player.worldY, e.x, e.y);
    if (e.type === "scorpion") updateScorpion(e, d);
    if (e.rooted > 0)
      e.rooted--; // boss en pleine attaque : il ne se déplace pas
    else moveEnemy(e, d);
    if (e.type === "ranged") rangedAttack(e, d);
    if (d < player.size + e.size && e.damage > 0) handleContact(e);
  }
  updateEnemyProjectiles();
  removeWhere(enemies, (e) => e.dead);
}

function moveEnemy(e, distToPlayer) {
  let tx = player.worldX;
  let ty = player.worldY;
  if (e.type === "goblin") {
    // Fuit le joueur en zigzaguant (pour ne pas rester coincé contre un bord)
    const away =
      Math.atan2(e.y - player.worldY, e.x - player.worldX) + Math.sin(game.time / 500 + e.phase * 9) * 1.1;
    tx = e.x + Math.cos(away) * 100;
    ty = e.y + Math.sin(away) * 100;
  } else if (e.type === "fast") {
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
  // Un recul (ultime, explosion...) ne doit pas sortir un ennemi de la zone de combat
  e.x = clamp(e.x, MAP_BOUNDS.minX + e.size, MAP_BOUNDS.maxX - e.size);
  e.y = clamp(e.y, MAP_BOUNDS.minY + e.size, MAP_BOUNDS.maxY - e.size);
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

  // Défense : réduction en pourcentage à rendements décroissants (elle ne peut plus tout annuler)
  const reduction = player.defense / (player.defense + SURVIVAL.armorCurve);
  const dmg = Math.max(1, e.damage * (1 - reduction));
  takeDamage(dmg);
  if (e.type === "golem") freezePlayer();
  e.lastDamage = game.time;
  const a = angleTo(player.worldX, player.worldY, e.x, e.y);
  e.x += Math.cos(a) * 20;
  e.y += Math.sin(a) * 20;
  if (player.thorns > 0) {
    addFloatingText(e.x, e.y, Math.round(dmg * player.thorns), "#aa00ff", 12);
    damageEnemy(e, dmg * player.thorns, "thorns");
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

/** Voleur doré : file pendant quelques secondes puis disparaît avec son butin. */
function updateGoblin(e) {
  e.life = (e.life ?? GOBLIN.lifetime) - 1;
  if (e.life % 6 === 0) createParticles(e.x, e.y, "#ffd700", 1);
  if (e.life > 0) return;
  e.dead = true; // retiré sans être tué : pas de récompense
  createParticles(e.x, e.y, "#ffd700", 25);
  addFloatingText(e.x, e.y - 30, "IL S'EST ENFUI !", "#ffd700", 20, 70);
}

/** Golem de glace : son contact gèle (ralentit) le joueur. */
function freezePlayer(ticks = 90) {
  if (player.buffs.slow <= 0) addFloatingText(player.worldX, player.worldY - 30, "GELÉ !", "#9fe8ff", 16, 40);
  player.buffs.slow = Math.max(player.buffs.slow, ticks);
}

// --- BOSS ---
// Les boss enchaînent des attaques annoncées (zones, lasers, ondes : voir hazards.js) et
// passent en « furie » sous 50 % de vie. `e.rooted` immobilise le boss pendant une attaque.

const aim = (e) => angleTo(e.x, e.y, player.worldX, player.worldY);

/** Attaque suivante dans le cycle du boss. */
function nextAttack(e, cycle) {
  e.turn = ((e.turn ?? -1) + 1) % cycle.length;
  return cycle[e.turn];
}

/** Passage en furie (une seule fois) : couleur, vitesse et annonce. */
function enrage(e, color, speedMult, text) {
  if (e.enraged || e.health >= e.maxHealth * 0.5) return false;
  e.enraged = true;
  e.color = color;
  e.speed = e.baseSpeed = e.baseSpeed * speedMult;
  addFloatingText(e.x, e.y - e.size - 20, text, color, 26, 80);
  addScreenShake(12);
  playSfx("boss");
  return true;
}

const CRAB = { windup: 45, charge: 26, chargeSpeed: 13 };

/** Crabe blindé : salve de gros tirs qui éclatent, puis charge annoncée par un trait. */
function updateMiniboss(e) {
  if (e.chargeIn > 0 && --e.chargeIn === 0) {
    e.charging = CRAB.charge;
    addScreenShake(6);
  }
  if (e.charging > 0) {
    e.charging--;
    e.rooted = 1;
    e.x = clamp(
      e.x + Math.cos(e.chargeAngle) * CRAB.chargeSpeed,
      MAP_BOUNDS.minX + e.size,
      MAP_BOUNDS.maxX - e.size,
    );
    e.y = clamp(
      e.y + Math.sin(e.chargeAngle) * CRAB.chargeSpeed,
      MAP_BOUNDS.minY + e.size,
      MAP_BOUNDS.maxY - e.size,
    );
    if (e.charging % 3 === 0) createParticles(e.x, e.y, "#ffaa00", 3);
    return;
  }
  if (--e.skillTimer > 0) return;
  if (nextAttack(e, ["shots", "charge"]) === "shots") {
    const base = aim(e);
    for (const offset of [-0.3, 0, 0.3]) {
      fireEnemyProjectile(e.x, e.y, base + offset, 7, {
        size: 14,
        damage: e.damage,
        color: "#ff6600",
        splitIn: 70,
      });
    }
    e.skillTimer = 100;
    return;
  }
  e.chargeAngle = aim(e);
  e.rooted = CRAB.windup;
  addBeam(e.x, e.y, e.chargeAngle, 0, {
    length: CRAB.charge * CRAB.chargeSpeed,
    width: e.size * 2,
    delay: CRAB.windup,
    color: "#ffaa00",
  });
  addFloatingText(e.x, e.y - e.size, "CHARGE !", "#ffaa00", 16, 40);
  e.chargeIn = CRAB.windup;
  e.skillTimer = CRAB.windup + CRAB.charge + 70;
}

const EYE_CYCLE = ["spiral", "lasers", "ring", "spiral", "lasers", "summon"];

/** Œil du néant : spirale de tirs, lasers en éventail, onde de choc et kamikazes. */
function updateBoss(e) {
  if (enrage(e, "#ff0040", 1.35, "FURIE !")) addRing(e.x, e.y, 700, e.damage * 0.5, { color: "#ff0040" });
  const fury = e.enraged;
  if (e.attack === "spiral" && e.attackTimer % (fury ? 4 : 6) === 0) {
    const arms = fury ? 3 : 2;
    for (let k = 0; k < arms; k++) {
      const a = game.time / 260 + (Math.PI * 2 * k) / arms;
      fireEnemyProjectile(e.x, e.y, a, 5.5, { size: 10, damage: e.damage * 0.6, color: e.color });
    }
  }
  if (--e.attackTimer > 0) return;
  e.attack = nextAttack(e, EYE_CYCLE);
  if (e.attack === "spiral") {
    e.attackTimer = 150;
  } else if (e.attack === "lasers") {
    const count = fury ? 5 : 3;
    const base = aim(e);
    for (let k = 0; k < count; k++) {
      addBeam(e.x, e.y, base + (k - (count - 1) / 2) * 0.45, e.damage * 0.7, {
        delay: 60,
        active: 30,
        color: e.color,
      });
    }
    e.rooted = 90;
    e.attackTimer = 110;
  } else if (e.attack === "ring") {
    addRing(e.x, e.y, 650, e.damage * 0.6, { color: e.color, speed: 6 });
    for (let k = 0; k < 20; k++) {
      fireEnemyProjectile(e.x, e.y, (Math.PI * 2 * k) / 20, 4, {
        size: 9,
        damage: e.damage * 0.5,
        color: e.color,
      });
    }
    e.attackTimer = 80;
  } else {
    for (let k = 0; k < (fury ? 5 : 3); k++) {
      const a = Math.random() * Math.PI * 2;
      spawnEnemy("kamikaze", e.x + Math.cos(a) * e.size * 1.5, e.y + Math.sin(a) * e.size * 1.5);
    }
    addFloatingText(e.x, e.y - e.size, "INVOCATION !", e.color, 20, 50);
    e.attackTimer = 60;
  }
}

const COLOSSUS_CYCLE = ["slam", "shards", "spikes", "slam", "spikes", "shards"];

/** Colosse de givre : frappe au sol + onde glacée, éclats gelants, pics de glace. */
function updateColossus(e) {
  enrage(e, "#e8fbff", 1.6, "ARMURE BRISÉE !");
  const speed = e.enraged ? 0.7 : 1;
  if (e.slamIn > 0 && --e.slamIn === 0) {
    addRing(e.x, e.y, 700, e.damage * 0.6, { color: "#9fe8ff", slow: 120, speed: 6 });
    createAoEEffect(e.x, e.y, 120);
  }
  if (--e.attackTimer > 0) return;
  const attack = nextAttack(e, COLOSSUS_CYCLE);
  if (attack === "slam") {
    addCircle(e.x, e.y, 210, e.damage, { delay: 55, color: "#9fe8ff", slow: 90 });
    addFloatingText(e.x, e.y - e.size - 10, "FRAPPE !", "#9fe8ff", 18, 40);
    e.rooted = 70;
    e.slamIn = 55;
    e.attackTimer = 130 * speed;
  } else if (attack === "shards") {
    const count = e.enraged ? 18 : 12;
    const offset = Math.random();
    for (let k = 0; k < count; k++) {
      const a = offset + (Math.PI * 2 * k) / count;
      fireEnemyProjectile(e.x, e.y, a, 5, { size: 9, damage: e.damage * 0.5, color: "#bdf3ff", slow: 90 });
    }
    e.attackTimer = 70 * speed;
  } else {
    const base = aim(e);
    for (const off of e.enraged ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.35, 0, 0.35]) {
      addBeam(e.x, e.y, base + off, e.damage * 0.8, {
        length: 650,
        width: 44,
        delay: 45,
        active: 18,
        color: "#9fe8ff",
      });
    }
    e.rooted = 60;
    e.attackTimer = 100 * speed;
  }
}

const REAPER_CYCLE = ["scythes", "blink", "scythes", "phantoms", "blink", "nova"];

/** Faucheur du vide : faux qui tournoient, téléportation, spectres et croix de lasers. */
function updateVoidReaper(e) {
  enrage(e, "#ff0055", 1.3, "LE VIDE S'OUVRE !");
  const speed = e.enraged ? 0.7 : 1;
  if (e.blinkIn > 0 && --e.blinkIn === 0) {
    createParticles(e.x, e.y, e.color, 20);
    e.x = e.blinkX;
    e.y = e.blinkY;
    createParticles(e.x, e.y, e.color, 20);
    for (let k = 0; k < 12; k++) {
      fireEnemyProjectile(e.x, e.y, (Math.PI * 2 * k) / 12, 5, {
        size: 9,
        damage: e.damage * 0.5,
        color: e.color,
      });
    }
  }
  if (--e.attackTimer > 0) return;
  const attack = nextAttack(e, REAPER_CYCLE);
  if (attack === "scythes") {
    const count = e.enraged ? 5 : 3;
    const base = aim(e);
    for (let k = 0; k < count; k++) {
      const side = k % 2 ? 1 : -1;
      fireEnemyProjectile(e.x, e.y, base + side * 0.9 + (k - count / 2) * 0.1, 7, {
        size: 14,
        damage: e.damage * 0.7,
        color: e.color,
        turn: -side * 0.028, // la faux décrit une courbe vers le joueur
        life: 160,
        scythe: true,
      });
    }
    e.attackTimer = 90 * speed;
  } else if (attack === "blink") {
    // Réapparaît derrière le joueur
    const a = Math.atan2(e.y - player.worldY, e.x - player.worldX) + Math.PI;
    e.blinkX = clamp(player.worldX + Math.cos(a) * 140, MAP_BOUNDS.minX + e.size, MAP_BOUNDS.maxX - e.size);
    e.blinkY = clamp(player.worldY + Math.sin(a) * 140, MAP_BOUNDS.minY + e.size, MAP_BOUNDS.maxY - e.size);
    addCircle(e.blinkX, e.blinkY, 110, e.damage, { delay: 50, color: e.color });
    e.blinkIn = 50;
    e.rooted = 50;
    e.attackTimer = 90 * speed;
  } else if (attack === "phantoms") {
    for (let k = 0; k < 4; k++) {
      const a = (Math.PI * 2 * k) / 4 + Math.random();
      spawnEnemy("phantom", player.worldX + Math.cos(a) * 260, player.worldY + Math.sin(a) * 260);
    }
    addFloatingText(e.x, e.y - e.size, "SPECTRES !", e.color, 20, 50);
    e.attackTimer = 60;
  } else {
    // Croix de lasers, puis une seconde croix décalée
    const base = Math.random() * Math.PI;
    for (let k = 0; k < 4; k++) {
      addBeam(e.x, e.y, base + (Math.PI / 2) * k, e.damage * 0.7, { delay: 55, active: 25, color: e.color });
      addBeam(e.x, e.y, base + Math.PI / 4 + (Math.PI / 2) * k, e.damage * 0.7, {
        delay: 95,
        active: 25,
        color: e.color,
      });
    }
    e.rooted = 120;
    e.attackTimer = 140;
  }
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
  // Toutes les quelques salves : pluie d'acide autour du joueur (flaques qui restent au sol)
  e.volleys = (e.volleys ?? 0) + 1;
  if (e.volleys % (enraged ? 3 : 4) === 0) {
    for (let k = 0; k < (enraged ? 7 : 5); k++) {
      const off = k === 0 ? 0 : 60 + Math.random() * 140;
      const a = Math.random() * Math.PI * 2;
      addCircle(player.worldX + Math.cos(a) * off, player.worldY + Math.sin(a) * off, 70, e.damage * 0.8, {
        delay: 70 + k * 6,
        color: "#39ff14",
        pool: 240,
      });
    }
    addFloatingText(e.x, e.y - e.size, "PLUIE D'ACIDE !", "#39ff14", 20, 50);
    e.skillTimer = 60;
    return;
  }
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
    if (p.turn) {
      // Projectile courbe (faux du Faucheur) : la vitesse tourne à chaque tick
      const c = Math.cos(p.turn);
      const s = Math.sin(p.turn);
      [p.vx, p.vy] = [p.vx * c - p.vy * s, p.vx * s + p.vy * c];
    }
    p.x += p.vx;
    p.y += p.vy;
    if (p.life !== undefined && --p.life <= 0) {
      p.dead = true;
      continue;
    }

    // Les gros projectiles du miniboss éclatent en 4 après un délai
    if (p.splitIn !== undefined && --p.splitIn <= 0) {
      for (let k = 0; k < 4; k++) {
        fireEnemyProjectile(p.x, p.y, (Math.PI / 2) * k, 5, { size: 8, damage: p.damage, color: "#ff6600" });
      }
      p.dead = true;
      continue;
    }

    const d = dist(p.x, p.y, player.worldX, player.worldY);
    if (d < player.size + p.size * 0.5) {
      if (!isProtected()) {
        takeDamage(p.damage);
        if (p.slow) freezePlayer(p.slow);
      }
      p.dead = true;
    } else if (d > 700) {
      p.dead = true;
    }
  }
  removeWhere(list, (p) => p.dead);
}
