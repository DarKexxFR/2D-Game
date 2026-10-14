// Duel en ligne : la partie de l'adversaire en direct, en haut à droite. Son appareil envoie sa scène
// quelques fois par seconde (systems/versusOnline.js) ; elle est redessinée ici avec les vrais sprites
// (décor du biome, ennemis, boss, son vaisseau), mouvements lissés entre deux envois.

import { ctx, view } from "../core/canvas.js";
import { camera, game, player, world } from "../core/state.js";
import { ENEMY_TYPES } from "../data/enemies.js";
import { ENEMY_KEYS, rival } from "../systems/versusOnline.js";
import { fighterName } from "../systems/versus.js";
import { drawEnemies, drawShip } from "./entities.js";
import { drawGrid, drawMapBorder } from "./world.js";

const PINK = "#ff2a6d";
const SHIP_SIZE = 15;

/** Fenêtre de l'aperçu : en haut à droite (sous le bouton pause sur mobile). */
export function rivalViewRect() {
  const touch = view.scale < 1;
  const w = touch ? Math.min(220, view.width * 0.48) : 300;
  const h = touch ? w * 0.85 : 200;
  return { x: view.width - w - 12, y: touch ? 150 : 12, w, h, zoom: touch ? 0.3 : 0.36 };
}

export function drawRivalView(now) {
  const v = rival.view;
  if (!v) return;
  const { prev, cur } = v;
  const k = Math.min(1, (now - v.at) / v.gap);
  const lerp = (a, b) => a + (b - a) * k;
  const before = new Map(prev.e.map((e) => [e[0], e]));
  const rx = lerp(prev.x, cur.x);
  const ry = lerp(prev.y, cur.y);

  const enemies = [];
  for (const [id, type, x, y, size, flags, hp] of cur.e) {
    const template = ENEMY_TYPES[ENEMY_KEYS[type]];
    if (!template) continue;
    const old = before.get(id);
    enemies.push({
      id,
      type: ENEMY_KEYS[type],
      template,
      x: old ? lerp(old[2], x) : x,
      y: old ? lerp(old[3], y) : y,
      size,
      color: template.color,
      elite: !!(flags & 1),
      enraged: !!(flags & 2),
      health: hp,
      maxHealth: 100,
      phase: (id % 10) / 10,
    });
  }

  const r = rivalViewRect();
  const saved = {
    enemies: world.enemies,
    cx: camera.x,
    cy: camera.y,
    vw: view.width,
    vh: view.height,
    px: player.worldX,
    py: player.worldY,
    wave: game.wave,
  };
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.beginPath();
  ctx.rect(0, 0, r.w, r.h);
  ctx.clip();
  ctx.scale(r.zoom, r.zoom);
  try {
    // La scène de l'adversaire prend la place de la sienne le temps de la dessiner
    world.enemies = enemies;
    view.width = r.w / r.zoom;
    view.height = r.h / r.zoom;
    camera.x = rx - view.width / 2;
    camera.y = ry - view.height / 2;
    player.worldX = rx; // les ennemis se tournent vers son vaisseau
    player.worldY = ry;
    game.wave = cur.w;
    ctx.fillStyle = "#06020d";
    ctx.fillRect(0, 0, view.width, view.height);
    drawGrid();
    ctx.translate(-camera.x, -camera.y);
    drawMapBorder();
    drawEnemies();
    drawShip(rx, ry, SHIP_SIZE, lerpAngle(prev.a, cur.a, k), cur.s[1], true, now, cur.s[0]);
  } finally {
    world.enemies = saved.enemies;
    camera.x = saved.cx;
    camera.y = saved.cy;
    view.width = saved.vw;
    view.height = saved.vh;
    player.worldX = saved.px;
    player.worldY = saved.py;
    game.wave = saved.wave;
    ctx.restore();
  }

  // Cadre, nom, vague et vie
  ctx.save();
  ctx.shadowBlur = 10;
  ctx.shadowColor = PINK;
  ctx.strokeStyle = PINK;
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(10, 5, 20, 0.8)";
  ctx.fillRect(r.x, r.y, r.w, 18);
  ctx.font = "bold 10px Orbitron, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillStyle = PINK;
  ctx.fillText(`${fighterName(1)} · VAGUE ${cur.w}`, r.x + 6, r.y + 9);
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  ctx.fillRect(r.x, r.y + r.h - 5, r.w, 5);
  ctx.fillStyle = PINK;
  ctx.fillRect(r.x, r.y + r.h - 5, (r.w * Math.max(0, Math.min(100, cur.h))) / 100, 5);
  ctx.restore();
}

function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
