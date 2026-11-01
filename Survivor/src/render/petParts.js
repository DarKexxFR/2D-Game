// Détails animés des familiers, par-dessus leur corps (PET_DRAWERS de render/entities.js) : canons et feu
// de position du drone, particules de soin, arcs de l'aimant, sillage de la faux, facettes du cristal,
// emblème du gardien, braises du dragon et du phénix. Traits fins, sans shadowBlur.

import { ctx } from "../core/canvas.js";
import { TAU, diamondPath, thinStroke, zigzagPath } from "./layerKit.js";

const GOLD = "#ffd700";

function dot(x, y, r, color, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** Braises qui s'échappent vers l'arrière (angle `a`). */
function embers(x, y, s, a, now, color, n = 4) {
  for (let i = 0; i < n; i++) {
    const t = (now / 500 + i / n) % 1;
    const spread = Math.sin(i * 2.7 + now / 300) * 0.5;
    dot(
      x - Math.cos(a + spread) * s * (1 + t * 1.6),
      y - Math.sin(a + spread) * s * (1 + t * 1.6),
      1.2 + (1 - t),
      color,
      0.8 * (1 - t),
    );
  }
}

/** @type {Record<string, (x: number, y: number, s: number, color: string, now: number, angle: number) => void>} */
const PET_PARTS = {
  /** Drone : deux canons latéraux, feu de position qui clignote. */
  drone(x, y, s, color, now) {
    const by = y + Math.sin(now / 250) * 3;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(x + side * s * 0.8, by);
      ctx.lineTo(x + side * s * 1.25, by);
    }
    thinStroke(color, 2, 0.9);
    if (Math.floor(now / 400) % 2) dot(x, by - s * 0.8, 1.6, "#ff2a6d", 1);
  },

  /** Médic : petites croix qui montent autour de lui. */
  medic(x, y, s, color, now) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const t = (now / 1200 + i / 3) % 1;
      const px = x + Math.sin(i * 2.1 + now / 500) * s * 1.4;
      const py = y + s - t * s * 2.6;
      const k = s * 0.22;
      ctx.moveTo(px - k, py);
      ctx.lineTo(px + k, py);
      ctx.moveTo(px, py - k);
      ctx.lineTo(px, py + k);
    }
    thinStroke("#ffffff", 1.2, 0.6);
  },

  /** Collecteur : arcs de champ entre les pôles de l'aimant. */
  collector(x, y, s, color, now) {
    const by = y + Math.sin(now / 280) * 3;
    ctx.setLineDash([2, 3]);
    ctx.lineDashOffset = -now / 30;
    ctx.beginPath();
    for (const d of [1.3, 1.7]) {
      ctx.moveTo(x - s, by - s * 0.9);
      ctx.quadraticCurveTo(x, by - s * 0.9 - s * d, x + s, by - s * 0.9);
    }
    thinStroke(color, 1, 0.5);
    ctx.setLineDash([]);
  },

  /** Faucheuse : sillage en arc derrière les lames. */
  reaper(x, y, s, color, now) {
    const a = now / 60;
    ctx.beginPath();
    for (const off of [0, Math.PI]) ctx.arc(x, y, s * 1.9, a + off - 0.9, a + off - 0.1);
    thinStroke(color, 1.4, 0.35);
  },

  /** Cristal de givre : facette intérieure et éclat qui tourne autour. */
  frost(x, y, s, color, now) {
    const by = y + Math.sin(now / 260) * 3;
    ctx.beginPath();
    diamondPath(x, by, now / 900 + Math.PI / 2, s * 0.6, s * 0.3);
    thinStroke("#ffffff", 1, 0.6);
    const a = -now / 400;
    dot(x + Math.cos(a) * s * 1.6, by + Math.sin(a) * s * 1.6, 1.5, "#ffffff", 0.9);
  },

  /** Gardien : chevron gravé sur le bouclier, reflet qui le balaie. */
  guardian(x, y, s, color, now) {
    const by = y + Math.sin(now / 300) * 3;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.45, by - s * 0.1);
    ctx.lineTo(x, by + s * 0.4);
    ctx.lineTo(x + s * 0.45, by - s * 0.1);
    thinStroke("#ffffff", 1.4, 0.7);
    const t = (now / 900) % 1;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.8 + t * s * 1.6, by - s * 0.8);
    ctx.lineTo(x - s * 0.9 + t * s * 1.6, by + s * 0.6);
    thinStroke("#ffffff", 1, 0.35 * Math.sin(t * Math.PI));
  },

  /** Dragonnet : braises derrière lui, petit souffle qui crépite devant. */
  dragon(x, y, s, color, now, angle) {
    const by = y + Math.sin(now / 220) * 3;
    embers(x, by, s, angle, now, "#ff7a1a", 3);
    if (Math.floor(now / 120) % 3 === 0) {
      ctx.beginPath();
      zigzagPath(
        x + Math.cos(angle) * s * 1.3,
        by + Math.sin(angle) * s * 1.3,
        x + Math.cos(angle) * s * 2,
        by + Math.sin(angle) * s * 2,
        3,
        s * 0.2,
        now,
      );
      thinStroke("#ffee00", 1.2, 0.7);
    }
  },

  /** Phénix : pluie de braises dorées dans son sillage. */
  phoenix(x, y, s, color, now, angle) {
    embers(x, y + Math.sin(now / 200) * 4, s * 1.2, angle, now, GOLD, 5);
  },
};

/** Détails animés d'un familier (angle = direction où il regarde, 0 hors combat). */
export function drawPetParts(kind, x, y, s, color, now, angle = 0) {
  const part = PET_PARTS[kind];
  if (!part) return;
  const alpha = ctx.globalAlpha;
  ctx.save();
  ctx.lineCap = "round";
  part(x, y, s, color, now, angle);
  ctx.restore();
  ctx.globalAlpha = alpha;
}

/** Familiers qui ont des détails animés (tests : chacun en a). */
export function petPartKinds() {
  return Object.keys(PET_PARTS);
}
