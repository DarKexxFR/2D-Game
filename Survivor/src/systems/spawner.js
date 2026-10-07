// Gestion des vagues, apparition des ennemis, des boss et des sanctuaires.

import { MAP_BOUNDS, NEXT_WAVE_DELAY, WAVE_DURATION } from "../config.js";
import { emit } from "../core/events.js";
import { game, player, world } from "../core/state.js";
import {
  BOSS_SPAWN_DELAY,
  BOSS_WAVES,
  ENEMY_TYPES,
  SPAWN_TABLES,
  WAVE_SCALING as W,
} from "../data/enemies.js";
import { biomeForWave } from "../data/biomes.js";
import { clamp, randomItem, weightedPick } from "../utils/math.js";
import { addFloatingText, createSpawnEffect } from "./effects.js";
import { arenaPointNear } from "./pickups.js";
import { recordWave } from "../services/achievements.js";

const SHRINES = [
  { type: "frenzy", name: "FRÉNÉSIE", color: "#ff2244", icon: "rage" },
  { type: "shield", name: "BOUCLIER", color: "#0088ff", icon: "shield" },
  { type: "magnet", name: "AIMANT", color: "#ffee00", icon: "magnet" },
];
const SHRINE_CHANCE = 0.001; // par tick

export function updateSpawning() {
  updateWaveTimer();
  spawnMobs();
  spawnPendingBosses();
  if (Math.random() < SHRINE_CHANCE) spawnShrine();
}

function updateWaveTimer() {
  game.waveTimer++;
  if (game.waveTimer > WAVE_DURATION) {
    addFloatingText(player.worldX, player.worldY - 80, "TEMPS ÉCOULÉ !", "#ffaa00", 20, 60);
    startNextWave();
  }
  if (game.nextWaveTimer > 0 && --game.nextWaveTimer === 0) startNextWave();
}

function spawnMobs() {
  const minMobs = W.baseMobs + game.wave * W.mobsPerWave;
  if (world.enemies.length < minMobs) {
    spawnEnemy();
  } else if (--game.spawnTimer <= 0) {
    spawnEnemy();
    game.spawnTimer = Math.max(W.minSpawnInterval, W.spawnInterval - game.wave * W.spawnIntervalPerWave);
  }
}

function spawnPendingBosses() {
  const pending = game.pendingBosses;
  for (let i = pending.length - 1; i >= 0; i--) {
    if (--pending[i].delay <= 0) {
      spawnEnemy(pending[i].type);
      pending.splice(i, 1);
    }
  }
}

export function spawnWave() {
  game.waveTimer = 0;
  game.isBossWave = false;
  recordWave(game.wave);
  const boss = game.wave > 1 ? BOSS_WAVES.find((b) => game.wave % b.every === 0) : null;
  if (!boss) return;
  game.isBossWave = true;
  if (boss.warning) emit("bossWarning", boss.warning);
  game.pendingBosses.push({ type: boss.type, delay: BOSS_SPAWN_DELAY });
}

export function startNextWave() {
  game.nextWaveTimer = 0;
  const before = biomeForWave(game.wave);
  game.wave++;
  spawnWave();
  addFloatingText(player.worldX, player.worldY - 50, "VAGUE " + game.wave, "#00ffff", 30, 120);
  const biome = biomeForWave(game.wave);
  if (biome !== before) emit("biomeChange", biome);
}

/** Programme la vague suivante (une seule fois, même si plusieurs boss meurent ensemble). */
export function scheduleNextWave() {
  if (game.nextWaveTimer > 0) return;
  addFloatingText(player.worldX, player.worldY - 100, "BOSS VAINCU - VAGUE SUIVANTE!", "#00ff00", 24, 100);
  game.nextWaveTimer = NEXT_WAVE_DELAY;
}

function pickEnemyType() {
  const table = SPAWN_TABLES.find((t) => game.wave < t.untilWave);
  const entries = Object.entries(table.weights);
  const extra = biomeForWave(game.wave).enemy;
  if (extra) entries.push([extra.type, extra.weight]);
  return weightedPick(entries, ([, w]) => w)[0];
}

export function spawnEnemy(type = pickEnemyType(), x = null, y = null) {
  const t = ENEMY_TYPES[type];
  if (x === null || y === null) {
    const angle = Math.random() * Math.PI * 2;
    x = player.worldX + Math.cos(angle) * W.spawnDistance;
    y = player.worldY + Math.sin(angle) * W.spawnDistance;
  }
  x = clamp(x, MAP_BOUNDS.minX + 50, MAP_BOUNDS.maxX - 50);
  y = clamp(y, MAP_BOUNDS.minY + 50, MAP_BOUNDS.maxY - 50);
  if (t.isBoss) createSpawnEffect(x, y, t.color);

  const wave = game.wave;
  const mod = game.modifier;
  const health = t.health * (1 + wave * W.health) * (mod.enemyHealth || 1);
  const speed = Math.min(t.speed * W.maxSpeedMult, t.speed * (1 + wave * W.speed)) * (mod.enemySpeed || 1);
  world.enemies.push({
    x,
    y,
    type,
    template: t,
    health,
    maxHealth: health,
    damage: t.damage * (1 + wave * W.damage),
    speed,
    baseSpeed: speed,
    size: t.size,
    color: t.color,
    xp: t.xp * (1 + wave * W.xp) * (mod.enemyXp || 1),
    gold: (t.gold || 1) * (1 + player.greed * 0.1),
    attackRange: t.attackRange || 0,
    shootCooldown: Math.max(500, (t.shootCooldown || 0) * 0.95),
    lastShot: 0,
    lastDamage: 0,
    phase: Math.random(), // décalage d'animation
    skillTimer: 100,
    isCharging: false,
    dead: false,
  });
}

const MAX_SHRINES = 3;

function spawnShrine() {
  if (world.shrines.length >= MAX_SHRINES) return;
  const shrine = randomItem(SHRINES);
  // Toujours à l'intérieur de la zone de combat, même si le joueur longe un bord
  world.shrines.push({ ...shrine, ...arenaPointNear(player.worldX, player.worldY, 1000), size: 25 });
}
