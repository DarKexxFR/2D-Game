// Effets des cartes d'amélioration à comportement (Givre, Ricochet, Bouclier d'énergie, Dash explosif,
// Arc électrique, Pulsar, Surtension) et de leurs évolutions (Zéro absolu, Tempête stellaire).
// Réglages dans data/cardEffects.js ; le nombre de cartes prises vit sur `player` (propre à chaque
// partie d'un duel). Appelé par systems/combat.js (tirs, coups, éliminations) et systems/player.js.

import { TICK_MS } from "../config.js";
import { game, player } from "../core/state.js";
import { CARD_EFFECTS as C } from "../data/cardEffects.js";
import { angleTo, dist } from "../utils/math.js";
import { chainLightning, damageEnemy, enemyGrid, explode } from "./combat.js";
import { addFloatingText, createParticles, createShockwave } from "./effects.js";

/** Tir de l'arme équipée qui part : rebonds (Ricochet) et tir géant (Pulsar). */
export function onCardShot(proj) {
  proj.bounces = player.ricochet;
  if (player.pulsar <= 0) return;
  const every = Math.max(2, C.pulsar.every - (player.pulsar - 1));
  if (++player.shotCount % every !== 0) return;
  proj.size *= C.pulsar.size;
  proj.damage *= C.pulsar.damage;
  proj.pierce += C.pulsar.pierce;
  proj.color = C.pulsar.color;
  proj.giant = true;
  if (player.evolutions.stellarStorm) proj.explosion = Math.max(proj.explosion, C.stellarStorm.explosion);
}

/** Bonus de dégâts sur la cible (Zéro absolu : ennemi gelé). */
export function cardDamageMult(enemy) {
  return player.evolutions.absoluteZero && enemy.stun > 0 ? 1 + C.absoluteZero.bonus : 1;
}

/** Tir de l'arme qui touche : ralenti (Givre), gel (Zéro absolu), éclair (Arc électrique). */
export function onCardHit(enemy, damage) {
  if (player.frost > 0 && !enemy.dead) {
    const factor = 1 - C.frost.slow * player.frost;
    enemy.slowFactor = enemy.slowUntil > game.time ? Math.min(enemy.slowFactor, factor) : factor;
    enemy.slowUntil = Math.max(enemy.slowUntil || 0, game.time + C.frost.ticks * TICK_MS);
    if (player.evolutions.absoluteZero) freeze(enemy);
  }
  if (player.arc > 0 && !enemy.dead && Math.random() < C.arc.chance * player.arc) {
    chainLightning(enemy, damage * C.arc.damage, C.arc.jumps, C.arc.color, "arc");
  }
}

/** Zéro absolu : gel net (les boss ne sont que ralentis), au plus une fois par `cooldown` par ennemi. */
function freeze(enemy) {
  const z = C.absoluteZero;
  if (enemy.template.isBoss) {
    enemy.slowFactor = Math.min(enemy.slowFactor, z.bossSlow);
    return;
  }
  if (game.time < (enemy.freezeReadyAt ?? 0)) return;
  enemy.freezeReadyAt = game.time + (z.freeze + z.cooldown) * TICK_MS;
  enemy.stun = Math.max(enemy.stun || 0, z.freeze);
  createParticles(enemy.x, enemy.y, C.frost.color, 4);
}

/**
 * Ricochet : le tir qui allait s'arrêter sur `enemy` repart vers l'ennemi le plus proche pas encore
 * touché. Renvoie vrai s'il a rebondi.
 */
export function ricochet(proj, enemy) {
  if (!(proj.bounces > 0)) return false;
  let next = null;
  let best = C.ricochet.range;
  for (const e of enemyGrid.query(enemy.x, enemy.y, C.ricochet.range)) {
    if (e === enemy || e.dead || proj.hits?.has(e)) continue;
    const d = dist(e.x, e.y, enemy.x, enemy.y);
    if (d < best) {
      best = d;
      next = e;
    }
  }
  if (!next) return false;
  proj.bounces--;
  (proj.hits ??= new Set()).add(enemy);
  const speed = Math.hypot(proj.vx, proj.vy);
  const a = angleTo(proj.x, proj.y, next.x, next.y);
  proj.vx = Math.cos(a) * speed;
  proj.vy = Math.sin(a) * speed;
  proj.damage *= C.ricochet.damage;
  if (proj.life !== Infinity) proj.life = Math.max(proj.life, 30);
  return true;
}

/** Élimination : Surtension, une nova toutes les N éliminations. */
export function onCardKill() {
  if (player.surge <= 0) return;
  const storm = player.evolutions.stellarStorm;
  const s = C.surge;
  const needed = Math.max(3, (s.kills - s.perCard * (player.surge - 1)) * (storm ? C.stellarStorm.kills : 1));
  if (++player.surgeKills < needed) return;
  player.surgeKills = 0;
  const r = s.radius * (storm ? C.stellarStorm.radius : 1) * player.projScale;
  const { worldX: x, worldY: y } = player;
  createShockwave(x, y, r, s.color);
  const damage = player.attack * s.damage;
  for (const e of enemyGrid.query(x, y, r).slice()) {
    if (!e.dead && dist(e.x, e.y, x, y) < r + e.size) damageEnemy(e, damage, "surge");
  }
}

/** Début d'un dash : Dash explosif. */
export function onCardDash() {
  if (player.dashBlast <= 0) return;
  const d = C.dashBlast;
  const r = (d.radius + d.radiusPerCard * (player.dashBlast - 1)) * player.projScale;
  explode(player.worldX, player.worldY, r, player.attack * d.damage * player.dashBlast, null, "dash");
}

/** Bouclier d'énergie : renvoie vrai si le coup est absorbé (puis il se recharge). */
export function absorbHit() {
  if (player.energyShield <= 0 || game.time < player.shieldReadyAt) return false;
  const e = C.energyShield;
  player.shieldReadyAt = game.time + Math.max(4, e.seconds - e.perCard * (player.energyShield - 1)) * 1000;
  addFloatingText(player.worldX, player.worldY - 30, "BLOQUÉ !", e.color, 16, 40);
  createShockwave(player.worldX, player.worldY, player.size + 30, e.color);
  return true;
}
