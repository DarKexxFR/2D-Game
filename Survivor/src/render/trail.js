// Dessin de la traînée du vaisseau (skin) : ruban, particules, étincelles, anneaux, flammes, pixels.

import { TRAIL } from "../data/skins.js";

const TAU = Math.PI * 2;

/** Dessine une liste de points de traînée (voir systems/trail.js) sur le contexte `c`. */
export function drawTrail(c, points) {
  if (points.length === 0) return;
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  if (points[0].style === "ribbon") drawRibbon(c, points);
  else for (const p of points) DRAWERS[p.style]?.(c, p, p.life / TRAIL.life);
  c.restore();
}

/** Ruban continu qui s'affine et s'efface vers la queue. */
function drawRibbon(c, points) {
  c.shadowBlur = 12;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.style !== "ribbon" || b.style !== "ribbon") continue;
    // Deux points trop éloignés (dash, nouvelle partie) : pas de trait entre eux
    if (Math.hypot(b.x - a.x, b.y - a.y) > b.size * 4) continue;
    const k = b.life / TRAIL.life;
    c.globalAlpha = k * 0.8;
    c.strokeStyle = b.color;
    c.shadowColor = b.color;
    c.lineWidth = Math.max(1, b.size * 0.7 * k);
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
  }
}

const DRAWERS = {
  dots(c, p, k) {
    c.globalAlpha = k;
    c.fillStyle = p.color;
    c.shadowBlur = 8;
    c.shadowColor = p.color;
    c.beginPath();
    c.arc(p.x, p.y, Math.max(0.5, p.size * 0.28 * k), 0, TAU);
    c.fill();
  },
  sparks(c, p, k) {
    const r = p.size * (0.15 + 0.3 * k);
    c.globalAlpha = k;
    c.strokeStyle = p.color;
    c.shadowBlur = 8;
    c.shadowColor = p.color;
    c.lineWidth = 1.5;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.seed * TAU + (1 - k) * 3);
    c.beginPath();
    c.moveTo(-r, 0);
    c.lineTo(r, 0);
    c.moveTo(0, -r);
    c.lineTo(0, r);
    c.stroke();
    c.restore();
  },
  rings(c, p, k) {
    c.globalAlpha = k * 0.7;
    c.strokeStyle = p.color;
    c.shadowBlur = 10;
    c.shadowColor = p.color;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(p.x, p.y, p.size * (0.25 + (1 - k) * 0.9), 0, TAU);
    c.stroke();
  },
  flames(c, p, k) {
    const r = p.size * (0.2 + (1 - k) * 0.55);
    c.globalCompositeOperation = "lighter";
    c.globalAlpha = k * 0.55;
    const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, k > 0.6 ? "#ffffff" : p.color);
    g.addColorStop(0.45, p.color);
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(p.x, p.y, r, 0, TAU);
    c.fill();
    c.globalCompositeOperation = "source-over";
  },
  pixels(c, p, k) {
    const s = Math.max(1, Math.round(p.size * 0.3 * (0.4 + k * 0.6)));
    // Clignotement « glitch » : certains carrés disparaissent un instant
    if (k < 0.7 && Math.floor(p.life / 3 + p.seed * 7) % 4 === 0) return;
    c.globalAlpha = k;
    c.fillStyle = p.color;
    c.shadowBlur = 6;
    c.shadowColor = p.color;
    c.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
  },
};
