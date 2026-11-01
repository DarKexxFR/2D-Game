// Effets d'écran appliqués à l'image finie (après la scène) : halo lumineux global et aberration chromatique.
// Tout passe par de simples copies entre canvas (aucun WebGL, aucun shadowBlur) :
//  - halo (« bloom ») : l'image est réduite (1/4 puis 1/8), adoucie, puis rajoutée en mode « screen » ;
//    tout ce qui brille dégage une aura, pour quelques copies d'image par frame ;
//  - aberration : aux gros chocs (game.chroma), le rouge est décalé d'un côté et le cyan de l'autre.
// La vignette et les lignes d'écran sont un calque CSS (#crtOverlay, css/fx.css) : aucun coût pour le canvas.

import { VISUAL_FX } from "../config.js";
import { canvas, ctx, view } from "../core/canvas.js";
import { game } from "../core/state.js";
import { logEvent } from "../services/diagnostics.js";
import { onSettingsChange } from "../services/settings.js";
import { versus } from "../systems/versus.js";
import { fxEnabled } from "./fxFlags.js";

const BLOOM = VISUAL_FX.bloom;
const CHROMA = VISUAL_FX.chroma;

// Calque « écran rétro » : affiché par une classe sur <body>, suivie à chaque changement de réglage
onSettingsChange(() => document.body.classList.toggle("fx-crt", fxEnabled("fxCrt")));

/** @typedef {{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D }} Layer */
/** @type {Record<string, Layer>} */
const layers = {};

/** Canvas hors écran réutilisé, redimensionné seulement quand la taille change. */
function layer(name, w, h) {
  let l = layers[name];
  if (!l) {
    const c = document.createElement("canvas");
    l = layers[name] = { canvas: c, ctx: c.getContext("2d") };
  }
  if (l.canvas.width !== w) l.canvas.width = w;
  if (l.canvas.height !== h) l.canvas.height = h;
  return l;
}

// Coût moyen du halo (ms par image, moyenne glissante) ; trop cher = coupé pour la session
const bloomCost = { avg: 0, samples: 0, suspended: false };

/** Le halo a été coupé automatiquement (appareil trop lent pour lui). */
export function bloomSuspended() {
  return bloomCost.suspended;
}

/** À appeler une fois l'image de la partie dessinée. */
export function applyPostFx() {
  const bloom = fxEnabled("fxBloom") && !bloomCost.suspended;
  const chroma = fxEnabled("fxChroma") && game.chroma > 0 && !versus.split;
  if (!bloom && !chroma) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // pixels réels du canvas
  if (bloom) timedBloom();
  if (chroma) drawChroma();
  ctx.restore();
}

/** Halo mesuré : sur un appareil qui le dessine sans carte graphique, il coûte trop cher et se coupe. */
function timedBloom() {
  const t0 = performance.now();
  drawBloom();
  const ms = performance.now() - t0;
  bloomCost.samples++;
  bloomCost.avg += (ms - bloomCost.avg) * (bloomCost.samples < 10 ? 0.5 : 0.08);
  if (bloomCost.samples >= BLOOM.samples && bloomCost.avg > BLOOM.budgetMs) {
    bloomCost.suspended = true;
    logEvent("rendu", `halo coupé : ${bloomCost.avg.toFixed(1)} ms par image`);
  }
}

function drawBloom() {
  const w = canvas.width;
  const h = canvas.height;
  const sw = Math.max(1, Math.round(w / BLOOM.scale));
  const sh = Math.max(1, Math.round(h / BLOOM.scale));
  const tw = Math.max(1, sw >> 1);
  const th = Math.max(1, sh >> 1);
  const small = layer("bloom", sw, sh);
  const tiny = layer("bloomTiny", tw, th);
  small.ctx.globalCompositeOperation = "copy";
  small.ctx.drawImage(canvas, 0, 0, sw, sh);
  tiny.ctx.globalCompositeOperation = "copy";
  tiny.ctx.drawImage(small.canvas, 0, 0, tw, th);
  // Retour à 1/4, adouci (flou du navigateur s'il le permet, sinon le simple agrandissement lissé)
  if ("filter" in small.ctx) small.ctx.filter = "blur(1.5px)";
  small.ctx.drawImage(tiny.canvas, 0, 0, sw, sh);
  if ("filter" in small.ctx) small.ctx.filter = "none";
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = BLOOM.alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small.canvas, 0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

/** Sépare l'image en deux couches (rouge ; vert + bleu) et les redessine décalées en sens contraires. */
function drawChroma() {
  const w = canvas.width;
  const h = canvas.height;
  const k = Math.min(1, game.chroma / CHROMA.ticks);
  const dx = Math.max(1, Math.round(CHROMA.shift * k * view.pixelRatio));
  const red = channel("chromaRed", w, h, "#ff0000");
  const cyan = channel("chromaCyan", w, h, "#00ffff");
  ctx.globalCompositeOperation = "copy";
  ctx.drawImage(cyan, -dx, 0);
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(red, dx, 0);
  ctx.globalCompositeOperation = "source-over";
}

/** Copie de l'image réduite à une couleur (`mask` = canaux gardés), transparence d'origine conservée. */
function channel(name, w, h, mask) {
  const { canvas: c, ctx: g } = layer(name, w, h);
  g.globalCompositeOperation = "copy";
  g.drawImage(canvas, 0, 0);
  g.globalCompositeOperation = "destination-over"; // fond noir : le filtre ne colore pas le transparent
  g.fillStyle = "#000000";
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = "multiply";
  g.fillStyle = mask;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = "destination-in"; // retrouve la transparence de l'image
  g.drawImage(canvas, 0, 0);
  g.globalCompositeOperation = "source-over";
  return c;
}
