// Outils partagés par tous les boss (systems/enemies.js et systems/bosses/*.js) : visée, cycle
// d'attaques, passage en furie, tirs ennemis et parties de boss (tentacules, segments, fleurs...).

import { player, world } from "../../core/state.js";
import { playSfx } from "../../services/sfx.js";
import { angleTo } from "../../utils/math.js";
import { addFloatingText, addScreenShake, createParticles } from "../effects.js";
import { spawnEnemy } from "../spawner.js";

/** Angle du boss vers le joueur. */
export const aim = (e) => angleTo(e.x, e.y, player.worldX, player.worldY);

/** Attaque suivante dans le cycle du boss. */
export function nextAttack(e, cycle) {
  e.turn = ((e.turn ?? -1) + 1) % cycle.length;
  return cycle[e.turn];
}

/** Passage en furie (une seule fois, sous 50 % de vie) : couleur, vitesse et annonce. */
export function enrage(e, color, speedMult, text) {
  if (e.enraged || e.health >= e.maxHealth * 0.5) return false;
  e.enraged = true;
  e.color = color;
  e.speed = e.baseSpeed = e.baseSpeed * speedMult;
  addFloatingText(e.x, e.y - e.size - 20, text, color, 26, 80);
  addScreenShake(12);
  playSfx("boss");
  return true;
}

/** Annonce au-dessus du boss (nom d'attaque). */
export function shout(e, text, color = e.color, size = 18, life = 40) {
  addFloatingText(e.x, e.y - e.size - 10, text, color, size, life);
}

/**
 * Tir ennemi. Options lues par updateEnemyProjectiles (systems/enemies.js) : size, damage, color,
 * life, slow, stun, turn (courbe), homing (suit le joueur), splitIn / splitCount / splitColor, from.
 */
export function fireEnemyProjectile(x, y, angle, speed, props) {
  world.enemyProjectiles.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    dead: false,
    ...props,
  });
}

/**
 * Fait apparaître une partie de boss (tentacule, segment, fleur, clone...) rattachée à `owner` :
 * elle meurt avec lui (voir `orphaned`). Renvoie l'ennemi créé.
 */
export function spawnPart(owner, type, x, y) {
  spawnEnemy(type, x, y);
  const part = world.enemies[world.enemies.length - 1];
  part.owner = owner;
  return part;
}

/** Partie de boss dont le boss est mort : elle disparaît (sans récompense). Renvoie vrai si c'est le cas. */
export function orphaned(e) {
  if (e.owner && !e.owner.dead) return false;
  e.dead = true;
  createParticles(e.x, e.y, e.color, 10);
  return true;
}

/** Retire les parties mortes d'une liste et renvoie combien sont tombées depuis le dernier appel. */
export function pruneParts(list) {
  const before = list.length;
  for (let i = list.length - 1; i >= 0; i--) if (list[i].dead) list.splice(i, 1);
  return before - list.length;
}
