// État mutable de la partie en cours. Les modules importent ces objets
// et les modifient ; ils ne sont jamais réassignés (seulement réinitialisés).

import { ACCOUNT_SCALING, MYSTERY_BOX, PLAYER_DEFAULTS } from "../config.js";

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
  clones: [], // clones d'ombre du Ninja (voir systems/skills.js)
  meteors: [], // météores du Mage en train de tomber
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
    daily: null, // défi du jour en cours (voir services/daily.js), sinon null
    modifier: {}, // modificateur du défi : enemySpeed, enemyHealth, goldMult...
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
    lastKunaiAttack: -Infinity,
    isDashing: false,
    dashTimer: 0,
    dashCooldownTimer: 0,
    auraDamage: 0,
    auraRadius: 0,
    lastAuraTick: 0,
    orbitals: 0,
    orbitalAngle: 0,
    inventory: {},
    evolutions: {}, // évolutions d'armes obtenues (voir data/upgrades.js)
    thorns: 0,
    vampirism: 0,
    explosionChance: 0,
    piercing: 0,
    knockbackMult: 1,
    regen: 0,
    greed: 1,
    goldBonus: 0, // bonus d'or en % (héros Pirate, familier Collecteur)
    executionThreshold: 0,
    hasRayGun: false,
    ultCharge: 0,
    isUltReady: false,
    buffs: { frenzy: 0, shield: 0, magnet: 0, overcharge: 0, slow: 0 },
    autoShoot: false,
    aimAngle: 0,
    weapon: null, // statistiques de l'arme équipée (voir systems/equipment.js)
    armor: null,
    hero: null,
  });
  player.health = player.maxHealth;
  player.speed = player.baseSpeed;
}

/** Familier équipé (statistiques de data/items.js petStats) ou null. */
export function resetPet(stats) {
  for (const k of Object.keys(pet)) delete pet[k];
  Object.assign(pet, {
    active: !!stats,
    kind: stats?.id ?? null,
    color: stats?.color ?? "#00ff88",
    power: stats?.power ?? {},
    x: 0,
    y: 0,
    size: 11,
    angle: 0,
    lastAction: 0,
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
