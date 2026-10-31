// Carte de score à partager (Discord, Insta...) : une image 1080×1350 dessinée sur un canvas à partir
// d'un résumé de la partie (voir ui/shareMenu.js runSummary). Rien ici ne lit l'état du jeu.

import { ICONS, iconGrid } from "../data/icons.js";
import { drawShip } from "./entities.js";

export const CARD_W = 1080;
export const CARD_H = 1350;

/**
 * @typedef {{ name: string, icon: string, color: string, count?: number }} CardIcon
 * @typedef {{
 *   pseudo: string, mode: { label: string, color: string }, valueLabel: string, value: number,
 *   newRecord: boolean, biome: { name: string, color: string }, level: number, duration: string,
 *   kills: number, bosses: number, combo: number, hero: { name: string, color: string },
 *   ship: { color: string, hull: string }, weapon: CardIcon | null, pet: CardIcon | null,
 *   cards: CardIcon[], evolutions: CardIcon[], killer: { name: string, line: string } | null, date: string,
 * }} RunSummary
 */

const ORBITRON = "Orbitron, sans-serif";
const PIXEL = '"Press Start 2P", monospace';
const MAX_CARDS = 10;

/** @param {CanvasRenderingContext2D} c */
function icon(c, name, x, y, size, color) {
  const key = ICONS[name] ? name : "unknown";
  const grid = iconGrid(key);
  c.save();
  c.translate(x - size / 2, y - size / 2);
  c.scale(size / grid, size / grid);
  c.fillStyle = color;
  c.shadowBlur = 10;
  c.shadowColor = color;
  c.fill(new Path2D(ICONS[key]), "evenodd");
  c.restore();
}

/** @param {CanvasRenderingContext2D} c */
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/**
 * @param {CanvasRenderingContext2D} c
 * @param {{ font: string, color?: string, align?: CanvasTextAlign, glow?: number, max?: number }} opts
 */
function text(c, str, x, y, opts) {
  const { font, color = "#fff", align = "center", glow = 0, max = undefined } = opts;
  c.save();
  c.font = font;
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = "middle";
  if (glow) {
    c.shadowBlur = glow;
    c.shadowColor = color;
  }
  c.fillText(str, x, y, max);
  c.restore();
}

/** @param {CanvasRenderingContext2D} c */
function background(c, accent) {
  const bg = c.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, "#120626");
  bg.addColorStop(0.55, "#07040f");
  bg.addColorStop(1, "#14031a");
  c.fillStyle = bg;
  c.fillRect(0, 0, CARD_W, CARD_H);

  // Grille néon en perspective légère (comme le sol du jeu)
  c.save();
  c.globalAlpha = 0.13;
  c.strokeStyle = accent;
  c.lineWidth = 2;
  for (let x = 0; x <= CARD_W; x += 60) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, CARD_H);
    c.stroke();
  }
  for (let y = 0; y <= CARD_H; y += 60) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(CARD_W, y);
    c.stroke();
  }
  c.restore();

  const halo = c.createRadialGradient(CARD_W / 2, 470, 40, CARD_W / 2, 470, 620);
  halo.addColorStop(0, "rgba(170, 102, 255, 0.28)");
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");
  c.fillStyle = halo;
  c.fillRect(0, 0, CARD_W, CARD_H);

  // Cadre néon
  c.save();
  c.strokeStyle = accent;
  c.lineWidth = 6;
  c.shadowBlur = 30;
  c.shadowColor = accent;
  roundRect(c, 24, 24, CARD_W - 48, CARD_H - 48, 36);
  c.stroke();
  c.restore();
}

/** @param {CanvasRenderingContext2D} c */
function tile(c, x, y, w, h, value, label, color) {
  c.save();
  c.fillStyle = "rgba(0, 0, 0, 0.45)";
  c.strokeStyle = "rgba(255, 255, 255, 0.14)";
  c.lineWidth = 2;
  roundRect(c, x, y, w, h, 18);
  c.fill();
  c.stroke();
  c.restore();
  text(c, String(value), x + w / 2, y + h * 0.42, {
    font: `900 46px ${ORBITRON}`,
    color,
    glow: 14,
    max: w - 20,
  });
  text(c, label.toUpperCase(), x + w / 2, y + h * 0.78, {
    font: `700 19px ${ORBITRON}`,
    color: "#9a9ab8",
    max: w - 16,
  });
}

/** Petite pastille d'icône (carte d'amélioration, évolution) avec son nombre. */
function badge(c, item, x, y, size) {
  c.save();
  c.fillStyle = "rgba(0, 0, 0, 0.55)";
  c.strokeStyle = item.color;
  c.lineWidth = 3;
  c.shadowBlur = 12;
  c.shadowColor = item.color;
  roundRect(c, x - size / 2, y - size / 2, size, size, 16);
  c.fill();
  c.stroke();
  c.restore();
  icon(c, item.icon, x, y, size * 0.56, item.color);
  if (item.count > 1) {
    text(c, `×${item.count}`, x + size / 2 - 6, y + size / 2 - 12, {
      font: `900 20px ${ORBITRON}`,
      color: "#fff",
      align: "right",
    });
  }
}

/**
 * Dessine la carte complète sur `canvas` (redimensionné en 1080×1350).
 * @param {HTMLCanvasElement} canvas
 * @param {RunSummary} s
 */
export function drawShareCard(canvas, s) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const c = canvas.getContext("2d");
  const accent = s.mode.color;
  background(c, accent);

  // En-tête : logo texte, mode de jeu, pseudo
  text(c, "LAST PULSE", CARD_W / 2, 112, { font: `46px ${PIXEL}`, color: "#00ffff", glow: 24 });
  text(c, s.mode.label, CARD_W / 2, 178, { font: `700 26px ${ORBITRON}`, color: accent, glow: 10 });
  text(c, s.pseudo, CARD_W / 2, 240, { font: `900 50px ${ORBITRON}`, color: "#ffffff", max: CARD_W - 160 });

  // Vaisseau et résultat principal
  const shipX = 300;
  const shipY = 470;
  c.save();
  c.strokeStyle = s.ship.color;
  c.globalAlpha = 0.35;
  c.lineWidth = 3;
  for (const r of [120, 160]) {
    c.beginPath();
    c.arc(shipX, shipY, r, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
  drawShip(shipX, shipY, 78, -Math.PI / 2, s.ship.color, true, 0, s.ship.hull, c);
  text(c, s.hero.name.toUpperCase(), shipX, shipY + 200, {
    font: `700 24px ${ORBITRON}`,
    color: s.hero.color,
    glow: 8,
  });

  const rightX = 720;
  text(c, s.valueLabel.toUpperCase(), rightX, 340, { font: `700 30px ${ORBITRON}`, color: "#c9c9e6" });
  text(c, String(s.value), rightX, 470, { font: `120px ${PIXEL}`, color: "#ffd700", glow: 30, max: 520 });
  text(c, s.biome.name, rightX, 585, { font: `700 26px ${ORBITRON}`, color: s.biome.color, glow: 10 });
  if (s.newRecord) {
    c.save();
    c.fillStyle = "#ff2a6d";
    c.shadowBlur = 24;
    c.shadowColor = "#ff2a6d";
    roundRect(c, rightX - 190, 620, 380, 56, 28);
    c.fill();
    c.restore();
    text(c, "NOUVEAU RECORD !", rightX, 649, { font: `18px ${PIXEL}`, color: "#ffffff" });
  }

  // Statistiques
  const tiles = [
    [s.level, "Niveau", "#00ffff"],
    [s.duration, "Durée", "#ffffff"],
    [s.kills, "Éliminations", "#00ff88"],
    [s.bosses, "Boss vaincus", "#ff2a6d"],
  ];
  const gap = 20;
  const tw = (CARD_W - 120 - gap * 3) / 4;
  tiles.forEach(([v, label, color], i) => tile(c, 60 + i * (tw + gap), 720, tw, 130, v, label, color));

  // Build : arme, familier, puis cartes et évolutions
  text(c, "BUILD", 60, 905, { font: `20px ${PIXEL}`, color: "#aa66ff", align: "left", glow: 10 });
  let x = 60;
  for (const part of [s.weapon, s.pet]) {
    if (!part) continue;
    icon(c, part.icon, x + 22, 960, 44, part.color);
    c.font = `700 28px ${ORBITRON}`;
    const w = Math.min(c.measureText(part.name).width, 360);
    text(c, part.name, x + 58, 960, { font: `700 28px ${ORBITRON}`, color: "#fff", align: "left", max: 360 });
    x += 58 + w + 50;
  }
  const items = [...s.evolutions, ...s.cards].slice(0, MAX_CARDS);
  const size = 82;
  const step = (CARD_W - 120 - size) / Math.max(1, MAX_CARDS - 1);
  items.forEach((item, i) => badge(c, item, 60 + size / 2 + i * step, 1060, size));
  if (!items.length) {
    text(c, "Aucune amélioration", 60, 1060, { font: `700 24px ${ORBITRON}`, color: "#666", align: "left" });
  }

  // Tué par
  if (s.killer) {
    c.save();
    const band = c.createLinearGradient(0, 0, CARD_W, 0);
    band.addColorStop(0, "rgba(255, 42, 109, 0)");
    band.addColorStop(0.5, "rgba(255, 42, 109, 0.28)");
    band.addColorStop(1, "rgba(255, 42, 109, 0)");
    c.fillStyle = band;
    c.fillRect(24, 1130, CARD_W - 48, 120);
    c.restore();
    text(c, "TUÉ PAR", CARD_W / 2, 1152, { font: `16px ${PIXEL}`, color: "#ff8fb0" });
    text(c, s.killer.name.toUpperCase(), CARD_W / 2, 1194, {
      font: `900 40px ${ORBITRON}`,
      color: "#ff2a6d",
      glow: 18,
      max: CARD_W - 120,
    });
    text(c, s.killer.line, CARD_W / 2, 1233, { font: `700 20px ${ORBITRON}`, color: "#d0d0e8" });
  }

  // Pied : adresse du jeu et date
  text(c, "last-pulse.com", 60, 1290, { font: `700 24px ${ORBITRON}`, color: "#00ffff", align: "left" });
  text(c, s.date, CARD_W - 60, 1290, { font: `700 22px ${ORBITRON}`, color: "#8888aa", align: "right" });
}
