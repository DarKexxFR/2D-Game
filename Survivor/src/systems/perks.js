// Effets spéciaux de prestige ★3 et panoplies (données dans data/perks.js).
// Tout l'état vit sur `player` (échangé avec la partie de l'autre joueur en duel sur un écran).

import { TICK_MS } from "../config.js";
import { game, player, world } from "../core/state.js";
import { PERKS, PERK_PRESTIGE, SETS } from "../data/perks.js";
import { angleTo, dist } from "../utils/math.js";
import { chainLightning, damageEnemy, enemyGrid, spawnProjectile } from "./combat.js";
import { addFloatingText, createAoEEffect, createParticles, createShockwave } from "./effects.js";
import { chargeUltimate, heal } from "./player.js";

const BURN_STEP = 15; // ticks entre deux dégâts de brûlure

/** Effets actifs pour l'équipement de la partie : objets ★3+ et panoplie arme + armure. */
export function applyPerks(loadout) {
  const perks = {};
  for (const it of Object.values(loadout)) {
    if (it && it.prestige >= PERK_PRESTIGE && PERKS[it.id]) perks[it.id] = PERKS[it.id];
  }
  player.perks = perks;
  player.set = SETS.find((s) => loadout.weapon?.id === s.weapon && loadout.armor?.id === s.armor) || null;
  player.perkTimers = {};
  player.perkZones = [];
  applyStaticPerks(perks);
  applyStaticSet(player.set);
}

/** Paramètres de l'effet ★3 d'un objet s'il est actif, sinon null. */
export function perk(id) {
  return player.perks?.[id] || null;
}

function applyStaticPerks(p) {
  const w = player.weapon;
  if (p.rocket) w.explosion *= p.rocket.explosion;
  if (p.tesla) w.chain += p.tesla.chain;
  if (p.blades) w.returns = p.blades.returns;
  if (p.plated) player.damageTaken *= 1 - p.plated.reduce;
  if (p.titan) player.damageTaken *= 1 - p.titan.reduce;
  if (p.looter) player.xpBonus += p.looter.xp;
  if (p.collector) player.xpBonus += p.collector.xp;
  if (p.aegis) player.revives += p.aegis.revives;
  if (p.pilot) player.maxUltCharge = Math.round(player.maxUltCharge * p.pilot.charge);
  if (p.mage) player.auraMult *= p.mage.aura;
  if (p.critChip) player.critMultiplier += p.critChip.critMult;
  if (p.powerChip) player.bossDamage += p.powerChip.boss;
  if (p.lifeChip) player.healMult += p.lifeChip.heal;
}

function applyStaticSet(s) {
  if (!s) return;
  if (s.auraRadius) {
    player.auraRadius += s.auraRadius;
    player.auraDamage += s.auraDamage;
  }
  if (s.fireRate) player.attackSpeed /= 1 + s.fireRate;
  if (s.pierce) player.piercing += s.pierce;
  if (s.defense) player.defense += s.defense;
  if (s.explosionChance) player.explosionChance += s.explosionChance;
  if (s.gold) player.goldBonus += s.gold;
  if (s.xp) player.xpBonus += s.xp;
  if (s.speed) {
    player.baseSpeed *= 1 + s.speed;
    player.speed = player.baseSpeed;
  }
}

/** Délai écoulé pour un effet à recharge ? Le cas échéant, le relance. */
function ready(key, ms) {
  const t = player.perkTimers;
  if (game.time - (t[key] ?? -Infinity) < ms) return false;
  t[key] = game.time;
  return true;
}

function enemiesNear(x, y, radius) {
  return enemyGrid.query(x, y, radius).filter((e) => !e.dead && dist(e.x, e.y, x, y) < radius + e.size);
}

/** Enflamme un ennemi : dégâts réguliers (en multiple de l'attaque par seconde). */
export function ignite(enemy, burn) {
  const until = game.time + burn.ticks * TICK_MS;
  if (enemy.burn && enemy.burn.dps > burn.dps && enemy.burn.until > game.time) return;
  enemy.burn = { until, dps: burn.dps };
}

/** Une étoile s'abat sur un point : dégâts de zone. */
function starStrike(x, y, radius, damage) {
  createAoEEffect(x, y, radius);
  createParticles(x, y, "#ffd700", 10);
  world.bolts.push({
    points: [
      { x: x + 60, y: y - 320 },
      { x, y },
    ],
    color: "#ffe066",
    life: 10,
  });
  for (const e of enemiesNear(x, y, radius)) damageEnemy(e, player.attack * damage, "perk");
}

// --- ÉVÉNEMENTS ---

/** Tir de l'arme du joueur (projectile tout juste créé). */
export function onShot(proj) {
  const p = player.perks;
  if (p.blaster) {
    player.perkTimers.shots = (player.perkTimers.shots || 0) + 1;
    if (player.perkTimers.shots % p.blaster.every === 0) {
      proj.damage *= p.blaster.damage;
      proj.size *= p.blaster.size;
    }
  }
  if (p.railgun) proj.ramp = p.railgun.ramp;
}

/** Coup porté par un projectile du joueur. */
export function onHit(proj, enemy, damage, isCrit) {
  if (proj.burn) ignite(enemy, proj.burn);
  const p = player.perks;
  if (isCrit && p.quantum && Math.random() < p.quantum.chance) {
    chainLightning(enemy, damage * 0.6, p.quantum.chain, "#00ffcc", "perk");
  }
  if (proj.source || proj.type === "kunai") return; // le reste ne concerne que l'arme équipée
  for (const id of ["smg", "plasma", "flamer"]) {
    if (p[id] && Math.random() < p[id].chance) ignite(enemy, p[id].burn);
  }
  if (p.shotgun && Math.random() < p.shotgun.chance) {
    enemy.stun = Math.max(enemy.stun || 0, enemy.template.isBoss ? p.shotgun.stun / 3 : p.shotgun.stun);
  }
  if (p.disc && ready("discHeal", 150)) heal(p.disc.heal);
  if (p.nova && Math.random() < p.nova.chance) starStrike(enemy.x, enemy.y, p.nova.radius, p.nova.damage);
}

export function onKill(enemy) {
  const p = player.perks;
  if (!p) return;
  if (p.pirate && Math.random() < p.pirate.chance) {
    game.runGold += p.pirate.gold;
    addFloatingText(enemy.x, enemy.y - 20, `+${p.pirate.gold}`, "#ffd700", 13, 30);
  }
  if (p.fireChip && Math.random() < p.fireChip.chance) {
    player.buffs.frenzy = Math.max(player.buffs.frenzy, p.fireChip.ticks);
  }
}

export function onDash() {
  const p = player.perks;
  const { worldX: x, worldY: y } = player;
  if (p.suit) {
    player.buffs.haste = p.suit.ticks;
    player.hasteBonus = p.suit.speed;
  }
  if (p.cloak) player.perkTimers.trailUntil = game.time + player.dashDuration * TICK_MS;
  if (p.ninja)
    ring(p.ninja.count, {
      size: 7,
      damage: player.attack * p.ninja.damage,
      color: "#ff55cc",
      pierce: 2,
      type: "kunai",
    });
  if (p.seraph) heal(player.maxHealth * p.seraph.heal);
  if (p.overclock) for (let i = 0; i < p.overclock.charge; i++) chargeUltimate();
  if (player.set?.discs) {
    ring(player.set.discs, {
      size: 10,
      damage: player.attack * 1.2,
      color: "#00ff88",
      pierce: 99,
      returns: 30,
      life: 150,
      type: "disc",
      age: 0,
    });
  }
  createParticles(x, y, "#ffffff", 4);
}

/** Projectiles lancés tout autour du joueur. */
function ring(count, props) {
  const offset = Math.random() * Math.PI;
  for (let i = 0; i < count; i++) {
    const a = offset + (Math.PI * 2 * i) / count;
    spawnProjectile({
      x: player.worldX,
      y: player.worldY,
      vx: Math.cos(a) * 11,
      vy: Math.sin(a) * 11,
      source: "perk",
      ...props,
    });
  }
}

/** Le joueur vient d'encaisser un coup (et a survécu). */
export function onHurt() {
  const p = player.perks;
  if (!p || game.over) return;
  const { worldX: x, worldY: y } = player;
  if (p.vest && ready("vest", p.vest.cooldown)) {
    player.buffs.shield = Math.max(player.buffs.shield, p.vest.shield);
  }
  if (p.heavy && ready("heavy", p.heavy.cooldown)) {
    createShockwave(x, y, p.heavy.radius, "#cc8833");
    for (const e of enemiesNear(x, y, p.heavy.radius)) {
      const a = angleTo(x, y, e.x, e.y);
      if (!e.template.isBoss) {
        e.x += Math.cos(a) * p.heavy.push;
        e.y += Math.sin(a) * p.heavy.push;
      }
      damageEnemy(e, player.attack * p.heavy.damage, "perk");
    }
  }
  if (p.spiked && ready("spiked", p.spiked.cooldown)) {
    ring(p.spiked.count, {
      size: 6,
      damage: player.attack * p.spiked.damage,
      color: "#ff5577",
      pierce: 1,
      life: 40,
    });
  }
}

export function onLevelUp() {
  const p = player.perks?.xpChip;
  if (p) heal(player.maxHealth * p.heal);
}

export function onGem() {
  const p = player.perks?.magnetChip;
  if (p) heal(p.heal);
}

// --- CHAQUE TICK ---

export function updatePerks() {
  if (!player.perks) return;
  const p = player.perks;
  const tick = (player.perkTimers.tick = (player.perkTimers.tick || 0) + 1);
  const { worldX: x, worldY: y } = player;
  if (tick % BURN_STEP === 0) updateBurns();
  updateZones(tick);

  if (p.exo && player.health < player.maxHealth * p.exo.below && ready("exo", 1000)) {
    heal(player.regen * p.exo.regen);
  }
  if (p.magcoat && ready("magcoat", p.magcoat.cooldown)) {
    player.buffs.magnet = Math.max(player.buffs.magnet, 30);
  }
  if (p.singularity && ready("singularity", p.singularity.cooldown)) blackHole(p.singularity);

  const s = player.set;
  if (s?.stars && ready("stellar", s.every)) {
    const targets = enemiesNear(x, y, 520).slice(0, s.stars);
    for (const e of targets) starStrike(e.x, e.y, s.radius, s.damage);
  }
  if (s?.strikes && ready("storm", s.every)) {
    for (const e of enemiesNear(x, y, 520).slice(0, s.strikes)) {
      world.bolts.push({
        points: [
          { x: e.x - 30, y: e.y - 300 },
          { x: e.x + 20, y: e.y - 140 },
          { x: e.x, y: e.y },
        ],
        color: "#66ccff",
        life: 12,
      });
      damageEnemy(e, player.attack * s.damage, "perk");
    }
  }
  if (s?.shield && ready("reactor", s.every)) {
    player.buffs.shield = Math.max(player.buffs.shield, s.shield);
    createShockwave(x, y, 70, "#ffd700");
  }
}

function updateBurns() {
  for (const e of world.enemies) {
    if (!e.burn || e.dead) continue;
    if (game.time > e.burn.until) {
      e.burn = null;
      continue;
    }
    createParticles(e.x, e.y - e.size * 0.5, "#ff7a1a", 2);
    damageEnemy(e, (player.attack * e.burn.dps * BURN_STEP) / 60, "burn");
  }
}

/** Traînée spectrale (Cape ★3) : zones qui ralentissent les ennemis. */
function updateZones(tick) {
  const p = player.perks.cloak;
  const zones = player.perkZones;
  if (p && game.time <= (player.perkTimers.trailUntil ?? -1) && tick % 3 === 0) {
    zones.push({ x: player.worldX, y: player.worldY, life: p.life, max: p.life, radius: p.radius });
  }
  if (zones.length === 0) return;
  for (const z of zones) {
    z.life--;
    for (const e of enemiesNear(z.x, z.y, z.radius)) {
      e.slowUntil = game.time + p.slowTicks * TICK_MS;
      e.slowFactor = p.slow;
    }
  }
  let w = 0;
  for (const z of zones) if (z.life > 0) zones[w++] = z;
  zones.length = w;
}

/** Cœur de singularité ★3 : aspire les ennemis proches et les broie. */
function blackHole(s) {
  const { worldX: x, worldY: y } = player;
  createShockwave(x, y, s.radius, "#ff3b30");
  createParticles(x, y, "#ff3b30", 16);
  for (const e of enemiesNear(x, y, s.radius)) {
    const pull = e.template.isBoss ? s.pull / 4 : s.pull;
    e.x += (x - e.x) * pull;
    e.y += (y - e.y) * pull;
    damageEnemy(e, player.attack * s.damage, "perk");
  }
}
