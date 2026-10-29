// Forgeronne stellaire : enclumes qui tombent sur le joueur (zones annoncées, flaques de métal en fusion),
// drones de forge (`forge_drone`, parties du boss) qu'elle soude ensuite en un colosse (`forge_golem`),
// gerbes d'étincelles. En furie (« FOURNAISE »), chaque attaque libère aussi une onde de chaleur.

import { player } from "../../core/state.js";
import { FORGE as F } from "../../data/bosses.js";
import { addScreenShake, createParticles } from "../effects.js";
import { addCircle, addRing } from "../hazards.js";
import { clampToZone } from "../arena.js";
import {
  aim,
  enrage,
  fireEnemyProjectile,
  nextAttack,
  orphaned,
  pruneParts,
  shout,
  spawnPart,
} from "./kit.js";

const MOLTEN = "#ff7a1a";

export function updateForge(e) {
  e.drones ??= [];
  enrage(e, "#ff3b1a", 1.2, "FOURNAISE !");
  pruneParts(e.drones);
  if (e.weldIn > 0 && --e.weldIn === 0) weldDrones(e);
  if (--e.attackTimer > 0) return;
  e.attackTimer = F.attackEvery * (e.enraged ? 0.8 : 1);
  let attack = nextAttack(e, F.cycle);
  if (attack === "weld" && e.drones.length < F.weld.min) attack = "sparks";
  if (attack === "drones" && e.drones.length >= F.drones.max) attack = "anvils";
  if (attack === "anvils") anvils(e);
  else if (attack === "drones") drones(e);
  else if (attack === "weld") startWeld(e);
  else sparks(e);
  if (e.enraged) addRing(e.x, e.y, F.furnace.max, e.damage * F.furnace.damage, { color: MOLTEN, speed: 5 });
}

/** Drone de forge et colosse forgé : ils foncent sur le joueur et tombent avec la Forgeronne. */
export function updateForgePart(e) {
  orphaned(e);
}

/** Enclumes : la première tombe pile sur le joueur, les autres autour ; le métal reste au sol. */
function anvils(e) {
  const a = F.anvils;
  const count = e.enraged ? a.countEnraged : a.count;
  for (let k = 0; k < count; k++) {
    const off = k === 0 ? 0 : a.spread * (0.4 + Math.random() * 0.6);
    const ang = Math.random() * Math.PI * 2;
    const at = clampToZone(
      player.worldX + Math.cos(ang) * off,
      player.worldY + Math.sin(ang) * off,
      a.radius,
    );
    addCircle(at.x, at.y, a.radius, e.damage * a.damage, { delay: a.delay, color: MOLTEN, pool: a.pool });
  }
  shout(e, "ENCLUMES !", MOLTEN, 20, 50);
}

/** Drones : une couronne de petits drones qui sortent de la forge. */
function drones(e) {
  const d = F.drones;
  const count = Math.min(e.enraged ? d.countEnraged : d.count, d.max - e.drones.length);
  for (let k = 0; k < count; k++) {
    const a = (Math.PI * 2 * k) / count;
    const at = clampToZone(e.x + Math.cos(a) * (e.size + 40), e.y + Math.sin(a) * (e.size + 40), 20);
    const drone = spawnPart(e, "forge_drone", at.x, at.y);
    drone.health = drone.maxHealth = e.maxHealth * d.health;
    e.drones.push(drone);
  }
  shout(e, "FORGE !", "#ffb35c");
}

/** Soudure annoncée : les drones s'immobilisent en brillant, puis fusionnent. */
function startWeld(e) {
  e.weldIn = F.weld.warn;
  for (const d of e.drones) {
    if (d.type !== "forge_drone") continue;
    d.rooted = F.weld.warn;
    d.welding = true;
  }
  shout(e, "SOUDURE...", "#ffd27a", 20, 50);
}

/** Les drones encore en vie se soudent en un colosse au milieu d'eux (PV cumulés). */
function weldDrones(e) {
  const parts = e.drones.filter((d) => !d.dead && d.type === "forge_drone");
  if (parts.length < F.weld.min) {
    for (const d of parts) d.welding = false;
    return;
  }
  let x = 0;
  let y = 0;
  let health = 0;
  for (const d of parts) {
    x += d.x / parts.length;
    y += d.y / parts.length;
    health += d.health;
    d.dead = true; // soudé : pas de récompense
    createParticles(d.x, d.y, d.color, 6);
  }
  const golem = spawnPart(e, "forge_golem", x, y);
  golem.health = golem.maxHealth = health * F.weld.health;
  e.drones.push(golem);
  createParticles(x, y, "#ffd27a", 25);
  addScreenShake(8);
  shout(e, "COLOSSE FORGÉ !", "#ffd27a", 22, 60);
}

/** Étincelles : trois gerbes de métal fondu en éventail vers le joueur. */
function sparks(e) {
  const s = F.sparks;
  const base = aim(e);
  for (let i = 0; i < s.streams; i++) {
    const a = base + (i - (s.streams - 1) / 2) * s.spread;
    for (let k = 0; k < s.bullets; k++) {
      fireEnemyProjectile(e.x, e.y, a + (Math.random() - 0.5) * 0.08, s.speed + k * s.step, {
        size: 8,
        damage: e.damage * s.damage,
        color: "#ffc35c",
      });
    }
  }
  shout(e, "ÉTINCELLES !", "#ffc35c");
}
