// Pièces animées des boss, par-dessus leur sprite en cache : anneaux et plaques qui tournent en sens
// contraires, satellites, tracé d'ECG... Elles rendent les boss vivants sans redessiner leur corps.
// Un boss qui prépare une attaque (minuteur d'attaque ou de compétence presque écoulé) fait briller
// ses repères : le joueur voit venir la salve. Aucun shadowBlur : lueur = trait plus large et transparent.

import { ctx } from "../core/canvas.js";
import { player } from "../core/state.js";
import { beatLevel } from "./bosses.js";

const TAU = Math.PI * 2;
const CHARGE_TICKS = 40; // les repères s'allument pendant les 40 derniers ticks avant une attaque

/** 0 → 1 à l'approche de la prochaine attaque du boss. */
function charge(e) {
  const t = Math.min(e.attackTimer ?? Infinity, e.skillTimer ?? Infinity);
  if (!(t < CHARGE_TICKS) || t < 0) return 0;
  return 1 - t / CHARGE_TICKS;
}

/** Trait néon sans flou : halo large et transparent, puis trait net. */
function neonStroke(color, width, alpha = 1) {
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha * 0.25;
  ctx.lineWidth = width * 3;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Anneau en pointillés qui tourne. */
function dashedRing(x, y, radius, color, width, dash, offset, alpha) {
  ctx.setLineDash(dash);
  ctx.lineDashOffset = offset;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  neonStroke(color, width, alpha);
  ctx.setLineDash([]);
}

/** Arcs (segments d'anneau) qui tournent : `count` plaques de `span` radians. */
function arcPlates(x, y, radius, count, span, rot, color, width, alpha) {
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const a = rot + (i * TAU) / count;
    ctx.moveTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    ctx.arc(x, y, radius, a, a + span);
  }
  neonStroke(color, width, alpha);
}

const LAYERS = {
  /** Cœur du Pulse : bouclier octogonal violet, plaques cyan en sens inverse, ECG qui bat. */
  pulse_core(e, now, s) {
    const r = e.size;
    const beat = beatLevel(e);
    const fury = e.enraged;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(now / (fury ? 900 : 1500));
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8;
      const c = Math.cos(a);
      const n = Math.sin(a);
      // Chevron tourné vers l'extérieur
      const p = (k, w) => [c * r * k - n * r * w, n * r * k + c * r * w];
      const [ax, ay] = p(1.18, -0.2);
      const [bx, by] = p(1.32, 0);
      const [cx, cy] = p(1.18, 0.2);
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.lineTo(cx, cy);
    }
    neonStroke("#aa66ff", 3 * s, 0.85);
    ctx.restore();
    arcPlates(e.x, e.y, r * 0.98, 4, 0.5, -now / 700, "#00ffff", 2.5 * s, 0.7);
    // Tracé d'ECG horizontal : un pic à chaque battement
    const w = r * 1.6;
    const amp = r * (0.15 + 0.45 * beat);
    ctx.beginPath();
    ctx.moveTo(e.x - w, e.y);
    ctx.lineTo(e.x - r * 0.35, e.y);
    ctx.lineTo(e.x - r * 0.22, e.y - amp);
    ctx.lineTo(e.x - r * 0.05, e.y + amp * 0.8);
    ctx.lineTo(e.x + r * 0.1, e.y - amp * 0.4);
    ctx.lineTo(e.x + r * 0.25, e.y);
    ctx.lineTo(e.x + w, e.y);
    neonStroke(fury ? "#ff3b30" : "#ff2a6d", 2 * s, 0.35 + 0.5 * beat);
    ctx.globalAlpha = 1;
  },

  /** Crabe blindé : pinces qui claquent, voyants qui s'allument avant la charge. */
  miniboss(e, now, s) {
    const r = e.size;
    const k = charge(e);
    const snap = Math.abs(Math.sin(now / (k > 0 ? 70 : 260))) * 0.35;
    const face = e.facing ?? Math.atan2(player.worldY - e.y, player.worldX - e.x);
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(face);
    ctx.beginPath();
    for (const side of [-1, 1]) {
      // Pince : deux mâchoires qui s'ouvrent et se ferment devant le crabe
      const bx = r * 1.05;
      const by = side * r * 0.75;
      for (const jaw of [-1, 1]) {
        const a = side * (0.35 + jaw * snap);
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(
          bx + Math.cos(a) * r * 0.45,
          by + Math.sin(a) * r * 0.45 + jaw * r * 0.12,
          bx + Math.cos(a) * r * 0.7,
          by + Math.sin(a) * r * 0.55,
        );
      }
    }
    neonStroke(e.color, 2.5 * s, 0.9);
    ctx.restore();
    if (k > 0) dashedRing(e.x, e.y, r * 1.3, "#00ffff", 2 * s, [6, 6], now / 20, k);
    ctx.globalAlpha = 1;
  },

  /** Œil du néant : anneau de capsules qui tourne, iris qui pulse et se contracte avant la salve. */
  boss(e, now, s) {
    const r = e.size;
    const k = charge(e);
    const rot = -now / 1800;
    ctx.fillStyle = "#aa66ff";
    for (let i = 0; i < 6; i++) {
      const a = rot + (i * TAU) / 6;
      const px = e.x + Math.cos(a) * r * 1.3;
      const py = e.y + Math.sin(a) * r * 1.3;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.1, r * 0.22, 0, 0, TAU);
      neonStroke(i % 2 ? "#00ffff" : "#ff2a6d", 2 * s, 0.85);
      ctx.restore();
    }
    dashedRing(e.x, e.y, r * 1.15, e.color, 1.5 * s, [10, 8], now / 35, 0.6);
    const iris = r * (0.42 - 0.12 * k + Math.sin(now / 300) * 0.03);
    ctx.beginPath();
    ctx.arc(e.x, e.y, iris, 0, TAU);
    neonStroke("#00ff88", 2.5 * s, 0.55 + 0.45 * k);
    ctx.globalAlpha = 1;
  },
};

/** Tous les autres boss : anneau en pointillés et plaques qui tournent en sens contraires. */
function defaultLayers(e, now, s) {
  const r = e.size;
  const k = charge(e);
  dashedRing(e.x, e.y, r * 1.18, e.color, 1.5 * s, [8, 7], now / 40, 0.45 + 0.4 * k);
  arcPlates(e.x, e.y, r * 1.32, 3, 0.55, -now / 1100, e.color, 2 * s, 0.35 + 0.5 * k);
  ctx.globalAlpha = 1;
}

/**
 * Pièces animées d'un boss (coordonnées monde). `s` : échelle d'épaisseur des traits.
 * @param {any} e
 */
export function drawBossLayers(e, now, s = 1) {
  (LAYERS[e.type] || defaultLayers)(e, now, s);
}

/** Ce type a-t-il des pièces animées ? (tous les boss, et ceux décrits ci-dessus) */
export function hasBossLayers(e) {
  return !!(e.template?.isBoss || LAYERS[e.type]);
}
