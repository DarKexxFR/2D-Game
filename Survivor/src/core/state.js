// État mutable de la partie en cours. Les modules importent ces objets
// et les modifient ; ils ne sont jamais réassignés (seulement réinitialisés).

import { ACCOUNT_SCALING, MAP_BOUNDS, MAP_EVENTS, MYSTERY_BOX, PLAYER_DEFAULTS } from "../config.js";

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
  cursedShrines: [], // sanctuaires maudits (voir systems/cursedShrines.js)
  merchants: [], // Marchand Noir (voir systems/blackMarket.js)
  particles: [],
  visualEffects: [],
  floatingTexts: [],
  ghosts: [],
  clones: [], // clones d'ombre du Ninja (voir systems/skills.js)
  meteors: [], // météores du Mage en train de tomber
  turrets: [], // tourelles de l'Ingénieur
  hazards: [], // attaques de zone des boss (voir systems/hazards.js)
  bossChests: [], // coffres d'augmentation lâchés par les boss
  bolts: [], // éclairs de l'Arc Tesla (purement visuels)
  mines: [], // mines à plasma posées (arme d'appoint, voir systems/sideWeapons.js)
  slashes: [], // coups de fouet laser (purement visuels)
  trail: [], // traînée cosmétique du vaisseau (skin, voir systems/trail.js)
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
    adReviveUsed: false, // a déjà revécu grâce à une pub dans cette partie
    difficulty: "normal", // niveau de difficulté de la partie (voir services/difficulty.js)
    daily: null, // défi du jour en cours (voir services/daily.js), sinon null
    endlessAllowed: false, // survie normale : vaincre le boss final lance l'Endless Pulse
    endless: null, // Endless Pulse en cours : { depth, stacks }, sinon null
    rush: null, // Boss Rush en cours : { stage, defeated } (voir systems/spawner.js), sinon null
    modifier: {}, // modificateur du défi : enemySpeed, enemyHealth, goldMult...
    stats: { damage: {}, kills: {}, bosses: 0, bestCombo: 0, bossChests: 0 }, // pour l'écran de fin
    combo: 0, // éliminations enchaînées (voir systems/effects.js)
    comboTimer: 0,
    slowMo: 0, // ticks de ralenti restants (mort d'un boss)
    killCam: { frames: [], tick: 0, killer: null }, // ralenti de la mort (voir systems/killCam.js)
    flash: null, // flash plein écran { color, alpha }
    banner: null, // duel sur un écran : annonce dans la moitié d'écran (voir systems/versus.js)
    duelAttack: 0, // duel : éliminations vers la prochaine attaque (voir systems/duelAttacks.js)
    duelSpell: 0, // duel : éliminations vers le prochain sort
    spellReady: null, // duel : sort prêt à lancer ("slow", "fog", "jam")
    hex: null, // duel : sort subi { type, ticks }
    // duel : récap de fin (vie % chaque seconde, attaques et sorts envoyés) ; t en ms depuis le début du duel
    duelLog: { hp: [], marks: [], sent: 0, cast: 0, lastT: -1e9 },
    bounds: { ...MAP_BOUNDS }, // zone de combat actuelle (se resserre pendant un boss, voir systems/arena.js)
    arena: null, // zone visée pendant un combat de boss { minX, maxX, minY, maxY }, sinon null
    mapEvent: null, // événement de carte en cours (voir systems/mapEvents.js), sinon null
    eventTimer: MAP_EVENTS.firstDelay, // ticks avant le prochain événement
    anomaly: null, // anomalie du biome en cours (voir systems/anomalies/), sinon null
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
    cardLog: [], // ce que chaque carte prise a changé (voir removeCard dans data/upgrades.js)
    evolutions: {}, // évolutions d'armes obtenues (voir data/upgrades.js)
    thorns: 0,
    vampirism: 0,
    explosionChance: 0,
    piercing: 0,
    knockbackMult: 1,
    regen: 0,
    greed: 1,
    goldBonus: 0, // bonus d'or en % (héros Pirate, familier Collecteur, talent Fortune)
    xpBonus: 0, // bonus d'XP en % (talent Sagesse)
    rerolls: 0, // relances des améliorations restantes (talent Relance)
    revives: 0, // résurrections restantes (talent Seconde chance)
    phoenixRevive: false, // la résurrection du Phénix n'a pas encore servi
    executionThreshold: 0,
    hasRayGun: false,
    ultCharge: 0,
    isUltReady: false,
    // glitch = commandes inversées (glitchWarn = alerte avant), jammed = tir coupé (Hacker)
    buffs: {
      frenzy: 0,
      shield: 0,
      magnet: 0,
      overcharge: 0,
      slow: 0,
      stun: 0,
      stunImmune: 0,
      haste: 0,
      glitch: 0,
      glitchWarn: 0,
      jammed: 0,
    },
    hasteBonus: 0, // vitesse en plus pendant buffs.haste (Combinaison légère ★3)
    // Effets d'équipement (systems/perks.js) : effets ★3 actifs, panoplie, minuteurs, zones
    perks: {},
    set: null,
    perkTimers: {},
    perkZones: [],
    damageTaken: 1, // multiplicateur des dégâts reçus
    healMult: 1, // efficacité des soins
    bossDamage: 1, // multiplicateur des dégâts contre les boss
    auraMult: 1, // taille de l'aura de feu
    rangeMult: 1, // portée des armes à courte portée (lance-flammes, fusil...)
    projScale: 1, // taille des tirs et des explosions (carte Singularité)
    noDash: false, // dash désactivé (carte Surcharge moteur)
    bloodPact: null, // carte Pacte de sang : { ms, heal } ; pactUntil = fin de la fenêtre de soins
    pactUntil: 0,
    synergy: null, // duo familier + arme actif (data/perks.js SYNERGIES)
    synergyState: { stacks: 0, until: 0, last: -1e9, tick: -1, bursts: 0 }, // systems/synergies.js
    core: null, // effets des nœuds actifs du Cœur Cybernétique (systems/cyberCore.js), ou null
    sideWeapons: [], // armes d'appoint de la partie { id, level, timer, angle, parts? } (systems/sideWeapons.js)
    // Cartes à effet (data/cardEffects.js, systems/cardEffects.js) : nombre de cartes prises et minuteurs
    frost: 0,
    ricochet: 0,
    energyShield: 0,
    shieldReadyAt: 0,
    dashBlast: 0,
    arc: 0,
    pulsar: 0,
    shotCount: 0,
    surge: 0,
    surgeKills: 0,
    ultGain: 1, // charges de compétence par élimination (carte Dette de temps)
    blind: false, // vision réduite (carte Furie aveugle)
    autoShoot: false,
    aimAngle: 0,
    weapon: null, // statistiques de l'arme équipée (voir systems/equipment.js)
    armor: null,
    hero: null,
    module: null,
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
    lastAction: -Infinity, // premier effet dès le début de la partie
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
