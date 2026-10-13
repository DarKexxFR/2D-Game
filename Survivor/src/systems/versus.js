// Duel 1 contre 1 sur le même écran : deux vaisseaux qui se tirent dessus automatiquement,
// 3 vies chacun. Celui qui meurt choisit 3 améliorations avant de revenir (rattrapage).
//
// Le reste du jeu suppose un seul `player` : chaque combattant est un objet joueur complet
// (mêmes champs, mêmes améliorations) et `withFighter` le charge dans `player` le temps
// d'appeler les fonctions existantes (rendu du vaisseau, orbes, aura).

import { KUNAI, NET, SURVIVAL, VERSUS } from "../config.js";
import { view } from "../core/canvas.js";
import { emit } from "../core/events.js";
import { isAnyKeyDown, isDown, touchMove } from "../core/input.js";
import { camera, game, player, resetPlayer, world } from "../core/state.js";
import { playSfx, vibrate } from "../services/sfx.js";
import { angleTo, clamp, dist } from "../utils/math.js";
import { auraRadius, getOrbitalPositions, orbitalStats } from "./combat.js";
import {
  addFloatingText,
  addScreenShake,
  createAoEEffect,
  createParticles,
  createShockwave,
  createSpawnEffect,
  flashScreen,
  slowMotion,
} from "./effects.js";
import { applyEquipment } from "./equipment.js";

/** Touches de chaque joueur (le joueur 1 garde ZQSD / WASD, le joueur 2 prend les flèches). */
export const VERSUS_KEYS = [
  { up: ["z", "w"], down: ["s"], left: ["q", "a"], right: ["d"], dash: ["space", "f"] },
  {
    up: ["arrowup"],
    down: ["arrowdown"],
    left: ["arrowleft"],
    right: ["arrowright"],
    dash: ["enter", "0", "l"],
  },
];

/** En ligne, chacun ne pilote que son vaisseau : toutes les touches de déplacement servent. */
const ONLINE_KEYS = Object.fromEntries(
  Object.keys(VERSUS_KEYS[0]).map((k) => [k, [...VERSUS_KEYS[0][k], ...VERSUS_KEYS[1][k]]]),
);

/** Joysticks tactiles (écrits par ui/versusTouch.js) : direction et dash demandé. */
export const versusTouch = [
  { x: 0, y: 0, dash: false },
  { x: 0, y: 0, dash: false },
];

export const versus = {
  active: false,
  fighters: [],
  lives: [],
  winner: null, // index du vainqueur une fois le duel terminé
  endTimer: 0,
  trails: [], // traînées de dash { x, y, color, size, angle, life }
  online: null, // duel en ligne : { role: "host" | "guest", local: index du vaisseau piloté ici }
  names: [], // pseudos en ligne
  remote: null, // hôte : dernière position envoyée par l'invité
  fx: [], // hôte en ligne : effets à reproduire chez l'invité (coups, morts, retours)
  wait: null, // message d'attente affiché (adversaire qui choisit ses améliorations...)
};

const START_LIVES = () => Array(2).fill(VERSUS.lives);

/** Nom affiché d'un joueur. */
export function fighterName(i) {
  return versus.names[i] || `JOUEUR ${i + 1}`;
}

/** Le vaisseau est-il piloté sur cet appareil ? (les deux en local, un seul en ligne) */
export function isLocalFighter(f) {
  return !versus.online || f.index === versus.online.local;
}

/** Bords de l'arène : un rectangle centré qui tient dans l'écran (laisse la place au HUD en haut). */
export function arenaBounds() {
  if (versus.online) {
    // En ligne : la même arène pour les deux joueurs, quel que soit l'écran (zoomée au rendu)
    const { width: w, height: h } = NET.arena;
    return { minX: -w / 2, maxX: w / 2, minY: -h / 2, maxY: h / 2 };
  }
  const a = VERSUS.arena;
  const w = Math.min(a.maxWidth, view.width - a.margin * 2);
  const h = Math.min(a.maxHeight, view.height - a.top - a.margin);
  const cy = (a.top - a.margin) / 2; // décalé vers le bas sous le HUD
  return { minX: -w / 2, maxX: w / 2, minY: cy - h / 2, maxY: cy + h / 2 };
}

function spawnPoint(i) {
  const b = arenaBounds();
  const wide = b.maxX - b.minX >= b.maxY - b.minY;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const side = i === 0 ? -1 : 1;
  // Écran large : gauche / droite ; écran en portrait : bas / haut
  return wide
    ? { x: cx + side * (b.maxX - b.minX) * 0.35, y: cy }
    : { x: cx, y: cy - side * (b.maxY - b.minY) * 0.35 };
}

function createFighter(i) {
  resetPlayer(1); // même base pour les deux : ni niveau de compte ni talents
  const base = { level: 1, prestige: 1 };
  applyEquipment({ hero: { id: "pilot", ...base }, weapon: { id: "blaster", ...base } });
  const color = VERSUS.colors[i];
  const p = spawnPoint(i);
  return {
    ...player,
    maxHealth: player.maxHealth * VERSUS.healthMult,
    health: player.maxHealth * VERSUS.healthMult,
    hero: { ...player.hero, color },
    weapon: { ...player.weapon, color },
    worldX: p.x,
    worldY: p.y,
    aimAngle: i === 0 ? 0 : Math.PI,
    index: i,
    alive: true,
    respawnTimer: 0,
    spawnSeq: 0, // compte les retours en jeu (en ligne : l'invité se replace sur son point de départ)
    regenTimer: 0,
    lastOrbitalHit: -Infinity,
    hitTime: -Infinity,
  };
}

/** Lance un duel (appelé après resetGame) ; `online` = { role, local } pour un duel en ligne. */
export function startVersus(online = null, names = []) {
  versus.active = true;
  versus.online = online;
  versus.names = names;
  versus.remote = null;
  versus.fx.length = 0;
  versus.wait = null;
  versus.fighters = [createFighter(0), createFighter(1)];
  versus.lives = START_LIVES();
  versus.winner = null;
  versus.endTimer = 0;
  versus.trails.length = 0;
  for (const t of versusTouch) Object.assign(t, { x: 0, y: 0, dash: false });
  centerCamera();
}

export function stopVersus() {
  versus.active = false;
  versus.online = null;
  versus.names = [];
}

/** Charge un combattant dans `player` le temps d'appeler `fn`, puis récupère ses changements. */
export function withFighter(f, fn) {
  for (const k of Object.keys(player)) delete player[k];
  Object.assign(player, f);
  try {
    return fn();
  } finally {
    Object.assign(f, player);
  }
}

function centerCamera() {
  camera.x = -view.width / 2;
  camera.y = -view.height / 2;
}

// --- MISE À JOUR (un tick) ---

export function updateVersus() {
  centerCamera();
  const bounds = arenaBounds();
  const [a, b] = versus.fighters;
  for (const f of versus.fighters) {
    if (f.alive) {
      updateStatus(f);
      if (isLocalFighter(f)) updateMovement(f, bounds);
      else applyRemote(f, bounds);
    } else if (!game.over && --f.respawnTimer <= 0) respawn(f);
  }
  if (a.alive && b.alive && !game.over) {
    attack(a, b);
    attack(b, a);
  }
  updateProjectiles(bounds);
  updateTrails();

  if (game.over && --versus.endTimer <= 0 && game.running) {
    game.running = false;
    emit("versusOver", versus.winner);
  }
}

export function updateTrails() {
  for (const t of versus.trails) t.life--;
  keep(versus.trails, (t) => t.life > 0);
}

/** Bonus temporaires et régénération (calculés par l'hôte seulement). */
function updateStatus(f) {
  const b = f.buffs;
  for (const k of Object.keys(b)) if (b[k] > 0) b[k]--;
  if (f.regen > 0 && ++f.regenTimer > 60) {
    f.regenTimer = 0;
    f.health = Math.min(f.maxHealth, f.health + f.regen);
  }
}

/** Commandes du vaisseau `f` sur cet appareil : direction (dx, dy) et dash demandé. */
function readControls(f) {
  const online = !!versus.online;
  const keys = online ? ONLINE_KEYS : VERSUS_KEYS[f.index];
  const touch = online ? { ...touchMove, dash: isDown("dash") } : versusTouch[f.index];
  let dx = (isAnyKeyDown(keys.right) ? 1 : 0) - (isAnyKeyDown(keys.left) ? 1 : 0);
  let dy = (isAnyKeyDown(keys.down) ? 1 : 0) - (isAnyKeyDown(keys.up) ? 1 : 0);
  if (dx !== 0 && dy !== 0) {
    dx *= Math.SQRT1_2;
    dy *= Math.SQRT1_2;
  }
  if (dx === 0 && dy === 0) {
    dx = touch.x;
    dy = touch.y;
  }
  const dash = isAnyKeyDown(keys.dash) || touch.dash;
  if (!online) versusTouch[f.index].dash = false;
  return { dx, dy, dash };
}

/** Déplacement et dash d'un vaisseau piloté sur cet appareil. */
export function updateMovement(f, bounds = arenaBounds()) {
  const { dx, dy, dash } = readControls(f);
  if (f.dashCooldownTimer > 0) f.dashCooldownTimer--;
  if (dash && f.dashCooldownTimer <= 0 && !f.isDashing) {
    f.isDashing = true;
    f.dashTimer = f.dashDuration;
    f.dashCooldownTimer = f.dashCooldown;
    createParticles(f.worldX, f.worldY, "#fff", 10);
    playSfx("dash");
  }
  if (f.isDashing) {
    f.speed = f.dashSpeed;
    if (--f.dashTimer % 2 === 0) addTrail(f);
    if (f.dashTimer <= 0) f.isDashing = false;
  } else {
    f.speed = f.baseSpeed;
  }
  const r = f.size;
  f.worldX = clamp(f.worldX + dx * f.speed, bounds.minX + r, bounds.maxX - r);
  f.worldY = clamp(f.worldY + dy * f.speed, bounds.minY + r, bounds.maxY - r);
}

export function addTrail(f) {
  versus.trails.push({ x: f.worldX, y: f.worldY, color: f.hero.color, angle: f.aimAngle, life: 10 });
}

/**
 * Hôte en ligne : le vaisseau de l'invité suit la position qu'il envoie (il se déplace chez lui,
 * sans attendre l'aller-retour). Après un retour en jeu, on attend qu'il se soit replacé.
 */
function applyRemote(f, bounds) {
  const r = versus.remote;
  if (!r || r.spawn !== f.spawnSeq) return;
  const s = f.size;
  f.worldX = clamp(r.x, bounds.minX + s, bounds.maxX - s);
  f.worldY = clamp(r.y, bounds.minY + s, bounds.maxY - s);
  if (r.dash && !f.isDashing) playSfx("dash");
  f.isDashing = !!r.dash;
  if (f.isDashing && (f.trailTick = (f.trailTick || 0) + 1) % 2 === 0) addTrail(f);
}

/** Tir automatique vers l'adversaire, kunai, aura et orbes. */
function attack(f, target) {
  const w = f.weapon;
  const fireRate = f.attackSpeed / (f.buffs.frenzy > 0 ? 3 : 1);
  const angle = angleTo(f.worldX, f.worldY, target.worldX, target.worldY);
  f.aimAngle = angle;
  if (game.time - f.lastAttack >= fireRate) {
    f.lastAttack = game.time;
    playSfx("shoot");
    const count = w.projectiles + (f.inventory["Multi-Tir"] || 0);
    const spread = w.spread || f.multishotSpread;
    for (let i = 0; i < count; i++) {
      const a = angle + (i - (count - 1) / 2) * spread;
      shootAt(f, a, w.speed, w.size, f.attack * w.damage, w.color, w.range || Infinity, "weapon");
    }
  }

  const kunai = f.inventory.Kunai || 0;
  if (kunai > 0 && game.time - f.lastKunaiAttack >= KUNAI.cooldown) {
    f.lastKunaiAttack = game.time;
    for (let i = 0; i < kunai; i++) {
      const a = angle + (i - (kunai - 1) / 2) * f.multishotSpread;
      shootAt(
        f,
        a,
        KUNAI.projectileSpeed,
        7,
        f.attack * KUNAI.damageMultiplier,
        "#ff55cc",
        Infinity,
        "kunai",
      );
    }
  }

  // Aura et orbes : calculés par les fonctions du mode normal (qui lisent `player`)
  const { radius, orb, orbs } = withFighter(f, () => {
    if (player.orbitals > 0) player.orbitalAngle += orbitalStats().spin;
    return { radius: auraRadius(), orb: orbitalStats(), orbs: getOrbitalPositions() };
  });
  const inferno = f.evolutions.inferno;
  if (radius > 0 && game.time - f.lastAuraTick > (inferno ? 250 : 500)) {
    f.lastAuraTick = game.time;
    if (dist(f.worldX, f.worldY, target.worldX, target.worldY) < radius + target.size) {
      createAoEEffect(f.worldX, f.worldY, radius);
      hitFighter(f, target, f.auraDamage * (inferno ? 2 : 1), "aura");
    }
  }
  if (game.time - f.lastOrbitalHit < VERSUS.orbitalHitCooldown) return;
  for (const o of orbs) {
    if (dist(o.x, o.y, target.worldX, target.worldY) >= target.size + orb.size) continue;
    f.lastOrbitalHit = game.time;
    hitFighter(f, target, orb.damage * VERSUS.orbitalDamageMult, "orbit");
    break;
  }
}

function shootAt(f, angle, speed, size, damage, color, life, kind) {
  world.projectiles.push({
    x: f.worldX,
    y: f.worldY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size,
    damage,
    color,
    life,
    owner: f.index,
    kind,
    type: kind === "kunai" ? "kunai" : undefined,
    dead: false,
  });
}

function updateProjectiles(bounds) {
  const m = 50;
  for (const p of world.projectiles) {
    p.x += p.vx;
    p.y += p.vy;
    if (
      --p.life <= 0 ||
      p.x < bounds.minX - m ||
      p.x > bounds.maxX + m ||
      p.y < bounds.minY - m ||
      p.y > bounds.maxY + m
    ) {
      p.dead = true;
      continue;
    }
    const target = versus.fighters[1 - p.owner];
    if (!target.alive || game.over) continue;
    if (dist(p.x, p.y, target.worldX, target.worldY) >= target.size + p.size) continue;
    if (isProtected(target)) continue; // le dash et le bouclier laissent passer les balles
    p.dead = true;
    const shooter = versus.fighters[p.owner];
    const k = Math.atan2(p.vy, p.vx);
    target.worldX = clamp(
      target.worldX + Math.cos(k) * VERSUS.knockback * shooter.knockbackMult,
      bounds.minX + target.size,
      bounds.maxX - target.size,
    );
    target.worldY = clamp(
      target.worldY + Math.sin(k) * VERSUS.knockback * shooter.knockbackMult,
      bounds.minY + target.size,
      bounds.maxY - target.size,
    );
    hitFighter(shooter, target, p.damage, p.kind);
  }
  keep(world.projectiles, (p) => !p.dead);
}

/** Filtre un tableau sur place (les autres modules gardent la même référence). */
export function keep(list, pred) {
  let w = 0;
  for (const x of list) if (pred(x)) list[w++] = x;
  list.length = w;
}

export function isProtected(f) {
  return f.isDashing || f.buffs.shield > 0;
}

/** Dégâts d'un combattant à l'autre (critique, défense, vol de vie, épines). */
export function hitFighter(attacker, target, amount, source = "weapon") {
  if (!target.alive || game.over || isProtected(target)) return;
  let damage = amount;
  const crit = Math.random() < attacker.critChance;
  if (crit) damage *= attacker.critMultiplier;
  damage *= 1 - target.defense / (target.defense + SURVIVAL.armorCurve);
  target.health -= damage;
  target.hitTime = game.time;
  if (versus.online) versus.fx.push({ t: "hit", i: target.index, d: Math.round(damage), c: crit });
  playSfx("hit");
  addFloatingText(
    target.worldX,
    target.worldY - 20,
    Math.round(damage) + (crit ? "!" : ""),
    crit ? "#d000ff" : "#fff",
    crit ? 20 : 15,
  );
  if (attacker.vampirism > 0) {
    attacker.health = Math.min(
      attacker.maxHealth,
      attacker.health + Math.min(VERSUS.vampirismCap, damage * attacker.vampirism),
    );
  }
  if (target.health <= 0) return killFighter(target);
  if (target.thorns > 0 && source !== "thorns") {
    hitFighter(target, attacker, damage * target.thorns * VERSUS.thornsReflect, "thorns");
  }
}

function killFighter(f) {
  f.alive = false;
  f.health = 0;
  f.isDashing = false;
  const i = f.index;
  versus.lives[i]--;
  if (versus.online) versus.fx.push({ t: "kill", i, x: f.worldX, y: f.worldY });
  killEffects(f);
  if (versus.lives[i] <= 0) {
    game.over = true;
    versus.winner = 1 - i;
    versus.endTimer = VERSUS.endDelay;
    slowMotion(VERSUS.endSlowMo);
    addFloatingText(0, arenaBounds().minY + 80, `${fighterName(1 - i)} GAGNE !`, "#ffd700", 34, 120);
    return;
  }
  f.respawnTimer = VERSUS.respawnDelay;
  addFloatingText(f.worldX, f.worldY - 40, `-1 VIE`, f.hero.color, 26, 80);
}

/** Explosion du vaisseau détruit (aussi rejouée chez l'invité en ligne). */
export function killEffects(f) {
  createParticles(f.worldX, f.worldY, f.hero.color, 40);
  createParticles(f.worldX, f.worldY, "#ffffff", 15);
  createShockwave(f.worldX, f.worldY, 260, f.hero.color);
  addScreenShake(18);
  flashScreen(f.hero.color, 0.35);
  playSfx("death");
  vibrate(200);
}

/** Retour en jeu : PV pleins, bouclier, puis choix des améliorations de rattrapage. */
function respawn(f) {
  const p = spawnPoint(f.index);
  Object.assign(f, { alive: true, health: f.maxHealth, worldX: p.x, worldY: p.y, isDashing: false });
  f.spawnSeq++;
  if (versus.online) versus.fx.push({ t: "spawn", i: f.index });
  f.buffs.shield = VERSUS.spawnShield;
  keep(world.projectiles, (pr) => pr.owner === f.index); // pas de balle en attente à son retour
  createSpawnEffect(f.worldX, f.worldY, f.hero.color);
  emit("versusUpgrades", f);
}
