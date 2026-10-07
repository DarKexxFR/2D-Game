// Familiers : suivent le joueur et agissent seuls selon leur type.

import { game, pet, player } from "../core/state.js";
import { angleTo, dist } from "../utils/math.js";
import { damageEnemy, enemyGrid, getNearestEnemy, spawnProjectile } from "./combat.js";
import { addFloatingText, createHealEffect } from "./effects.js";
import { heal } from "./player.js";

const DRONE_RANGE = 300;
const DRONE_PROJECTILE_SPEED = 8;
const REAPER_SPIN = 0.06; // radians par tick
const REAPER_BLADE = 16; // rayon de la lame
const REAPER_HIT_COOLDOWN = 400; // ms entre deux coups sur le même ennemi

const BEHAVIORS = { drone: updateDrone, medic: updateMedic, reaper: updateReaper, collector: follow };

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
  const angle = angleTo(pet.x, pet.y, target.x, target.y);
  spawnProjectile({
    x: pet.x,
    y: pet.y,
    vx: Math.cos(angle) * DRONE_PROJECTILE_SPEED,
    vy: Math.sin(angle) * DRONE_PROJECTILE_SPEED,
    size: 4,
    damage: pet.power.damage,
    color: pet.color,
    source: "pet",
  });
}

function updateMedic() {
  follow();
  if (game.time - pet.lastAction <= pet.power.cooldown) return;
  pet.lastAction = game.time;
  if (player.health >= player.maxHealth) return;
  heal(pet.power.heal);
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
    damageEnemy(e, pet.power.damage, "pet");
  }
}
