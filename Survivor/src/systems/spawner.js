// Gestion des vagues, apparition des ennemis, des boss et des sanctuaires.

import { MAP_BOUNDS, NEXT_WAVE_DELAY, SURVIVAL, WAVE_DURATION } from "../config.js";
import { emit } from "../core/events.js";
import { game, player, world } from "../core/state.js";
import {
  BOSS_ARENA,
  BOSS_RUSH,
  BOSS_SPAWN_DELAY,
  BOSS_WAVES,
  ELITE,
  ENEMY_NAMES,
  ENEMY_TYPES,
  GOBLIN,
  SPAWN_TABLES,
  WAVE_SCALING as W,
} from "../data/enemies.js";
import { biomeForWave } from "../data/biomes.js";
import { clamp, randomItem, weightedPick } from "../utils/math.js";
import { addFloatingText, createParticles, createSpawnEffect } from "./effects.js";
import { arenaPointNear } from "./pickups.js";
import { recordBest, recordWave } from "../services/achievements.js";

const SHRINES = [
  { type: "frenzy", name: "FRÉNÉSIE", color: "#ff2244", icon: "rage" },
  { type: "shield", name: "BOUCLIER", color: "#0088ff", icon: "shield" },
  { type: "magnet", name: "AIMANT", color: "#ffee00", icon: "magnet" },
];
const SHRINE_CHANCE = 0.001; // par tick

export function updateSpawning() {
  if (game.rush) {
    // Boss Rush : ni petits ennemis ni limite de temps, seulement les boss l'un après l'autre
    if (game.nextWaveTimer > 0 && --game.nextWaveTimer === 0) startNextWave();
    spawnPendingBosses();
    return;
  }
  updateWaveTimer();
  if (!bossFight()) spawnMobs(); // pendant un vrai boss : aucun petit ennemi
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
      if (isQuietBoss(pending[i].type)) clearMobs();
      spawnEnemy(pending[i].type);
      pending.splice(i, 1);
    }
  }
}

/** Un boss qui vide l'arène (tous sauf ceux de `BOSS_ARENA.keepMobs`, comme le Crabe blindé). */
function isQuietBoss(type) {
  return ENEMY_TYPES[type].isBoss && !BOSS_ARENA.keepMobs.includes(type);
}

/** Vrai pendant un combat de boss : boss annoncé ou encore en vie. */
export function bossFight() {
  return (
    game.pendingBosses.some((b) => isQuietBoss(b.type)) ||
    world.enemies.some((e) => !e.dead && isQuietBoss(e.type))
  );
}

/** Le boss arrive : les petits ennemis disparaissent (sans récompense), le Voleur doré reste. */
function clearMobs() {
  for (const e of world.enemies) {
    if (e.dead || e.template.isBoss || e.type === "goblin") continue;
    e.dead = true;
    createParticles(e.x, e.y, e.template.color, 4);
  }
}

export function spawnWave() {
  game.waveTimer = 0;
  game.isBossWave = false;
  if (game.rush) return spawnRushBoss();
  recordWave(game.wave);
  const boss = game.wave > 1 ? BOSS_WAVES.find((b) => game.wave % b.every === 0) : null;
  if (!boss) {
    if (game.wave >= GOBLIN.fromWave && Math.random() < GOBLIN.chance) spawnGoblin();
    return;
  }
  game.isBossWave = true;
  if (boss.warning) emit("bossWarning", boss.warning);
  game.pendingBosses.push({ type: boss.type, delay: BOSS_SPAWN_DELAY });
}

/**
 * Boss Rush : prochain boss de la liste. `game.wave` prend la vague habituelle du boss (PV,
 * dégâts, biome) ; chaque tour complet de la liste ajoute `cycleWaves` vagues.
 */
function spawnRushBoss() {
  const rush = game.rush;
  const { order, cycleWaves } = BOSS_RUSH;
  const entry = order[rush.stage % order.length];
  game.wave = entry.wave + Math.floor(rush.stage / order.length) * cycleWaves;
  rush.stage++;
  game.isBossWave = true;
  emit("bossWarning", `BOSS ${rush.stage} · ${entry.warning}`);
  game.pendingBosses.push({ type: entry.type, delay: BOSS_RUSH.spawnDelay });
}

export function startNextWave() {
  game.nextWaveTimer = 0;
  const before = biomeForWave(game.wave);
  game.wave++;
  spawnWave();
  const label = game.rush ? "BOSS " + game.rush.stage : "VAGUE " + game.wave;
  addFloatingText(player.worldX, player.worldY - 50, label, "#00ffff", 30, 120);
  announceDifficulty(game.wave);
  const biome = biomeForWave(game.wave);
  if (biome !== before) emit("biomeChange", biome);
}

/** Programme la vague suivante (une seule fois, même si plusieurs boss meurent ensemble). */
export function scheduleNextWave() {
  if (game.nextWaveTimer > 0) return;
  if (game.rush) return scheduleNextRushBoss();
  addFloatingText(player.worldX, player.worldY - 100, "BOSS VAINCU - VAGUE SUIVANTE!", "#00ff00", 24, 100);
  game.nextWaveTimer = NEXT_WAVE_DELAY;
}

/** Boss Rush : boss vaincu, un peu de répit et de soin avant le suivant. */
function scheduleNextRushBoss() {
  const rush = game.rush;
  rush.defeated++;
  recordBest("bestBossRush", rush.defeated);
  player.health = Math.min(player.maxHealth, player.health + player.maxHealth * BOSS_RUSH.heal);
  const next = BOSS_RUSH.order[rush.stage % BOSS_RUSH.order.length];
  addFloatingText(player.worldX, player.worldY - 100, "BOSS VAINCU !", "#00ff00", 26, 100);
  addFloatingText(
    player.worldX,
    player.worldY - 130,
    `PROCHAIN : ${ENEMY_NAMES[next.type]}`,
    "#ffd700",
    16,
    120,
  );
  game.nextWaveTimer = BOSS_RUSH.breather;
}

function pickEnemyType() {
  const table = SPAWN_TABLES.find((t) => game.wave < t.untilWave);
  const entries = Object.entries(table.weights);
  const extra = biomeForWave(game.wave).enemy;
  if (extra) entries.push([extra.type, extra.weight]);
  return weightedPick(entries, ([, w]) => w)[0];
}

/** Annonce les paliers de difficulté (montée exponentielle, corruption des soins). */
function announceDifficulty(wave) {
  if (wave === W.rampFrom) {
    addFloatingText(player.worldX, player.worldY - 90, "LA NUÉE S'ENRAGE !", "#ff2a6d", 24, 150);
  }
  if (wave === SURVIVAL.healFatigueFrom) {
    addFloatingText(player.worldX, player.worldY - 120, "CORRUPTION : SOINS RÉDUITS", "#aa66ff", 22, 150);
  }
}

/** Multiplicateurs de PV et de dégâts d'une vague : linéaires, puis exponentiels après `rampFrom`. */
export function waveMultipliers(wave) {
  const ramp = Math.max(0, wave - W.rampFrom);
  return {
    health: (1 + wave * W.health) * W.healthRamp ** ramp,
    damage: (1 + wave * W.damage) * W.damageRamp ** ramp,
  };
}

/** Chance qu'un ennemi ordinaire apparaisse en élite à cette vague. */
export function eliteChance(wave) {
  if (wave < ELITE.fromWave) return 0;
  return Math.min(ELITE.maxChance, (wave - ELITE.fromWave + 1) * ELITE.chancePerWave);
}

let enemyIds = 0; // identifiant de chaque ennemi (suivi d'un ennemi dans l'aperçu du duel en ligne)

/** `forceElite` : élite d'office (attaque envoyée par l'adversaire en duel). */
export function spawnEnemy(type = pickEnemyType(), x = null, y = null, forceElite = false) {
  const t = ENEMY_TYPES[type];
  // Seuls les ennemis ordinaires qui arrivent du bord peuvent être des élites (pas les invocations)
  const elite =
    x === null && !t.isBoss && type !== "goblin" && (forceElite || Math.random() < eliteChance(game.wave));
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
  const mult = waveMultipliers(wave);
  const eliteMult = (k) => (elite ? ELITE[k] : 1);
  const health = t.health * mult.health * (mod.enemyHealth || 1) * eliteMult("health");
  const speed = Math.min(t.speed * W.maxSpeedMult, t.speed * (1 + wave * W.speed)) * (mod.enemySpeed || 1);
  world.enemies.push({
    id: ++enemyIds,
    x,
    y,
    type,
    template: t,
    health,
    maxHealth: health,
    damage: t.damage * mult.damage * eliteMult("damage"),
    speed,
    baseSpeed: speed,
    size: t.size * eliteMult("size"),
    elite,
    color: t.color,
    xp: t.xp * (1 + wave * W.xp) * (mod.enemyXp || 1) * (elite ? ELITE.rewards : 1),
    gold: (t.gold || 1) * (1 + player.greed * 0.1) * (elite ? ELITE.rewards : 1),
    attackRange: t.attackRange || 0,
    shootCooldown: Math.max(500, (t.shootCooldown || 0) * 0.95),
    lastShot: 0,
    lastDamage: 0,
    phase: Math.random(), // décalage d'animation
    skillTimer: 100,
    attackTimer: 90, // première attaque des boss à cycle d'attaques
    isCharging: false,
    dead: false,
  });
}

/** Voleur doré : apparaît non loin du joueur et s'enfuit avec son or. */
export function spawnGoblin() {
  const a = Math.random() * Math.PI * 2;
  const x = player.worldX + Math.cos(a) * GOBLIN.spawnDistance;
  const y = player.worldY + Math.sin(a) * GOBLIN.spawnDistance;
  spawnEnemy("goblin", x, y);
  createSpawnEffect(x, y, "#ffd700");
  emit("goblin");
}

const MAX_SHRINES = 3;

function spawnShrine() {
  if (world.shrines.length >= MAX_SHRINES) return;
  const shrine = randomItem(SHRINES);
  // Toujours à l'intérieur de la zone de combat, même si le joueur longe un bord
  world.shrines.push({ ...shrine, ...arenaPointNear(player.worldX, player.worldY, 1000), size: 25 });
}
