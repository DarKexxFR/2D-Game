// Événements aléatoires sur la carte : pluie d'astéroïdes, pluie acide, trou noir, pluie d'étoiles.
// Annoncés par un bandeau, puis chaque impact est marqué au sol avant de tomber (zones rondes de
// systems/hazards.js). Jamais pendant un combat de boss ni en Boss Rush. Réglages : MAP_EVENTS.

import { MAP_EVENTS, TICK_MS } from "../config.js";
import { emit } from "../core/events.js";
import { game, player, world } from "../core/state.js";
import { WAVE_SCALING } from "../data/enemies.js";
import { angleTo, dist, weightedPick } from "../utils/math.js";
import { damageEnemy } from "./combat.js";
import { createParticles } from "./effects.js";
import { addCircle, registerImpact } from "./hazards.js";
import { arenaPointNear, createGem, dropLootBox } from "./pickups.js";
import { isProtected, takeDamage } from "./player.js";
import { bossFight, waveMultipliers } from "./spawner.js";

export const EVENT_TYPES = ["asteroids", "acid", "vortex", "stars"];

export function updateMapEvents() {
  if (game.rush || bossFight()) {
    game.mapEvent = null; // le boss arrive : l'événement s'arrête (les impacts annoncés tombent quand même)
    return;
  }
  const ev = game.mapEvent;
  if (!ev) {
    if (game.wave >= MAP_EVENTS.fromWave && --game.eventTimer <= 0) startMapEvent();
    return;
  }
  if (ev.warn > 0) {
    ev.warn--;
    return;
  }
  ev.tick++;
  if (ev.tick >= MAP_EVENTS[ev.type].duration) return endMapEvent();
  UPDATERS[ev.type](ev, MAP_EVENTS[ev.type]);
}

/** Lance un événement (tiré au hasard selon `weight`, ou `type` imposé). */
export function startMapEvent(type = weightedPick(EVENT_TYPES, (t) => MAP_EVENTS[t].weight)) {
  const cfg = MAP_EVENTS[type];
  const ev = { type, warn: MAP_EVENTS.warning, tick: 0 };
  if (type === "vortex") {
    // Le trou noir s'ouvre à côté du joueur, dans la zone de combat
    const a = Math.random() * Math.PI * 2;
    Object.assign(
      ev,
      arenaPointNear(
        player.worldX + Math.cos(a) * cfg.distance,
        player.worldY + Math.sin(a) * cfg.distance,
        0,
      ),
    );
    ev.hit = 0;
    ev.grind = 0;
  }
  game.mapEvent = ev;
  emit("mapEvent", cfg);
}

function endMapEvent() {
  game.mapEvent = null;
  const [min, max] = MAP_EVENTS.interval;
  game.eventTimer = min + Math.floor(Math.random() * (max - min));
}

/** Point d'impact : sur le joueur (part `aimed`) ou au hasard autour de lui. */
function impactPoint(cfg) {
  if (Math.random() < cfg.aimed) return arenaPointNear(player.worldX, player.worldY, 60);
  return arenaPointNear(player.worldX, player.worldY, cfg.spread * 2);
}

function radius(cfg) {
  const [min, max] = cfg.radius;
  return min + Math.random() * (max - min);
}

// Effets à l'impact, en données simples dans la zone (la partie reste sauvegardable)

/** Dégâts d'un impact aux ennemis dessous (proportionnels aux PV de la vague). */
registerImpact("hitEnemies", (h, { damage }) => {
  for (const e of world.enemies) {
    if (e.dead || e.template.isBoss) continue;
    if (dist(e.x, e.y, h.x, h.y) < h.radius + e.size * 0.5) damageEnemy(e, damage, "event");
  }
});

/** Étoile filante : gemme d'XP, et parfois une boîte de soin. */
registerImpact("star", (h, { xp, healChance }) => {
  createGem(h.x, h.y, xp);
  createParticles(h.x, h.y, "#ffffff", 8);
  if (Math.random() < healChance) dropLootBox(h.x, h.y);
});

const UPDATERS = {
  asteroids(ev, cfg) {
    if (ev.tick % cfg.every !== 0) return;
    const { x, y } = impactPoint(cfg);
    const enemyDamage = cfg.enemyDamage * waveMultipliers(game.wave).health;
    addCircle(x, y, radius(cfg), cfg.damage * waveMultipliers(game.wave).damage, {
      delay: cfg.delay,
      color: cfg.color,
      fall: "rock",
      impact: { type: "hitEnemies", damage: enemyDamage },
    });
  },

  acid(ev, cfg) {
    if (ev.tick % cfg.every !== 0) return;
    const { x, y } = impactPoint(cfg);
    const enemyDamage = cfg.enemyDamage * waveMultipliers(game.wave).health;
    addCircle(x, y, radius(cfg), cfg.damage * waveMultipliers(game.wave).damage, {
      delay: cfg.delay,
      color: cfg.color,
      pool: cfg.pool,
      slow: cfg.slow,
      fall: "drop",
      impact: { type: "hitEnemies", damage: enemyDamage },
    });
  },

  stars(ev, cfg) {
    if (ev.tick % cfg.every !== 0) return;
    const { x, y } = impactPoint(cfg);
    const xp = cfg.xp * (1 + game.wave * WAVE_SCALING.xp);
    addCircle(x, y, radius(cfg), 0, {
      delay: cfg.delay,
      color: cfg.color,
      fall: "star",
      impact: { type: "star", xp, healChance: cfg.healChance },
    });
  },

  /** Trou noir : aspire joueur et ennemis vers son centre, qui broie ce qui s'y trouve. */
  vortex(ev, cfg) {
    const grind = cfg.enemyDamage * waveMultipliers(game.wave).health;
    const grinding = game.time - ev.grind >= 15 * TICK_MS;
    if (grinding) ev.grind = game.time;
    for (const e of world.enemies) {
      if (e.dead || e.template.isBoss || e.submerged) continue;
      const d = dist(e.x, e.y, ev.x, ev.y);
      if (d > cfg.radius) continue;
      if (d < cfg.core + e.size * 0.5) {
        if (grinding) damageEnemy(e, grind, "event");
        continue;
      }
      const a = angleTo(e.x, e.y, ev.x, ev.y);
      const pull = Math.min(d, cfg.enemyPull);
      e.x += Math.cos(a) * pull;
      e.y += Math.sin(a) * pull;
    }
    pullPlayer(ev, cfg);
  },
};

function pullPlayer(ev, cfg) {
  const d = dist(player.worldX, player.worldY, ev.x, ev.y);
  if (d > cfg.radius || isProtected()) return;
  if (d < cfg.core + player.size * 0.5) {
    if (game.time - ev.hit < 30 * TICK_MS) return;
    ev.hit = game.time;
    takeDamage(cfg.damage * waveMultipliers(game.wave).damage, "vortex");
    return;
  }
  // Plus fort près du centre, toujours plus faible que la vitesse du vaisseau
  const pull = Math.min(d, cfg.pull * (0.5 + 0.5 * (1 - d / cfg.radius)));
  const a = angleTo(player.worldX, player.worldY, ev.x, ev.y);
  player.worldX += Math.cos(a) * pull;
  player.worldY += Math.sin(a) * pull;
}
