// État mutable de la partie en cours. Les modules importent ces objets
// et les modifient ; ils ne sont jamais réassignés (seulement réinitialisés).

import { ACCOUNT_SCALING, DRONE, MYSTERY_BOX, PLAYER_DEFAULTS, droneDamage } from "../config.js";

export const game = { started: false, running: false, paused: false };
export const camera = { x: 0, y: 0 };
export const player = {};
export const pet = {};
export const mysteryBox = {};

export const world = {
  enemies: [],
  projectiles: [],
  enemyProjectiles: [],
  gems: [],
  lootBoxes: [],
  shrines: [],
  particles: [],
  visualEffects: [],
  floatingTexts: [],
  ghosts: [],
};

export function resetGame() {
  Object.assign(game, {
    started: true,
    running: true,
    paused: false,
    over: false,
    time: 0, // temps de jeu simulé en ms (s'arrête en pause)
    wave: 1,
    score: 0,
    kills: 0,
    totalRunXp: 0,
    runGold: 0,
    spawnTimer: 0,
    waveTimer: 0,
    regenTimer: 0,
    screenShake: 0,
    pendingBosses: [],
    isBossWave: false,
    nextWaveTimer: 0,
  });
  for (const list of Object.values(world)) list.length = 0;
}

export function resetPlayer(accountLevel) {
  const lvl = accountLevel - 1;
  const d = PLAYER_DEFAULTS;
  // Réinitialisation complète : aucune stat de la partie précédente ne survit.
  for (const k of Object.keys(player)) delete player[k];
  Object.assign(player, {
    ...d,
    worldX: 0,
    worldY: 0,
    maxHealth: d.maxHealth + lvl * ACCOUNT_SCALING.healthPerLevel,
    attack: d.attack + lvl * ACCOUNT_SCALING.attackPerLevel,
    baseSpeed: d.baseSpeed * (1 + lvl * ACCOUNT_SCALING.speedPerLevel),
    level: 1,
    xp: 0,
    lastAttack: -Infinity,
    isDashing: false,
    dashTimer: 0,
    dashCooldownTimer: 0,
    auraDamage: 0,
    auraRadius: 0,
    lastAuraTick: 0,
    orbitals: 0,
    orbitalAngle: 0,
    inventory: {},
    thorns: 0,
    vampirism: 0,
    explosionChance: 0,
    piercing: 0,
    knockbackMult: 1,
    regen: 0,
    greed: 1,
    executionThreshold: 0,
    hasRayGun: false,
    ultCharge: 0,
    isUltReady: false,
    buffs: { frenzy: 0, shield: 0, magnet: 0, overcharge: 0 },
    autoShoot: false,
  });
  player.health = player.maxHealth;
  player.speed = player.baseSpeed;
}

export function resetPet(droneLevel) {
  Object.assign(pet, {
    active: droneLevel > 0,
    x: 0,
    y: 0,
    size: DRONE.size,
    range: DRONE.range,
    damage: droneDamage(droneLevel),
    cooldown: DRONE.baseCooldown * Math.pow(DRONE.cooldownFactor, droneLevel),
    lastShot: 0,
  });
}

export function resetMysteryBox() {
  Object.assign(mysteryBox, {
    x: MYSTERY_BOX.x,
    y: MYSTERY_BOX.y,
    w: MYSTERY_BOX.w,
    h: MYSTERY_BOX.h,
    cost: MYSTERY_BOX.cost,
    active: true,
    state: "IDLE", // IDLE | OPENING | BROKEN
    timer: 0,
    colorIdx: 0,
    uses: 0,
    maxUses: Math.floor(Math.random() * 5) + 3,
  });
}
