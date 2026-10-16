// Déplacement, dash, buffs, vie et expérience du joueur.

import { ADS, REVIVE, STAT_CAPS, STUN, SURVIVAL, VERSUS } from "../config.js";
import { view } from "../core/canvas.js";
import { emit } from "../core/events.js";
import { isDown, stickDirection } from "../core/input.js";
import { camera, game, player, world } from "../core/state.js";
import { playSfx, vibrate } from "../services/sfx.js";
import { angleTo, clamp, dist } from "../utils/math.js";
import {
  addFloatingText,
  addScreenShake,
  createParticles,
  createShockwave,
  createSpawnEffect,
  flashScreen,
  slowMotion,
} from "./effects.js";
import { damageEnemy } from "./combat.js";
import { recordPlayerLevel } from "../services/achievements.js";
import { onDash, onHurt, onLevelUp } from "./perks.js";
import { noteKiller } from "./killCam.js";

const FROST_SLOW = 0.55; // vitesse quand le joueur est gelé par un golem

export function updatePlayer() {
  updateBuffs();
  updateRegen();
  updateDash();
  move();
  camera.x = player.worldX - view.width / 2;
  camera.y = player.worldY - view.height / 2;
}

function updateBuffs() {
  const b = player.buffs;
  if (b.frenzy > 0) b.frenzy--;
  if (b.shield > 0) b.shield--;
  if (b.magnet > 0) b.magnet--;
  if (b.slow > 0) b.slow--;
  if (b.haste > 0) b.haste--;
  if (b.stunImmune > 0) b.stunImmune--;
  if (b.stun > 0 && --b.stun === 0) b.stunImmune = STUN.immunity;
  if (b.overcharge > 0 && --b.overcharge === 0) {
    addFloatingText(player.worldX, player.worldY, "FIN SURCHARGE", "#ccc");
  }
}

function updateRegen() {
  if (player.regen <= 0) return;
  if (++game.regenTimer > 60) {
    heal(player.regen);
    game.regenTimer = 0;
  }
}

function updateDash() {
  if (player.dashCooldownTimer > 0) player.dashCooldownTimer--;
  if (
    isDown("dash") &&
    !player.noDash &&
    player.dashCooldownTimer <= 0 &&
    !player.isDashing &&
    !isStunned()
  ) {
    player.isDashing = true;
    player.dashTimer = player.dashDuration;
    player.dashCooldownTimer = player.dashCooldown;
    createParticles(player.worldX, player.worldY, "#fff", 10);
    playSfx("dash");
    onDash();
  }
  if (player.isDashing) {
    player.speed = player.dashSpeed;
    player.dashTimer--;
    if (player.dashTimer % 2 === 0) {
      world.ghosts.push({ x: player.worldX, y: player.worldY, life: 10 });
    }
    if (player.dashTimer <= 0) player.isDashing = false;
  } else {
    // Plafond : améliorations, équipement, talents, niveau de compte et accélération compris
    const haste = player.buffs.haste > 0 ? 1 + player.hasteBonus : 1;
    player.speed =
      Math.min(player.baseSpeed * haste, STAT_CAPS.speed) * (player.buffs.slow > 0 ? FROST_SLOW : 1);
    if (game.hex?.type === "slow") player.speed *= VERSUS.spell.slow.speed; // sort du duel
  }
}

function move() {
  if (isStunned()) return; // étourdi : le vaisseau ne répond plus
  let dx = 0;
  let dy = 0;
  if (isDown("up")) dy -= 1;
  if (isDown("down")) dy += 1;
  if (isDown("left")) dx -= 1;
  if (isDown("right")) dx += 1;
  if (dx !== 0 && dy !== 0) {
    dx *= Math.SQRT1_2;
    dy *= Math.SQRT1_2;
  }
  if (dx === 0 && dy === 0) {
    // Joystick tactile (analogique)
    ({ x: dx, y: dy } = stickDirection());
  }
  const r = player.size;
  player.worldX = clamp(player.worldX + dx * player.speed, game.bounds.minX + r, game.bounds.maxX - r);
  player.worldY = clamp(player.worldY + dy * player.speed, game.bounds.minY + r, game.bounds.maxY - r);
}

/** Le joueur est-il invulnérable aux coups « normaux » (contact, projectiles) ? */
export function isProtected() {
  return player.isDashing || player.buffs.shield > 0;
}

export function isStunned() {
  return player.buffs.stun > 0;
}

/** Étourdit le joueur (sauf s'il vient de l'être : courte insensibilité ensuite). */
export function stunPlayer(ticks) {
  const b = player.buffs;
  if (b.stun > 0 || b.stunImmune > 0 || game.over) return false;
  b.stun = Math.min(ticks, STUN.maxTicks);
  player.isDashing = false;
  addFloatingText(player.worldX, player.worldY - 34, "ÉTOURDI !", "#ffe94d", 18, 50);
  vibrate([60, 30, 60]);
  return true;
}

/** Efficacité des soins : réduite par la « corruption » au fil des vagues. */
export function healFactor(wave = game.wave) {
  const over = Math.max(0, wave - SURVIVAL.healFatigueFrom);
  return Math.max(SURVIVAL.minHealFactor, 1 - over * SURVIVAL.healFatiguePerWave);
}

export function heal(amount) {
  player.health = Math.min(player.maxHealth, player.health + amount * healFactor() * player.healMult);
}

/** `source` (facultatif) : ce qui a porté le coup, pour le ralenti de la mort (systems/killCam.js). */
export function takeDamage(amount, source) {
  if (game.over) return;
  amount *= player.damageTaken;
  player.health -= amount;
  playSfx("hurt");
  vibrate(40);
  addScreenShake(5);
  addFloatingText(player.worldX, player.worldY - 20, `-${Math.round(amount)}`, "#ff0000", 16);
  if (player.health <= 0 && player.revives > 0) {
    // Talent « Seconde chance », Phénix (consommé en premier) ou Renaissance céleste
    player.revives--;
    const phoenix = player.phoenixRevive;
    player.phoenixRevive = false;
    player.health = player.maxHealth * 0.5;
    player.buffs.shield = 120;
    if (phoenix) rebirth("#ff6a1f", "RENAISSANCE DU PHÉNIX !", "phoenix");
    else rebirth("#00ffcc", "SECONDE CHANCE !");
    return;
  }
  if (player.health <= 0) {
    noteKiller(source);
    game.over = true;
    playSfx("death");
    vibrate(300);
    game.running = false;
    emit("playerDied");
    return;
  }
  if (player.bloodPact) player.pactUntil = game.time + player.bloodPact.ms; // Pacte de sang
  onHurt();
}

/** Retour en jeu après une pub récompensée : PV partiels, bouclier et ennemis repoussés. */
export function reviveFromAd() {
  game.adReviveUsed = true;
  game.over = false;
  game.running = true;
  game.paused = false;
  player.health = player.maxHealth * ADS.reviveHealth;
  player.buffs.shield = 180;
  rebirth("#ffd700", "DE RETOUR !", "ad", ADS.reviveClearRadius);
}

/**
 * Renaissance : animation autour du joueur et onde de choc. Les ennemis au corps à corps meurent,
 * les boss (et tentacules du Kraken) perdent une part de leur vie (jamais tués d'un coup ni repoussés), les autres proches
 * sont repoussés et les tirs ennemis effacés.
 */
function rebirth(color, label, kind = "talent", pushRadius = REVIVE.pushRadius) {
  const { worldX: x, worldY: y } = player;
  for (const e of world.enemies) {
    if (e.dead || e.submerged) continue;
    const d = dist(e.x, e.y, x, y);
    if (e.template.isBoss || e.template.noExecute) {
      if (d < REVIVE.killRadius + e.size) {
        damageEnemy(e, Math.max(0, Math.min(e.health - 1, e.maxHealth * REVIVE.bossDamage)), "revive");
      }
      continue;
    }
    if (d < REVIVE.killRadius + e.size) {
      createParticles(e.x, e.y, color, 6);
      damageEnemy(e, e.health + 1, "revive");
    } else if (d < pushRadius) {
      const a = angleTo(x, y, e.x, e.y);
      e.x = x + Math.cos(a) * pushRadius;
      e.y = y + Math.sin(a) * pushRadius;
    }
  }
  world.enemyProjectiles.length = 0;
  world.visualEffects.push({
    type: "rebirth",
    x,
    y,
    life: REVIVE.animTicks,
    max: REVIVE.animTicks,
    color,
    kind,
  });
  createShockwave(x, y, REVIVE.killRadius, "#ffffff");
  createShockwave(x, y, pushRadius, color);
  createParticles(x, y, color, 40);
  flashScreen(color, 0.45);
  slowMotion(REVIVE.slowMo);
  addFloatingText(x, y - 40, label, color, 26, 90);
  addScreenShake(14);
  playSfx("levelUp");
  vibrate([80, 40, 120]);
}

export function gainXp(amount) {
  amount *= 1 + player.xpBonus;
  player.xp += amount;
  game.totalRunXp += amount;
  if (player.xp < player.xpToNextLevel) return;

  player.xp -= player.xpToNextLevel;
  player.level++;
  recordPlayerLevel(player.level);
  player.xpToNextLevel = Math.floor(player.xpToNextLevel * 1.3);
  addFloatingText(player.worldX, player.worldY - 50, "LEVEL UP!", "#ffd700", 30, 100);
  playSfx("levelUp");
  vibrate([30, 40, 30]);
  createSpawnEffect(player.worldX, player.worldY, "#ffd700");
  onLevelUp();
  emit("levelUp");
}

export function chargeUltimate() {
  if (player.isUltReady) return;
  player.ultCharge++;
  if (player.ultCharge >= player.maxUltCharge) {
    player.ultCharge = player.maxUltCharge;
    player.isUltReady = true;
    addFloatingText(player.worldX, player.worldY, "COMPÉTENCE PRÊTE (R) !", "#ffaa00", 30, 60);
  }
}
