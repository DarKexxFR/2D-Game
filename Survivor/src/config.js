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

// Tutoriel de la première partie (ui/tutorial.js)
export const TUTORIAL = {
  moveDistance: 150, // distance à parcourir pour valider « se déplacer »
  kills: 5, // ennemis à détruire pour valider « tir auto »
  minTicks: 90, // une bulle reste affichée au moins 1,5 s
  endTicks: 240, // durée du message de fin
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

// Niveaux de difficulté (partie normale seulement : ni défi du jour, ni Boss Rush, ni duel).
// Multiplicateurs appliqués via `game.modifier` ; `eliteShift` avance (+) ou recule (-) l'arrivée des
// élites en vagues ; `rewards` multiplie l'XP et l'or. Cauchemar : débloqué au record de vague
// `unlockWave`, classement mondial à part. Facile : pas de classement mondial.
export const DIFFICULTIES = {
  easy: {
    name: "FACILE",
    color: "#00ff88",
    desc: "Ennemis plus faibles · XP et or ×0,7",
    enemyHealth: 0.7,
    enemyDamage: 0.6,
    eliteShift: -4,
    rewards: 0.7,
  },
  normal: { name: "NORMAL", color: "#00ffff", desc: "L'expérience prévue", rewards: 1 },
  nightmare: {
    name: "CAUCHEMAR",
    color: "#ff2a6d",
    desc: "Ennemis bien plus forts, élites dès la vague 3 · XP et or ×1,75",
    enemyHealth: 1.6,
    enemyDamage: 1.5,
    enemySpeed: 1.1,
    eliteShift: 5,
    rewards: 1.75,
    unlockWave: 10,
  },
};

// Série de connexion : une récompense par jour de connexion d'affilée (heure locale), de plus en
// plus grosse jusqu'au 7e jour ; un jour manqué remet la série à 1, après le 7e jour elle recommence.
export const LOGIN_STREAK = {
  rewards: [100, 150, 200, 300, 400, 600, 1200], // or des jours 1 à 7
};

// Quêtes hebdomadaires (data/quests.js) : renouvelées chaque lundi à 0 h (heure du joueur).
export const WEEKLY = {
  questsPerWeek: 3,
  bonusGold: 750, // or en plus quand toutes les quêtes de la semaine sont récupérées
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

// Duel (voir systems/versus.js) : chaque joueur joue sa propre partie de survie, le dernier en vie
// gagne et empoche l'XP et l'or des deux parties. Sur un écran : écran scindé en deux.
export const VERSUS = {
  pickSeconds: 12, // choix d'amélioration en duel : au-delà, la carte surlignée est prise (pas de blocage)
  endDelayMs: 1200, // entre la mort du perdant et l'écran du vainqueur
  colors: ["#00ffff", "#ff2a6d"],
  // Attaques : les éliminations remplissent une jauge ; pleine, elle envoie des ennemis chez l'adversaire
  attack: {
    killsPerSend: 35, // éliminations pour remplir la jauge
    mobs: 6, // ennemis envoyés quand la jauge est pleine
    bossElites: 3, // élites envoyées quand on tue un boss
  },
  // Sorts : une seconde jauge (éliminations) donne un sort tiré au hasard, lancé à la main sur l'adversaire
  spell: {
    killsPerSpell: 50,
    slow: { ticks: 300, speed: 0.55 }, // RALENTI : vitesse de l'adversaire réduite
    fog: { ticks: 360, radius: 160 }, // BROUILLARD : on ne voit plus qu'autour de son vaisseau
    jam: { ticks: 240 }, // TIR COUPÉ : l'arme principale ne tire plus
  },
};

// Duel en ligne (voir services/netplay.js) : Supabase Realtime sert de salon (code de salle et
// mise en relation), puis les deux navigateurs se parlent en direct (WebRTC). Si la connexion directe
// échoue (réseau strict), les messages passent par Supabase. Chaque joueur fait tourner sa partie
// et envoie seulement ses statistiques (vague, PV, score...) à l'adversaire.
export const NET = {
  codeLength: 4,
  statsPerSecond: 4, // statistiques envoyées à l'adversaire
  // Aperçu en direct : scène (vaisseau, ennemis proches) envoyée à l'adversaire, qui la redessine en petit
  viewPerSecond: 8, // connexion directe
  viewPerSecondRelay: 4, // relais par Supabase (plus lent, quota de messages)
  viewEnemies: 80, // ennemis envoyés au plus (les plus proches)
  viewRange: 900, // distance (unités du monde) au-delà de laquelle un ennemi n'est pas envoyé
  p2pTimeoutMs: 7000, // au-delà, on passe par Supabase
  joinTimeoutMs: 8000, // pas de réponse de l'hôte : code inconnu
  lostAfterMs: 6000, // plus aucun message de l'adversaire : partie interrompue
  heartbeatMs: 25000, // battement de cœur exigé par Supabase Realtime
  eloRetryMs: 1500, // duel classé : nouvelle demande tant que l'adversaire n'a pas déclaré le résultat
  eloRetries: 4,
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
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
  nightmareTable: "nightmare_scores",
  nightmareView: "nightmare_leaderboard",
  topCount: 50,
  timeoutMs: 6000,
};
