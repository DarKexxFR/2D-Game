// Canvas et « vue » logique. Toute la logique travaille en unités logiques
// (view.width × view.height) : sur petit écran la vue est dézoomée pour que
// le joueur voie autant de terrain que sur PC, et le rendu reste net (devicePixelRatio).

import { onSettingsChange } from "../services/settings.js";
import { QUALITY, gfx } from "./gfx.js";

export const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("gameCanvas"));
export const ctx = canvas.getContext("2d");

export { gfx };

// Toutes les écritures de ctx.shadowBlur passent par ici : en qualité basse,
// les ombres sont ignorées sans avoir à modifier chaque fonction de dessin.
const shadowBlur = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "shadowBlur");
Object.defineProperty(ctx, "shadowBlur", {
  get() {
    return shadowBlur.get.call(this);
  },
  set(v) {
    shadowBlur.set.call(this, gfx.shadows ? v : 0);
  },
});

const MIN_VIEW_SIZE = 720; // plus petit côté visible, en unités logiques

export const view = { width: 0, height: 0, scale: 1, pixelRatio: 1 };

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  view.scale = Math.min(1, Math.min(w, h) / MIN_VIEW_SIZE);
  view.width = w / view.scale;
  view.height = h / view.scale;
  const dpr = Math.min(window.devicePixelRatio || 1, gfx.maxPixelRatio);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  view.pixelRatio = dpr * view.scale;
}
window.addEventListener("resize", resize);
onSettingsChange((s) => {
  Object.assign(gfx, QUALITY[s.quality] || QUALITY.high);
  resize();
});

/** Repasse en coordonnées logiques (à appeler au début de chaque frame). */
export function resetTransform() {
  ctx.setTransform(view.pixelRatio, 0, 0, view.pixelRatio, 0, 0);
}

/** Convertit une position écran (CSS px) en coordonnées logiques. */
export function toViewCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: (clientX - rect.left) / view.scale, y: (clientY - rect.top) / view.scale };
}
