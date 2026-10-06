// Drone de combat acheté dans la boutique : suit le joueur et tire seul.

import { DRONE } from "../config.js";
import { game, pet, player } from "../core/state.js";
import { angleTo } from "../utils/math.js";
import { getNearestEnemy, spawnProjectile } from "./combat.js";

export function updatePet() {
  if (!pet.active) return;
  pet.x += (player.worldX - 40 - pet.x) * 0.08;
  pet.y += (player.worldY - 40 - pet.y) * 0.08;

  if (game.time - pet.lastShot <= pet.cooldown) return;
  const target = getNearestEnemy(pet.x, pet.y, pet.range);
  if (!target) return;

  pet.lastShot = game.time;
  const angle = angleTo(pet.x, pet.y, target.x, target.y);
  spawnProjectile({
    x: pet.x,
    y: pet.y,
    vx: Math.cos(angle) * DRONE.projectileSpeed,
    vy: Math.sin(angle) * DRONE.projectileSpeed,
    size: 4,
    damage: pet.damage,
    color: "#00ff88",
  });
}
