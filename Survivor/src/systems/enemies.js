// IA des ennemis : déplacement, séparation, attaques et comportements de boss.

import { game, player, world } from "../core/state.js";
import { BIOME_FOES, GOBLIN, KRAKEN, MAX_ENEMY_SIZE, SLIME_KING, TWINS } from "../data/enemies.js";
import { playSfx } from "../services/sfx.js";
import { SURVIVAL, TICK_MS } from "../config.js";
import { angleDiff, angleTo, clamp, dist, removeWhere } from "../utils/math.js";
import { damageEnemy, enemyGrid, killEnemy } from "./combat.js";
import {
  addFloatingText,
  addScreenShake,
  createAoEEffect,
  createParticles,
  createShockwave,
} from "./effects.js";
import { addBeam, addCircle, addRing } from "./hazards.js";
import { isProtected, stunPlayer, takeDamage } from "./player.js";
import { spawnEnemy } from "./spawner.js";
import { clampToZone } from "./arena.js";

const CONTACT_DAMAGE_COOLDOWN = 500; // ms

const BOSS_BEHAVIORS = {
  miniboss: updateMiniboss,
  boss: updateBoss,
  slime_boss: updateSlimeBoss,
  hydra: updateHydra,
  colossus: updateColossus,
  void_reaper: updateVoidReaper,
  storm_titan: updateStormTitan,
  prism: updatePrism,
  kraken: updateKraken,
  kraken_tentacle: updateTentacle,
  twin_fire: updateTwin,
  twin_ice: updateTwin,
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
    else if (e.type === "bomber") updateBomber(e, d);
    else if (e.type === "blinker") updateBlinker(e, d);
    else if (e.type === "laser_drone") updateLaserDrone(e, d);
    else if (e.type === "shield") updateShield(e);
    else if (e.type === "healer") updateHealer(e);
    else if (e.type === "magnet") updateMagnet(e, d);
    if (e.rooted > 0)
      e.rooted--; // boss en pleine attaque : il ne se déplace pas
    else moveEnemy(e, d);
    // Même immobile (tentacule, boss en pleine attaque), un ennemi suit les murs de l'arène qui se referment
    e.x = clamp(e.x, game.bounds.minX + e.size, game.bounds.maxX - e.size);
    e.y = clamp(e.y, game.bounds.minY + e.size, game.bounds.maxY - e.size);
    if (e.type === "ranged") rangedAttack(e, d);
    if (d < player.size + e.size && e.damage > 0 && !e.submerged && !e.airborne) handleContact(e);
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
  } else if (e.type === "ranged" || e.type === "laser_drone" || e.type === "healer") {
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
    // Traînée spectrale (Cape ★3) : ennemi ralenti
    const speed = e.speed * (e.slowUntil > game.time ? e.slowFactor : 1);
    e.x += (mx / len) * speed;
    e.y += (my / len) * speed;
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

/** Poseur de mines : sème des mines (zones annoncées) quand il est près du joueur. */
function updateBomber(e, distToPlayer) {
  const m = BIOME_FOES.mine;
  e.mineTimer = (e.mineTimer ?? m.every * Math.random()) - 1;
  if (e.mineTimer > 0 || distToPlayer > m.range) return;
  e.mineTimer = m.every;
  addCircle(e.x, e.y, m.radius, e.damage * m.damage, { delay: m.delay, color: e.color });
}

/** Téléporteur : annonce son point d'arrivée près du joueur, puis y surgit. */
function updateBlinker(e, distToPlayer) {
  const b = BIOME_FOES.blink;
  if (e.blinkTo) {
    if (e.rooted % 5 === 0) createParticles(e.blinkTo.x, e.blinkTo.y, e.color, 2);
    if (e.rooted > 1) return;
    createParticles(e.x, e.y, e.color, 10);
    e.x = e.blinkTo.x;
    e.y = e.blinkTo.y;
    e.blinkTo = null;
    createParticles(e.x, e.y, e.color, 10);
    return;
  }
  e.blinkTimer = (e.blinkTimer ?? b.every * Math.random()) - 1;
  if (e.blinkTimer > 0 || distToPlayer < b.minDist) return;
  e.blinkTimer = b.every;
  const a = Math.random() * Math.PI * 2;
  e.blinkTo = clampToZone(
    player.worldX + Math.cos(a) * b.landDist,
    player.worldY + Math.sin(a) * b.landDist,
    e.size,
  );
  e.rooted = b.warn; // immobile pendant l'annonce
}

/** Drone laser : garde ses distances et tire un laser annoncé vers le joueur. */
function updateLaserDrone(e, distToPlayer) {
  const l = BIOME_FOES.laser;
  e.laserTimer = (e.laserTimer ?? l.every * (0.5 + Math.random() * 0.5)) - 1;
  if (e.laserTimer > 0 || distToPlayer > l.range) return;
  e.laserTimer = l.every;
  e.rooted = l.delay + l.active;
  addBeam(e.x, e.y, aim(e), e.damage, {
    length: l.length,
    width: l.width,
    delay: l.delay,
    active: l.active,
    color: e.color,
  });
}

/** Porte-bouclier : son bouclier (face avant) pivote lentement vers le joueur. */
function updateShield(e) {
  const target = aim(e);
  e.facing ??= target;
  const turn = BIOME_FOES.shield.turn;
  e.facing += clamp(angleDiff(target, e.facing), -turn, turn);
}

/** Soigneur : reste en retrait et soigne régulièrement les ennemis proches (jamais les boss). */
function updateHealer(e) {
  const h = BIOME_FOES.heal;
  e.healTimer = (e.healTimer ?? h.every * (0.5 + Math.random() * 0.5)) - 1;
  if (e.healTimer > 0) return;
  e.healTimer = h.every;
  createShockwave(e.x, e.y, h.radius, e.color);
  for (const o of enemyGrid.query(e.x, e.y, h.radius)) {
    if (o.dead || o.template.isBoss || o.health >= o.maxHealth) continue;
    if (dist(o.x, o.y, e.x, e.y) > h.radius + o.size) continue;
    o.health = Math.min(o.maxHealth, o.health + o.maxHealth * h.amount);
    createParticles(o.x, o.y, e.color, 4);
  }
}

/** Aimant : annonce son attraction (anneau qui se resserre), puis tire le joueur vers lui. */
function updateMagnet(e, distToPlayer) {
  const m = BIOME_FOES.magnet;
  if (e.pulling > 0) {
    e.pulling--;
    e.rooted = 1;
    if (isProtected()) return; // le dash ou le bouclier libèrent
    const a = angleTo(player.worldX, player.worldY, e.x, e.y);
    const pull = Math.min(m.pull, Math.max(0, distToPlayer - e.size - player.size));
    player.worldX = clamp(player.worldX + Math.cos(a) * pull, game.bounds.minX, game.bounds.maxX);
    player.worldY = clamp(player.worldY + Math.sin(a) * pull, game.bounds.minY, game.bounds.maxY);
    return;
  }
  if (e.magnetWarn > 0) {
    e.rooted = 1;
    if (--e.magnetWarn === 0) e.pulling = m.duration;
    return;
  }
  e.magnetTimer = (e.magnetTimer ?? m.every * (0.4 + Math.random() * 0.6)) - 1;
  if (e.magnetTimer > 0 || distToPlayer > m.range) return;
  e.magnetTimer = m.every;
  e.magnetWarn = m.warn;
  e.rooted = 1;
  addFloatingText(e.x, e.y - e.size - 15, "AIMANT !", e.color, 16, 45);
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
      game.bounds.minX + e.size,
      game.bounds.maxX - e.size,
    );
    e.y = clamp(
      e.y + Math.sin(e.chargeAngle) * CRAB.chargeSpeed,
      game.bounds.minY + e.size,
      game.bounds.maxY - e.size,
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
    const to = clampToZone(player.worldX + Math.cos(a) * 140, player.worldY + Math.sin(a) * 140, e.size);
    e.blinkX = to.x;
    e.blinkY = to.y;
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

const STORM_CYCLE = ["strikes", "orbs", "chain", "strikes", "overload", "orbs"];
const STORM_BLUE = "#9be7ff";

/**
 * Titan de l'orage : pluie d'éclairs autour du joueur, boules de foudre, arcs électriques et
 * surcharge. Tous ses coups étourdissent (le dash et le bouclier protègent).
 */
function updateStormTitan(e) {
  enrage(e, "#fff7b0", 1.3, "TEMPÊTE !");
  const speed = e.enraged ? 0.7 : 1;
  if (e.overloadIn > 0 && --e.overloadIn === 0) {
    addRing(e.x, e.y, 600, e.damage * 0.5, { color: STORM_BLUE, speed: 7 });
  }
  if (--e.attackTimer > 0) return;
  const attack = nextAttack(e, STORM_CYCLE);
  if (attack === "strikes") {
    const count = e.enraged ? 7 : 5;
    for (let k = 0; k < count; k++) {
      // Le premier éclair vise le joueur, les autres tombent autour
      const off = k === 0 ? 0 : 70 + Math.random() * 150;
      const a = Math.random() * Math.PI * 2;
      addCircle(player.worldX + Math.cos(a) * off, player.worldY + Math.sin(a) * off, 70, e.damage * 0.7, {
        delay: 55 + k * 8,
        color: "#ffe94d",
        stun: 50,
      });
    }
    addFloatingText(e.x, e.y - e.size - 10, "FOUDRE !", "#ffe94d", 18, 40);
    e.attackTimer = 110 * speed;
  } else if (attack === "orbs") {
    const count = e.enraged ? 14 : 10;
    const offset = Math.random();
    for (let k = 0; k < count; k++) {
      fireEnemyProjectile(e.x, e.y, offset + (Math.PI * 2 * k) / count, 3.6, {
        size: 12,
        damage: e.damage * 0.5,
        color: STORM_BLUE,
        stun: 40,
        life: 220,
      });
    }
    e.attackTimer = 80 * speed;
  } else if (attack === "chain") {
    const base = aim(e);
    for (const off of e.enraged ? [-0.6, -0.3, 0, 0.3, 0.6] : [-0.4, 0, 0.4]) {
      addBeam(e.x, e.y, base + off, e.damage * 0.6, {
        length: 800,
        width: 30,
        delay: 50,
        active: 22,
        color: STORM_BLUE,
        stun: 45,
      });
    }
    e.rooted = 70;
    e.attackTimer = 100 * speed;
  } else {
    // Surcharge : grosse décharge autour du Titan, puis onde électrique
    addCircle(e.x, e.y, 240, e.damage, { delay: 70, color: "#ffe94d", stun: 70 });
    addFloatingText(e.x, e.y - e.size - 10, "SURCHARGE !", "#ffe94d", 20, 50);
    e.rooted = 80;
    e.overloadIn = 70;
    e.attackTimer = 130 * speed;
  }
}

const PRISM_CYCLE = ["sweep", "shards", "grid", "sweep", "grid", "shards"];

/** Sentinelle prismatique : lasers qui balaient l'arène, éclats qui se diffractent, damier de zones. */
function updatePrism(e) {
  enrage(e, "#ff4dd2", 1.25, "RÉFRACTION !");
  const speed = e.enraged ? 0.75 : 1;
  if (--e.attackTimer > 0) return;
  const attack = nextAttack(e, PRISM_CYCLE);
  if (attack === "sweep") {
    const count = e.enraged ? 3 : 2;
    const base = aim(e) + Math.PI / 2; // commence de côté : le balayage arrive vers le joueur
    const spin = (Math.random() < 0.5 ? -1 : 1) * 0.012;
    const active = e.enraged ? 180 : 150;
    for (let k = 0; k < count; k++) {
      addBeam(e.x, e.y, base + (Math.PI * 2 * k) / count, e.damage * 0.6, {
        length: 900,
        width: 30,
        delay: 60,
        active,
        color: e.color,
        spin,
      });
    }
    addFloatingText(e.x, e.y - e.size - 10, "BALAYAGE !", e.color, 18, 40);
    e.rooted = 60 + active;
    e.attackTimer = 60 + active + 20;
  } else if (attack === "shards") {
    const base = aim(e);
    const count = e.enraged ? 7 : 5;
    for (let k = 0; k < count; k++) {
      fireEnemyProjectile(e.x, e.y, base + (k - (count - 1) / 2) * 0.28, 6, {
        size: 14,
        damage: e.damage * 0.6,
        color: e.color,
        splitIn: 50,
        splitCount: 6,
        splitColor: "#ff4dd2",
      });
    }
    e.attackTimer = 90 * speed;
  } else {
    // Damier 3×3 centré sur le joueur : les cases « noires » puis les « blanches »
    const cell = 140;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const first = (i + j) % 2 === 0;
        addCircle(player.worldX + i * cell, player.worldY + j * cell, 72, e.damage * 0.8, {
          delay: first ? 60 : 105,
          color: first ? "#b07dff" : e.color,
        });
      }
    }
    e.attackTimer = 140 * speed;
  }
}

// --- KRAKEN ---

const INK = "#6a3dff";

/**
 * Kraken : sous l'eau (invulnérable), il fait jaillir des tentacules autour du joueur et l'aspire
 * par des tourbillons. Quand toutes ses tentacules sont détruites, sa tête remonte : c'est le
 * seul moment où on peut le blesser. Puis il replonge avec de nouvelles tentacules.
 */
function updateKraken(e) {
  if (!e.tentacles) return krakenDive(e);
  if (e.emergeIn > 0 && --e.emergeIn === 0) {
    for (const [i, p] of e.pending.entries()) {
      spawnEnemy("kraken_tentacle", p.x, p.y);
      const t = world.enemies[world.enemies.length - 1];
      t.owner = e;
      t.attackTimer = 50 + i * 22; // pas toutes en même temps
      e.tentacles.push(t);
    }
    addScreenShake(6);
  }
  if (e.surfaceIn > 0) {
    e.rooted = 1;
    if (--e.surfaceIn > 0) return;
    e.submerged = false;
    e.exposedFor = e.enraged ? KRAKEN.exposedEnraged : KRAKEN.exposed;
    e.attackTimer = 40;
    addFloatingText(e.x, e.y - e.size - 20, "TÊTE EXPOSÉE !", "#ffd700", 24, 70);
    addScreenShake(10);
    return;
  }
  if (e.submerged) {
    if (e.emergeIn <= 0 && e.tentacles.every((t) => t.dead)) return krakenSurface(e);
    krakenWhirl(e);
    return;
  }
  // Tête à l'air : jets d'encre, puis il replonge
  e.rooted = 1;
  enrage(e, "#ff3d9a", 1.25, "COLÈRE DES ABYSSES !");
  if (--e.exposedFor <= 0) return krakenDive(e);
  if (--e.attackTimer > 0) return;
  const count = e.enraged ? 7 : 5;
  const base = aim(e);
  for (let k = 0; k < count; k++) {
    fireEnemyProjectile(e.x, e.y, base + (k - (count - 1) / 2) * 0.22, 5.5, {
      size: 12,
      damage: e.damage * 0.5,
      color: INK,
    });
  }
  e.attackTimer = e.enraged ? 40 : 55;
}

/** Plongée : la tête disparaît et des tentacules jaillissent (zones annoncées) autour du joueur. */
function krakenDive(e) {
  const first = !e.tentacles;
  e.submerged = true;
  e.tentacles = [];
  e.pending = [];
  e.whirlTimer = KRAKEN.whirlEvery;
  const count = e.enraged ? KRAKEN.tentaclesEnraged : KRAKEN.tentacles;
  const offset = Math.random() * Math.PI * 2;
  for (let k = 0; k < count; k++) {
    const a = offset + (Math.PI * 2 * k) / count;
    // Dans l'arène finale, pas seulement entre les murs actuels (ils se referment encore à l'arrivée du boss)
    const { x, y } = clampToZone(
      player.worldX + Math.cos(a) * KRAKEN.ringRadius,
      player.worldY + Math.sin(a) * KRAKEN.ringRadius,
      60,
    );
    addCircle(x, y, 60, e.damage * 0.6, { delay: KRAKEN.emerge, color: "#b46bff" });
    e.pending.push({ x, y });
  }
  e.emergeIn = KRAKEN.emerge;
  createParticles(e.x, e.y, e.color, 25);
  if (!first) addFloatingText(e.x, e.y - e.size - 20, "LE KRAKEN PLONGE !", e.color, 22, 60);
}

/** Plus de tentacules : la tête remonte (zone annoncée sous elle). */
function krakenSurface(e) {
  e.whirl = 0;
  e.surfaceIn = 50;
  addCircle(e.x, e.y, e.size + 50, e.damage, { delay: 50, color: e.color });
  addFloatingText(e.x, e.y - e.size - 20, "IL REMONTE !", e.color, 20, 50);
}

/** Tourbillon : de temps en temps, la tête immergée aspire le joueur (le dash y échappe). */
function krakenWhirl(e) {
  if (e.whirl > 0) {
    e.whirl--;
    if (isProtected()) return;
    const a = angleTo(player.worldX, player.worldY, e.x, e.y);
    const pull = Math.min(KRAKEN.whirlPull, dist(player.worldX, player.worldY, e.x, e.y));
    player.worldX = clamp(player.worldX + Math.cos(a) * pull, game.bounds.minX, game.bounds.maxX);
    player.worldY = clamp(player.worldY + Math.sin(a) * pull, game.bounds.minY, game.bounds.maxY);
    return;
  }
  if (--e.whirlTimer > 0) return;
  e.whirlTimer = KRAKEN.whirlEvery;
  e.whirl = KRAKEN.whirlDuration;
  addFloatingText(e.x, e.y - e.size - 20, "TOURBILLON !", e.color, 20, 50);
}

/**
 * Tentacule du Kraken : fixe, elle n'attaque qu'en zone. « Frappe » : grande zone sous le joueur ;
 * « fracas » : elle s'abat autour d'elle et envoie une onde de choc.
 */
function updateTentacle(e) {
  e.rooted = 1;
  if (!e.owner || e.owner.dead) {
    e.dead = true; // le Kraken est mort : ses tentacules retombent (sans récompense)
    createParticles(e.x, e.y, e.color, 10);
    return;
  }
  if (e.smashIn > 0 && --e.smashIn === 0) {
    addRing(e.x, e.y, 380, e.damage * 0.6, { color: e.color, speed: 6 });
    addScreenShake(6);
  }
  if (--e.attackTimer > 0) return;
  if (nextAttack(e, ["slam", "smash"]) === "slam") {
    addCircle(player.worldX, player.worldY, 120, e.damage, { delay: 60, color: e.color });
    e.attackTimer = 170;
    return;
  }
  addCircle(e.x, e.y, 190, e.damage * 1.2, { delay: 65, color: "#ff3d9a" });
  e.smashIn = 65;
  e.attackTimer = 200;
}

// --- JUMEAUX ---

const TWIN_CYCLES = {
  twin_fire: ["flames", "meteors", "scissors"],
  twin_ice: ["shards", "spikes"],
  revenge: ["flames", "shards", "meteors", "spikes"],
};

/**
 * Jumeaux de feu et de glace : ils tournent autour du joueur, reliés par un lien d'énergie qui
 * blesse. « Ciseaux » : ils changent de côté et le lien balaie le joueur. Si l'un meurt, l'autre
 * se venge : il récupère de la vie et enchaîne les attaques des deux.
 */
function updateTwin(e) {
  if (!e.pair) linkTwins(e);
  const partner = e.partner;
  if (partner.dead && !e.revenge) twinRevenge(e);
  if (e.revenge) {
    if (--e.attackTimer <= 0) twinAttack(e, nextAttack(e, TWIN_CYCLES.revenge));
    return; // seul : il fonce sur le joueur comme un boss ordinaire
  }
  const pair = e.pair;
  if (e.type === "twin_fire") updatePair(e, pair);
  // Chacun rejoint sa place sur le cercle autour du joueur
  e.rooted = 1;
  const angle = pair.theta + (e.type === "twin_ice" ? pair.gap : 0);
  const tx = player.worldX + Math.cos(angle) * TWINS.orbit;
  const ty = player.worldY + Math.sin(angle) * TWINS.orbit;
  const d = dist(e.x, e.y, tx, ty);
  const step = Math.min(d, pair.scissors > 0 ? 16 : e.speed * 1.6);
  if (d > 0) {
    e.x = clamp(e.x + ((tx - e.x) / d) * step, game.bounds.minX + e.size, game.bounds.maxX - e.size);
    e.y = clamp(e.y + ((ty - e.y) / d) * step, game.bounds.minY + e.size, game.bounds.maxY - e.size);
  }
  if (pair.scissors > 0 || pair.warn > 0) return;
  if (--e.attackTimer <= 0) twinAttack(e, nextAttack(e, TWIN_CYCLES[e.type]));
}

/** Premier tick d'un jumeau : son frère apparaît à côté et les deux sont reliés. */
function linkTwins(e) {
  spawnEnemy(e.type === "twin_fire" ? "twin_ice" : "twin_fire", e.x + 120, e.y);
  const other = world.enemies[world.enemies.length - 1];
  const pair = { theta: angleTo(player.worldX, player.worldY, e.x, e.y), gap: TWINS.gap };
  Object.assign(pair, { scissors: 0, warn: 0, hit: -1e9 });
  e.pair = other.pair = pair;
  e.partner = other;
  other.partner = e;
  other.attackTimer = e.attackTimer + 45; // attaques décalées
}

/** Rotation du duo, ciseaux et dégâts du lien (gérés une fois par tick, par le Jumeau de feu). */
function updatePair(fire, pair) {
  pair.theta += TWINS.orbitSpeed;
  if (pair.warn > 0 && --pair.warn === 0) pair.scissors = TWINS.scissors;
  if (pair.scissors > 0) {
    // L'écart passe de `from` à 2π - from : les jumeaux échangent leurs côtés
    const t = 1 - --pair.scissors / TWINS.scissors;
    pair.gap = pair.from + (Math.PI * 2 - 2 * pair.from) * t;
    if (pair.scissors === 0) pair.gap = Math.PI * 2 - pair.from;
  }
  const ice = fire.partner;
  if (game.time - pair.hit < TWINS.tetherTick * TICK_MS || isProtected()) return;
  const width = tetherWidth(pair);
  if (
    segmentDist(player.worldX, player.worldY, fire.x, fire.y, ice.x, ice.y) <
    width / 2 + player.size * 0.5
  ) {
    pair.hit = game.time;
    takeDamage(fire.damage * TWINS.tetherDamage * (pair.scissors > 0 ? 2 : 1));
  }
}

/** Épaisseur du lien entre les jumeaux (plus large pendant les ciseaux). Partagée avec le rendu. */
export function tetherWidth(pair) {
  return pair.scissors > 0 ? TWINS.tetherWidth * 2 : TWINS.tetherWidth;
}

function twinAttack(e, attack) {
  const fast = e.revenge ? 0.7 : 1;
  if (attack === "flames") {
    const base = aim(e);
    for (let k = 0; k < 9; k++) {
      fireEnemyProjectile(e.x, e.y, base + (k - 4) * 0.1, 6.5, {
        size: 10,
        damage: e.damage * 0.45,
        color: "#ff7a1a",
        life: 80,
      });
    }
    e.attackTimer = 90 * fast;
  } else if (attack === "meteors") {
    for (let k = 0; k < 3; k++) {
      const off = k === 0 ? 0 : 90 + Math.random() * 90;
      const a = Math.random() * Math.PI * 2;
      addCircle(player.worldX + Math.cos(a) * off, player.worldY + Math.sin(a) * off, 75, e.damage * 0.8, {
        delay: 60 + k * 10,
        color: "#ff5a00",
        pool: 150,
      });
    }
    addFloatingText(e.x, e.y - e.size - 10, "MÉTÉORES !", "#ff7a1a", 18, 40);
    e.attackTimer = 120 * fast;
  } else if (attack === "shards") {
    const count = e.revenge ? 16 : 12;
    const offset = Math.random();
    for (let k = 0; k < count; k++) {
      fireEnemyProjectile(e.x, e.y, offset + (Math.PI * 2 * k) / count, 5, {
        size: 9,
        damage: e.damage * 0.45,
        color: "#bdf3ff",
        slow: 90,
      });
    }
    e.attackTimer = 90 * fast;
  } else if (attack === "spikes") {
    const base = aim(e);
    for (const off of [-0.3, 0, 0.3]) {
      addBeam(e.x, e.y, base + off, e.damage * 0.7, {
        length: 600,
        width: 36,
        delay: 45,
        active: 18,
        color: "#7fd8ff",
      });
    }
    e.attackTimer = 110 * fast;
  } else {
    // Ciseaux : le lien clignote, puis les jumeaux se croisent en passant de part et d'autre du joueur
    const pair = e.pair;
    pair.warn = 45;
    pair.from = pair.gap;
    addFloatingText(player.worldX, player.worldY - 70, "CISEAUX !", "#ffd700", 22, 50);
    e.attackTimer = 45 + TWINS.scissors + 60;
  }
}

/** Le frère est mort : vengeance (soin, vitesse, attaques des deux jumeaux). */
function twinRevenge(e) {
  e.revenge = e.enraged = true;
  e.health = Math.min(e.maxHealth, e.health + e.maxHealth * TWINS.revengeHeal);
  e.speed = e.baseSpeed = e.baseSpeed * TWINS.revengeSpeed;
  e.attackTimer = 60;
  addFloatingText(e.x, e.y - e.size - 20, "VENGEANCE !", e.color, 26, 80);
  addScreenShake(12);
  playSfx("boss");
}

/** Distance d'un point au segment [A, B]. */
function segmentDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

const SLIME_CYCLE = ["jump", "globs", "jump", "absorb"];
const SLIME_GREEN = "#7dff3d";

/**
 * Roi Slime : saute sur le joueur (zone annoncée, onde de choc à l'atterrissage et petits slimes),
 * crache une pluie de slime collante (flaques qui ralentissent) et absorbe ses petits pour se
 * soigner : il vaut mieux les tuer vite. En furie (« MITOSE ») il se dédouble et enchaîne les sauts.
 * Il se divise toujours à sa mort (`splitTo`).
 */
function updateSlimeBoss(e) {
  e.baseSize ??= e.size;
  if (enrage(e, "#d4ff00", 1.2, "MITOSE !")) {
    for (let k = 0; k < 2; k++) spawnEnemy("slime_big", e.x + (k ? 60 : -60), e.y);
  }
  if (e.jump) return slimeJump(e);
  if (--e.attackTimer > 0) return;
  const pace = e.enraged ? 0.75 : 1;
  const attack = nextAttack(e, SLIME_CYCLE);
  if (attack === "jump") {
    e.jumpsLeft = e.enraged ? SLIME_KING.jumpsEnraged : 1;
    startSlimeJump(e);
  } else if (attack === "globs") {
    const count = e.enraged ? SLIME_KING.globsEnraged : SLIME_KING.globs;
    for (let k = 0; k < count; k++) {
      const off = k === 0 ? 0 : 80 + Math.random() * 170;
      const a = Math.random() * Math.PI * 2;
      addCircle(player.worldX + Math.cos(a) * off, player.worldY + Math.sin(a) * off, 75, e.damage * 0.5, {
        delay: 55 + k * 6,
        color: SLIME_GREEN,
        pool: 240,
        slow: 60,
      });
    }
    addFloatingText(e.x, e.y - e.size - 10, "PLUIE DE SLIME !", SLIME_GREEN, 18, 40);
    e.attackTimer = 110 * pace;
  } else {
    slimeAbsorb(e);
    e.attackTimer = 90 * pace;
  }
}

/** Début d'un saut : zone d'atterrissage annoncée là où se tient le joueur. */
function startSlimeJump(e) {
  const { x: tx, y: ty } = clampToZone(player.worldX, player.worldY, e.size);
  const r = SLIME_KING.jumpRadius;
  addCircle(tx, ty, r, e.damage, { delay: SLIME_KING.jumpTicks, color: SLIME_GREEN });
  e.jump = { fromX: e.x, fromY: e.y, tx, ty, t: 0 };
  addFloatingText(e.x, e.y - e.size, "SAUT !", SLIME_GREEN, 22, 40);
}

/** En l'air : il traverse l'arène en grossissant, puis retombe (onde de choc + petits slimes). */
function slimeJump(e) {
  const j = e.jump;
  const k = ++j.t / SLIME_KING.jumpTicks;
  e.rooted = 1;
  e.airborne = true; // pas de contact pendant le saut
  e.x = j.fromX + (j.tx - j.fromX) * k;
  e.y = j.fromY + (j.ty - j.fromY) * k;
  e.size = e.baseSize * (1 + Math.sin(Math.PI * k) * 0.25);
  if (k < 1) return;
  e.jump = null;
  e.airborne = false;
  e.size = e.baseSize;
  addRing(e.x, e.y, 520, e.damage * 0.5, { color: SLIME_GREEN, speed: 7 });
  createAoEEffect(e.x, e.y, SLIME_KING.jumpRadius);
  addScreenShake(12);
  for (let i = 0; i < 3; i++) spawnEnemy("slime_small", e.x, e.y);
  if (--e.jumpsLeft > 0) startSlimeJump(e);
  else e.attackTimer = e.enraged ? 70 : 100;
}

/** Absorption : les slimes proches rejoignent le roi et le soignent ; sinon il appelle des renforts. */
function slimeAbsorb(e) {
  let eaten = 0;
  for (const s of enemyGrid.query(e.x, e.y, SLIME_KING.absorbRange)) {
    if (s.dead || (s.type !== "slime_small" && s.type !== "slime_big")) continue;
    if (dist(s.x, s.y, e.x, e.y) > SLIME_KING.absorbRange) continue;
    s.dead = true; // absorbé : pas de récompense
    createParticles(s.x, s.y, SLIME_GREEN, 6);
    eaten++;
  }
  if (eaten > 0) {
    const heal = SLIME_KING.absorbHeal * eaten;
    e.health = Math.min(e.maxHealth, e.health + e.maxHealth * heal);
    addFloatingText(e.x, e.y - e.size - 10, `ABSORPTION +${Math.round(heal * 100)}%`, SLIME_GREEN, 20, 60);
    return;
  }
  for (let i = 0; i < SLIME_KING.reinforcements; i++) {
    const a = (Math.PI * 2 * i) / SLIME_KING.reinforcements;
    spawnEnemy("slime_small", e.x + Math.cos(a) * e.size * 1.4, e.y + Math.sin(a) * e.size * 1.4);
  }
  addFloatingText(e.x, e.y - e.size - 10, "RENFORTS !", SLIME_GREEN, 20, 50);
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

    // Les gros projectiles (crabe, Sentinelle) éclatent après un délai
    if (p.splitIn !== undefined && --p.splitIn <= 0) {
      const count = p.splitCount ?? 4;
      const offset = p.splitCount ? Math.atan2(p.vy, p.vx) : 0;
      for (let k = 0; k < count; k++) {
        fireEnemyProjectile(p.x, p.y, offset + (Math.PI * 2 * k) / count, 5, {
          size: 8,
          damage: p.damage,
          color: p.splitColor ?? "#ff6600",
        });
      }
      p.dead = true;
      continue;
    }

    const d = dist(p.x, p.y, player.worldX, player.worldY);
    if (d < player.size + p.size * 0.5) {
      if (!isProtected()) {
        takeDamage(p.damage);
        if (p.slow) freezePlayer(p.slow);
        if (p.stun) stunPlayer(p.stun);
      }
      p.dead = true;
    } else if (d > 700) {
      p.dead = true;
    }
  }
  removeWhere(list, (p) => p.dead);
}
