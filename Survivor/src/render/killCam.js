// Ralenti de la mort : rejoue les dernières secondes enregistrées par systems/killCam.js sur le canvas
// du jeu, façon caméra de cinéma (bandes noires, zoom et ralenti sur la fin), puis l'explosion du
// vaisseau et « TUÉ PAR ... ». La scène enregistrée prend la place de la partie le temps de la dessiner.

import { KILL_CAM, TICK_MS } from "../config.js";
import { ctx, resetTransform, view } from "../core/canvas.js";
import { camera, game, player, world } from "../core/state.js";
import { currentSkin, shipLook } from "../services/skins.js";
import { playSfx } from "../services/sfx.js";
import { drawEnemies, drawProjectiles, drawShip } from "./entities.js";
import { drawHazards } from "./hazards.js";
import { fillCircle, strokeCircle } from "./draw.js";
import { drawGrid, drawMapBorder } from "./world.js";

const PINK = "#ff2a6d";
const TAU = Math.PI * 2;
const FRAME_MS = KILL_CAM.every * TICK_MS;
const ZOOM = 1.4; // zoom atteint à la fin du ralenti

const play = { on: false, start: 0, boom: false, onEnd: null };

export function killCamActive() {
  return play.on;
}

/** Lance le ralenti ; `onEnd` est appelé à la fin (ou quand le joueur le passe). */
export function startKillCam(onEnd) {
  Object.assign(play, { on: true, start: performance.now(), boom: false, onEnd });
}

export function stopKillCam() {
  if (!play.on) return;
  play.on = false;
  const done = play.onEnd;
  play.onEnd = null;
  done?.();
}

/** Déroulé : temps réel écoulé → temps de jeu rejoué (vitesse normale, puis ralenti, puis arrêt). */
function timeline(elapsed, total) {
  const slow = Math.min(KILL_CAM.slowSeconds * 1000, total);
  const fast = total - slow;
  const slowEnd = fast + slow / KILL_CAM.slowRate;
  if (elapsed < fast) return { t: elapsed, zoom: 1, slow: false, hold: 0 };
  if (elapsed < slowEnd) {
    const k = (elapsed - fast) / (slowEnd - fast);
    return { t: fast + (elapsed - fast) * KILL_CAM.slowRate, zoom: 1 + (ZOOM - 1) * k, slow: true, hold: 0 };
  }
  return { t: total, zoom: ZOOM, slow: false, hold: (elapsed - slowEnd) / KILL_CAM.holdMs };
}

export function drawKillCam(now) {
  const frames = game.killCam.frames;
  if (!play.on || frames.length < 2) return stopKillCam();
  const total = (frames.length - 1) * FRAME_MS;
  const tl = timeline(Math.max(0, now - play.start), total); // `now` (image) peut précéder le clic
  if (tl.hold >= 1) return stopKillCam();
  if (tl.hold > 0 && !play.boom) {
    play.boom = true;
    playSfx("explosion");
  }

  const pos = Math.min(frames.length - 1, tl.t / FRAME_MS);
  const i = Math.min(frames.length - 2, Math.floor(pos));
  const k = pos - i;
  const a = frames[i];
  const b = frames[i + 1];
  const scene = blend(a, b, k);

  resetTransform();
  ctx.clearRect(0, 0, view.width, view.height);
  drawScene(scene, tl, now);
  drawOverlay(scene, tl, now);
}

/** Image intermédiaire entre deux images enregistrées : positions lissées, tirs prolongés. */
function blend(a, b, k) {
  const before = new Map(a.enemies.map((e) => [e.id, e]));
  const lerp = (x, y) => x + (y - x) * k;
  const step = k * KILL_CAM.every;
  const move = (p) => ({ ...p, x: p.x + p.vx * step, y: p.y + p.vy * step });
  return {
    ...b,
    t: lerp(a.t, b.t),
    x: lerp(a.x, b.x),
    y: lerp(a.y, b.y),
    angle: lerpAngle(a.angle, b.angle, k),
    health: lerp(a.health, b.health),
    enemies: b.enemies.map((e) => {
      const old = before.get(e.id);
      return old ? { ...e, x: lerp(old.x, e.x), y: lerp(old.y, e.y) } : e;
    }),
    shots: a.shots.map(move),
    enemyShots: a.enemyShots.map(move),
    hazards: k < 0.5 ? a.hazards : b.hazards,
  };
}

function drawScene(s, tl, now) {
  const saved = {
    enemies: world.enemies,
    projectiles: world.projectiles,
    enemyProjectiles: world.enemyProjectiles,
    hazards: world.hazards,
    cx: camera.x,
    cy: camera.y,
    vw: view.width,
    vh: view.height,
    px: player.worldX,
    py: player.worldY,
    time: game.time,
    wave: game.wave,
  };
  ctx.save();
  ctx.scale(tl.zoom, tl.zoom);
  try {
    world.enemies = s.enemies;
    world.projectiles = s.shots;
    world.enemyProjectiles = s.enemyShots;
    world.hazards = s.hazards;
    view.width = saved.vw / tl.zoom;
    view.height = saved.vh / tl.zoom;
    camera.x = s.x - view.width / 2;
    camera.y = s.y - view.height / 2;
    player.worldX = s.x; // les ennemis se tournent vers le vaisseau
    player.worldY = s.y;
    game.time = s.t;
    game.wave = s.wave;
    ctx.fillStyle = "#06020d";
    ctx.fillRect(0, 0, view.width, view.height);
    drawGrid();
    ctx.translate(-camera.x, -camera.y);
    drawMapBorder();
    drawHazards(now);
    if (!tl.hold) drawFighter(s, now);
    drawEnemies();
    drawProjectiles();
    if (tl.slow || tl.hold > 0) drawKillerMark(s, now);
    if (tl.hold > 0) drawExplosion(s.x, s.y, tl.hold);
  } finally {
    world.enemies = saved.enemies;
    world.projectiles = saved.projectiles;
    world.enemyProjectiles = saved.enemyProjectiles;
    world.hazards = saved.hazards;
    camera.x = saved.cx;
    camera.y = saved.cy;
    view.width = saved.vw;
    view.height = saved.vh;
    player.worldX = saved.px;
    player.worldY = saved.py;
    game.time = saved.time;
    game.wave = saved.wave;
    ctx.restore();
  }
}

/** Le vaisseau, son bouclier et une petite barre de vie qui fond. */
function drawFighter(s, now) {
  const look = shipLook(player.hero, currentSkin(), now);
  const r = player.size;
  if (s.shield) strokeCircle(s.x, s.y, r + 12, "#0088ff", 3);
  drawShip(s.x, s.y, r, s.angle, s.dash ? "#ffffff" : look.color, true, now, look.hull);
  const w = r * 2.6;
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  ctx.fillRect(s.x - w / 2, s.y + r + 10, w, 4);
  ctx.fillStyle = s.health < 0.25 ? "#ff0040" : "#00ff88";
  ctx.fillRect(s.x - w / 2, s.y + r + 10, w * s.health, 4);
}

/** Viseur rose autour de l'ennemi qui a porté le coup fatal. */
function drawKillerMark(s, now) {
  const id = game.killCam.killer?.id;
  const e = id !== null && id !== undefined && s.enemies.find((x) => x.id === id);
  if (!e) return;
  const r = e.size * 1.5 + 8 + Math.sin(now / 120) * 4;
  ctx.save();
  ctx.shadowBlur = 14;
  ctx.shadowColor = PINK;
  ctx.strokeStyle = PINK;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  ctx.lineDashOffset = -now / 30;
  ctx.beginPath();
  ctx.arc(e.x, e.y, r, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/** Explosion du vaisseau : éclair blanc, anneaux néon et éclats. */
function drawExplosion(x, y, k) {
  const e = Math.min(1, k * 2.2); // l'explosion se joue sur le début de l'image figée
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - e);
  fillCircle(x, y, 20 + e * 70, "#ffffff", 40);
  /** @type {[string, number][]} */
  const rings = [
    [PINK, 1],
    ["#00ffff", 1.5],
    ["#ffd700", 2],
  ];
  for (const [color, mult] of rings) {
    ctx.globalAlpha = Math.max(0, 1 - e) * 0.9;
    strokeCircle(x, y, 10 + e * 90 * mult, color, 4);
  }
  ctx.globalAlpha = Math.max(0, 1 - e);
  for (let i = 0; i < 18; i++) {
    const a = (TAU * i) / 18 + i * 0.37;
    const d = 12 + e * (90 + (i % 5) * 28);
    fillCircle(x + Math.cos(a) * d, y + Math.sin(a) * d, 3 - (i % 3) * 0.6, i % 2 ? PINK : "#00ffff", 8);
  }
  ctx.restore();
}

/** Habillage : bandes noires, « REPLAY », ralenti, puis le nom du coupable. */
function drawOverlay(s, tl, now) {
  const { width: w, height: h } = view;
  const small = w < 600;
  const bar = Math.round(h * 0.09);
  ctx.save();
  // Voile rouge qui monte pendant le ralenti
  if (tl.slow || tl.hold > 0) {
    const g = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.25,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.7,
    );
    g.addColorStop(0, "rgba(255, 0, 60, 0)");
    g.addColorStop(1, `rgba(255, 0, 60, ${tl.hold > 0 ? 0.35 : 0.22})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, bar);
  ctx.fillRect(0, h - bar, w, bar);

  ctx.textBaseline = "middle";
  ctx.font = `bold ${small ? 11 : 14}px Orbitron, sans-serif`;
  ctx.textAlign = "left";
  if (Math.floor(now / 500) % 2 === 0) fillCircle(18, bar / 2, 5, "#ff0040", 10);
  ctx.fillStyle = "#ffffff";
  ctx.fillText("REPLAY", 30, bar / 2);
  ctx.textAlign = "right";
  ctx.fillStyle = tl.slow ? "#ffd700" : "rgba(255, 255, 255, 0.6)";
  ctx.fillText(tl.slow ? `RALENTI ×${KILL_CAM.slowRate}` : tl.hold > 0 ? "FIN" : "×1", w - 14, bar / 2);
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.font = `${small ? 9 : 11}px Orbitron, sans-serif`;
  ctx.fillText("Touche l'écran ou une touche pour revenir", w / 2, h - bar / 2);

  if (tl.hold > 0) drawKiller(w, h, small, Math.min(1, tl.hold * 4));
  ctx.restore();
}

function drawKiller(w, h, small, appear) {
  const killer = game.killCam.killer || { name: "Un ennemi" };
  const y = h * 0.3;
  ctx.globalAlpha = appear;
  // Bandeau sombre derrière le texte (la scène reste visible autour)
  const top = y - (small ? 48 : 64);
  const band = small ? 100 : 136;
  const g = ctx.createLinearGradient(0, top, 0, top + band);
  g.addColorStop(0, "rgba(5, 2, 12, 0)");
  g.addColorStop(0.2, "rgba(5, 2, 12, 0.82)");
  g.addColorStop(0.8, "rgba(5, 2, 12, 0.82)");
  g.addColorStop(1, "rgba(5, 2, 12, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, top, w, band);
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.font = `bold ${small ? 12 : 16}px Orbitron, sans-serif`;
  ctx.fillText("TUÉ PAR", w / 2, y - (small ? 26 : 34));
  ctx.font = `900 ${small ? 20 : 34}px Orbitron, sans-serif`;
  ctx.shadowBlur = 20;
  ctx.shadowColor = PINK;
  ctx.fillStyle = PINK;
  ctx.fillText(killer.name.toUpperCase(), w / 2, y, w - 30);
  ctx.shadowBlur = 0;
  ctx.font = `${small ? 11 : 14}px Orbitron, sans-serif`;
  ctx.fillStyle = "#ffd700";
  ctx.fillText(killerLine(killer), w / 2, y + (small ? 28 : 40), w - 30);
  ctx.globalAlpha = 1;
}

/** Petite phrase sous le nom : rageante quand le boss était presque mort. */
export function killerLine(killer) {
  if (killer.boss && killer.health !== null && killer.health <= KILL_CAM.lowHealth) {
    const pct = Math.max(1, Math.round(killer.health * 100));
    return `Il ne lui restait que ${pct} % de vie...`;
  }
  return `Vague ${game.wave} · ${game.stats.kills ? totalKills() : 0} ennemis détruits`;
}

function totalKills() {
  return Object.values(game.stats.kills).reduce((sum, n) => sum + n, 0);
}

function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + d * k;
}
