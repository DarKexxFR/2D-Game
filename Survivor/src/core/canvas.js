// Canvas et « vue » logique. Toute la logique travaille en unités logiques
// (view.width × view.height) : sur petit écran la vue est dézoomée pour que
// le joueur voie autant de terrain que sur PC, et le rendu reste net (devicePixelRatio).

export const canvas = document.getElementById("gameCanvas");
export const ctx = canvas.getContext("2d");

const MIN_VIEW_SIZE = 720; // plus petit côté visible, en unités logiques
const MAX_PIXEL_RATIO = 1.5; // au-delà, coût GPU trop élevé pour un gain visuel faible

export const view = { width: 0, height: 0, scale: 1, pixelRatio: 1 };

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  view.scale = Math.min(1, Math.min(w, h) / MIN_VIEW_SIZE);
  view.width = w / view.scale;
  view.height = h / view.scale;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  view.pixelRatio = dpr * view.scale;
}
resize();
window.addEventListener("resize", resize);

/** Repasse en coordonnées logiques (à appeler au début de chaque frame). */
export function resetTransform() {
  ctx.setTransform(view.pixelRatio, 0, 0, view.pixelRatio, 0, 0);
}

/** Convertit une position écran (CSS px) en coordonnées logiques. */
export function toViewCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: (clientX - rect.left) / view.scale, y: (clientY - rect.top) / view.scale };
}
