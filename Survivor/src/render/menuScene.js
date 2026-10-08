// Scène animée derrière l'écran d'accueil : sol néon, ligne de pouls (ECG) qui traverse
// l'écran et fait « battre » le héros équipé, avec son familier en orbite.
// Le héros se place dans la zone #heroStage du menu (vide en HTML, remplie ici).

import { ctx, resetTransform, toViewCoords, view } from "../core/canvas.js";
import { HEROES, PETS } from "../data/items.js";
import { getEquipped } from "../services/inventory.js";
import { drawPet, drawShip } from "./entities.js";

const TAU = Math.PI * 2;
const BEAT_PX = 520; // distance entre deux battements sur la ligne
const BEAT_MS = 1100; // ≈ 55 battements par minute
const SPEED = BEAT_PX / BEAT_MS;
const PULSE_COLOR = "#ff2a6d";

// Forme d'un battement (position dans la période → hauteur) : onde P, complexe QRS, onde T.
const ECG = [
  [0, 0],
  [0.1, 0],
  [0.14, 0.12],
  [0.18, 0],
  [0.3, 0],
  [0.32, -0.18],
  [0.345, 1],
  [0.37, -0.42],
  [0.395, 0],
  [0.5, 0],
  [0.56, 0.24],
  [0.63, 0],
  [1, 0],
];
const SPIKE = 0.345; // sommet du battement

function ecg(f) {
  for (let i = 1; i < ECG.length; i++) {
    const [x1, y1] = ECG[i];
    if (f <= x1) {
      const [x0, y0] = ECG[i - 1];
      return y0 + ((y1 - y0) * (f - x0)) / (x1 - x0);
    }
  }
  return 0;
}

const fract = (v) => v - Math.floor(v);

// Étoiles fixes (positions relatives) qui scintillent doucement
const STARS = Array.from({ length: 140 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: Math.random() < 0.15 ? 1.6 : 0.9,
  phase: Math.random() * TAU,
}));

/** Centre et taille de la zone du héros, en coordonnées logiques (milieu de l'écran sinon). */
function stageArea() {
  const stage = document.getElementById("heroStage");
  const rect = stage?.getBoundingClientRect();
  if (!rect || rect.width === 0) {
    return { x: view.width / 2, y: view.height * 0.45, r: 40, visible: false };
  }
  const c = toViewCoords(rect.left + rect.width / 2, rect.top + rect.height * 0.45);
  // Taille du héros (px écran) : tient dans la zone, nom compris (≈ 40 px sous le socle)
  const size = Math.min(rect.width * 0.2, (rect.height * 0.55 - 40) / 2.1, 44);
  const r = Math.max(14, size / view.scale);
  return { ...c, r, visible: true };
}

export function renderMenuBackground() {
  const now = performance.now();
  resetTransform();
  const { width: w, height: h } = view;
  const stage = stageArea();

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#05010c");
  sky.addColorStop(0.6, "#12041f");
  sky.addColorStop(1, "#1d0630");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  drawStars(w, h, now);
  drawFloor(w, h, stage.y + stage.r * 1.9, now);

  // Temps écoulé depuis que le dernier battement est passé sous le héros
  const sinceBeat = fract((now * SPEED - stage.x) / BEAT_PX + SPIKE) * BEAT_MS;
  drawPulseLine(w, stage, now);
  if (!stage.visible) return;
  drawRings(stage, sinceBeat);
  drawHero(stage, sinceBeat, now);
}

function drawStars(w, h, now) {
  ctx.fillStyle = "#ffffff";
  for (const s of STARS) {
    ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(now / 900 + s.phase));
    ctx.fillRect(s.x * w, s.y * h * 0.85, s.r, s.r);
  }
  ctx.globalAlpha = 1;
}

/** Sol en grille qui défile vers le joueur, en perspective. */
function drawFloor(w, h, horizon, now) {
  if (horizon >= h) return;
  const depth = h - horizon;
  const glow = ctx.createLinearGradient(0, horizon, 0, h);
  glow.addColorStop(0, "rgba(255, 42, 109, 0.18)");
  glow.addColorStop(1, "rgba(80, 0, 120, 0.05)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, horizon, w, depth);

  ctx.lineWidth = 1;
  // Lignes horizontales : resserrées près de l'horizon, elles avancent avec le temps
  const offset = fract(now / 1600);
  for (let i = 0; i < 14; i++) {
    const t = (i + offset) / 14;
    const y = horizon + depth * t * t;
    ctx.strokeStyle = `rgba(255, 42, 109, ${0.08 + 0.4 * t})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // Lignes de fuite
  const cx = w / 2;
  ctx.strokeStyle = "rgba(255, 42, 109, 0.22)";
  ctx.beginPath();
  for (let i = -12; i <= 12; i++) {
    ctx.moveTo(cx + i * 30, horizon);
    ctx.lineTo(cx + i * 30 * (1 + depth / 40), h);
  }
  ctx.stroke();

  // Ligne d'horizon lumineuse
  const line = ctx.createLinearGradient(0, 0, w, 0);
  line.addColorStop(0, "rgba(255, 42, 109, 0)");
  line.addColorStop(0.5, "rgba(255, 120, 200, 0.9)");
  line.addColorStop(1, "rgba(255, 42, 109, 0)");
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(w, horizon);
  ctx.stroke();
}

/** Ligne de pouls : traverse tout l'écran et s'efface autour du héros. */
function drawPulseLine(w, stage, now) {
  const amp = stage.r * 1.5;
  const gap = stage.visible ? stage.r * 2.3 : 0;
  const fade = ctx.createLinearGradient(0, 0, w, 0);
  fade.addColorStop(0, "rgba(255, 42, 109, 0)");
  fade.addColorStop(0.2, PULSE_COLOR);
  fade.addColorStop(0.8, PULSE_COLOR);
  fade.addColorStop(1, "rgba(255, 42, 109, 0)");

  ctx.save();
  ctx.lineJoin = "round";
  ctx.strokeStyle = fade;
  ctx.shadowColor = PULSE_COLOR;
  ctx.shadowBlur = 12;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  let drawing = false;
  for (let x = 0; x <= w; x += 3) {
    if (Math.abs(x - stage.x) < gap) {
      drawing = false;
      continue;
    }
    const y = stage.y - amp * ecg(fract((x - now * SPEED) / BEAT_PX));
    if (drawing) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
    drawing = true;
  }
  ctx.stroke();
  ctx.restore();
}

/** Ondes qui partent du héros à chaque battement. */
function drawRings({ x, y, r }, sinceBeat) {
  ctx.save();
  ctx.lineWidth = 2;
  for (let k = 0; k < 2; k++) {
    const t = sinceBeat + k * BEAT_MS;
    const alpha = 1 - t / (BEAT_MS * 1.8);
    if (alpha <= 0) continue;
    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = PULSE_COLOR;
    ctx.shadowColor = PULSE_COLOR;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.6 + t * 0.08, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHero({ x, y, r }, sinceBeat, now) {
  const heroId = getEquipped("hero")?.id || "pilot";
  const hero = HEROES[heroId] || HEROES.pilot;
  const beat = 1 + 0.12 * Math.exp(-sinceBeat / 110);
  const bob = Math.sin(now / 700) * r * 0.08;

  // Socle lumineux
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = hero.color;
  ctx.shadowColor = hero.color;
  ctx.shadowBlur = 25;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 1.75, r * 1.5, r * 0.32, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  drawShip(x, y + bob, r * beat, -Math.PI / 2, hero.color, true, now, hero.hull);

  const petId = getEquipped("pet")?.id;
  const pet = PETS[petId];
  if (pet) {
    const a = now / 1400;
    drawPet(petId, x + Math.cos(a) * r * 2.4, y + Math.sin(a) * r * 1.1, r * 0.32, pet.color, now);
  }
}
