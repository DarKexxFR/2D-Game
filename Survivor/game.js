const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// --- INPUT & MOUSE ---
const input = { mouseX: canvas.width / 2, mouseY: canvas.height / 2 };
window.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  input.mouseX = e.clientX - rect.left;
  input.mouseY = e.clientY - rect.top;
});

// --- DATA MANAGEMENT ---
function resetData() {
  if (
    confirm(
      "Effacer la progression (Niveau, Or) ?\nLe classement et le pseudo seront CONSERVÉS."
    )
  ) {
    localStorage.removeItem("survivor_save_v11");
    location.reload();
  }
}

let currentPseudo = localStorage.getItem("survivor_pseudo") || "Survivor";
document.getElementById("playerPseudo").value = currentPseudo;
function savePseudo() {
  const val = document.getElementById("playerPseudo").value.trim();
  if (val) {
    currentPseudo = val.substring(0, 12);
    localStorage.setItem("survivor_pseudo", currentPseudo);
  }
}
function getLeaderboard() {
  const data = localStorage.getItem("survivor_lb_v1");
  return data ? JSON.parse(data) : [];
}
function saveToLeaderboard(pseudo, wave, xp, lvl) {
  let lb = getLeaderboard();
  lb.push({
    name: pseudo,
    wave: wave,
    xp: xp,
    lvl: lvl,
    date: Date.now(),
  });
  lb.sort((a, b) => b.xp - a.xp);
  lb = lb.slice(0, 10);
  localStorage.setItem("survivor_lb_v1", JSON.stringify(lb));
  return lb.some((entry) => entry.xp === xp && entry.name === pseudo);
}
function openLeaderboard() {
  const lb = getLeaderboard();
  const tbody = document.getElementById("lbContent");
  tbody.innerHTML = "";
  if (lb.length === 0) {
    tbody.innerHTML =
      "<tr><td colspan='4' style='text-align:center; padding:20px; color:#666'>Aucun score enregistré</td></tr>";
  } else {
    lb.forEach((entry, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td class="lb-rank">${index + 1}</td><td>${
        entry.name
      }</td><td>${entry.wave}</td><td>${Math.floor(entry.xp)}</td>`;
      tbody.appendChild(row);
    });
  }
  document.getElementById("mainMenu").style.display = "none";
  document.getElementById("leaderboardMenu").style.display = "block";
}
function closeLeaderboard() {
  document.getElementById("leaderboardMenu").style.display = "none";
  document.getElementById("mainMenu").style.display = "block";
}

// --- ACCOUNT & SHOP ---
const account = {
  level: 1,
  currentXp: 0,
  nextLevelXp: 1000,
  gold: 0,
  petLevels: { drone: 0 },
};
function loadAccount() {
  const saved = localStorage.getItem("survivor_save_v11");
  if (saved) {
    const parsed = JSON.parse(saved);
    account.level = parsed.level || 1;
    account.currentXp = parsed.currentXp || 0;
    account.nextLevelXp = parsed.nextLevelXp || 1000;
    account.gold = parsed.gold || 0;
    account.petLevels = parsed.petLevels || { drone: 0 };
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
  const droneLvl = account.petLevels.drone || 0;
  const droneBtn = document.getElementById("btnDroneContainer");
  const droneBadge = document.getElementById("droneLvlBadge");
  const droneStats = document.getElementById("droneStats");
  const dmg = 5 + droneLvl * 3;
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

// --- GAME LOGIC ---
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
  runGold: 0,
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
  baseSpeed: 4.7,
  speed: 4.7,
  health: 100,
  maxHealth: 100,
  attack: 8,
  defense: 0,
  attackSpeed: 470,
  lastAttack: 0,
  critChance: 0.05,
  critMultiplier: 1.5,
  level: 1,
  xp: 0,
  xpToNextLevel: 10,
  magnetRadius: 100,
  dashSpeed: 12,
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
  hasRayGun: false,
  ultCharge: 0,
  maxUltCharge: 50,
  isUltReady: false,
  buffs: { frenzy: 0, shield: 0, magnet: 0 },
  autoShootActive: false,
};
const mysteryBox = {
  x: 0,
  y: -600,
  w: 80,
  h: 60,
  active: true,
  cost: 100,
  state: "IDLE",
  timer: 0,
  maxTimer: 180,
  colors: ["#00ffff", "#ff00ff", "#ffff00", "#00ff00"],
  colorIdx: 0,
  uses: 0,
  maxUses: 0,
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
let shrines = [];
let particles = [];
let visualEffects = [];
let floatingTexts = [];

const enemyTypes = {
  normal: {
    health: 20,
    damage: 8,
    speed: 2.5,
    size: 15,
    color: "#a23bdb",
    xp: 2,
    gold: 1,
  },
  fast: {
    health: 12,
    damage: 6,
    speed: 4.2,
    size: 12,
    color: "#ff9944",
    xp: 3,
    gold: 2,
  },
  tank: {
    health: 80,
    damage: 15,
    speed: 1.8,
    size: 25,
    color: "#9944ff",
    xp: 8,
    gold: 5,
  },
  ranged: {
    health: 15,
    damage: 12,
    speed: 2.0,
    size: 14,
    color: "#44ff44",
    xp: 4,
    gold: 3,
    attackRange: 300,
    shootCooldown: 1500,
  },
  miniboss: {
    health: 150,
    damage: 25,
    speed: 3.9,
    size: 35,
    color: "#ffaa00",
    xp: 50,
    gold: 20,
  },
  boss: {
    health: 1200,
    damage: 55,
    speed: 3.2,
    size: 65,
    color: "#aa00ff",
    xp: 200,
    gold: 100,
  },
  slime_boss: {
    health: 2000,
    damage: 45,
    speed: 1.5,
    size: 80,
    color: "#00ff00",
    xp: 400,
    gold: 150,
    splitTo: "slime_big",
    splitCount: 4,
  },
  slime_big: {
    health: 150,
    damage: 20,
    speed: 2.5,
    size: 40,
    color: "#44ff44",
    xp: 20,
    gold: 10,
    splitTo: "slime_small",
    splitCount: 3,
  },
  slime_small: {
    health: 50,
    damage: 10,
    speed: 4.5,
    size: 18,
    color: "#88ff88",
    xp: 5,
    gold: 2,
  },
  kamikaze: {
    health: 1,
    damage: 45,
    speed: 5.0,
    size: 12,
    color: "#ff3300",
    xp: 10,
    gold: 1,
  },
};

function logUpgrade(name) {
  if (!player.inventory[name]) player.inventory[name] = 0;
  player.inventory[name]++;
}
const upgradesList = [
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

// --- HELPER FUNCTIONS ---
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
function returnToMenu() {
  location.reload();
}

function startGame(isReplay) {
  savePseudo();
  if (!currentPseudo) {
    alert("Veuillez entrer un pseudo !");
    return;
  }
  game.started = true;
  game.running = true;
  game.paused = false;
  game.wave = 1;
  game.score = 0;
  game.kills = 0;
  game.totalRunXp = 0;
  game.runGold = 0;
  game.spawnTimer = 0;
  game.waveTimer = 0;
  game.pendingBoss = [];
  game.isBossWave = false;
  enemies = [];
  projectiles = [];
  enemyProjectiles = [];
  gems = [];
  lootBoxes = [];
  shrines = [];
  particles = [];
  visualEffects = [];
  floatingTexts = [];

  // Reset Player Stats but keep object ref
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
  player.hasRayGun = false;
  player.ultCharge = 0;
  player.isUltReady = false;
  player.buffs = { frenzy: 0, shield: 0, magnet: 0 };

  // Stat Scaling
  player.maxHealth = 100 + (account.level - 1) * 5;
  player.health = player.maxHealth;
  player.attack = 8 + (account.level - 1) * 0.5;
  player.attackSpeed = 500;
  player.baseSpeed = 4.7 * (1 + (account.level - 1) * 0.01);
  player.speed = player.baseSpeed;

  // Mystery Box Reset
  mysteryBox.state = "IDLE";
  mysteryBox.active = true;
  mysteryBox.uses = 0;
  mysteryBox.maxUses = Math.floor(Math.random() * 5) + 3;

  // Pet
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

  // UI Updates
  document.getElementById("mainMenu").style.display = "none";
  document.getElementById("gameOver").style.display = "none";
  document.getElementById("ui").style.display = "block";
  document.getElementById("xpContainer").style.display = "block";
  document.getElementById("levelIndicator").style.display = "block";
  document.getElementById("boxIndicator").style.display = "block";

  updateUI();
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
    gold: (template.gold || 1) * (1 + player.greed * 0.1),
    attackRange: template.attackRange || 0,
    shootCooldown: Math.max(500, (template.shootCooldown || 0) * 0.95),
    lastShot: 0,
    lastDamage: 0,
    skillTimer: 100,
    isCharging: false,
    aiState: 0,
  });
}

function spawnShrine() {
  const x = player.worldX + (Math.random() - 0.5) * 1000;
  const y = player.worldY + (Math.random() - 0.5) * 1000;
  const types = ["frenzy", "shield", "magnet"];
  const type = types[Math.floor(Math.random() * types.length)];
  let color = "#fff";
  let label = "";
  if (type === "frenzy") {
    color = "#ff0000";
    label = "🔴";
  }
  if (type === "shield") {
    color = "#0000ff";
    label = "🛡️";
  }
  if (type === "magnet") {
    color = "#ffff00";
    label = "🧲";
  }
  shrines.push({ x, y, type, color, label, size: 25 });
}

function handleBossBehaviors(e) {
  if (e.type === "miniboss") {
    e.skillTimer--;
    if (e.skillTimer <= 0) {
      const baseAngle = Math.atan2(player.worldY - e.y, player.worldX - e.x);
      const angles = [-0.3, 0, 0.3];
      angles.forEach((offset) => {
        enemyProjectiles.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(baseAngle + offset) * 7,
          vy: Math.sin(baseAngle + offset) * 7,
          size: 14,
          damage: e.damage,
          color: "#ff6600",
          canSplit: true,
          life: 70,
        });
      });
      e.skillTimer = 100;
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
        if (
          Math.hypot(player.worldX - e.x, player.worldY - e.y) < 200 &&
          player.buffs.shield <= 0
        )
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

function activateUltimate() {
  if (!player.isUltReady) return;
  player.ultCharge = 0;
  player.isUltReady = false;
  addScreenShake(20);
  createAoEEffect(player.worldX, player.worldY, 400);
  enemies.forEach((e, i) => {
    const dist = Math.hypot(e.x - player.worldX, e.y - player.worldY);
    if (dist < 350) {
      e.health -= 200;
      const angle = Math.atan2(e.y - player.worldY, e.x - player.worldX);
      e.x += Math.cos(angle) * 100;
      e.y += Math.sin(angle) * 100;
      addFloatingText(e.x, e.y, "ULT!", "#ff6600", 24);
      if (e.health <= 0) killEnemy(e, i);
    }
  });
  updateUI();
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

  if (player.buffs.frenzy > 0) player.buffs.frenzy--;
  if (player.buffs.shield > 0) player.buffs.shield--;
  if (player.buffs.magnet > 0) player.buffs.magnet--;
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
  if (Math.random() < 0.001) spawnShrine();
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
  if (keys["r"]) activateUltimate();
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
      player.ghosts.push({
        x: player.worldX,
        y: player.worldY,
        life: 10,
      });
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

  const ind = document.getElementById("boxIndicator");
  if (player.worldY > -400) ind.style.display = "block";
  else ind.style.display = "none";

  if (mysteryBox.active) {
    if (mysteryBox.state === "OPENING") {
      mysteryBox.timer--;
      if (mysteryBox.timer % 5 === 0)
        mysteryBox.colorIdx =
          (mysteryBox.colorIdx + 1) % mysteryBox.colors.length;
      if (mysteryBox.timer <= 0) {
        mysteryBox.uses++;
        if (mysteryBox.uses >= mysteryBox.maxUses) {
          mysteryBox.state = "BROKEN";
          mysteryBox.timer = 120;
          addFloatingText(
            mysteryBox.x,
            mysteryBox.y - 100,
            "NOUNOURS!",
            "#ff0000",
            30,
            120
          );
        } else {
          mysteryBox.state = "IDLE";
          giveBoxReward();
        }
      }
    } else if (mysteryBox.state === "BROKEN") {
      mysteryBox.y -= 3;
      mysteryBox.timer--;
      if (mysteryBox.timer <= 0) mysteryBox.active = false;
    } else if (mysteryBox.state === "IDLE") {
      const dist = Math.hypot(
        mysteryBox.x - player.worldX,
        mysteryBox.y - player.worldY
      );
      if (dist < 100 && keys["e"]) {
        if (game.runGold >= mysteryBox.cost) {
          game.runGold -= mysteryBox.cost;
          updateUI();
          mysteryBox.state = "OPENING";
          mysteryBox.timer = mysteryBox.maxTimer;
          addFloatingText(
            mysteryBox.x,
            mysteryBox.y - 50,
            "-100 OR",
            "#ffff00",
            20
          );
          keys["e"] = false;
        } else {
          addFloatingText(
            mysteryBox.x,
            mysteryBox.y - 50,
            "PAS ASSEZ D'OR",
            "#ff0000",
            16
          );
          keys["e"] = false;
        }
      }
    }
  }

  shoot();
  updatePet();
  if (game.screenShake > 0) game.screenShake *= 0.9;

  const magnetR = player.buffs.magnet > 0 ? 3000 : player.magnetRadius;
  gems.forEach((g, i) => {
    const dist = Math.hypot(g.x - player.worldX, g.y - player.worldY);
    if (dist < magnetR) {
      const angle = Math.atan2(player.worldY - g.y, player.worldX - g.x);
      const speed = 10 + (magnetR - dist) / 10;
      g.x += Math.cos(angle) * speed;
      g.y += Math.sin(angle) * speed;
    }
    if (dist < player.size + 10) {
      gainXp(g.xp);
      gems.splice(i, 1);
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
  shrines.forEach((s, i) => {
    if (
      Math.hypot(player.worldX - s.x, player.worldY - s.y) <
      player.size + s.size
    ) {
      addFloatingText(
        player.worldX,
        player.worldY - 50,
        s.label + " ACTIVÉ!",
        s.color,
        20
      );
      createSpawnEffect(player.worldX, player.worldY, s.color);
      if (s.type === "frenzy") player.buffs.frenzy = 600;
      if (s.type === "shield") player.buffs.shield = 600;
      if (s.type === "magnet") player.buffs.magnet = 300;
      shrines.splice(i, 1);
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
    if (!proj.hitIds) proj.hitIds = [];
    for (let j = 0; j < enemies.length; j++) {
      let enemy = enemies[j];
      if (proj.hitIds.includes(j)) continue;
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
        if (
          player.executionThreshold > 0 &&
          enemy.health / enemy.maxHealth < player.executionThreshold &&
          !["boss", "slime_boss"].includes(enemy.type)
        ) {
          damage = enemy.health + 999;
          addFloatingText(enemy.x, enemy.y, "EXEC!", "#ff0000", 20);
        }
        enemy.health -= damage;
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
        if (proj.pierce > 0) {
          proj.pierce--;
          proj.hitIds.push(j);
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
      if (!player.isDashing && player.buffs.shield <= 0) {
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
      if (!player.isDashing && player.buffs.shield <= 0) takeDamage(p.damage);
      enemyProjectiles.splice(i, 1);
    } else if (Math.hypot(p.x - player.worldX, p.y - player.worldY) > 700)
      enemyProjectiles.splice(i, 1);
  });
  updateUI();
}

function giveBoxReward() {
  const roll = Math.random();
  let reward = "";
  let color = "#fff";
  if (roll < 0.4) {
    gainXp(500);
    reward = "JACKPOT XP!";
    color = "#ffff00";
  } else if (roll < 0.7) {
    player.health = player.maxHealth;
    createHealEffect(player.worldX, player.worldY);
    reward = "SOIN MAX";
    color = "#00ff00";
  } else if (roll < 0.9) {
    player.attackSpeed = 50;
    setTimeout(() => {
      player.attackSpeed = 500;
      addFloatingText(player.worldX, player.worldY, "FIN SURCHARGE", "#ccc");
    }, 10000);
    reward = "SURCHARGE (10s)";
    color = "#ff6600";
  } else if (roll < 0.98) {
    enemies.forEach((e, i) => {
      e.health = 0;
      killEnemy(e, i);
    });
    addScreenShake(20);
    createAoEEffect(player.worldX, player.worldY, 1000);
    reward = "☢️ NUKE ☢️";
    color = "#ff0000";
  } else {
    player.hasRayGun = true;
    player.attack += 20;
    reward = "🔫 RAY GUN 🔫";
    color = "#00ffff";
  }
  addFloatingText(mysteryBox.x, mysteryBox.y - 100, reward, color, 30, 150);
  createSpawnEffect(mysteryBox.x, mysteryBox.y, color);
}

function killEnemy(enemy, index) {
  game.score += enemy.score || 10;
  game.kills++;
  createGem(enemy.x, enemy.y, enemy.xp);
  const goldDrop = Math.floor(enemy.gold * (1 + player.greed * 0.1));
  game.runGold += goldDrop;
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

  if (!player.isUltReady) {
    player.ultCharge++;
    if (player.ultCharge >= player.maxUltCharge) {
      player.ultCharge = player.maxUltCharge;
      player.isUltReady = true;
      addFloatingText(
        player.worldX,
        player.worldY,
        "ULTIME PRÊT (R)!",
        "#ffaa00",
        30,
        60
      );
    }
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
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const stars = 100;
  ctx.fillStyle = "#fff";
  for (let i = 0; i < stars; i++) {
    ctx.fillRect(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      2,
      2
    );
  }
}

function render() {
  let dx = (Math.random() - 0.5) * game.screenShake;
  let dy = (Math.random() - 0.5) * game.screenShake;
  ctx.save();
  ctx.translate(dx, dy);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid
  ctx.strokeStyle = "rgba(157, 0, 255, 0.15)";
  ctx.lineWidth = 1;
  const gridSize = 60;
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
  ctx.strokeStyle = "#ff0055";
  ctx.lineWidth = 5;
  ctx.shadowBlur = 20;
  ctx.shadowColor = "#ff0055";
  ctx.strokeRect(tl.x, tl.y, MAP_SIZE, MAP_SIZE);
  ctx.shadowBlur = 0;

  // Mystery Box
  if (mysteryBox.active) {
    const boxS = toScreen(mysteryBox.x, mysteryBox.y);
    ctx.shadowBlur = 30;
    ctx.shadowColor =
      mysteryBox.state === "OPENING"
        ? mysteryBox.colors[mysteryBox.colorIdx]
        : "#00ffff";
    ctx.fillStyle = mysteryBox.state === "BROKEN" ? "#333" : "#0055aa";
    ctx.fillRect(
      boxS.x - mysteryBox.w / 2,
      boxS.y - mysteryBox.h / 2,
      mysteryBox.w,
      mysteryBox.h
    );
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(
      boxS.x - mysteryBox.w / 2,
      boxS.y - mysteryBox.h / 2,
      mysteryBox.w,
      mysteryBox.h / 2
    );
    ctx.shadowBlur = 0;
    if (mysteryBox.state === "BROKEN") {
      ctx.fillStyle = "#000";
      ctx.font = "24px Arial";
      ctx.textAlign = "center";
      ctx.fillText("🧸", boxS.x, boxS.y + 5);
    } else {
      ctx.fillStyle = "#fff";
      ctx.font = "900 30px Orbitron";
      ctx.textAlign = "center";
      ctx.fillText("?", boxS.x, boxS.y + 10);
    }
    if (mysteryBox.state === "OPENING") {
      const pct = 1 - mysteryBox.timer / mysteryBox.maxTimer;
      ctx.fillStyle = "#111";
      ctx.fillRect(boxS.x - 40, boxS.y - 50, 80, 6);
      ctx.fillStyle = "#ffff00";
      ctx.fillRect(boxS.x - 40, boxS.y - 50, 80 * pct, 6);
    }
    const dist = Math.hypot(
      mysteryBox.x - player.worldX,
      mysteryBox.y - player.worldY
    );
    if (dist < 100 && mysteryBox.state === "IDLE") {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px Orbitron";
      ctx.fillText("[E] 100 OR", boxS.x, boxS.y - 40);
    }
  }

  // Shrines
  shrines.forEach((s) => {
    const ss = toScreen(s.x, s.y);
    ctx.shadowBlur = 20;
    ctx.shadowColor = s.color;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(ss.x, ss.y, s.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(s.label, ss.x, ss.y + 7);
    ctx.strokeStyle = s.color;
    ctx.beginPath();
    ctx.arc(
      ss.x,
      ss.y,
      s.size + Math.sin(Date.now() / 200) * 5,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  });

  gems.forEach((g) => {
    const s = toScreen(g.x, g.y);
    ctx.fillStyle = g.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = g.color;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 6);
    ctx.lineTo(s.x + 6, s.y);
    ctx.lineTo(s.x, s.y + 6);
    ctx.lineTo(s.x - 6, s.y);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
  lootBoxes.forEach((b) => {
    const s = toScreen(b.x, b.y);
    ctx.fillStyle = "#00ff00";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#00ff00";
    ctx.fillRect(s.x - b.size / 2, s.y - b.size / 2, b.size, b.size);
    ctx.shadowBlur = 0;
  });

  player.ghosts.forEach((g) => {
    const s = toScreen(g.x, g.y);
    ctx.fillStyle = `rgba(0, 255, 255, ${g.life / 30})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, player.size, 0, Math.PI * 2);
    ctx.fill();
  });
  if (player.abilities.includes("aura")) {
    const s = toScreen(player.worldX, player.worldY);
    ctx.beginPath();
    ctx.arc(s.x, s.y, player.auraRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 100, 0, 0.1)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 100, 0, 0.3)";
    ctx.stroke();
  }

  const ps = toScreen(player.worldX, player.worldY);
  if (player.buffs.shield > 0) {
    ctx.strokeStyle = "#0088ff";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#0088ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ps.x, ps.y, player.size + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  if (player.buffs.frenzy > 0) {
    ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
    ctx.beginPath();
    ctx.arc(ps.x, ps.y, player.size + 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = player.isDashing
    ? "#ffffff"
    : player.hasRayGun
    ? "#00ff88"
    : "#00ccff";
  ctx.shadowBlur = 20;
  ctx.shadowColor = ctx.fillStyle;
  ctx.beginPath();
  ctx.arc(ps.x, ps.y, player.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (!player.isDashing) {
    ctx.fillStyle = "#003355";
    ctx.beginPath();
    ctx.arc(ps.x, ps.y, player.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (pet.active) {
    const s = toScreen(pet.x, pet.y);
    ctx.fillStyle = "#00ff88";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#00ff88";
    ctx.beginPath();
    ctx.rect(s.x - pet.size / 2, s.y - pet.size / 2, pet.size, pet.size);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  if (player.abilities.includes("orbit")) {
    for (let k = 0; k < player.orbitals; k++) {
      const angle = player.orbitalAngle + ((Math.PI * 2) / player.orbitals) * k;
      const sX = ps.x + Math.cos(angle) * 80;
      const sY = ps.y + Math.sin(angle) * 80;
      ctx.fillStyle = "#00ffff";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#00ffff";
      ctx.beginPath();
      ctx.arc(sX, sY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
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
    ctx.shadowBlur = 10;
    ctx.shadowColor = e.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, e.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(
      s.x - e.size * 0.3,
      s.y - e.size * 0.2,
      e.size * 0.15,
      0,
      Math.PI * 2
    );
    ctx.arc(
      s.x + e.size * 0.3,
      s.y - e.size * 0.2,
      e.size * 0.15,
      0,
      Math.PI * 2
    );
    ctx.fill();
    // Fixed Health Bar
    const hpBarW = 40;
    const hpPercent = Math.max(0, Math.min(1, e.health / e.maxHealth));
    ctx.fillStyle = "#220000";
    ctx.fillRect(s.x - hpBarW / 2, s.y - e.size - 12, hpBarW, 5);
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(s.x - hpBarW / 2, s.y - e.size - 12, hpBarW * hpPercent, 5);
  });

  projectiles.forEach((p) => {
    const s = toScreen(p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = p.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
  enemyProjectiles.forEach((p) => {
    const s = toScreen(p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = p.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
  particles.forEach((p, i) => {
    const s = toScreen(p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life / 30;
    ctx.fillRect(s.x, s.y, 3, 3);
  });
  ctx.globalAlpha = 1;

  visualEffects.forEach((e) => {
    const s = toScreen(e.x, e.y);
    if (e.type === "aoe" || e.type === "spawn") {
      ctx.strokeStyle = e.color || "#ff6600";
      ctx.lineWidth = 4;
      ctx.globalAlpha = e.life / 20;
      ctx.beginPath();
      ctx.arc(s.x, s.y, e.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (e.type === "heal") {
      ctx.strokeStyle = "#00ff00";
      ctx.globalAlpha = e.life / 30;
      ctx.beginPath();
      ctx.arc(s.x, s.y, e.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;

  if (player.isUltReady) {
    ctx.strokeStyle = "rgba(255, 170, 0, 0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(
      ps.x,
      ps.y,
      player.size + 18 + Math.sin(Date.now() / 100) * 4,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }

  ctx.font = "bold 16px Orbitron";
  ctx.textAlign = "center";
  floatingTexts.forEach((t) => {
    const s = toScreen(t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.shadowColor = "black";
    ctx.shadowBlur = 2;
    ctx.font = `bold ${t.size}px Orbitron`;
    ctx.globalAlpha = t.life / 20;
    ctx.fillText(t.text, s.x, s.y);
    ctx.shadowBlur = 0;
  });
  ctx.globalAlpha = 1;

  // Top HUD Gradient Line
  const timePct = game.waveTimer / game.waveDuration;
  ctx.fillStyle = "#003344";
  ctx.fillRect(canvas.width / 2 - 150, 55, 300, 6);
  ctx.fillStyle = "#00ffff";
  ctx.shadowBlur = 10;
  ctx.shadowColor = "#00ffff";
  ctx.fillRect(canvas.width / 2 - 150, 55, 300 * timePct, 6);
  ctx.shadowBlur = 0;

  ctx.restore();
}

window.addEventListener("keydown", (a) => {
  if (a.key === "a" || a.key === "A") {
    player.autoShootActive = !player.autoShootActive; // On inverse l'état
    console.log("Autoshoot:", player.autoShootActive);
  }
});

function getNearestEnemy() {
  let nearest = null;
  let minDist = Infinity;

  enemies.forEach((e) => {
    const dist = Math.hypot(e.x - player.worldX, e.y - player.worldY);
    if (dist < minDist) {
      minDist = dist;
      nearest = e;
    }
  });
  return nearest;
}

function shoot() {
  const now = Date.now();
  let fireRate = player.attackSpeed;
  if (player.buffs.frenzy > 0) fireRate /= 3;

  // Vérification du délai de tir
  if (now - player.lastAttack < fireRate) return;

  const playerScreenX = canvas.width / 2;
  const playerScreenY = canvas.height / 2;
  let angle = 0;

  // LOGIQUE DE VISÉE
  if (player.autoShootActive) {
    // Si autoshoot actif : on cherche l'ennemi le plus proche
    const target = getNearestEnemy();
    if (target) {
      // Si on a une cible, on vise vers elle (coordonnées monde)
      angle = Math.atan2(target.y - player.worldY, target.x - player.worldX);
    } else {
      // Pas d'ennemi ? On ne tire pas (ou tu peux laisser tirer vers la souris si tu préfères)
      return;
    }
  } else {
    // Si autoshoot inactif : on vise la souris (coordonnées écran)
    angle = Math.atan2(
      input.mouseY - playerScreenY,
      input.mouseX - playerScreenX
    );
  }

  // On met à jour le moment du dernier tir
  player.lastAttack = now;

  // Création des projectiles (gestion du Multi-Tir)
  let count = 1 + (player.inventory["Multi-Tir_Level"] || 0);
  if (count > 1) {
    let spread = 0.2; // Écart entre les balles
    for (let i = 0; i < count; i++) {
      let offset = (i - (count - 1) / 2) * spread;
      createProjectile(angle + offset);
    }
  } else {
    createProjectile(angle);
  }
}

function createProjectile(angle) {
  const color = player.hasRayGun ? "#00ff88" : "#ffff00";
  const size = player.hasRayGun ? 8 : 5;
  projectiles.push({
    x: player.worldX,
    y: player.worldY,
    vx: Math.cos(angle) * 10,
    vy: Math.sin(angle) * 10,
    size: size,
    damage: player.attack,
    color: color,
    pierce: player.piercing + (player.hasRayGun ? 2 : 0),
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
  visualEffects.push({ type: "heal", x, y, radius: 20, life: 30 });
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

  // 1. On récupère les améliorations possibles
  // Note: on utilise 'let' pour pouvoir modifier le tableau (retirer les élus)
  let avail = upgradesList.filter((u) => u.canApply());

  if (avail.length === 0) {
    // Soin de secours si plus rien n'est dispo
    player.health = Math.min(player.maxHealth, player.health + 50);
    game.running = true;
    game.paused = false;
    return;
  }

  // --- DÉBUT DU SYSTÈME DE RARETÉ ---
  const rarityWeights = {
    common: 100, // Très fréquent
    rare: 50, // Fréquent
    epic: 15, // Rare
    legendary: 3, // Très rare (~2% de chance vs common)
  };

  const selectedUpgrades = [];

  // On boucle 3 fois pour choisir 3 cartes
  for (let i = 0; i < 3; i++) {
    if (avail.length === 0) break;

    // A. Calculer le poids total actuel
    let totalWeight = 0;
    avail.forEach((u) => {
      totalWeight += rarityWeights[u.rarity] || 10;
    });

    // B. Tirer un nombre aléatoire dans cette masse
    let randomVal = Math.random() * totalWeight;

    // C. Trouver quel item correspond à ce nombre
    let selectedIndex = -1;
    for (let j = 0; j < avail.length; j++) {
      let weight = rarityWeights[avail[j].rarity] || 10;
      randomVal -= weight;
      if (randomVal <= 0) {
        selectedIndex = j;
        break;
      }
    }

    // D. Ajouter l'item et le retirer de la liste disponible (pour éviter les doublons)
    if (selectedIndex !== -1) {
      selectedUpgrades.push(avail[selectedIndex]);
      avail.splice(selectedIndex, 1);
    }
  }
  // --- FIN DU SYSTÈME DE RARETÉ ---

  // Affichage des cartes choisies (on utilise selectedUpgrades au lieu de shuffled)
  selectedUpgrades.forEach((u) => {
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
  document.getElementById("uiRunGold").textContent = game.runGold;
  const ultPct = (player.ultCharge / player.maxUltCharge) * 100;
  document.getElementById("ultBar").style.width = ultPct + "%";
  document.getElementById("ultReadyText").style.display = player.isUltReady
    ? "block"
    : "none";
}

function gameOver() {
  game.running = false;
  addAccountRewards(Math.floor(game.totalRunXp), game.runGold);
  const isNewRecord = saveToLeaderboard(
    currentPseudo,
    game.wave,
    game.totalRunXp,
    player.level
  );
  document.getElementById("finalPseudo").textContent = currentPseudo;
  document.getElementById("finalLvl").textContent = player.level;
  document.getElementById("finalWave").textContent = game.wave;
  document.getElementById("runXpGain").textContent = Math.floor(
    game.totalRunXp
  );
  document.getElementById("runGoldGain").textContent = game.runGold;
  document.getElementById("newRecordMsg").style.display = isNewRecord
    ? "block"
    : "none";
  document.getElementById("gameOver").style.display = "block";
}
function gameLoop() {
  if (game.started) {
    update();
    render();
  }

  if (input.isShooting || player.autoShootActive) {
    shoot();
  }
  requestAnimationFrame(gameLoop);
}

// LOAD ON START
window.onload = function () {
  loadAccount();
  document.getElementById("mainMenu").style.display = "block";
  function menuLoop() {
    if (!game.started) {
      renderMenuBackground();
      requestAnimationFrame(menuLoop);
    }
  }
  menuLoop();
};
