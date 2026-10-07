// Constantes globales du jeu. Toute valeur d'équilibrage doit vivre ici
// (ou dans src/data/) plutôt qu'en dur dans la logique.

export const STORAGE_KEYS = {
  settings: "survivor_settings",
  save: "survivor_save_v11",
  pseudo: "survivor_pseudo",
  leaderboard: "survivor_lb_v1",
  cloudCode: "survivor_cloud_code",
  dailyBest: "survivor_daily_best",
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
