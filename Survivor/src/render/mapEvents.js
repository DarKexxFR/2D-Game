// Rendu des événements de carte : trou noir (au sol) et voile de pluie (par-dessus la scène).

import { MAP_EVENTS } from "../config.js";
import { ctx, view } from "../core/canvas.js";
import { camera, game } from "../core/state.js";
import { fillCircle, strokeCircle } from "./draw.js";

const TAU = Math.PI * 2;

/** Trou noir : anneau d'alerte pendant l'annonce, puis spirales qui tournent vers le centre. */
export function drawVortex(now) {
  const ev = game.mapEvent;
  if (ev?.type !== "vortex") return;
  const cfg = MAP_EVENTS.vortex;
  if (ev.warn > 0) {
    const t = 1 - ev.warn / MAP_EVENTS.warning;
    ctx.globalAlpha = 0.5 + Math.sin(now / 80) * 0.3;
    ctx.setLineDash([12, 10]);
    strokeCircle(ev.x, ev.y, cfg.radius, cfg.color, 2);
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.3;
    fillCircle(ev.x, ev.y, cfg.core * t, cfg.color);
    ctx.globalAlpha = 1;
    return;
  }
  const g = ctx.createRadialGradient(ev.x, ev.y, 0, ev.x, ev.y, cfg.radius);
  g.addColorStop(0, "rgba(170, 102, 255, 0.35)");
  g.addColorStop(1, "rgba(170, 102, 255, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(ev.x, ev.y, cfg.radius, 0, TAU);
  ctx.fill();
  // Bras de spirale
  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = 2;
  const spin = now / 300;
  for (let arm = 0; arm < 4; arm++) {
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    for (let k = 0; k <= 24; k++) {
      const f = k / 24;
      const a = spin + (arm * TAU) / 4 + f * 3;
      const r = cfg.core + (cfg.radius - cfg.core) * (1 - f);
      ctx.lineTo(ev.x + Math.cos(a) * r, ev.y + Math.sin(a) * r);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 25;
  ctx.shadowColor = cfg.color;
  fillCircle(ev.x, ev.y, cfg.core, "#08000f");
  strokeCircle(ev.x, ev.y, cfg.core, cfg.color, 3);
  ctx.shadowBlur = 0;
}

/** Pluie (acide ou astéroïdes) : voile teinté et traits de pluie en coordonnées écran. */
export function drawWeather(now) {
  const ev = game.mapEvent;
  if (!ev || (ev.type !== "acid" && ev.type !== "asteroids")) return;
  const cfg = MAP_EVENTS[ev.type];
  // Le voile monte pendant l'annonce et retombe à la fin
  const fade = Math.min(1, (MAP_EVENTS.warning - ev.warn) / 60, (cfg.duration - ev.tick) / 60);
  ctx.globalAlpha = 0.06 * fade;
  ctx.fillStyle = cfg.color;
  ctx.fillRect(0, 0, view.width, view.height);
  if (ev.type !== "acid") {
    ctx.globalAlpha = 1;
    return;
  }
  ctx.globalAlpha = 0.35 * fade;
  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 90; i++) {
    // Positions fixes par goutte (pseudo-aléatoires), qui défilent avec la caméra
    const sx = (((i * 137.5 - camera.x * 0.6) % view.width) + view.width) % view.width;
    const sy =
      (((i * 89.3 + now * (0.5 + (i % 3) * 0.2) - camera.y * 0.6) % view.height) + view.height) % view.height;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx - 4, sy + 16);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}
