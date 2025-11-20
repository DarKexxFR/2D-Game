// Canvas setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// --- ACCOUNT ---
const account = {
  level: 1,
  currentXp: 0,
  nextLevelXp: 1000,
  gold: 0,
  petLevels: { drone: 0 },
  playerName: "Joueur",
  bestScore: 0,
  bestWave: 0,
};

let leaderboard = [];

function loadAccount() {
  const saved = localStorage.getItem("survivor_save_v11");
  if (saved) {
    const parsed = JSON.parse(saved);
    account.level = parsed.level || 1;
    account.currentXp = parsed.currentXp || 0;
    account.nextLevelXp = parsed.nextLevelXp || 1000;
    account.gold = parsed.gold || 0;
    account.petLevels = parsed.petLevels || { drone: 0 };
    account.playerName = parsed.playerName || "Joueur";
    account.bestScore = parsed.bestScore || 0;
    account.bestWave = parsed.bestWave || 0;
  }

  const savedLeaderboard = localStorage.getItem("survivor_leaderboard_v1");
  if (savedLeaderboard) {
    leaderboard = JSON.parse(savedLeaderboard);
  }

  updateMenuUI();
}

function saveAccount() {
  localStorage.setItem("survivor_save_v11", JSON.stringify(account));
  updateMenuUI();
}

function addAccountRewards(xp, gold) {
  account.gold += gold;
  account.currentXp += xp;
  while (account.currentXp >= account.nextLevelXp) {
    account.currentXp -= account.nextLevelXp;
    account.level++;
    account.nextLevelXp = Math.floor(account.nextLevelXp * 1.2);
  }
  saveAccount();
}

function updateMenuUI() {
  document.getElementById("acLvlDisplay").textContent = account.level;
  document.getElementById("acXpDisplay").textContent = `${Math.floor(
    account.currentXp
  )}/${Math.floor(account.nextLevelXp)} XP`;
  document.getElementById("acBarFill").style.width =
    (account.currentXp / account.nextLevelXp) * 100 + "%";
  document.getElementById("acGoldDisplay").textContent = account.gold;
  document.getElementById("shopGoldDisplay").textContent = account.gold;

  // Update player name display
  const nameInput = document.getElementById("playerNameInput");
  const nameDisplay = document.getElementById("currentPlayerName");
  if (nameInput) nameInput.value = account.playerName;
  if (nameDisplay) nameDisplay.textContent = `Joueur: ${account.playerName}`;

  const droneLvl = account.petLevels.drone || 0;
  const droneBtn = document.getElementById("btnDroneContainer");
  const droneBadge = document.getElementById("droneLvlBadge");
  const droneStats = document.getElementById("droneStats");
  const dmg = 5 + droneLvl * 3;
  const cd = (800 * Math.pow(0.95, droneLvl)).toFixed(0);

  if (droneLvl === 0) {
    droneBadge.style.display = "none";
    droneStats.textContent = "Dégâts: 5 | Vitesse: 0.8s";
    droneBtn.innerHTML = `<button class="shop-btn" onclick="upgradePet('drone')" style="margin:0; font-size:14px; padding:5px 10px;">ACHETER (500 💰)</button>`;
  } else {
    droneBadge.style.display = "inline-block";
    droneBadge.textContent = "Lvl " + droneLvl;
    const cost = 500 * droneLvl;
    droneStats.innerHTML = `Actuel: ${dmg} Dmg <br> Coût: ${cost} 💰`;
    if (account.gold >= cost)
      droneBtn.innerHTML = `<button class="shop-btn" onclick="upgradePet('drone')" style="margin:0; font-size:14px; padding:5px 10px;">UPGRADE</button>`;
    else
      droneBtn.innerHTML = `<button class="shop-btn" disabled style="margin:0; font-size:14px; padding:5px 10px; background:#333;">PAS D'OR</button>`;
  }
}

function openShop() {
  document.getElementById("mainMenu").style.display = "none";
  document.getElementById("shopMenu").style.display = "block";
}

function closeShop() {
  document.getElementById("shopMenu").style.display = "none";
  document.getElementById("mainMenu").style.display = "block";
}

function upgradePet(id) {
  const currentLvl = account.petLevels[id] || 0;
  const cost = currentLvl === 0 ? 500 : 500 * currentLvl;
  if (account.gold >= cost) {
    account.gold -= cost;
    account.petLevels[id] = currentLvl + 1;
    saveAccount();
  }
}

function savePlayerName() {
  const input = document.getElementById("playerNameInput");
  if (input && input.value.trim()) {
    account.playerName = input.value.trim().substring(0, 20);
    saveAccount();
  }
}

function openLeaderboard() {
  document.getElementById("mainMenu").style.display = "none";
  document.getElementById("leaderboardMenu").style.display = "block";
  displayLeaderboard();
}

function closeLeaderboard() {
  document.getElementById("leaderboardMenu").style.display = "none";
  document.getElementById("mainMenu").style.display = "block";
}

function displayLeaderboard() {
  const list = document.getElementById("leaderboardList");
  list.innerHTML = "";

  if (leaderboard.length === 0) {
    list.innerHTML =
      "<div style='text-align:center; padding:20px; color:#666'>Aucun score enregistré</div>";
    return;
  }

  leaderboard.forEach((entry, index) => {
    const item = document.createElement("div");
    item.className = "leaderboard-item";
    if (index === 0) item.classList.add("top1");
    if (index === 1) item.classList.add("top2");
    if (index === 2) item.classList.add("top3");

    const medal =
      index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";

    item.innerHTML = `
      <span class="leaderboard-rank">${medal} #${index + 1}</span>
      <span class="leaderboard-name">${entry.name}</span>
      <div style="text-align: right;">
        <span class="leaderboard-score">${entry.score}</span>
        <span class="leaderboard-wave">Vague ${entry.wave}</span>
      </div>
    `;
    list.appendChild(item);
  });
}

function addScoreToLeaderboard(name, score, wave) {
  leaderboard.push({ name, score, wave, date: Date.now() });
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, 50); // Keep top 50
  localStorage.setItem("survivor_leaderboard_v1", JSON.stringify(leaderboard));
}

// --- GAME CONFIG ---
const MAP_SIZE = 3000;
const MAP_BOUNDS = {
  minX: -MAP_SIZE / 2,
  maxX: MAP_SIZE / 2,
  minY: -MAP_SIZE / 2,
  maxY: MAP_SIZE / 2,
};

const game = {
  started: false,
  running: false,
  paused: false,
  wave: 1,
  score: 0,
  kills: 0,
  totalRunXp: 0,
  spawnTimer: 0,
  waveTimer: 0,
  waveDuration: 3600,
  screenShake: 0,
  pendingBoss: [],
  isBossWave: false,
  regenTimer: 0,
};

const camera = { x: 0, y: 0 };

const pet = {
  active: false,
  x: 0,
  y: 0,
  size: 8,
  damage: 5,
  range: 300,
  lastShot: 0,
  cooldown: 800,
};

const player = {
  x: 0,
  y: 0,
  worldX: 0,
  worldY: 0,
  size: 20,
  baseSpeed: 3.0,
  speed: 3.0,
  health: 100,
  maxHealth: 100,
  attack: 5,
  defense: 0,
  attackSpeed: 500,
  lastAttack: 0,
  critChance: 0.05,
  critMultiplier: 1.5,
  level: 1,
  xp: 0,
  xpToNextLevel: 10,
  magnetRadius: 100,
  dashSpeed: 8,
  isDashing: false,
  dashDuration: 10,
  dashTimer: 0,
  dashCooldown: 120,
  dashCooldownTimer: 0,
  abilities: [],
  auraDamage: 0,
  auraRadius: 0,
  lastAuraTick: 0,
  orbitals: 0,
  orbitalAngle: 0,
  ghosts: [],
  inventory: {},
  thorns: 0,
  vampirism: 0,
  explosionChance: 0,
  piercing: 0,
  knockbackMult: 1.0,
  regen: 0,
  greed: 1.0,
  executionThreshold: 0,
};

const statCaps = {
  speed: 10,
  maxHealth: 10000,
  attack: 999,
  defense: 80,
  attackSpeed: 50,
  critChance: 1.0,
  magnet: 600,
};

const keys = {};

document.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.code === "Space") keys["space"] = true;
  if (e.key.toLowerCase() === "p" || e.key === "Escape") {
    if (
      game.started &&
      game.running &&
      document.getElementById("upgradeMenu").style.display !== "block"
    )
      togglePause();
  }
});

document.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
  if (e.code === "Space") keys["space"] = false;
});

let enemies = [];
let projectiles = [];
let enemyProjectiles = [];
let gems = [];
let lootBoxes = [];
let particles = [];
let visualEffects = [];
let floatingTexts = [];

const enemyTypes = {
  normal: {
    health: 20,
    damage: 8,
    speed: 1.8,
    size: 15,
    color: "#ff4444",
    xp: 2,
  },
  fast: {
    health: 12,
    damage: 6,
    speed: 3.0,
    size: 12,
    color: "#ff9944",
    xp: 3,
  },
  tank: {
    health: 80,
    damage: 15,
    speed: 1.2,
    size: 25,
    color: "#9944ff",
    xp: 8,
  },
  ranged: {
    health: 15,
    damage: 12,
    speed: 1.4,
    size: 14,
    color: "#44ff44",
    xp: 4,
    attackRange: 300,
    shootCooldown: 1500,
  },
  miniboss: {
    health: 100,
    damage: 18,
    speed: 2.2,
    size: 30,
    color: "#ffaa00",
    xp: 50,
  },
  boss: {
    health: 1200,
    damage: 55,
    speed: 2.3,
    size: 65,
    color: "#aa00ff",
    xp: 200,
  },
  slime_boss: {
    health: 2000,
    damage: 45,
    speed: 1.0,
    size: 80,
    color: "#00ff00",
    xp: 400,
    splitTo: "slime_big",
    splitCount: 4,
  },
  slime_big: {
    health: 150,
    damage: 20,
    speed: 1.8,
    size: 40,
    color: "#44ff44",
    xp: 20,
    splitTo: "slime_small",
    splitCount: 3,
  },
  slime_small: {
    health: 50,
    damage: 10,
    speed: 3.2,
    size: 18,
    color: "#88ff88",
    xp: 5,
  },
  kamikaze: {
    health: 1,
    damage: 60,
    speed: 4.5,
    size: 12,
    color: "#ff3300",
    xp: 10,
  },
};

function logUpgrade(name) {
  if (!player.inventory[name]) player.inventory[name] = 0;
  player.inventory[name]++;
}

// --- NEW UPGRADES ---
const upgradesList = [
  // COMMUN
  {
    name: "Force Brute",
    rarity: "common",
    icon: "⚔️",
    desc: "+4 Attaque",
    apply: () => {
      player.attack += 4;
      logUpgrade("Force Brute");
      return true;
    },
    canApply: () => true,
  },
  {
    name: "Vitalité",
    rarity: "common",
    icon: "❤️",
    desc: "+50 HP Max",
    apply: () => {
      player.maxHealth += 50;
      player.health += 50;
      createHealEffect(player.worldX, player.worldY);
      logUpgrade("Vitalité");
      return true;
    },
    canApply: () => true,
  },
  {
    name: "Bottes Légères",
    rarity: "common",
    icon: "👟",
    desc: "+10% Vitesse",
    apply: () => {
      if (player.baseSpeed < statCaps.speed) {
        player.baseSpeed *= 1.1;
        logUpgrade("Bottes Légères");
        return true;
      }
      return false;
    },
    canApply: () => player.baseSpeed < statCaps.speed,
  },
  {
    name: "Aimant",
    rarity: "common",
    icon: "🧲",
    desc: "+50% Portée",
    apply: () => {
      player.magnetRadius *= 1.5;
      logUpgrade("Aimant");
      return true;
    },
    canApply: () => player.magnetRadius < statCaps.magnet,
  },
  {
    name: "Avidité",
    rarity: "common",
    icon: "💰",
    desc: "+20% Gain d'Or",
    apply: () => {
      player.greed += 0.2;
      logUpgrade("Avidité");
      return true;
    },
    canApply: () => true,
  },
  {
    name: "Recul",
    rarity: "common",
    icon: "🥊",
    desc: "+50% Force de Recul",
    apply: () => {
      player.knockbackMult += 0.5;
      logUpgrade("Recul");
      return true;
    },
    canApply: () => true,
  },

  // RARE
  {
    name: "Aura de Feu",
    rarity: "rare",
    icon: "🔥",
    desc: "Dégâts de zone constants",
    apply: () => {
      if (player.auraRadius === 0) {
        player.auraRadius = 100;
        player.auraDamage = 5;
        player.abilities.push("aura");
      } else {
        player.auraRadius += 20;
        player.auraDamage += 3;
      }
      logUpgrade("Aura de Feu");
      return true;
    },
    canApply: () => true,
  },
  {
    name: "Mitraillette",
    rarity: "rare",
    icon: "🔫",
    desc: "-15% Cooldown Tir",
    apply: () => {
      if (player.attackSpeed > statCaps.attackSpeed) {
        player.attackSpeed *= 0.85;
        logUpgrade("Mitraillette");
        return true;
      }
      return false;
    },
    canApply: () => player.attackSpeed > statCaps.attackSpeed,
  },
  {
    name: "Sniper",
    rarity: "rare",
    icon: "🎯",
    desc: "+20% Crit & Dégâts",
    apply: () => {
      player.critChance += 0.2;
      player.attack += 5;
      logUpgrade("Sniper");
      return true;
    },
    canApply: () => player.critChance < 0.8,
  },
  {
    name: "Perçage",
    rarity: "rare",
    icon: "🔩",
    desc: "Balles traversent +1 ennemi",
    apply: () => {
      player.piercing += 1;
      logUpgrade("Perçage");
      return true;
    },
    canApply: () => player.piercing < 5,
  },
  {
    name: "Régénération",
    rarity: "rare",
    icon: "💖",
    desc: "+1 HP / sec",
    apply: () => {
      player.regen += 1;
      logUpgrade("Régénération");
      return true;
    },
    canApply: () => true,
  },

  // EPIQUE
  {
    name: "Orbe Protecteur",
    rarity: "epic",
    icon: "🔮",
    desc: "+1 Projectile Rotatif",
    apply: () => {
      player.orbitals++;
      if (!player.abilities.includes("orbit")) player.abilities.push("orbit");
      logUpgrade("Orbe Protecteur");
      return true;
    },
    canApply: () => player.orbitals < 6,
  },
  {
    name: "Multi-Tir",
    rarity: "epic",
    icon: "🏹",
    desc: "+1 Projectile (Max 5)",
    apply: () => {
      if (!player.abilities.includes("multishot"))
        player.abilities.push("multishot");
      let count = player.inventory["Multi-Tir"] || 0;
      player.inventory["Multi-Tir_Level"] = count + 1;
      logUpgrade("Multi-Tir");
      return true;
    },
    canApply: () => (player.inventory["Multi-Tir"] || 0) < 4,
  },
  {
    name: "Épines",
    rarity: "epic",
    icon: "🌵",
    desc: "Renvoie 50% des dégâts",
    apply: () => {
      player.thorns += 0.5;
      logUpgrade("Épines");
      return true;
    },
    canApply: () => player.thorns < 2.0,
  },
  {
    name: "Explosion",
    rarity: "epic",
    icon: "💣",
    desc: "20% chance boum ennemis",
    apply: () => {
      player.explosionChance += 0.2;
      logUpgrade("Explosion");
      return true;
    },
    canApply: () => player.explosionChance < 1.0,
  },

  // LEGENDAIRE
  {
    name: "Vampirisme",
    rarity: "legendary",
    icon: "🩸",
    desc: "2% Vol de Vie par tir",
    apply: () => {
      player.vampirism += 0.02;
      logUpgrade("Vampirisme");
      return true;
    },
    canApply: () => player.vampirism < 0.2,
  },
  {
    name: "Berserker",
    rarity: "legendary",
    icon: "😡",
    desc: "+30 Dégâts, -20% HP",
    apply: () => {
      player.attack += 30;
      player.maxHealth *= 0.8;
      player.health = Math.min(player.health, player.maxHealth);
      logUpgrade("Berserker");
      return true;
    },
    canApply: () => player.maxHealth > 100,
  },
  {
    name: "Divinité",
    rarity: "legendary",
    icon: "✨",
    desc: "Tout +15%",
    apply: () => {
      player.attack *= 1.15;
      player.maxHealth *= 1.15;
      player.health += 20;
      player.baseSpeed *= 1.15;
      logUpgrade("Divinité");
      return true;
    },
    canApply: () => true,
  },
  {
    name: "Exécution",
    rarity: "legendary",
    icon: "💀",
    desc: "Tue instantanément < 20% HP",
    apply: () => {
      player.executionThreshold += 0.2;
      logUpgrade("Exécution");
      return true;
    },
    canApply: () => player.executionThreshold < 0.6,
  },
];

function addScreenShake(amount) {
  game.screenShake = amount;
}

function addFloatingText(x, y, text, color = "#fff", size = 14, duration = 40) {
  floatingTexts.push({
    x,
    y,
    text,
    color,
    size,
    vy: -1.5,
    life: duration,
    maxLife: duration,
  });
}

function createGem(x, y, xpValue) {
  let color = "#ff3333";
  if (xpValue > 10) color = "#33ff33";
  if (xpValue > 50) color = "#3333ff";
  gems.push({ x, y, xp: xpValue, color, vx: 0, vy: 0, collected: false });
}

function gainXp(amount) {
  player.xp += amount;
  game.totalRunXp += amount;
  if (player.xp >= player.xpToNextLevel) {
    player.xp -= player.xpToNextLevel;
    player.level++;
    player.xpToNextLevel = Math.floor(player.xpToNextLevel * 1.3);
    addFloatingText(
      player.worldX,
      player.worldY - 50,
      "LEVEL UP!",
      "#ffd700",
      30,
      100
    );
    createSpawnEffect(player.worldX, player.worldY, "#ffd700");
    showUpgradeMenu();
  }
}

function initGame() {
  loadAccount();

  // Setup name input listener
  const nameInput = document.getElementById("playerNameInput");
  if (nameInput) {
    nameInput.addEventListener("change", savePlayerName);
    nameInput.addEventListener("blur", savePlayerName);
  }

  function menuLoop() {
    if (!game.started) {
      renderMenuBackground();
      requestAnimationFrame(menuLoop);
    }
  }
  menuLoop();
}

function returnToMenu() {
  location.reload();
}

function startGame(isReplay) {
  game.started = true;
  game.running = true;
  game.paused = false;
  game.wave = 1;
  game.score = 0;
  game.kills = 0;
  game.totalRunXp = 0;
  game.spawnTimer = 0;
  game.waveTimer = 0;
  game.pendingBoss = [];
  game.isBossWave = false;

  enemies = [];
  projectiles = [];
  enemyProjectiles = [];
  gems = [];
  lootBoxes = [];
  particles = [];
  visualEffects = [];
  floatingTexts = [];

  player.worldX = 0;
  player.worldY = 0;
  player.level = 1;
  player.xp = 0;
  player.xpToNextLevel = 10;
  player.inventory = {};
  player.abilities = [];
  player.ghosts = [];
  player.orbitals = 0;
  player.auraRadius = 0;
  player.thorns = 0;
  player.vampirism = 0;
  player.explosionChance = 0;
  player.piercing = 0;
  player.knockbackMult = 1.0;
  player.regen = 0;
  player.greed = 1.0;
  player.executionThreshold = 0;

  player.maxHealth = 100 + (account.level - 1) * 5;
  player.health = player.maxHealth;
  player.attack = 5 + (account.level - 1) * 0.5;
  player.attackSpeed = 500;
  player.baseSpeed = 3.0 * (1 + (account.level - 1) * 0.01);
  player.speed = player.baseSpeed;

  const droneLvl = account.petLevels.drone || 0;
  if (droneLvl > 0) {
    pet.active = true;
    pet.x = player.worldX;
    pet.y = player.worldY;
    pet.damage = 5 + droneLvl * 3;
    pet.cooldown = 800 * Math.pow(0.95, droneLvl);
  } else {
    pet.active = false;
  }

  document.getElementById("mainMenu").style.display = "none";
  document.getElementById("gameOver").style.display = "none";
  document.getElementById("ui").style.display = "block";
  document.getElementById("xpContainer").style.display = "block";
  document.getElementById("levelIndicator").style.display = "block";

  spawnWave();
  if (!isReplay) gameLoop();
}

function startNextWave() {
  game.wave++;
  spawnWave();
  addFloatingText(
    player.worldX,
    player.worldY - 50,
    "VAGUE " + game.wave,
    "#00ffff",
    30,
    120
  );
}

function spawnWave() {
  game.waveTimer = 0;
  game.isBossWave = false;
  let bossType = null;
  let warning = "";

  if (game.wave % 8 === 0) {
    bossType = "slime_boss";
    warning = "⚠️ ROI SLIME ⚠️";
    game.isBossWave = true;
  } else if (game.wave % 5 === 0) {
    bossType = "boss";
    warning = "⚠️ BOSS ⚠️";
    game.isBossWave = true;
  } else if (game.wave % 2 === 0 && game.wave > 1) {
    bossType = "miniboss";
    warning = "";
    game.isBossWave = true;
  }

  if (bossType) {
    if (warning) {
      document.getElementById("bossWarning").textContent = warning;
      document.getElementById("bossWarning").style.display = "block";
      setTimeout(() => {
        document.getElementById("bossWarning").style.display = "none";
      }, 3000);
    }
    game.pendingBoss.push({ type: bossType, delay: 180 });
  }
}

function spawnEnemy(type = null, x = null, y = null) {
  if (!type) {
    const rand = Math.random();
    if (game.wave < 3) type = rand < 0.8 ? "normal" : "fast";
    else if (game.wave < 5)
      type = rand < 0.5 ? "normal" : rand < 0.8 ? "fast" : "kamikaze";
    else if (game.wave < 8)
      type =
        rand < 0.5
          ? "normal"
          : rand < 0.7
          ? "fast"
          : rand < 0.9
          ? "ranged"
          : "kamikaze";
    else
      type =
        rand < 0.3
          ? "normal"
          : rand < 0.5
          ? "fast"
          : rand < 0.7
          ? "ranged"
          : rand < 0.85
          ? "tank"
          : rand < 0.95
          ? "kamikaze"
          : "slime_big";
  }

  const template = enemyTypes[type];
  if (x === null || y === null) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 600;
    x = player.worldX + Math.cos(angle) * dist;
    y = player.worldY + Math.sin(angle) * dist;
  }

  x = Math.max(MAP_BOUNDS.minX + 50, Math.min(MAP_BOUNDS.maxX - 50, x));
  y = Math.max(MAP_BOUNDS.minY + 50, Math.min(MAP_BOUNDS.maxY - 50, y));

  if (type.includes("boss")) createSpawnEffect(x, y, template.color);

  const waveMult = 1 + game.wave * 0.35;
  enemies.push({
    x,
    y,
    type,
    health: template.health * waveMult,
    maxHealth: template.health * waveMult,
    damage: template.damage * (1 + game.wave * 0.15),
    speed: Math.min(
      template.speed * 1.4,
      template.speed * (1 + game.wave * 0.03)
    ),
    baseSpeed: Math.min(
      template.speed * 1.4,
      template.speed * (1 + game.wave * 0.03)
    ),
    size: template.size,
    color: template.color,
    xp: template.xp * (1 + game.wave * 0.1),
    attackRange: template.attackRange || 0,
    shootCooldown: Math.max(500, (template.shootCooldown || 0) * 0.95),
    lastShot: 0,
    lastDamage: 0,
    skillTimer: 100,
    isCharging: false,
    aiState: 0,
    targetX: 0,
    targetY: 0,
  });
}

function handleBossBehaviors(e) {
  if (e.type === "miniboss") {
    e.skillTimer--;
    if (e.skillTimer <= 0) {
      const baseAngle = Math.atan2(player.worldY - e.y, player.worldX - e.x);
      const angles = [-0.2, 0, 0.2];
      angles.forEach((offset) => {
        enemyProjectiles.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(baseAngle + offset) * 5,
          vy: Math.sin(baseAngle + offset) * 5,
          size: 10,
          damage: e.damage * 0.7,
          color: "#ff6600",
          canSplit: false,
          life: 70,
        });
      });
      e.skillTimer = 150;
      addFloatingText(e.x, e.y, "TIR!", "#ffaa00", 14, 30);
    }
  }

  if (e.type === "boss") {
    const isEnraged = e.health < e.maxHealth * 0.5;
    if (isEnraged) {
      e.color = "#ff0000";
      e.speed = e.baseSpeed * 1.5;
    }
    e.skillTimer--;
    if (e.skillTimer <= 0) {
      const angle = Date.now() / 200;
      enemyProjectiles.push({
        x: e.x,
        y: e.y,
        vx: Math.cos(angle) * 6,
        vy: Math.sin(angle) * 6,
        size: 10,
        damage: e.damage,
        color: isEnraged ? "#ff0000" : "#aa00ff",
      });
      e.skillTimer = isEnraged ? 5 : 10;
    }
  }

  if (e.type === "slime_boss") {
    e.skillTimer--;
    if (e.isCharging) {
      const dx = player.worldX - e.x;
      const dy = player.worldY - e.y;
      e.x += dx * 0.1;
      e.y += dy * 0.1;
      e.size = 90;
      if (e.skillTimer <= 0) {
        e.isCharging = false;
        e.size = 80;
        e.skillTimer = 300;
        createAoEEffect(e.x, e.y, 200);
        addScreenShake(10);
        if (Math.hypot(player.worldX - e.x, player.worldY - e.y) < 200)
          takeDamage(40);
      }
    } else {
      if (e.skillTimer <= 0) {
        e.isCharging = true;
        e.skillTimer = 40;
        addFloatingText(e.x, e.y, "JUMP!", "#00ff00", 24, 40);
        for (let i = 0; i < 3; i++) spawnEnemy("slime_small", e.x, e.y);
      }
    }
  }
}

function updatePet() {
  if (!pet.active) return;

  const dx = player.worldX - 40 - pet.x;
  const dy = player.worldY - 40 - pet.y;
  pet.x += dx * 0.08;
  pet.y += dy * 0.08;

  const now = Date.now();
  if (now - pet.lastShot > pet.cooldown) {
    let nearest = null,
      minD = Infinity;
    enemies.forEach((e) => {
      const d = Math.hypot(e.x - pet.x, e.y - pet.y);
      if (d < minD) {
        minD = d;
        nearest = e;
      }
    });

    if (nearest && minD < pet.range) {
      pet.lastShot = now;
      const angle = Math.atan2(nearest.y - pet.y, nearest.x - pet.x);
      projectiles.push({
        x: pet.x,
        y: pet.y,
        vx: Math.cos(angle) * 8,
        vy: Math.sin(angle) * 8,
        size: 4,
        damage: pet.damage,
        color: "#00ff88",
        pierce: 0,
      });
    }
  }
}

function update() {
  if (!game.running || game.paused) return;

  game.waveTimer++;
  const progress = Math.min(100, (game.waveTimer / game.waveDuration) * 100);
  document.getElementById("timerBar").style.width = progress + "%";

  if (game.waveTimer > game.waveDuration) {
    addFloatingText(
      player.worldX,
      player.worldY - 80,
      "TEMPS ÉCOULÉ !",
      "#ffaa00",
      20,
      60
    );
    startNextWave();
  }

  const minMobs = 30 + game.wave * 4;
  if (enemies.length < minMobs) {
    spawnEnemy();
  } else {
    game.spawnTimer--;
    if (game.spawnTimer <= 0) {
      spawnEnemy();
      game.spawnTimer = Math.max(5, 60 - game.wave * 2);
    }
  }

  if (game.pendingBoss.length > 0) {
    game.pendingBoss.forEach((b, i) => {
      b.delay--;
      if (b.delay <= 0) {
        spawnEnemy(b.type);
        game.pendingBoss.splice(i, 1);
      }
    });
  }

  // REGEN
  if (player.regen > 0) {
    game.regenTimer++;
    if (game.regenTimer > 60) {
      player.health = Math.min(player.health + player.regen, player.maxHealth);
      game.regenTimer = 0;
    }
  }

  if (player.abilities.includes("aura")) {
    if (Date.now() - player.lastAuraTick > 500) {
      player.lastAuraTick = Date.now();
      let hit = false;
      enemies.forEach((e) => {
        if (
          Math.hypot(e.x - player.worldX, e.y - player.worldY) <
          player.auraRadius
        ) {
          e.health -= player.auraDamage;
          addFloatingText(
            e.x,
            e.y,
            Math.round(player.auraDamage),
            "#ff6600",
            12,
            20
          );
          if (e.health <= 0) killEnemy(e, enemies.indexOf(e));
          hit = true;
        }
      });
      if (hit) createAoEEffect(player.worldX, player.worldY, player.auraRadius);
    }
  }

  if (player.abilities.includes("orbit")) player.orbitalAngle += 0.05;

  if (player.dashCooldownTimer > 0) player.dashCooldownTimer--;
  if (keys["space"] && player.dashCooldownTimer <= 0 && !player.isDashing) {
    player.isDashing = true;
    player.dashTimer = player.dashDuration;
    player.dashCooldownTimer = player.dashCooldown;
    createDashEffect();
  }

  let moveX = 0;
  let moveY = 0;
  if (keys["z"] || keys["w"]) moveY = -1;
  if (keys["s"]) moveY = 1;
  if (keys["q"] || keys["a"]) moveX = -1;
  if (keys["d"]) moveX = 1;

  if (moveX !== 0 && moveY !== 0) {
    const factor = 1 / 1.4142;
    moveX *= factor;
    moveY *= factor;
  }

  if (player.isDashing) {
    player.speed = player.dashSpeed;
    player.dashTimer--;
    if (player.dashTimer % 2 === 0)
      player.ghosts.push({ x: player.worldX, y: player.worldY, life: 10 });
    if (player.dashTimer <= 0) player.isDashing = false;
  } else {
    player.speed = player.baseSpeed;
  }

  player.worldX += moveX * player.speed;
  player.worldY += moveY * player.speed;
  player.worldX = Math.max(
    MAP_BOUNDS.minX + player.size,
    Math.min(MAP_BOUNDS.maxX - player.size, player.worldX)
  );
  player.worldY = Math.max(
    MAP_BOUNDS.minY + player.size,
    Math.min(MAP_BOUNDS.maxY - player.size, player.worldY)
  );

  camera.x = player.worldX - canvas.width / 2;
  camera.y = player.worldY - canvas.height / 2;

  shoot();
  updatePet();
  if (game.screenShake > 0) game.screenShake *= 0.9;

  gems.forEach((g, i) => {
    const dist = Math.hypot(g.x - player.worldX, g.y - player.worldY);
    if (dist < player.magnetRadius) {
      const angle = Math.atan2(player.worldY - g.y, player.worldX - g.x);
      const speed = 10 + (player.magnetRadius - dist) / 10;
      g.x += Math.cos(angle) * speed;
      g.y += Math.sin(angle) * speed;
    }
    if (dist < player.size + 10) {
      gainXp(g.xp);
      gems.splice(i, 1);
    }
  });

  player.ghosts.forEach((g, i) => {
    g.life--;
    if (g.life <= 0) player.ghosts.splice(i, 1);
  });

  for (let i = projectiles.length - 1; i >= 0; i--) {
    let proj = projectiles[i];
    proj.x += proj.vx;
    proj.y += proj.vy;

    if (
      Math.abs(proj.x - player.worldX) > 800 ||
      Math.abs(proj.y - player.worldY) > 800
    ) {
      projectiles.splice(i, 1);
      continue;
    }

    // HIT DETECTION
    if (!proj.hitIds) proj.hitIds = [];
    for (let j = 0; j < enemies.length; j++) {
      let enemy = enemies[j];
      if (proj.hitIds.includes(j)) continue; // Piercing limitation

      if (
        Math.hypot(enemy.x - proj.x, enemy.y - proj.y) <
        enemy.size + proj.size
      ) {
        let damage = proj.damage;
        let isCrit = Math.random() < player.critChance;
        if (isCrit) {
          damage *= player.critMultiplier;
          addScreenShake(2);
        }

        // EXECUTION
        if (
          player.executionThreshold > 0 &&
          enemy.health / enemy.maxHealth < player.executionThreshold &&
          !["boss", "slime_boss"].includes(enemy.type)
        ) {
          damage = enemy.health + 999;
          addFloatingText(enemy.x, enemy.y, "EXEC!", "#ff0000", 20);
        }

        enemy.health -= damage;

        // KNOCKBACK
        const kAngle = Math.atan2(enemy.y - proj.y, enemy.x - proj.x);
        enemy.x += Math.cos(kAngle) * 10 * player.knockbackMult;
        enemy.y += Math.sin(kAngle) * 10 * player.knockbackMult;

        addFloatingText(
          enemy.x,
          enemy.y,
          Math.round(damage) + (isCrit ? "!" : ""),
          isCrit ? "#d000ff" : "#fff",
          isCrit ? 20 : 14
        );

        if (player.vampirism > 0 && Math.random() < 0.3) {
          player.health = Math.min(
            player.health + damage * player.vampirism,
            player.maxHealth
          );
        }

        if (enemy.health <= 0) {
          killEnemy(enemy, j);
          break;
        }

        // PIERCE LOGIC
        if (proj.pierce > 0) {
          proj.pierce--;
          proj.hitIds.push(j); // Remember hit
        } else {
          projectiles.splice(i, 1);
          break;
        }
      }
    }
  }

  enemies.forEach((enemy, idx) => {
    handleBossBehaviors(enemy);

    if (player.abilities.includes("orbit")) {
      for (let k = 0; k < player.orbitals; k++) {
        const angle =
          player.orbitalAngle + ((Math.PI * 2) / player.orbitals) * k;
        const orbX = player.worldX + Math.cos(angle) * 80;
        const orbY = player.worldY + Math.sin(angle) * 80;
        if (Math.hypot(enemy.x - orbX, enemy.y - orbY) < enemy.size + 10) {
          enemy.x += Math.cos(angle) * 5;
          enemy.y += Math.sin(angle) * 5;
          enemy.health -= 2;
          if (enemy.health <= 0) killEnemy(enemy, idx);
        }
      }
    }

    // SMART AI
    let moveX = 0;
    let moveY = 0;
    const distToPlayer = Math.hypot(
      player.worldX - enemy.x,
      player.worldY - enemy.y
    );
    let targetX = player.worldX;
    let targetY = player.worldY;

    if (enemy.type === "fast") {
      targetX += (player.worldX - enemy.x) * 0.2;
      targetY += (player.worldY - enemy.y) * 0.2;
    }

    if (enemy.type === "ranged") {
      if (distToPlayer < 250) {
        targetX = enemy.x - (player.worldX - enemy.x);
        targetY = enemy.y - (player.worldY - enemy.y);
      } else if (distToPlayer > 350) {
      } else {
        targetX = enemy.x;
        targetY = enemy.y;
      }
    }

    const angle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
    moveX = Math.cos(angle);
    moveY = Math.sin(angle);

    enemies.forEach((other, otherIdx) => {
      if (idx === otherIdx) return;
      const d = Math.hypot(enemy.x - other.x, enemy.y - other.y);
      if (d < enemy.size + other.size) {
        const pushX = (enemy.x - other.x) / d;
        const pushY = (enemy.y - other.y) / d;
        moveX += pushX * 1.5;
        moveY += pushY * 1.5;
      }
    });

    const len = Math.hypot(moveX, moveY);
    if (len > 0) {
      moveX /= len;
      moveY /= len;
    }

    enemy.x += moveX * enemy.speed;
    enemy.y += moveY * enemy.speed;

    if (enemy.type === "ranged" && distToPlayer < enemy.attackRange) {
      const now = Date.now();
      if (now - enemy.lastShot > enemy.shootCooldown) {
        enemy.lastShot = now;
        const angle = Math.atan2(
          player.worldY - enemy.y,
          player.worldX - enemy.x
        );
        enemyProjectiles.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * 6,
          vy: Math.sin(angle) * 6,
          size: 6,
          damage: enemy.damage,
          color: "#ff0000",
        });
      }
    }

    if (distToPlayer < player.size + enemy.size) {
      if (enemy.type === "kamikaze") {
        takeDamage(enemy.damage);
        createAoEEffect(enemy.x, enemy.y, 40);
        enemy.health = 0;
        killEnemy(enemy, idx);
        return;
      }

      if (!player.isDashing) {
        const now = Date.now();
        if (now - enemy.lastDamage > 500) {
          let dmg = Math.max(1, enemy.damage - player.defense);
          takeDamage(dmg);
          enemy.lastDamage = now;
          const a = Math.atan2(
            enemy.y - player.worldY,
            enemy.x - player.worldX
          );
          enemy.x += Math.cos(a) * 20;
          enemy.y += Math.sin(a) * 20;

          if (player.thorns > 0) {
            enemy.health -= dmg * player.thorns;
            addFloatingText(
              enemy.x,
              enemy.y,
              Math.round(dmg * player.thorns),
              "#aa00ff",
              12
            );
            if (enemy.health <= 0) killEnemy(enemy, idx);
          }
        }
      }
    }
  });

  lootBoxes.forEach((box, i) => {
    if (
      Math.hypot(player.worldX - box.x, player.worldY - box.y) <
      player.size + box.size
    ) {
      player.health = Math.min(player.maxHealth, player.health + 25);
      createHealEffect(player.worldX, player.worldY);
      addFloatingText(box.x, box.y, "+25 HP", "#00ff00", 16);
      lootBoxes.splice(i, 1);
    }
  });

  particles.forEach((p, i) => {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  });

  floatingTexts.forEach((t, i) => {
    t.y += t.vy;
    t.life--;
    if (t.life <= 0) floatingTexts.splice(i, 1);
  });

  visualEffects.forEach((e, i) => {
    e.life--;
    if (e.type === "aoe") e.radius += 1;
    if (e.life <= 0) visualEffects.splice(i, 1);
  });

  enemyProjectiles.forEach((p, i) => {
    p.x += p.vx;
    p.y += p.vy;

    if (p.canSplit) {
      p.life--;
      if (p.life <= 0) {
        for (let k = 0; k < 4; k++) {
          const angle = (Math.PI / 2) * k;
          enemyProjectiles.push({
            x: p.x,
            y: p.y,
            vx: Math.cos(angle) * 5,
            vy: Math.sin(angle) * 5,
            size: 8,
            damage: p.damage,
            color: "#ff6600",
          });
        }
        enemyProjectiles.splice(i, 1);
        return;
      }
    }

    if (Math.hypot(p.x - player.worldX, p.y - player.worldY) < player.size) {
      if (!player.isDashing) takeDamage(p.damage);
      enemyProjectiles.splice(i, 1);
    } else if (Math.hypot(p.x - player.worldX, p.y - player.worldY) > 700)
      enemyProjectiles.splice(i, 1);
  });

  updateUI();
}

function killEnemy(enemy, index) {
  game.score += enemy.score || 10;
  game.kills++;
  createGem(enemy.x, enemy.y, enemy.xp);

  if (Math.random() < 0.05)
    lootBoxes.push({ x: enemy.x, y: enemy.y, size: 15 });

  if (
    game.isBossWave &&
    (enemy.type === "boss" ||
      enemy.type === "slime_boss" ||
      enemy.type === "miniboss")
  ) {
    let bossRemaining = false;
    enemies.forEach((e, i) => {
      if (
        i !== index &&
        (e.type === "boss" || e.type === "slime_boss" || e.type === "miniboss")
      )
        bossRemaining = true;
    });

    if (!bossRemaining) {
      addFloatingText(
        player.worldX,
        player.worldY - 100,
        "BOSS VAINCU - VAGUE SUIVANTE!",
        "#00ff00",
        24,
        100
      );
      setTimeout(startNextWave, 1000);
    }
  }

  const template = enemyTypes[enemy.type];
  if (template && template.splitTo) {
    for (let i = 0; i < template.splitCount; i++) {
      const offsetX = (Math.random() - 0.5) * 20;
      const offsetY = (Math.random() - 0.5) * 20;
      spawnEnemy(template.splitTo, enemy.x + offsetX, enemy.y + offsetY);
    }
    addFloatingText(enemy.x, enemy.y, "DIVISION!", "#00ff00", 14, 30);
  }

  if (player.explosionChance > 0 && Math.random() < player.explosionChance) {
    createAoEEffect(enemy.x, enemy.y, 60);
    enemies.forEach((e) => {
      if (Math.hypot(e.x - enemy.x, e.y - enemy.y) < 60) {
        e.health -= player.attack * 2;
        addFloatingText(e.x, e.y, "BOOM", "#ffaa00", 14);
      }
    });
  }

  if (index > -1) enemies.splice(index, 1);
  createParticles(enemy.x, enemy.y, enemy.color, 8);
}

function takeDamage(amount) {
  player.health -= amount;
  addScreenShake(5);
  addFloatingText(
    player.worldX,
    player.worldY - 20,
    `-${Math.round(amount)}`,
    "#ff0000",
    16
  );
  if (player.health <= 0) gameOver();
}

function renderMenuBackground() {
  ctx.fillStyle = "#0f3460";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  const gridSize = 50;
  const offset = (Date.now() / 50) % gridSize;

  for (let x = offset; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = offset; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function render() {
  let dx = (Math.random() - 0.5) * game.screenShake;
  let dy = (Math.random() - 0.5) * game.screenShake;
  ctx.save();
  ctx.translate(dx, dy);

  ctx.fillStyle = "#0f3460";
  ctx.fillRect(-dx, -dy, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  const gridSize = 50;
  const offsetX = -camera.x % gridSize;
  const offsetY = -camera.y % gridSize;

  for (let x = offsetX; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = offsetY; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  const toScreen = (wx, wy) => ({ x: wx - camera.x, y: wy - camera.y });
  const tl = toScreen(MAP_BOUNDS.minX, MAP_BOUNDS.minY);
  ctx.strokeStyle = "#ff4444";
  ctx.lineWidth = 4;
  ctx.strokeRect(tl.x, tl.y, MAP_SIZE, MAP_SIZE);

  gems.forEach((g) => {
    const s = toScreen(g.x, g.y);
    ctx.fillStyle = g.color;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 6);
    ctx.lineTo(s.x + 6, s.y);
    ctx.lineTo(s.x, s.y + 6);
    ctx.lineTo(s.x - 6, s.y);
    ctx.fill();
  });

  ctx.fillStyle = "#00ff00";
  lootBoxes.forEach((b) => {
    const s = toScreen(b.x, b.y);
    ctx.fillRect(s.x - b.size / 2, s.y - b.size / 2, b.size, b.size);
  });

  player.ghosts.forEach((g) => {
    const s = toScreen(g.x, g.y);
    ctx.fillStyle = `rgba(0, 255, 255, ${g.life / 20})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, player.size, 0, Math.PI * 2);
    ctx.fill();
  });

  if (player.abilities.includes("aura")) {
    const s = toScreen(player.worldX, player.worldY);
    ctx.beginPath();
    ctx.arc(s.x, s.y, player.auraRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 100, 0, 0.15)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 100, 0, 0.5)";
    ctx.stroke();
  }

  ctx.fillStyle = player.isDashing ? "#ffffff" : "#00ffff";
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, player.size, 0, Math.PI * 2);
  ctx.fill();

  if (!player.isDashing) {
    ctx.fillStyle = "#008888";
    ctx.beginPath();
    ctx.arc(
      canvas.width / 2,
      canvas.height / 2,
      player.size / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  if (pet.active) {
    const s = toScreen(pet.x, pet.y);
    ctx.fillStyle = "#00ff88";
    ctx.beginPath();
    ctx.rect(s.x - pet.size / 2, s.y - pet.size / 2, pet.size, pet.size);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 255, 136, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(canvas.width / 2, canvas.height / 2);
    ctx.stroke();
  }

  if (player.abilities.includes("orbit")) {
    for (let k = 0; k < player.orbitals; k++) {
      const angle = player.orbitalAngle + ((Math.PI * 2) / player.orbitals) * k;
      const sX = canvas.width / 2 + Math.cos(angle) * 80;
      const sY = canvas.height / 2 + Math.sin(angle) * 80;
      ctx.fillStyle = "#00ffff";
      ctx.beginPath();
      ctx.arc(sX, sY, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  enemies.forEach((e) => {
    const s = toScreen(e.x, e.y);
    if (
      s.x < -50 ||
      s.x > canvas.width + 50 ||
      s.y < -50 ||
      s.y > canvas.height + 50
    )
      return;

    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, e.size, 0, Math.PI * 2);
    ctx.fill();

    if (e.isCharging) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, e.size + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "#000";
    ctx.fillRect(s.x - 15, s.y - e.size - 10, 30, 4);
    ctx.fillStyle = "#0f0";
    ctx.fillRect(s.x - 15, s.y - e.size - 10, 30 * (e.health / e.maxHealth), 4);
  });

  ctx.fillStyle = "#ffff00";
  projectiles.forEach((p) => {
    const s = toScreen(p.x, p.y);
    ctx.fillStyle = p.color || "#ffff00";
    ctx.beginPath();
    ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });

  enemyProjectiles.forEach((p) => {
    const s = toScreen(p.x, p.y);
    ctx.fillStyle = p.color || "#ff0000";
    ctx.beginPath();
    ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });

  particles.forEach((p, i) => {
    const s = toScreen(p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life / 30;
    ctx.fillRect(s.x, s.y, 4, 4);
  });
  ctx.globalAlpha = 1;

  visualEffects.forEach((e) => {
    const s = toScreen(e.x, e.y);
    if (e.type === "aoe" || e.type === "spawn") {
      ctx.strokeStyle = e.color || "#ff6600";
      ctx.lineWidth = 3;
      ctx.globalAlpha = e.life / 20;
      ctx.beginPath();
      ctx.arc(s.x, s.y, e.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (e.type === "heal") {
      ctx.strokeStyle = "#0f0";
      ctx.globalAlpha = e.life / 30;
      ctx.beginPath();
      ctx.arc(s.x, s.y, e.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;

  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  floatingTexts.forEach((t) => {
    const s = toScreen(t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.font = `bold ${t.size}px Arial`;
    ctx.globalAlpha = t.life / 20;
    ctx.fillText(t.text, s.x, s.y);
  });
  ctx.globalAlpha = 1;

  const timePct = game.waveTimer / game.waveDuration;
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillRect(canvas.width / 2 - 100, 45, 200, 4);
  ctx.fillStyle = "#00ffff";
  ctx.fillRect(canvas.width / 2 - 100, 45, 200 * timePct, 4);

  ctx.restore();
}

function shoot() {
  const now = Date.now();
  if (now - player.lastAttack < player.attackSpeed) return;

  let nearest = null,
    minD = Infinity;
  enemies.forEach((e) => {
    const d = Math.hypot(e.x - player.worldX, e.y - player.worldY);
    if (d < minD) {
      minD = d;
      nearest = e;
    }
  });

  if (nearest && minD < 600) {
    player.lastAttack = now;
    const angle = Math.atan2(
      nearest.y - player.worldY,
      nearest.x - player.worldX
    );
    let count = 1 + (player.inventory["Multi-Tir_Level"] || 0);

    if (count > 1) {
      let spread = 0.2;
      for (let i = 0; i < count; i++) {
        let offset = (i - (count - 1) / 2) * spread;
        createProjectile(angle + offset);
      }
    } else {
      createProjectile(angle);
    }
  }
}

function createProjectile(angle) {
  projectiles.push({
    x: player.worldX,
    y: player.worldY,
    vx: Math.cos(angle) * 10,
    vy: Math.sin(angle) * 10,
    size: 5,
    damage: player.attack,
    color: "#ffff00",
    pierce: player.piercing,
  });
}

function createParticles(x, y, color, count) {
  for (let i = 0; i < count; i++)
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.5) * 5,
      life: 20 + Math.random() * 20,
      color,
    });
}

function createAoEEffect(x, y, radius) {
  visualEffects.push({
    type: "aoe",
    x,
    y,
    radius: radius,
    life: 15,
    color: "#ff6600",
  });
}

function createSpawnEffect(x, y, color) {
  visualEffects.push({
    type: "spawn",
    x,
    y,
    radius: 10,
    life: 40,
    color,
  });
}

function createHealEffect(x, y) {
  visualEffects.push({
    type: "heal",
    x,
    y,
    radius: 20,
    life: 30,
  });
}

function createDashEffect() {
  createParticles(player.worldX, player.worldY, "#fff", 10);
}

function showUpgradeMenu() {
  game.running = false;
  game.paused = true;
  const menu = document.getElementById("upgradeMenu");
  const options = document.getElementById("upgradeOptions");
  options.innerHTML = "";

  const avail = upgradesList.filter((u) => u.canApply());
  if (avail.length === 0) {
    player.health = Math.min(player.maxHealth, player.health + 50);
    game.running = true;
    game.paused = false;
    return;
  }

  const shuffled = avail.sort(() => 0.5 - Math.random()).slice(0, 3);
  shuffled.forEach((u) => {
    const d = document.createElement("div");
    d.className = `upgrade-option rarity-${u.rarity}`;
    d.innerHTML = `<span class="rarity-tag" style="color:${getRarityColor(
      u.rarity
    )}">${u.rarity}</span><div class="icon">${
      u.icon
    }</div><div class="upg-info"><h4>${u.name}</h4><p>${u.desc}</p></div>`;
    d.onclick = () => {
      if (u.apply()) {
        updateUI();
        menu.style.display = "none";
        game.running = true;
        game.paused = false;
      }
    };
    options.appendChild(d);
  });

  menu.style.display = "block";
}

function getRarityColor(rarity) {
  if (rarity === "legendary") return "#ffaa00";
  if (rarity === "epic") return "#aa00ff";
  if (rarity === "rare") return "#0088ff";
  return "#aaa";
}

function togglePause() {
  game.paused = !game.paused;
  const pm = document.getElementById("pauseMenu");
  pm.style.display = game.paused ? "block" : "none";

  if (game.paused) {
    const invDiv = document.getElementById("pauseInventory");
    let invHtml = "";
    const sortedKeys = Object.keys(player.inventory).sort();

    if (sortedKeys.length === 0)
      invHtml =
        "<div style='text-align:center; padding:10px; color:#666'>Inventaire vide</div>";
    else
      sortedKeys.forEach((key) => {
        if (key.includes("_Level")) return;
        invHtml += `<div class="inv-item"><span>${key}</span><span class="inv-count">x${player.inventory[key]}</span></div>`;
      });

    invDiv.innerHTML = invHtml;
  }
}

function updateUI() {
  document.getElementById("wave").textContent = game.wave;
  document.getElementById("kills").textContent = game.kills;
  document.getElementById("healthText").textContent = `${Math.round(
    player.health
  )}/${Math.round(player.maxHealth)}`;
  document.getElementById("playerHealth").style.width =
    (player.health / player.maxHealth) * 100 + "%";

  const dashPct = 100 - (player.dashCooldownTimer / player.dashCooldown) * 100;
  document.getElementById("dashBar").style.width = dashPct + "%";

  document.getElementById("xpBar").style.width =
    (player.xp / player.xpToNextLevel) * 100 + "%";
  document.getElementById("lvlVal").textContent = player.level;

  document.getElementById("statAtk").textContent = Math.round(player.attack);
  document.getElementById("statDef").textContent = player.defense;
  document.getElementById("statSpd").textContent = player.baseSpeed.toFixed(1);
  document.getElementById("statMagnet").textContent = Math.round(
    player.magnetRadius
  );
  document.getElementById("statCrit").textContent =
    Math.round(player.critChance * 100) + "%";
  document.getElementById("statCdmg").textContent =
    Math.round(player.critMultiplier * 100) + "%";
}

function gameOver() {
  game.running = false;

  // Calculate score: kills * 100 + wave * 500 + level * 50
  const finalScore = game.kills * 100 + game.wave * 500 + player.level * 50;

  const earnedGold = Math.floor(
    game.totalRunXp * 0.5 * player.greed + game.wave * 10
  );
  addAccountRewards(Math.floor(game.totalRunXp), earnedGold);

  // Update best score
  if (finalScore > account.bestScore) {
    account.bestScore = finalScore;
  }
  if (game.wave > account.bestWave) {
    account.bestWave = game.wave;
  }

  // Add to leaderboard
  addScoreToLeaderboard(account.playerName, finalScore, game.wave);
  saveAccount();

  document.getElementById("finalLvl").textContent = player.level;
  document.getElementById("finalWave").textContent = game.wave;
  document.getElementById("finalScore").textContent =
    finalScore.toLocaleString();
  document.getElementById("runXpGain").textContent = Math.floor(
    game.totalRunXp
  );
  document.getElementById("runGoldGain").textContent = earnedGold;
  document.getElementById("gameOver").style.display = "block";
}

function gameLoop() {
  if (game.started) {
    update();
    render();
  }
  requestAnimationFrame(gameLoop);
}

initGame();
