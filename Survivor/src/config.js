// Constantes globales du jeu. Toute valeur d'équilibrage doit vivre ici
// (ou dans src/data/) plutôt qu'en dur dans la logique.

export const STORAGE_KEYS = {
  settings: "survivor_settings",
  save: "survivor_save_v11",
  pseudo: "survivor_pseudo",
  leaderboard: "survivor_lb_v1",
  cloudCode: "survivor_cloud_code",
  dailyBest: "survivor_daily_best",
  auth: "survivor_auth", // session de connexion (Google ou e-mail), facultative
  accountSync: "survivor_account_sync", // dernière version échangée avec le compte (anti-écrasement)
};

// La logique tourne à pas fixe : le jeu va à la même vitesse en 60, 144 ou 240 Hz.
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;

export const MAP_SIZE = 3000;
export const MAP_BOUNDS = {
  minX: -MAP_SIZE / 2,
  maxX: MAP_SIZE / 2,
  minY: -MAP_SIZE / 2,
  maxY: MAP_SIZE / 2,
};

export const WAVE_DURATION = 3600; // en ticks (60 s)
export const NEXT_WAVE_DELAY = 60; // ticks entre la mort du boss et la vague suivante

export const LIMITS = {
  gems: 300,
  particles: 1000,
  particlesLowQuality: 200,
  floatingTexts: 200,
  leaderboard: 10,
};

export const STAT_CAPS = {
  speed: 10,
  attackSpeed: 50,
  magnet: 600,
};

// Survie en fin de partie. La défense réduit les dégâts de contact en pourcentage, avec des
// rendements décroissants (défense / (défense + armorCurve)). À partir de la vague
// `healFatigueFrom`, les soins perdent de leur efficacité (« corruption ») jusqu'à `minHealFactor`.
export const SURVIVAL = {
  armorCurve: 40,
  healFatigueFrom: 12,
  healFatiguePerWave: 0.04,
  minHealFactor: 0.35,
  harvestCooldown: 200, // ms entre deux soins de la Moisson sanglante (max 5 % des PV / s)
};

/**
 * Étourdissement du joueur (éclairs du Titan de l'orage) : ni déplacement, ni dash, ni compétence.
 * Après un étourdissement, le joueur y est insensible un moment (pas d'enchaînement sans fin).
 */
export const STUN = { maxTicks: 75, immunity: 150 };

export const PLAYER_DEFAULTS = {
  size: 20,
  baseSpeed: 4.7,
  maxHealth: 100,
  attack: 8,
  defense: 0,
  attackSpeed: 500, // ms entre deux tirs
  critChance: 0.05,
  critMultiplier: 1.5,
  xpToNextLevel: 10,
  magnetRadius: 100,
  dashSpeed: 12,
  dashDuration: 10,
  dashCooldown: 120,
  maxUltCharge: 50,
  projectileSpeed: 10,
  multishotSpread: 0.2,
  orbitalRadius: 80,
};

// Bonus permanents par niveau de compte
export const ACCOUNT_SCALING = {
  healthPerLevel: 5,
  attackPerLevel: 0.5,
  speedPerLevel: 0.01,
  baseXpToLevel: 1000,
  xpGrowth: 1.2,
};

export const KUNAI = {
  cooldown: 700,
  projectileSpeed: 14,
  damageMultiplier: 0.75,
};

export const MYSTERY_BOX = {
  x: 0,
  y: -600,
  w: 80,
  h: 60,
  cost: 100,
  openDuration: 180,
  interactRadius: 100,
  colors: ["#00ffff", "#ff00ff", "#ffff00", "#00ff00"],
  overchargeDuration: 600,
  overchargeAttackSpeed: 50,
};

export const BUFF_DURATIONS = {
  frenzy: 600,
  shield: 600,
  magnet: 300,
};

export const ULTIMATE = {
  radius: 350,
  damage: 200,
  knockback: 100,
};

export const RARITIES = {
  common: { weight: 100, color: "#aaa" },
  rare: { weight: 50, color: "#0088ff" },
  epic: { weight: 15, color: "#aa00ff" },
  legendary: { weight: 3, color: "#ffaa00" },
  evolution: { weight: 0, color: "#ff2a6d" }, // jamais tirée au hasard : proposée en priorité
};

// Coffre lâché par un boss : une augmentation au choix (raretés hautes favorisées) + de l'or.
export const BOSS_CHEST = {
  weights: { rare: 40, epic: 40, legendary: 20 },
  gold: 40,
  goldPerWave: 8,
};

// Publicités récompensées (vidéo facultative contre un bonus). provider "demo" = fausse
// pub interne en attendant une vraie régie (CrazyGames, Poki, AdSense...), "none" = désactivé.
export const ADS = {
  provider: "demo", // "demo" (fausse pub), "adsense" (H5 Games Ads, voir PUBS.md) ou "none"
  demoDurationMs: 5000, // durée de la fausse pub
  reviveHealth: 0.5, // part des PV rendus en revivant
  reviveDecisionMs: 10000, // temps pour choisir avant l'abandon automatique
  reviveClearRadius: 300, // les ennemis proches sont repoussés au retour
  adChestsPerDay: 3, // coffres bonus contre une pub, par jour
  // AdSense H5 Games Ads (pubs récompensées) : à activer seulement une fois la bêta acceptée par Google
  adsense: {
    client: "ca-pub-8968329181870538", // identifiant d'éditeur « ca-pub-… » (AdSense → Compte → Informations)
    testMode: true, // pubs de test Google : repasser à false pour la mise en ligne
    loadTimeoutMs: 8000, // abandon si la régie ne répond pas (bloqueur de pubs, réseau)
  },
};

// Duel 1 contre 1 sur le même écran (voir systems/versus.js). Les deux joueurs partent à égalité
// (Pilote + Blaster, ni niveau de compte ni talents) ; celui qui meurt choisit des améliorations.
export const VERSUS = {
  lives: 3,
  upgradesPerDeath: 3,
  healthMult: 2, // PV de base multipliés : un duel ne doit pas se jouer en deux tirs
  respawnDelay: 90, // ticks entre la mort et le choix des améliorations
  spawnShield: 150, // ticks d'invulnérabilité au retour
  endDelay: 60, // ticks avant l'écran du vainqueur
  endSlowMo: 40, // dont ticks au ralenti (×0,3)
  knockback: 10,
  thornsReflect: 0.3, // part des dégâts renvoyés par les Épines (par niveau de 0,5)
  vampirismCap: 10, // soin maximum par tir
  orbitalHitCooldown: 300, // ms entre deux coups d'orbes sur l'adversaire
  orbitalDamageMult: 5,
  arena: { maxWidth: 1400, maxHeight: 1100, margin: 30, top: 130 },
  colors: ["#00ffff", "#ff2a6d"],
};

export const MUSIC = {
  dir: "assets/audio/",
  tracks: ["intro.mp3", "cyber.mp3"],
};

// Classement mondial (Supabase). Laisser vide pour désactiver le mode en ligne.
// Valeurs dans Supabase : Project Settings → API. La clé « anon public » est
// faite pour être publique ; la sécurité est assurée par les règles RLS (voir supabase/schema.sql).
export const ONLINE = {
  supabaseUrl: "https://eibzkrgobawkgjwheyfl.supabase.co",
  supabaseAnonKey: "sb_publishable__LDgojI-trllPtdOuAmhaA_jhbCP2Kd",
  table: "scores",
  leaderboardView: "leaderboard",
  dailyTable: "daily_scores",
  dailyView: "daily_leaderboard",
  topCount: 50,
  timeoutMs: 6000,
};
