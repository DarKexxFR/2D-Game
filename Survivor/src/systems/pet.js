// Familiers : suivent le joueur et agissent seuls selon leur type.

import { TICK_MS } from "../config.js";
import { game, pet, player, world } from "../core/state.js";
import { angleTo, dist } from "../utils/math.js";
import { damageEnemy, enemyGrid, getNearestEnemy, spawnProjectile } from "./combat.js";
import { addFloatingText, createHealEffect, createParticles, createShockwave } from "./effects.js";
import { playSfx } from "../services/sfx.js";
import { heal } from "./player.js";
import { perk } from "./perks.js";
import { knockEnemy } from "./knockback.js";

const DRONE_RANGE = 300;
const DRONE_PROJECTILE_SPEED = 8;
const REAPER_SPIN = 0.06; // radians par tick
const REAPER_BLADE = 16; // rayon de la lame
const REAPER_HIT_COOLDOWN = 400; // ms entre deux coups sur le même ennemi

const FROST = { range: 240, targets: 3 };
const DRAGON = { range: 360, fireballs: 5, spread: 0.18, speed: 7, explosion: 40 };
const PHOENIX = { range: 420, speed: 12, size: 9, life: 55 };

const BEHAVIORS = {
  drone: updateDrone,
  medic: updateMedic,
  reaper: updateReaper,
  collector: follow,
  frost: updateFrost,
  guardian: updateGuardian,
  dragon: updateDragon,
  phoenix: updatePhoenix,
};

/** Le familier est-il prêt à agir (délai écoulé) ? Le cas échéant, relance son délai. */
function ready() {
  if (game.time - pet.lastAction <= pet.power.cooldown) return false;
  pet.lastAction = game.time;
  return true;
}

export function updatePet() {
  if (!pet.active) return;
  BEHAVIORS[pet.kind]?.();
}

/** Flotte derrière le joueur. */
function follow() {
  pet.x += (player.worldX - 40 - pet.x) * 0.08;
  pet.y += (player.worldY - 40 - pet.y) * 0.08;
}

function updateDrone() {
  follow();
  if (game.time - pet.lastAction <= pet.power.cooldown) return;
  const target = getNearestEnemy(pet.x, pet.y, DRONE_RANGE);
  if (!target) return;
  pet.lastAction = game.time;
  playSfx("petLaser");
  const angle = angleTo(pet.x, pet.y, target.x, target.y);
  const shots = perk("drone")?.shots || 1;
  for (let i = 0; i < shots; i++) {
    const a = angle + (i - (shots - 1) / 2) * 0.12;
    spawnProjectile({
      x: pet.x,
      y: pet.y,
      vx: Math.cos(a) * DRONE_PROJECTILE_SPEED,
      vy: Math.sin(a) * DRONE_PROJECTILE_SPEED,
      size: 4,
      damage: pet.power.damage,
      color: pet.color,
      source: "pet",
    });
  }
}

function updateMedic() {
  follow();
  const urgent = perk("medic");
  const cooldown =
    urgent && player.health < player.maxHealth * urgent.below ? pet.power.cooldown / 2 : pet.power.cooldown;
  if (game.time - pet.lastAction <= cooldown) return;
  pet.lastAction = game.time;
  if (player.health >= player.maxHealth) return;
  heal(pet.power.heal);
  playSfx("petHeal");
  createHealEffect(player.worldX, player.worldY);
  addFloatingText(player.worldX, player.worldY - 30, `+${Math.round(pet.power.heal)}`, pet.color, 14, 40);
}

/** Faucheuse : tourne autour du joueur et tranche les ennemis touchés. */
function updateReaper() {
  pet.angle += REAPER_SPIN;
  pet.x = player.worldX + Math.cos(pet.angle) * pet.power.radius;
  pet.y = player.worldY + Math.sin(pet.angle) * pet.power.radius;
  for (const e of enemyGrid.query(pet.x, pet.y, REAPER_BLADE).slice()) {
    if (e.dead || dist(e.x, e.y, pet.x, pet.y) >= e.size + REAPER_BLADE) continue;
    if (game.time - (e.reaperHit ?? -1e9) < REAPER_HIT_COOLDOWN) continue;
    e.reaperHit = game.time;
    playSfx("petSlash");
    damageEnemy(e, pet.power.damage, "pet");
    if (perk("reaper")) heal(perk("reaper").heal);
  }
}

/** Cristal de givre : gèle sur place les ennemis les plus proches. */
function updateFrost() {
  follow();
  if (game.time - pet.lastAction <= pet.power.cooldown) return;
  const targets = world.enemies
    .filter((e) => !e.dead && dist(e.x, e.y, pet.x, pet.y) < FROST.range)
    .sort((a, b) => dist(a.x, a.y, pet.x, pet.y) - dist(b.x, b.y, pet.x, pet.y))
    .slice(0, perk("frost")?.targets || FROST.targets);
  if (targets.length === 0) return;
  pet.lastAction = game.time;
  playSfx("petLaser");
  for (const e of targets) {
    // Les boss résistent : gel bien plus court
    e.stun = Math.max(e.stun || 0, Math.round(e.template.isBoss ? pet.power.freeze / 4 : pet.power.freeze));
    e.frozenUntil = game.time + e.stun * TICK_MS; // gelé (synergie Cristal de givre + Railgun)
    createParticles(e.x, e.y, pet.color, 6);
    world.bolts.push({
      points: [
        { x: pet.x, y: pet.y },
        { x: e.x, y: e.y },
      ],
      color: pet.color,
      life: 8,
    });
    damageEnemy(e, pet.power.damage, "pet");
  }
}

/** Gardien : bouclier régulier autour du joueur. */
function updateGuardian() {
  follow();
  if (!ready()) return;
  player.buffs.shield = Math.max(player.buffs.shield, Math.round(pet.power.shield));
  createShockwave(player.worldX, player.worldY, 60, pet.color);
  const rampart = perk("guardian");
  if (rampart) {
    createShockwave(player.worldX, player.worldY, rampart.radius, pet.color);
    for (const e of enemyGrid.query(player.worldX, player.worldY, rampart.radius)) {
      if (e.dead) continue;
      knockEnemy(e, angleTo(player.worldX, player.worldY, e.x, e.y), rampart.push);
    }
  }
  playSfx("petHeal");
}

/** Dragonnet : crache une gerbe de boules de feu explosives vers l'ennemi le plus proche. */
function updateDragon() {
  follow();
  if (game.time - pet.lastAction <= pet.power.cooldown) return;
  const target = getNearestEnemy(pet.x, pet.y, DRAGON.range);
  if (!target) return;
  pet.lastAction = game.time;
  playSfx("explosion");
  const base = angleTo(pet.x, pet.y, target.x, target.y);
  pet.angle = base;
  const count = perk("dragon")?.fireballs || DRAGON.fireballs;
  for (let i = 0; i < count; i++) {
    const a = base + (i - (count - 1) / 2) * DRAGON.spread;
    spawnProjectile({
      x: pet.x,
      y: pet.y,
      vx: Math.cos(a) * DRAGON.speed,
      vy: Math.sin(a) * DRAGON.speed,
      size: 6,
      damage: pet.power.damage,
      color: pet.color,
      explosion: DRAGON.explosion,
      life: 50,
      source: "pet",
    });
  }
}

/** Phénix : crache un rayon de feu qui traverse tout (la résurrection est gérée par l'équipement). */
function updatePhoenix() {
  follow();
  if (game.time - pet.lastAction <= pet.power.cooldown) return;
  const target = getNearestEnemy(pet.x, pet.y, PHOENIX.range);
  if (!target) return;
  pet.lastAction = game.time;
  playSfx("explosion");
  const a = angleTo(pet.x, pet.y, target.x, target.y);
  pet.angle = a;
  spawnProjectile({
    x: pet.x,
    y: pet.y,
    vx: Math.cos(a) * PHOENIX.speed,
    vy: Math.sin(a) * PHOENIX.speed,
    size: PHOENIX.size,
    damage: pet.power.damage,
    color: pet.color,
    pierce: 99,
    life: PHOENIX.life,
    burn: perk("phoenix")?.burn, // Phénix ★3 : enflamme
    source: "pet",
  });
}
