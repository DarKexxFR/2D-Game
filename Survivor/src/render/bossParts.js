// Pièces animées propres à chaque boss (en plus de son sprite en cache) : elles racontent ce que fait le
// boss (glace qui gravite, arcs électriques, aiguilles d'horloge, toile...) et s'allument quand une attaque
// approche (`charge`). Appelées par render/bossLayers.js. Aucun shadowBlur.

import { ctx } from "../core/canvas.js";
import { player } from "../core/state.js";
import {
  TAU,
  arcPlates,
  charge,
  dashedRing,
  diamondPath,
  neonStroke,
  polyPath,
  zigzagPath,
} from "./layerKit.js";

const CYAN = "#00ffff";
const PINK = "#ff2a6d";
const VIOLET = "#aa66ff";
const GOLD = "#ffd700";
const GREEN = "#00ff88";
const ICE = "#9fe8ff";
const FIRE = "#ff7a1a";

/** Angle du boss vers le joueur (ou son orientation propre). */
const facing = (e) => e.facing ?? Math.atan2(player.worldY - e.y, player.worldX - e.x);

/** Petits points qui gravitent : `n` points sur un anneau de rayon `radius`. */
function orbitDots(x, y, radius, n, rot, size, color, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i * TAU) / n;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    ctx.moveTo(px + size, py);
    ctx.arc(px, py, size, 0, TAU);
  }
  ctx.fill();
}

/** @type {Record<string, (e: any, now: number, s: number) => void>} */
export const BOSS_PARTS = {
  /** Roi Slime : bulles qui remontent dans la gelée, cercle d'impact au sol avant le saut. */
  slime_boss(e, now, s) {
    const r = e.size;
    const k = charge(e);
    ctx.fillStyle = "#d8ffd8";
    for (let i = 0; i < 6; i++) {
      const t = (now / 1400 + i / 6) % 1;
      const bx = e.x + Math.sin(i * 2.4 + now / 600) * r * 0.45;
      const by = e.y + r * 0.5 - t * r;
      ctx.globalAlpha = 0.5 * Math.sin(t * Math.PI);
      ctx.beginPath();
      ctx.arc(bx, by, r * (0.04 + 0.03 * (i % 3)), 0, TAU);
      ctx.fill();
    }
    if (k > 0) dashedRing(e.x, e.y, r * (1.6 - k * 0.4), "#88ff88", 2 * s, [10, 8], now / 25, k);
    ctx.globalAlpha = 1;
  },

  /** Nécro-Hydre : sceau runique qui tourne sous ses têtes, gouttes de venin. */
  hydra(e, now, s) {
    const r = e.size;
    const k = charge(e);
    ctx.beginPath();
    polyPath(e.x, e.y, 3, r * 1.25, now / 2000);
    polyPath(e.x, e.y, 3, r * 1.25, now / 2000 + Math.PI);
    neonStroke(VIOLET, 1.5 * s, 0.35 + 0.5 * k);
    orbitDots(e.x, e.y, r * 1.05, 6, -now / 900, 2 * s, GREEN, 0.7);
    ctx.globalAlpha = 1;
  },

  /** Colosse de givre : éclats de glace en orbite, givre qui s'étend avant une attaque. */
  colossus(e, now, s) {
    const r = e.size;
    const k = charge(e);
    const rot = now / 1600;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = rot + (i * TAU) / 6;
      const d = r * (1.3 + 0.06 * Math.sin(now / 300 + i));
      diamondPath(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, a, r * 0.16, r * 0.07);
    }
    neonStroke(ICE, 1.6 * s, 0.85);
    if (k > 0) {
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12;
        ctx.moveTo(e.x + Math.cos(a) * r * 1.05, e.y + Math.sin(a) * r * 1.05);
        ctx.lineTo(e.x + Math.cos(a) * r * (1.05 + 0.45 * k), e.y + Math.sin(a) * r * (1.05 + 0.45 * k));
      }
      neonStroke("#ffffff", 1.2 * s, k);
    }
    ctx.globalAlpha = 1;
  },

  /** Faucheur du vide : faux en croissant qui tourne autour de lui, volutes d'ombre. */
  void_reaper(e, now, s) {
    const r = e.size;
    const k = charge(e);
    const a = now / (e.enraged ? 260 : 420);
    ctx.beginPath();
    for (const off of [0, Math.PI]) {
      ctx.arc(e.x, e.y, r * 1.35, a + off, a + off + 1.1);
      ctx.arc(e.x, e.y, r * 1.18, a + off + 0.9, a + off, true);
      ctx.closePath();
    }
    neonStroke(VIOLET, 1.8 * s, 0.7 + 0.3 * k);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const w = now / 500 + (i * TAU) / 3;
      ctx.moveTo(e.x + Math.cos(w) * r * 0.9, e.y + Math.sin(w) * r * 0.9);
      ctx.quadraticCurveTo(
        e.x + Math.cos(w + 0.6) * r * 1.5,
        e.y + Math.sin(w + 0.6) * r * 1.5,
        e.x + Math.cos(w + 1.2) * r * 1.1,
        e.y + Math.sin(w + 1.2) * r * 1.1,
      );
      neonStroke("#5b2a9e", 1.2 * s, 0.5);
    }
    ctx.globalAlpha = 1;
  },

  /** Titan de l'orage : arcs électriques qui crépitent autour de lui, de plus en plus avant la frappe. */
  storm_titan(e, now, s) {
    const r = e.size;
    const k = charge(e);
    const tick = Math.floor(now / 70);
    const arcs = 3 + Math.round(k * 4);
    ctx.beginPath();
    for (let i = 0; i < arcs; i++) {
      const a = ((tick * 7 + i * 13) % 32) * (TAU / 32);
      const b = a + 0.5 + ((tick + i) % 3) * 0.2;
      zigzagPath(
        e.x + Math.cos(a) * r * 1.05,
        e.y + Math.sin(a) * r * 1.05,
        e.x + Math.cos(b) * r * 1.3,
        e.y + Math.sin(b) * r * 1.3,
        5,
        r * 0.1,
        tick + i,
      );
    }
    neonStroke(stormColor(e), 1.4 * s, 0.6 + 0.4 * k);
    arcPlates(e.x, e.y, r * 1.12, 4, 0.35, now / 900, CYAN, 1.5 * s, 0.4 + 0.4 * k);
    ctx.globalAlpha = 1;
  },

  /** Sentinelle prismatique : facettes qui tournent en sens contraires, rayons arc-en-ciel avant le laser. */
  prism(e, now, s) {
    const r = e.size;
    const k = charge(e);
    ctx.beginPath();
    polyPath(e.x, e.y, 3, r * 1.3, -now / 1300);
    neonStroke(CYAN, 1.6 * s, 0.6);
    ctx.beginPath();
    polyPath(e.x, e.y, 6, r * 1.15, now / 1700);
    neonStroke(PINK, 1.2 * s, 0.45);
    if (k > 0) {
      const colors = ["#ff3b30", "#ffd700", "#00ff88", "#00ffff", "#aa66ff"];
      colors.forEach((col, i) => {
        const a = now / 400 + (i * TAU) / colors.length;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a) * r * 0.5, e.y + Math.sin(a) * r * 0.5);
        ctx.lineTo(e.x + Math.cos(a) * r * (1.2 + k * 0.6), e.y + Math.sin(a) * r * (1.2 + k * 0.6));
        neonStroke(col, 1.4 * s, k);
      });
    }
    ctx.globalAlpha = 1;
  },

  /** Kraken : bulles qui montent autour de lui, œil cerclé qui se plisse avant une attaque. */
  kraken(e, now, s) {
    const r = e.size;
    const k = charge(e);
    ctx.strokeStyle = "#7fe8ff";
    ctx.lineWidth = 1.2 * s;
    for (let i = 0; i < 7; i++) {
      const t = (now / 1800 + i / 7) % 1;
      const a = i * 0.9;
      ctx.globalAlpha = 0.6 * (1 - t);
      ctx.beginPath();
      ctx.arc(
        e.x + Math.cos(a) * r * (1 + t * 0.4),
        e.y + Math.sin(a) * r * (1 + t * 0.4),
        r * 0.05 + t * 3,
        0,
        TAU,
      );
      ctx.stroke();
    }
    dashedRing(e.x, e.y, r * 1.2, "#00b3ff", 1.6 * s, [14, 10], -now / 50, 0.35 + 0.5 * k);
    ctx.globalAlpha = 1;
  },

  /** Jumeau de feu : langues de flammes qui lèchent son pourtour. */
  twin_fire(e, now, s) {
    const r = e.size;
    const k = charge(e);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8 + now / 1200;
      const h = r * (0.25 + 0.15 * Math.sin(now / 90 + i * 1.7) + 0.2 * k);
      const x0 = e.x + Math.cos(a - 0.18) * r;
      const y0 = e.y + Math.sin(a - 0.18) * r;
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(
        e.x + Math.cos(a) * (r + h * 1.4),
        e.y + Math.sin(a) * (r + h * 1.4),
        e.x + Math.cos(a + 0.18) * r,
        e.y + Math.sin(a + 0.18) * r,
      );
    }
    neonStroke(FIRE, 1.6 * s, 0.8);
    ctx.globalAlpha = 1;
  },

  /** Jumeau de glace : flocon géant qui tourne lentement autour de lui. */
  twin_ice(e, now, s) {
    const r = e.size;
    const k = charge(e);
    const rot = -now / 2200;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = rot + (i * TAU) / 6;
      const c = Math.cos(a);
      const n = Math.sin(a);
      const x1 = e.x + c * r * 1.45;
      const y1 = e.y + n * r * 1.45;
      ctx.moveTo(e.x + c * r * 1.05, e.y + n * r * 1.05);
      ctx.lineTo(x1, y1);
      // Petites branches du flocon
      for (const side of [-1, 1]) {
        const b = a + side * 0.6;
        ctx.moveTo(e.x + c * r * 1.28, e.y + n * r * 1.28);
        ctx.lineTo(e.x + c * r * 1.28 + Math.cos(b) * r * 0.14, e.y + n * r * 1.28 + Math.sin(b) * r * 0.14);
      }
    }
    neonStroke(ICE, 1.4 * s, 0.6 + 0.4 * k);
    ctx.globalAlpha = 1;
  },

  /** Ver des sables : mandibules qui s'ouvrent et claquent, plus vite avant une attaque. */
  sandworm(e, now, s) {
    const r = e.size;
    const k = charge(e);
    const a = e.heading ?? 0;
    const open = 0.35 + Math.abs(Math.sin(now / (k > 0 ? 60 : 220))) * 0.35;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(a);
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(r * 0.75, side * r * 0.35);
      ctx.quadraticCurveTo(
        r * 1.25,
        side * r * (0.35 + open * 0.6),
        r * 1.45,
        side * r * (0.1 + open * 0.15),
      );
    }
    neonStroke("#ffb347", 2.2 * s, 0.9);
    ctx.restore();
    ctx.globalAlpha = 1;
  },

  /** Mère-Ruche : ailes translucides qui bourdonnent, abeilles en orbite. */
  hive_queen(e, now, s) {
    const r = e.size;
    const k = charge(e);
    const face = facing(e);
    const buzz = Math.sin(now / 25) * 0.2;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(face);
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.ellipse(-r * 0.35, side * r * 0.85, r * 0.6, r * 0.28, side * (0.5 + buzz), 0, TAU);
    }
    ctx.fillStyle = "#ffe14d";
    ctx.globalAlpha = 0.12;
    ctx.fill();
    neonStroke("#ffe14d", 1.2 * s, 0.6);
    ctx.restore();
    orbitDots(e.x, e.y, r * (1.4 + 0.1 * Math.sin(now / 200)), 5, now / 500, 2.2 * s, GOLD, 0.6 + 0.4 * k);
    ctx.globalAlpha = 1;
  },

  /** Chronophage : cadran autour de lui, aiguilles qui tournent (à l'envers pendant le retour arrière). */
  chronophage(e, now, s) {
    const r = e.size;
    const k = charge(e);
    const dir = e.rewindIn > 0 ? -1 : 1;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12;
      const inner = i % 3 ? 1.22 : 1.15;
      ctx.moveTo(e.x + Math.cos(a) * r * inner, e.y + Math.sin(a) * r * inner);
      ctx.lineTo(e.x + Math.cos(a) * r * 1.32, e.y + Math.sin(a) * r * 1.32);
    }
    neonStroke(GOLD, 1.4 * s, 0.55 + 0.4 * k);
    const hands = [
      { a: (dir * now) / 300, len: 1.3 },
      { a: (dir * now) / 3600, len: 0.95 },
    ];
    ctx.beginPath();
    for (const h of hands) {
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(h.a) * r * h.len, e.y + Math.sin(h.a) * r * h.len);
    }
    neonStroke(CYAN, 1.6 * s, 0.7);
    ctx.globalAlpha = 1;
  },

  /** Hacker : blocs de code qui clignotent autour de lui, ligne de balayage. */
  hacker(e, now, s) {
    const r = e.size;
    const k = charge(e);
    const tick = Math.floor(now / 110);
    ctx.fillStyle = GREEN;
    for (let i = 0; i < 10; i++) {
      if ((tick + i * 7) % 3 === 0) continue;
      const a = ((i * 37 + tick * 3) % 60) * (TAU / 60);
      const d = r * (1.15 + ((i * 13 + tick) % 5) * 0.06);
      ctx.globalAlpha = 0.35 + 0.4 * k;
      ctx.fillRect(e.x + Math.cos(a) * d - 3 * s, e.y + Math.sin(a) * d - 1.5 * s, 6 * s, 3 * s);
    }
    const scan = ((now / 900) % 1) * 2 - 1;
    ctx.beginPath();
    const half = Math.sqrt(Math.max(0, 1 - scan * scan)) * r * 1.1;
    ctx.moveTo(e.x - half, e.y + scan * r * 1.1);
    ctx.lineTo(e.x + half, e.y + scan * r * 1.1);
    neonStroke(GREEN, 1.2 * s, 0.6);
    ctx.globalAlpha = 1;
  },

  /** Forgeronne stellaire : roue dentée qui tourne, étincelles de forge. */
  forge(e, now, s) {
    const r = e.size;
    const k = charge(e);
    const rot = now / 1400;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = rot + (i * TAU) / 12;
      const b = a + TAU / 24;
      ctx.lineTo(e.x + Math.cos(a) * r * 1.35, e.y + Math.sin(a) * r * 1.35);
      ctx.lineTo(e.x + Math.cos(a + 0.12) * r * 1.35, e.y + Math.sin(a + 0.12) * r * 1.35);
      ctx.lineTo(e.x + Math.cos(b) * r * 1.2, e.y + Math.sin(b) * r * 1.2);
      ctx.lineTo(e.x + Math.cos(b + 0.14) * r * 1.2, e.y + Math.sin(b + 0.14) * r * 1.2);
    }
    ctx.closePath();
    neonStroke("#ffb347", 1.5 * s, 0.55 + 0.4 * k);
    ctx.fillStyle = GOLD;
    for (let i = 0; i < 6; i++) {
      const t = (now / 500 + i / 6) % 1;
      const a = i * 1.9 + Math.floor(now / 500 + i / 6) * 0.7;
      ctx.globalAlpha = 1 - t;
      ctx.fillRect(
        e.x + Math.cos(a) * r * (0.9 + t * 0.8) - 1.5,
        e.y + Math.sin(a) * r * (0.9 + t * 0.8) - 1.5,
        3,
        3,
      );
    }
    ctx.globalAlpha = 1;
  },

  /** Le Reflet : éclats de miroir par paires symétriques, reflet qui court dessus. */
  mirror(e, now, s) {
    const r = e.size;
    const k = charge(e);
    const rot = now / 1800;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = rot + (i * TAU) / 8;
      for (const off of [0, Math.PI]) {
        const b = a + off;
        diamondPath(
          e.x + Math.cos(b) * r * 1.35,
          e.y + Math.sin(b) * r * 1.35,
          b + Math.PI / 2,
          r * 0.2,
          r * 0.06,
        );
      }
    }
    neonStroke("#e0f7ff", 1.3 * s, 0.6 + 0.3 * k);
    const shine = (now / 700) % TAU;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 1.12, shine, shine + 0.6);
    neonStroke("#ffffff", 2 * s, 0.7);
    ctx.globalAlpha = 1;
  },

  /** Tisseuse du vide : toile en rayons et polygones concentriques qui tourne lentement. */
  weaver(e, now, s) {
    const r = e.size;
    const k = charge(e);
    const rot = now / 3000;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = rot + (i * TAU) / 8;
      ctx.moveTo(e.x + Math.cos(a) * r * 0.9, e.y + Math.sin(a) * r * 0.9);
      ctx.lineTo(e.x + Math.cos(a) * r * 1.5, e.y + Math.sin(a) * r * 1.5);
    }
    for (const d of [1.15, 1.38]) polyPath(e.x, e.y, 8, r * d, rot);
    neonStroke(VIOLET, 1 * s, 0.4 + 0.5 * k);
    ctx.globalAlpha = 1;
  },

  /** L'Architecte : plan de construction (carrés imbriqués, compas) qui tourne en couches. */
  architect(e, now, s) {
    const r = e.size;
    const k = charge(e);
    ctx.beginPath();
    polyPath(e.x, e.y, 4, r * 1.35, now / 2600);
    neonStroke(CYAN, 1.4 * s, 0.55);
    ctx.beginPath();
    polyPath(e.x, e.y, 4, r * 1.2, -now / 2000 + Math.PI / 4);
    neonStroke(GOLD, 1.2 * s, 0.45 + 0.4 * k);
    // Graduations qui défilent sur le cercle extérieur
    dashedRing(e.x, e.y, r * 1.55, CYAN, 1 * s, [2, 10], now / 30, 0.4 + 0.4 * k);
    // Bras du compas
    const a = now / 700;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + Math.cos(a) * r * 1.55, e.y + Math.sin(a) * r * 1.55);
    neonStroke("#ffffff", 1 * s, 0.5);
    ctx.globalAlpha = 1;
  },
};

/** Arcs du Titan : dorés, blancs en furie. */
function stormColor(e) {
  return e.enraged ? "#ffffff" : GOLD;
}
