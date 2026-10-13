// Rendu du joueur, du drone, des ennemis et des projectiles (sprites néon).

import { ctx } from "../core/canvas.js";
import { game, pet, player, world } from "../core/state.js";
import { auraRadius, getOrbitalPositions, isOnScreen, orbitalStats } from "../systems/combat.js";
import { hydraHeads } from "../systems/enemies.js";
import { fillCircle, strokeCircle } from "./draw.js";
import { drawSprite, getSprite, shade } from "./sprites.js";
import { drawTrail } from "./trail.js";
import { currentSkin, shipLook } from "../services/skins.js";

const TAU = Math.PI * 2;
const HIT_FLASH_MS = 80;

// Sprite de chaque type d'ennemi et façon de l'orienter :
// "face" = tourné vers le joueur, "spin" = tourne sur lui-même, "wobble" = gélatine.
const ENEMY_LOOKS = {
  normal: { sprite: "normal", mode: "face" },
  fast: { sprite: "fast", mode: "face" },
  tank: { sprite: "tank", mode: "face" },
  ranged: { sprite: "ranged", mode: "face" },
  kamikaze: { sprite: "kamikaze", mode: "spin", spin: 0.012 },
  miniboss: { sprite: "miniboss", mode: "face" },
  boss: { sprite: "boss", mode: "spin", spin: 0.0015 },
  slime_boss: { sprite: "slime_king", mode: "wobble" },
  slime_big: { sprite: "slime", mode: "wobble" },
  slime_small: { sprite: "slime", mode: "wobble" },
  hydra: { sprite: "hydra", mode: "hydra", spin: 0.0006 },
  hydra_spawn: { sprite: "fast", mode: "face" },
  scorpion: { sprite: "scorpion", mode: "face" },
  golem: { sprite: "golem", mode: "face" },
  colossus: { sprite: "colossus", mode: "face" },
  void_reaper: { sprite: "void_reaper", mode: "face" },
  storm_titan: { sprite: "storm_titan", mode: "face" },
  prism: { sprite: "prism", mode: "spin", spin: 0.0012 },
  phantom: { sprite: "phantom", mode: "face" },
  goblin: { sprite: "goblin", mode: "flee" },
};

export function drawPlayer(now) {
  const { worldX: x, worldY: y, size } = player;
  const look = shipLook(player.hero, currentSkin(), now);
  const hull = look.hull;
  // Position à l'image précédente : gardée sur le joueur (deux parties en duel sur un écran)
  const moving = Math.hypot(x - (player.drawnX ?? x), y - (player.drawnY ?? y)) > 0.5;
  player.drawnX = x;
  player.drawnY = y;

  for (const g of world.ghosts) {
    ctx.globalAlpha = g.life / 30;
    drawShip(g.x, g.y, size, player.aimAngle, look.color, false, now, hull);
  }
  ctx.globalAlpha = 1;
  drawTrail(ctx, world.trail);

  const aura = auraRadius();
  if (aura > 0) {
    const inferno = player.evolutions.inferno;
    ctx.beginPath();
    ctx.arc(x, y, aura, 0, TAU);
    ctx.fillStyle = inferno
      ? `rgba(255, 60, 0, ${0.14 + Math.sin(now / 120) * 0.04})`
      : "rgba(255, 100, 0, 0.08)";
    ctx.fill();
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -now / 40;
    ctx.strokeStyle = inferno ? "rgba(255, 220, 0, 0.7)" : "rgba(255, 120, 0, 0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (player.buffs.shield > 0) {
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#0088ff";
    strokeCircle(x, y, size + 12, "#0088ff", 3);
    ctx.globalAlpha = 0.12;
    fillCircle(x, y, size + 12, "#0088ff");
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
  if (player.buffs.frenzy > 0) fillCircle(x, y, size + 5, "rgba(255, 0, 0, 0.2)");

  for (const c of world.clones) {
    ctx.globalAlpha = Math.min(0.6, c.life / 40);
    drawShip(c.x, c.y, size * 0.8, player.aimAngle, "#b04dff", false, now, hull);
  }
  ctx.globalAlpha = 1;

  drawArmor(x, y, size, now);
  const bodyColor = player.isDashing ? "#ffffff" : player.hasRayGun ? "#00ff88" : look.color;
  drawWeapon(x, y, size);
  drawShip(x, y, size, player.aimAngle, bodyColor, moving || player.isDashing, now, hull);

  if (pet.active) PET_DRAWERS[pet.kind]?.(pet.x, pet.y, pet.size, pet.color, now);

  const orbSize = orbitalStats().size * 0.7;
  const orbColor = player.evolutions.guardianRing ? "#ffd700" : "#00ffff";
  for (const orb of getOrbitalPositions()) {
    drawSprite(ctx, getSprite("bullet", orbSize, orbColor), orb.x, orb.y);
  }

  if (player.isUltReady) {
    strokeCircle(x, y, size + 18 + Math.sin(now / 100) * 4, "rgba(255, 170, 0, 0.6)", 3);
  }
  if (player.buffs.stun > 0) drawPlayerStun(x, y, size, now);
}

/** Joueur étourdi : arcs électriques autour du vaisseau et étoiles au-dessus. */
function drawPlayerStun(x, y, size, now) {
  ctx.strokeStyle = "#ffe94d";
  ctx.lineWidth = 2;
  ctx.shadowBlur = 10;
  ctx.shadowColor = "#ffe94d";
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = now / 90 + (TAU * i) / 3;
    const r = size + 6;
    ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    for (let k = 1; k <= 3; k++) {
      const b = a + k * 0.25;
      const rr = r + (k % 2 ? 6 : -2);
      ctx.lineTo(x + Math.cos(b) * rr, y + Math.sin(b) * rr);
    }
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  for (let i = 0; i < 3; i++) {
    const a = now / 150 + (TAU * i) / 3;
    fillCircle(x + Math.cos(a) * size * 0.8, y - size - 10 + Math.sin(a) * 4, 3, "#ffe94d");
  }
}

/** Vaisseau du joueur, orienté vers la visée, réacteur allumé quand il bouge. */
// Silhouettes des vaisseaux (points en unités de rayon, nez vers la droite).
const HULLS = {
  arrow: [
    [1.25, 0],
    [-0.35, -0.95],
    [-0.75, -0.85],
    [-0.45, 0],
    [-0.75, 0.85],
    [-0.35, 0.95],
  ],
  dart: [
    [1.5, 0],
    [-0.4, -0.5],
    [-0.95, -0.95],
    [-0.55, 0],
    [-0.95, 0.95],
    [-0.4, 0.5],
  ],
  heavy: [
    [1, -0.4],
    [1, 0.4],
    [0.4, 1],
    [-0.8, 1],
    [-0.6, 0.35],
    [-0.6, -0.35],
    [-0.8, -1],
    [0.4, -1],
  ],
  orb: [
    [1.25, 0],
    ...Array.from({ length: 11 }, (_, i) => {
      const a = 0.5 + (i * (TAU - 1)) / 10;
      return [Math.cos(a) * 0.85, Math.sin(a) * 0.85];
    }),
  ],
  engineer: [
    [1.1, -0.3],
    [1.1, 0.3],
    [0.5, 0.95],
    [-0.5, 0.95],
    [-0.9, 0.5],
    [-0.65, 0],
    [-0.9, -0.5],
    [-0.5, -0.95],
    [0.5, -0.95],
  ],
  spectre: [
    [1.35, 0],
    [0.2, -0.45],
    [-0.3, -1.1],
    [-0.15, -0.35],
    [-0.95, -0.25],
    [-0.7, 0],
    [-0.95, 0.25],
    [-0.15, 0.35],
    [-0.3, 1.1],
    [0.2, 0.45],
  ],
  // Formes supplémentaires des skins (data/skins.js)
  manta: [
    [1.1, 0],
    [0.2, -0.4],
    [-0.4, -1.15],
    [-0.85, -0.9],
    [-0.5, 0],
    [-0.85, 0.9],
    [-0.4, 1.15],
    [0.2, 0.4],
  ],
  needle: [
    [1.55, 0],
    [0, -0.32],
    [-0.9, -0.62],
    [-0.65, 0],
    [-0.9, 0.62],
    [0, 0.32],
  ],
  trident: [
    [1.3, -0.12],
    [0.45, -0.22],
    [1.05, -0.8],
    [-0.2, -0.95],
    [-0.9, -0.4],
    [-0.6, 0],
    [-0.9, 0.4],
    [-0.2, 0.95],
    [1.05, 0.8],
    [0.45, 0.22],
    [1.3, 0.12],
  ],
  phoenix: [
    [1.25, 0],
    [0.5, -0.28],
    [0.15, -1.2],
    [-0.3, -0.5],
    [-1.05, -0.95],
    [-0.7, 0],
    [-1.05, 0.95],
    [-0.3, 0.5],
    [0.15, 1.2],
    [0.5, 0.28],
  ],
  star: Array.from({ length: 10 }, (_, i) => {
    const a = (i * TAU) / 10;
    const r = i % 2 ? 0.5 : 1.15;
    return [Math.cos(a) * r, Math.sin(a) * r];
  }),
  corsair: [
    [1.3, 0],
    [0.3, -0.5],
    [-0.2, -1.05],
    [-0.95, -0.7],
    [-0.6, 0],
    [-0.95, 0.7],
    [-0.2, 1.05],
    [0.3, 0.5],
  ],
};

/** Vaisseau du héros, orienté vers la visée, réacteur allumé quand il bouge (`c` : autre canvas). */
export function drawShip(x, y, r, angle, color, thrust, now, shape = "arrow", c = ctx) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);

  if (thrust) {
    const len = r * (0.9 + Math.sin(now / 30) * 0.25);
    const flame = c.createLinearGradient(-r * 0.5, 0, -r * 0.5 - len, 0);
    flame.addColorStop(0, "#ffffff");
    flame.addColorStop(0.3, color);
    flame.addColorStop(1, "rgba(0, 0, 0, 0)");
    c.fillStyle = flame;
    c.beginPath();
    c.moveTo(-r * 0.45, -r * 0.3);
    c.lineTo(-r * 0.5 - len, 0);
    c.lineTo(-r * 0.45, r * 0.3);
    c.closePath();
    c.fill();
  }

  const points = HULLS[shape] || HULLS.arrow;
  const hull = () => {
    c.beginPath();
    points.forEach(([px, py], i) => (i ? c.lineTo(px * r, py * r) : c.moveTo(px * r, py * r)));
    c.closePath();
  };
  c.lineJoin = "round";
  c.fillStyle = shade(color.startsWith("#") && color.length === 7 ? color : "#00ccff", 0.18);
  hull();
  c.fill();
  c.shadowBlur = 18;
  c.shadowColor = color;
  c.strokeStyle = color;
  c.lineWidth = 3;
  hull();
  c.stroke();
  c.shadowBlur = 0;

  // Lignes de coque et cockpit
  c.strokeStyle = color;
  c.globalAlpha *= 0.5;
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(-r * 0.3, -r * 0.6);
  c.lineTo(r * 0.3, -r * 0.2);
  c.moveTo(-r * 0.3, r * 0.6);
  c.lineTo(r * 0.3, r * 0.2);
  c.stroke();
  c.globalAlpha *= 2;
  c.fillStyle = "#ffffff";
  c.shadowBlur = 10;
  c.shadowColor = color;
  c.beginPath();
  c.ellipse(r * 0.35, 0, r * 0.28, r * 0.16, 0, 0, TAU);
  c.fill();
  c.shadowBlur = 0;
  c.restore();
}

// --- FAMILIERS ---

/** Ouvre un tracé néon centré (x, y) : couleur, lueur, épaisseur. */
function beginNeon(x, y, color, line = 2) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowBlur = 10;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = line;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.fillStyle = shade(color, 0.2);
}

function endNeon() {
  ctx.shadowBlur = 0;
  ctx.restore();
}

const PET_DRAWERS = {
  /** Drone : losange avec anneau qui tourne. */
  drone(x, y, s, color, now) {
    beginNeon(x, y + Math.sin(now / 250) * 3, color, 1.5);
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = now / 30;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.2, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.8);
    ctx.lineTo(s * 0.8, 0);
    ctx.lineTo(0, s * 0.8);
    ctx.lineTo(-s * 0.8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    fillCircle(0, 0, s * 0.22, "#ffffff");
    endNeon();
  },

  /** Médic : capsule avec croix, halo qui pulse. */
  medic(x, y, s, color, now) {
    beginNeon(x, y + Math.sin(now / 300) * 3, color);
    ctx.globalAlpha = 0.25 + Math.sin(now / 200) * 0.15;
    strokeCircle(0, 0, s * 1.5, color, 1);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.roundRect(-s, -s, s * 2, s * 2, s * 0.5);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.55);
    ctx.lineTo(0, s * 0.55);
    ctx.moveTo(-s * 0.55, 0);
    ctx.lineTo(s * 0.55, 0);
    ctx.stroke();
    endNeon();
  },

  /** Collecteur : aimant en fer à cheval avec étincelles. */
  collector(x, y, s, color, now) {
    beginNeon(x, y + Math.sin(now / 280) * 3, color, 3);
    ctx.rotate(Math.sin(now / 500) * 0.3);
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI);
    ctx.moveTo(-s, 0);
    ctx.lineTo(-s, -s * 0.9);
    ctx.moveTo(s, 0);
    ctx.lineTo(s, -s * 0.9);
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(-s, -s * 0.9);
    ctx.lineTo(-s, -s * 0.5);
    ctx.moveTo(s, -s * 0.9);
    ctx.lineTo(s, -s * 0.5);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = now / 300 + (i * TAU) / 3;
      fillCircle(Math.cos(a) * s * 1.8, Math.sin(a) * s * 1.8, 1.5, color);
    }
    endNeon();
  },

  /** Faucheuse : lame courbe qui tourne sur elle-même. */
  reaper(x, y, s, color, now) {
    beginNeon(x, y, color, 2);
    ctx.rotate(now / 60);
    for (let k = 0; k < 2; k++) {
      ctx.rotate(Math.PI);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * 1.4, -s * 0.2, s * 2, s * 0.9);
      ctx.quadraticCurveTo(s * 1.1, s * 0.3, 0, 0);
      ctx.fill();
      ctx.stroke();
    }
    fillCircle(0, 0, s * 0.35, "#ffffff");
    endNeon();
  },
};

Object.assign(PET_DRAWERS, {
  /** Cristal de givre : losange de glace entouré de flocons. */
  frost(x, y, s, color, now) {
    beginNeon(x, y + Math.sin(now / 260) * 3, color, 2);
    ctx.rotate(now / 900);
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.2);
    ctx.lineTo(s * 0.6, 0);
    ctx.lineTo(0, s * 1.2);
    ctx.lineTo(-s * 0.6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = (TAU * i) / 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 1.4, Math.sin(a) * s * 1.4);
      ctx.lineTo(Math.cos(a) * s * 1.8, Math.sin(a) * s * 1.8);
      ctx.stroke();
    }
    endNeon();
  },

  /** Gardien : bouclier volant avec anneau. */
  guardian(x, y, s, color, now) {
    beginNeon(x, y + Math.sin(now / 300) * 3, color, 2);
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.9, -s * 0.6);
    ctx.lineTo(s * 0.75, s * 0.4);
    ctx.lineTo(0, s * 1.1);
    ctx.lineTo(-s * 0.75, s * 0.4);
    ctx.lineTo(-s * 0.9, -s * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.4 + Math.sin(now / 200) * 0.2;
    strokeCircle(0, 0, s * 1.6, color, 1);
    ctx.globalAlpha = 1;
    fillCircle(0, 0, s * 0.25, "#ffffff");
    endNeon();
  },

  /** Dragonnet : petite tête de dragon aux ailes battantes, tournée vers sa cible. */
  dragon(x, y, s, color, now) {
    beginNeon(x, y + Math.sin(now / 220) * 3, color, 2);
    ctx.rotate(pet.active ? pet.angle : 0);
    const flap = Math.sin(now / 90) * 0.4;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * (0.4 + flap));
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, 0);
      ctx.lineTo(-s * 1.1, side * s * 1.4);
      ctx.lineTo(-s * 0.5, side * s * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(s * 1.3, 0);
    ctx.lineTo(s * 0.2, -s * 0.6);
    ctx.lineTo(-s * 0.9, 0);
    ctx.lineTo(s * 0.2, s * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    fillCircle(s * 0.5, -s * 0.2, s * 0.14, "#ffee00");
    fillCircle(s * 0.5, s * 0.2, s * 0.14, "#ffee00");
    endNeon();
  },
});

/** Dessine un familier hors partie (écran d'accueil). */
export function drawPet(kind, x, y, size, color, now) {
  PET_DRAWERS[kind]?.(x, y, size, color, now);
}

/** Armure : plus le prestige est haut, plus elle est épaisse, lumineuse et ornée. */
function drawArmor(x, y, size, now) {
  const a = player.armor;
  if (!a) return;
  const p = a.prestige;
  ctx.save();
  ctx.shadowBlur = 6 + p * 4;
  ctx.shadowColor = a.color;
  strokeCircle(x, y, size + 3 + p, a.color, 2 + p);

  if (p >= 3) {
    // Pointes en orbite
    const count = 4 + p * 2;
    const r = size + 8 + p * 1.5;
    const rot = now / 900;
    ctx.fillStyle = a.color;
    for (let i = 0; i < count; i++) {
      const ang = rot + (Math.PI * 2 * i) / count;
      ctx.beginPath();
      ctx.arc(x + Math.cos(ang) * r, y + Math.sin(ang) * r, 1.5 + p * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (p >= 5) {
    // Halo doré pulsant
    ctx.globalAlpha = 0.5;
    strokeCircle(x, y, size + 18 + Math.sin(now / 200) * 3, "#ffd700", 2);
  }
  ctx.restore();
}

/** Canon de l'arme orienté vers la visée ; taille et éclat selon le prestige. */
function drawWeapon(x, y, size) {
  const w = player.weapon;
  if (!w) return;
  const p = w.prestige;
  const len = 10 + p * 4;
  const thick = 5 + p * 1.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(player.aimAngle);
  ctx.shadowBlur = 4 + p * 4;
  ctx.shadowColor = w.color;
  ctx.fillStyle = w.color;
  ctx.fillRect(size * 0.7, -thick / 2, len + size * 0.3, thick);
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(size + len - 3, -thick / 2, 3, thick);
  if (p >= 4) {
    // Rails latéraux
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(size * 0.7 + 2, -thick / 2 - 2, len, 1.5);
    ctx.fillRect(size * 0.7 + 2, thick / 2 + 0.5, len, 1.5);
  }
  ctx.restore();
}

export function drawEnemies() {
  const now = performance.now();
  for (const e of world.enemies) {
    if (!isOnScreen(e.x, e.y, e.size)) continue;
    const look = ENEMY_LOOKS[e.type] || ENEMY_LOOKS.normal;
    const base = e.template.size;
    const scale = e.size / base;
    const flash = game.time - (e.hitTime ?? -1e9) < HIT_FLASH_MS ? "flash" : "";
    const sprite = getSprite(look.sprite, base, e.color, flash);
    const t = now + (e.phase || 0) * 1000;

    if (look.mode === "hydra") {
      drawHydraHeads(e, flash);
      drawSprite(ctx, sprite, e.x, e.y, t * look.spin, scale);
    } else if (look.mode === "wobble") {
      const w = Math.sin(t / 160) * 0.08;
      drawSprite(ctx, sprite, e.x, e.y, 0, scale * (1 + w), scale * (1 - w));
    } else if (look.mode === "spin") {
      const pulse = e.type === "kamikaze" ? 1 + Math.sin(t / 60) * 0.08 : 1;
      drawSprite(ctx, sprite, e.x, e.y, t * look.spin, scale * pulse);
    } else {
      let angle = Math.atan2(player.worldY - e.y, player.worldX - e.x);
      if (look.mode === "flee") angle += Math.PI; // le Voleur doré tourne le dos au joueur
      drawSprite(ctx, sprite, e.x, e.y, angle, scale * (1 + Math.sin(t / 140) * 0.04));
    }
    if (e.enraged) drawFury(e, now);
    if (e.elite) drawElite(e, now);

    if (e.health < e.maxHealth) drawHealthBar(e);
    if (e.stun > 0) drawStun(e, now);
  }
}

/** Élite : couronne de points dorés qui tourne autour de l'ennemi. */
function drawElite(e, now) {
  const r = e.size + 6;
  ctx.shadowBlur = 8;
  ctx.shadowColor = "#ffd700";
  for (let i = 0; i < 6; i++) {
    const a = now / 400 + (TAU * i) / 6;
    fillCircle(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 2.2, "#ffd700");
  }
  ctx.shadowBlur = 0;
}

/** Boss en furie : double halo rouge qui pulse. */
function drawFury(e, now) {
  ctx.globalAlpha = 0.5 + Math.sin(now / 90) * 0.3;
  strokeCircle(e.x, e.y, e.size * 1.25 + Math.sin(now / 120) * 4, e.color, 2);
  ctx.globalAlpha = 0.25;
  strokeCircle(e.x, e.y, e.size * 1.45 + Math.sin(now / 90) * 6, e.color, 1);
  ctx.globalAlpha = 1;
}

/** Cous et têtes de la Nécro-Hydre, dessinés sous le corps. */
function drawHydraHeads(e, flash) {
  const head = getSprite("hydraHead", 22, e.color, flash);
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.shadowBlur = 10;
  ctx.shadowColor = e.color;
  for (const h of hydraHeads(e)) {
    const mx = (e.x + h.x) / 2 + Math.cos(h.angle + Math.PI / 2) * 12;
    const my = (e.y + h.y) / 2 + Math.sin(h.angle + Math.PI / 2) * 12;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.quadraticCurveTo(mx, my, h.x, h.y);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  for (const h of hydraHeads(e)) drawSprite(ctx, head, h.x, h.y, h.angle);
}

/** Étoiles qui tournent au-dessus d'un ennemi étourdi. */
function drawStun(e, now) {
  for (let i = 0; i < 3; i++) {
    const a = now / 150 + (TAU * i) / 3;
    fillCircle(e.x + Math.cos(a) * e.size * 0.7, e.y - e.size - 6 + Math.sin(a) * 4, 2.5, "#ffee00");
  }
}

/** Météores du Mage : zone d'impact au sol qui se resserre, puis la boule qui tombe. */
export function drawSkillEffects() {
  for (const m of world.meteors) {
    const t = 1 - m.delay / m.total; // 0 → 1 à l'impact
    ctx.globalAlpha = 0.25 + t * 0.5;
    strokeCircle(m.x, m.y, 85 * (1.4 - t * 0.4), "#ff5533", 2);
    ctx.globalAlpha = 0.1 + t * 0.15;
    fillCircle(m.x, m.y, 85 * t, "#ff5533");
    ctx.globalAlpha = 1;
    const fall = (1 - t) * 420;
    ctx.strokeStyle = "rgba(255, 170, 60, 0.5)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(m.x + fall * 0.5 + 40, m.y - fall - 80);
    ctx.lineTo(m.x + fall * 0.5, m.y - fall);
    ctx.stroke();
    drawSprite(ctx, getSprite("bullet", 12, "#ff8844"), m.x + fall * 0.5, m.y - fall);
  }
}

/** Barre de vie, seulement une fois blessé ; plus large et lumineuse pour les boss. */
function drawHealthBar(e) {
  const boss = e.template.isBoss;
  const w = boss ? Math.max(80, e.size * 2) : 30;
  const h = boss ? 6 : 4;
  const pct = Math.max(0, Math.min(1, e.health / e.maxHealth));
  const left = e.x - w / 2;
  const top = e.y - e.size - (boss ? 22 : 12);
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(left - 1, top - 1, w + 2, h + 2);
  ctx.fillStyle = boss ? "#ff0040" : "#ff3366";
  if (boss) {
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#ff0040";
  }
  ctx.fillRect(left, top, w * pct, h);
  ctx.shadowBlur = 0;
}

export function drawProjectiles() {
  ctx.lineCap = "round";
  for (const p of world.projectiles) {
    if (p.type === "kunai") {
      drawKunai(p);
      continue;
    }
    if (p.type === "disc") {
      // Fondu pendant les derniers ticks de sa durée de vie
      if (p.fade) ctx.globalAlpha = Math.min(1, p.life / p.fade);
      drawSprite(ctx, getSprite("disc", roundSize(p.size), p.color), p.x, p.y, performance.now() / 40);
      ctx.globalAlpha = 1;
      continue;
    }
    // Traînée puis projectile lumineux
    ctx.strokeStyle = p.color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = p.size * 1.2;
    ctx.beginPath();
    ctx.moveTo(p.x - p.vx * 1.8, p.y - p.vy * 1.8);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawSprite(ctx, getSprite("bullet", roundSize(p.size), p.color), p.x, p.y);
  }
  for (const p of world.enemyProjectiles) {
    if (!isOnScreen(p.x, p.y, p.size)) continue;
    if (p.scythe) {
      drawSprite(ctx, getSprite("scythe", roundSize(p.size), p.color), p.x, p.y, performance.now() / 50);
      continue;
    }
    drawSprite(ctx, getSprite("bullet", roundSize(p.size), p.color), p.x, p.y);
  }
}

/** Kunai : lame effilée avec anneau au pommeau. */
function drawKunai(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.atan2(p.vy, p.vx));
  ctx.shadowBlur = 10;
  ctx.shadowColor = p.color;
  ctx.fillStyle = "#ffe6f6";
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(0, -4);
  ctx.lineTo(-2, 0);
  ctx.lineTo(0, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = shade("#ff55cc", 0.6);
  ctx.fillRect(-8, -1.5, 6, 3);
  ctx.beginPath();
  ctx.arc(-10, 0, 2.5, 0, TAU);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

/** Arrondit une taille au demi-pixel pour limiter le nombre de sprites en cache. */
function roundSize(s) {
  return Math.max(2, Math.round(s * 2) / 2);
}
