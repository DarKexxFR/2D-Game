// Armes d'appoint : chaque tick, les armes ramassées en partie (player.sideWeapons) agissent seules.
// Réglages et niveaux dans data/sideWeapons.js ; une fonction par arme ci-dessous (`BEHAVIORS`).
// Tout leur état vit sur `player` et `world`, donc chaque partie d'un duel garde le sien.

import { player, world } from "../core/state.js";
import { SIDE_WEAPONS, sideStats } from "../data/sideWeapons.js";
import { angleDiff, angleTo, dist, removeWhere } from "../utils/math.js";
import {
  chainLightning,
  enemyGrid,
  explode,
  getNearestEnemy,
  isOnScreen,
  spawnProjectile,
  strikeEnemy,
} from "./combat.js";
import { createParticles, createShockwave } from "./effects.js";
import { knockEnemy } from "./knockback.js";
import { heal } from "./player.js";

/** Réglages communs (le reste dépend du niveau, voir data/sideWeapons.js). */
const SIDE = {
  missileSpeed: 7,
  missileTurn: 0.12, // part de la vitesse redirigée vers la cible à chaque tick
  missileLife: 150, // ticks
  mineArm: 30, // ticks avant qu'une mine posée s'arme
  mineLife: 900, // ticks avant qu'une mine non déclenchée s'éteigne
  mineTrigger: 26, // distance de déclenchement (en plus de la taille de l'ennemi)
  lightningRange: 520, // les éclairs visent les ennemis à cette distance au plus
  beamTick: 10, // le faisceau blesse toutes les 10 ticks
  beamWidth: 8,
  echoDelay: 18, // ticks entre les deux ondes de l'Écho sismique
  slashLife: 12, // durée du coup de fouet à l'écran
};

/** @typedef {{ id: string, level: number, timer: number, angle: number, flip?: boolean, echo?: number }} SideWeaponState */

export function updateSideWeapons() {
  for (const w of player.sideWeapons) {
    const s = sideStats(w, player);
    const behavior = BEHAVIORS[w.id];
    if (s.cooldown) {
      if (++w.timer < s.cooldown) {
        behavior.idle?.(w, s);
        continue;
      }
      w.timer = 0;
    }
    behavior.fire(w, s);
  }
  updateMines();
  for (const s of world.slashes) s.life--;
  removeWhere(world.slashes, (s) => s.life <= 0);
}

/** @type {Record<string, { fire: (w: SideWeaponState, s: Record<string, number>) => void, idle?: (w: SideWeaponState, s: Record<string, number>) => void }>} */
const BEHAVIORS = {
  missiles: { fire: fireMissiles },
  mines: { fire: dropMine },
  lightning: { fire: castLightning },
  pulse: { fire: emitPulse, idle: pulseEcho },
  beam: { fire: sweepBeams },
  whip: { fire: crackWhip },
};

const color = (id) => SIDE_WEAPONS[id].color;

// --- MISSILES CHERCHEURS ---

function fireMissiles(w, s) {
  const first = getNearestEnemy(player.worldX, player.worldY, SIDE.lightningRange);
  if (!first) {
    w.timer = s.cooldown; // personne à viser : tire dès qu'un ennemi approche
    return;
  }
  const base = angleTo(player.worldX, player.worldY, first.x, first.y);
  for (let i = 0; i < s.count; i++) {
    // départ en éventail derrière le vaisseau, puis virage vers la cible
    const a = base + Math.PI + (i - (s.count - 1) / 2) * 0.5;
    spawnProjectile({
      x: player.worldX,
      y: player.worldY,
      vx: Math.cos(a) * SIDE.missileSpeed,
      vy: Math.sin(a) * SIDE.missileSpeed,
      size: 6,
      damage: player.attack * s.damage,
      color: color("missiles"),
      explosion: s.explosion * player.projScale,
      life: SIDE.missileLife,
      homing: SIDE.missileTurn,
      target: i === 0 ? first : null,
      type: "missile",
      source: "missiles",
    });
  }
}

// --- MINES À PLASMA ---

function dropMine(w, s) {
  const mines = world.mines;
  if (mines.length >= s.max) mines.shift(); // la plus ancienne laisse la place
  mines.push({
    x: player.worldX,
    y: player.worldY,
    arm: SIDE.mineArm,
    life: SIDE.mineLife,
    damage: player.attack * s.damage,
    radius: s.radius * player.projScale,
    color: color("mines"),
    dead: false,
  });
}

function updateMines() {
  for (const m of world.mines) {
    if (--m.life <= 0) m.dead = true;
    if (m.dead || --m.arm > 0) continue;
    const near = enemyGrid.query(m.x, m.y, SIDE.mineTrigger + 40);
    if (!near.some((e) => !e.dead && dist(e.x, e.y, m.x, m.y) < e.size + SIDE.mineTrigger)) continue;
    m.dead = true;
    explode(m.x, m.y, m.radius, m.damage, null, "mines");
    createParticles(m.x, m.y, m.color, 10);
  }
  removeWhere(world.mines, (m) => m.dead);
}

// --- FOUDRE CÉLESTE ---

function castLightning(w, s) {
  const targets = [];
  for (const e of enemyGrid.query(player.worldX, player.worldY, SIDE.lightningRange)) {
    if (!e.dead && isOnScreen(e.x, e.y, e.size, 0)) targets.push(e);
  }
  if (targets.length === 0) {
    w.timer = s.cooldown;
    return;
  }
  for (let i = 0; i < s.strikes && targets.length > 0; i++) {
    const target = targets.splice(Math.floor(Math.random() * targets.length), 1)[0];
    strike(target, s);
  }
}

/** Éclair tombé du ciel sur `target` : dégâts autour du point d'impact, puis rebonds éventuels. */
function strike(target, s) {
  const { x, y } = target;
  const c = color("lightning");
  world.bolts.push({
    points: [
      { x: x + 40, y: y - 420 },
      { x: x - 20, y: y - 200 },
      { x, y },
    ],
    color: c,
    life: 10,
  });
  createShockwave(x, y, s.radius * player.projScale, c);
  const damage = player.attack * s.damage;
  const r = s.radius * player.projScale;
  for (const e of enemyGrid.query(x, y, r).slice()) {
    if (!e.dead && dist(e.x, e.y, x, y) < r + e.size) strikeEnemy(e, damage, "lightning");
  }
  if (s.chain && !target.dead) chainLightning(target, damage * 0.6, s.chain, c, "lightning");
}

// --- ONDE PULSÉE ---

function emitPulse(w, s) {
  pulseWave(s);
  if (s.echo) w.echo = SIDE.echoDelay;
}

/** Écho sismique : seconde onde peu après la première. */
function pulseEcho(w, s) {
  if (w.echo > 0 && --w.echo === 0) pulseWave(s);
}

function pulseWave(s) {
  const r = s.radius * player.projScale;
  const { worldX: x, worldY: y } = player;
  createShockwave(x, y, r, color("pulse"));
  const damage = player.attack * s.damage;
  for (const e of enemyGrid.query(x, y, r).slice()) {
    if (e.dead || dist(e.x, e.y, x, y) >= r + e.size) continue;
    strikeEnemy(e, damage, "pulse");
    knockEnemy(e, angleTo(x, y, e.x, e.y), s.push * player.knockbackMult); // les boss ne bougent pas
    if (s.stun && !e.dead) e.stun = Math.max(e.stun || 0, e.template.isBoss ? s.stun / 4 : s.stun);
  }
}

// --- FAISCEAU ROTATIF ---

/** Rayons tournants (positions partagées avec le rendu). */
export function beamSegments(w, s) {
  const out = [];
  const length = s.length * player.projScale;
  for (let k = 0; k < s.beams; k++) {
    const a = w.angle + (Math.PI * 2 * k) / s.beams;
    out.push({
      angle: a,
      length,
      x2: player.worldX + Math.cos(a) * length,
      y2: player.worldY + Math.sin(a) * length,
    });
  }
  return out;
}

function sweepBeams(w, s) {
  w.angle += s.spin;
  if (++w.timer < SIDE.beamTick) return;
  w.timer = 0;
  const segments = beamSegments(w, s);
  const length = segments[0].length;
  const damage = player.attack * s.damage;
  for (const e of enemyGrid.query(player.worldX, player.worldY, length).slice()) {
    if (e.dead) continue;
    const d = dist(e.x, e.y, player.worldX, player.worldY);
    if (d > length + e.size) continue;
    const a = angleTo(player.worldX, player.worldY, e.x, e.y);
    // distance de l'ennemi au rayon le plus proche (en travers du rayon)
    const hit = segments.some((g) => {
      const off = angleDiff(a, g.angle);
      return Math.abs(off) < Math.PI / 2 && Math.abs(Math.sin(off) * d) < e.size + SIDE.beamWidth;
    });
    if (hit) strikeEnemy(e, damage, "beam");
  }
}

// --- FOUET LASER ---

function crackWhip(w, s) {
  w.flip = !w.flip;
  const sides = s.both ? [0, Math.PI] : [w.flip ? Math.PI : 0];
  const range = s.range * player.projScale;
  const damage = player.attack * s.damage;
  const { worldX: x, worldY: y } = player;
  let healed = 0;
  for (const side of sides) {
    const facing = player.aimAngle + side;
    world.slashes.push({
      x,
      y,
      angle: facing,
      arc: s.arc,
      range,
      life: SIDE.slashLife,
      color: color("whip"),
    });
    for (const e of enemyGrid.query(x, y, range).slice()) {
      if (e.dead || dist(e.x, e.y, x, y) > range + e.size) continue;
      if (Math.abs(angleDiff(angleTo(x, y, e.x, e.y), facing)) > s.arc / 2) continue;
      strikeEnemy(e, damage, "whip");
      if (s.heal) healed += player.maxHealth * s.heal;
    }
  }
  if (healed > 0) heal(Math.min(healed, player.maxHealth * s.healCap));
}
