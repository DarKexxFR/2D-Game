// Mère-Ruche : elle plante des fleurs toxiques (`hive_flower`, parties du boss) dont le poison
// s'étend au sol autour d'elles. Tant que des fleurs vivent, la reine a une carapace qui réduit les
// dégâts reçus (`e.armor`, lu par damageEnemy) : il faut faucher le jardin pour l'atteindre.
// Pollen à tête chercheuse et nuée en spirale.

import { game, player } from "../../core/state.js";
import { HIVE as H } from "../../data/bosses.js";
import { TICK_MS } from "../../config.js";
import { dist } from "../../utils/math.js";
import { addScreenShake } from "../effects.js";
import { addCircle } from "../hazards.js";
import { clampToZone } from "../arena.js";
import { isProtected, takeDamage } from "../player.js";
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

const TOXIC = "#9dff3d";
const POLLEN = "#ffe14d";

export function updateHiveQueen(e) {
  e.flowers ??= [];
  e.planting ??= [];
  enrage(e, "#ff9d1f", 1.25, "ESSAIMAGE !");
  if (pruneParts(e.flowers) > 0) shout(e, "FLEUR FAUCHÉE !", TOXIC);
  plantPending(e);
  updateCarapace(e);
  if (--e.attackTimer > 0) return;
  e.attackTimer = H.attackEvery * (e.enraged ? 0.75 : 1);
  let attack = nextAttack(e, H.cycle);
  if (attack === "bloom" && e.flowers.length + e.planting.length >= H.maxFlowers) attack = "pollen";
  if (attack === "bloom") bloom(e);
  else if (attack === "pollen") pollen(e);
  else swirl(e);
}

/**
 * Fleur toxique : immobile, son poison s'étend peu à peu autour d'elle et blesse le joueur qui s'y
 * tient. Elle fane avec la reine.
 */
export function updateHiveFlower(e) {
  e.rooted = 1;
  if (orphaned(e)) return;
  const a = H.aura;
  e.aura = Math.min(a.max, (e.aura ?? a.start) + a.grow);
  if (game.time - (e.auraHit ?? -1e9) < a.tick * TICK_MS) return;
  if (dist(player.worldX, player.worldY, e.x, e.y) > e.aura + player.size * 0.5) return;
  e.auraHit = game.time;
  if (!isProtected()) takeDamage(e.owner.damage * a.damage, e.owner);
}

/** Carapace : un cran par fleur en vie (plafonné), affichée sur la barre de vie du boss. */
function updateCarapace(e) {
  const per = e.enraged ? H.armorPerFlowerEnraged : H.armorPerFlower;
  e.armor = Math.min(H.maxArmor, e.flowers.length * per);
  e.barTag = e.armor > 0 ? `CARAPACE ${Math.round(e.armor * 100)} %` : "";
}

/** Floraison : zones annoncées autour du joueur, d'où sortent les fleurs. */
function bloom(e) {
  const count = Math.min(e.enraged ? H.flowersEnraged : H.flowers, H.maxFlowers - e.flowers.length);
  const offset = Math.random() * Math.PI * 2;
  for (let k = 0; k < count; k++) {
    const a = offset + (Math.PI * 2 * k) / count;
    const at = clampToZone(
      player.worldX + Math.cos(a) * H.plantRadius,
      player.worldY + Math.sin(a) * H.plantRadius,
      60,
    );
    addCircle(at.x, at.y, 55, e.damage * 0.5, { delay: H.plantDelay, color: TOXIC });
    e.planting.push({ ...at, in: H.plantDelay });
  }
  shout(e, "FLORAISON !", TOXIC, 20, 50);
}

/** Les fleurs annoncées sortent de terre à la fin de leur alerte. */
function plantPending(e) {
  for (let i = e.planting.length - 1; i >= 0; i--) {
    const p = e.planting[i];
    if (--p.in > 0) continue;
    e.planting.splice(i, 1);
    const f = spawnPart(e, "hive_flower", p.x, p.y);
    f.health = f.maxHealth = e.maxHealth * H.flowerHealth;
    e.flowers.push(f);
    addScreenShake(3);
  }
}

/** Pollen : boules lentes qui suivent le joueur (le dash les fait passer à côté). */
function pollen(e) {
  const p = H.pollen;
  const count = e.enraged ? p.countEnraged : p.count;
  const base = aim(e);
  for (let k = 0; k < count; k++) {
    fireEnemyProjectile(e.x, e.y, base + (k - (count - 1) / 2) * 0.45, p.speed, {
      size: 11,
      damage: e.damage * p.damage,
      color: POLLEN,
      homing: p.homing,
      life: p.life,
    });
  }
  shout(e, "POLLEN !", POLLEN);
}

/** Nuée : couronne de dards qui s'éloigne en spirale. */
function swirl(e) {
  const s = H.swirl;
  const count = e.enraged ? s.countEnraged : s.count;
  const offset = Math.random() * Math.PI * 2;
  const dir = Math.random() < 0.5 ? -1 : 1;
  for (let k = 0; k < count; k++) {
    fireEnemyProjectile(e.x, e.y, offset + (Math.PI * 2 * k) / count, s.speed, {
      size: 8,
      damage: e.damage * s.damage,
      color: "#ffcc33",
      turn: s.turn * dir,
      life: 200,
    });
  }
  shout(e, "NUÉE !", "#ffcc33");
}
