// Sol : grille néon. Droite quand rien ne se passe ; avec les effets néon, elle se déforme sous les ondes
// des explosions (systems/gridWarp.js) et s'enroule vers le trou noir. Elle s'assombrit pendant l'annonce
// d'une attaque de boss (le télégraphe ressort mieux) et s'illumine aux battements du Cœur du Pulse.

import { MAP_EVENTS, VISUAL_FX } from "../config.js";
import { ctx, view } from "../core/canvas.js";
import { camera, game, world } from "../core/state.js";
import { biomeForWave } from "../data/biomes.js";
import { beatLevel } from "./bosses.js";
import { fxEnabled } from "./fxFlags.js";

export const GRID_SIZE = 60;
const MAJOR_EVERY = 4; // une ligne plus lumineuse toutes les 4 cases
const G = VISUAL_FX.grid;

// Positions écran des nœuds de la grille déformée (réutilisées d'une image à l'autre)
let nodes = new Float32Array(0);

/**
 * Dessine la grille en coordonnées écran.
 * @param {{ live?: boolean }} [opts] `live: false` = grille simple (ralenti de la mort, partie de l'adversaire)
 */
export function drawGrid({ live = true } = {}) {
  const biome = biomeForWave(game.wave);
  // Teinte du biome par-dessus le fond de la page
  ctx.fillStyle = biome.tint;
  ctx.fillRect(0, 0, view.width, view.height);

  const warp = live && fxEnabled("fxGrid") && warpActive();
  const { minor, major } = warp ? warpedPaths() : straightPaths();
  const dim = live ? gridDim() : 1;
  ctx.lineWidth = 1;
  ctx.globalAlpha = dim;
  ctx.strokeStyle = biome.grid;
  ctx.stroke(minor);
  ctx.strokeStyle = biome.gridMajor;
  ctx.stroke(major);

  // Battement du Cœur du Pulse : la grille s'éclaire d'un coup puis s'éteint
  const beat = live ? heartBeat() : 0;
  if (beat > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = Math.min(1, beat * G.beat * dim);
    ctx.stroke(minor);
    ctx.stroke(major);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** Une onde en cours ou un trou noir à l'écran : la grille doit être déformée. */
function warpActive() {
  return world.gridPulses.length > 0 || vortex() !== null;
}

/** Trou noir (événement de carte) : { x, y, radius, k } (k = 0 → 1 pendant l'annonce), sinon null. */
function vortex() {
  const ev = game.mapEvent;
  if (ev?.type !== "vortex") return null;
  const k = ev.warn > 0 ? 0.35 * (1 - ev.warn / MAP_EVENTS.warning) : 1;
  return { x: ev.x, y: ev.y, radius: MAP_EVENTS.vortex.radius * 1.7, k };
}

/** Pendant l'annonce d'une attaque de boss (zone ou laser), la grille baisse ; elle remonte doucement après. */
function gridDim() {
  let warn = false;
  for (const h of world.hazards) {
    if (h.delay > 0 && h.damage > 0 && (h.kind === "circle" || h.kind === "beam")) {
      warn = true;
      break;
    }
  }
  const target = warn ? G.dimDuringTelegraph : 1;
  game.gridDim = (game.gridDim ?? 1) + (target - (game.gridDim ?? 1)) * 0.15;
  return game.gridDim;
}

function heartBeat() {
  let level = 0;
  for (const e of world.enemies) {
    if (e.beatAt !== undefined && !e.dead) level = Math.max(level, beatLevel(e));
  }
  return level;
}

function isMajorIndex(i) {
  return ((i % MAJOR_EVERY) + MAJOR_EVERY) % MAJOR_EVERY === 0;
}

/** Grille droite : une ligne par case visible. */
function straightPaths() {
  const minor = new Path2D();
  const major = new Path2D();
  const i0 = Math.ceil(camera.x / GRID_SIZE);
  const j0 = Math.ceil(camera.y / GRID_SIZE);
  for (let i = i0; i * GRID_SIZE - camera.x < view.width; i++) {
    const x = i * GRID_SIZE - camera.x;
    const path = isMajorIndex(i) ? major : minor;
    path.moveTo(x, 0);
    path.lineTo(x, view.height);
  }
  for (let j = j0; j * GRID_SIZE - camera.y < view.height; j++) {
    const y = j * GRID_SIZE - camera.y;
    const path = isMajorIndex(j) ? major : minor;
    path.moveTo(0, y);
    path.lineTo(view.width, y);
  }
  return { minor, major };
}

/**
 * Grille déformée : chaque nœud (coin de case, en coordonnées monde) est poussé par les ondes et
 * aspiré par le trou noir, puis les nœuds sont reliés ligne par ligne et colonne par colonne.
 */
function warpedPaths() {
  const i0 = Math.floor(camera.x / GRID_SIZE) - 1;
  const j0 = Math.floor(camera.y / GRID_SIZE) - 1;
  const cols = Math.ceil(view.width / GRID_SIZE) + 3;
  const rows = Math.ceil(view.height / GRID_SIZE) + 3;
  if (nodes.length < cols * rows * 2) nodes = new Float32Array(cols * rows * 2);
  const pulses = world.gridPulses;
  const hole = vortex();

  for (let r = 0; r < rows; r++) {
    const wy = (j0 + r) * GRID_SIZE;
    for (let c = 0; c < cols; c++) {
      const wx = (i0 + c) * GRID_SIZE;
      let dx = 0;
      let dy = 0;
      for (const p of pulses) {
        const ox = wx - p.x;
        const oy = wy - p.y;
        const d2 = ox * ox + oy * oy;
        if (d2 > p.reach * p.reach || d2 < 1) continue;
        const d = Math.sqrt(d2);
        const u = (d - p.age * G.speed) / G.width; // distance au front de l'onde
        if (u > 2.5 || u < -2.5) continue;
        const t = 1 - p.age / G.life;
        const push = (p.amp * t * t * Math.exp(-u * u) * (1 - d / p.reach)) / d;
        dx += ox * push;
        dy += oy * push;
      }
      const shift = Math.hypot(dx, dy);
      if (shift > G.maxShift) {
        dx *= G.maxShift / shift;
        dy *= G.maxShift / shift;
      }
      if (hole) {
        // Trou noir : les nœuds proches tournent et se resserrent vers le centre
        const ox = wx - hole.x;
        const oy = wy - hole.y;
        const d = Math.hypot(ox, oy);
        if (d < hole.radius) {
          const k = (1 - d / hole.radius) ** 2 * hole.k;
          const a = G.vortexSwirl * k;
          const s = 1 - G.vortexPull * k;
          const cos = Math.cos(a) * s;
          const sin = Math.sin(a) * s;
          dx += ox * cos - oy * sin - ox;
          dy += ox * sin + oy * cos - oy;
        }
      }
      const n = (r * cols + c) * 2;
      nodes[n] = wx - camera.x + dx;
      nodes[n + 1] = wy - camera.y + dy;
    }
  }

  const minor = new Path2D();
  const major = new Path2D();
  for (let c = 0; c < cols; c++) {
    const path = isMajorIndex(i0 + c) ? major : minor;
    path.moveTo(nodes[c * 2], nodes[c * 2 + 1]);
    for (let r = 1; r < rows; r++) path.lineTo(nodes[(r * cols + c) * 2], nodes[(r * cols + c) * 2 + 1]);
  }
  for (let r = 0; r < rows; r++) {
    const path = isMajorIndex(j0 + r) ? major : minor;
    path.moveTo(nodes[r * cols * 2], nodes[r * cols * 2 + 1]);
    for (let c = 1; c < cols; c++) path.lineTo(nodes[(r * cols + c) * 2], nodes[(r * cols + c) * 2 + 1]);
  }
  return { minor, major };
}
