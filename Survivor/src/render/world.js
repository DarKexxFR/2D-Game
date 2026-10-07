// Décor et objets posés au sol : grille, bordure, boîte mystère, sanctuaires, butin.

import { MAP_BOUNDS, MAP_SIZE, MYSTERY_BOX } from "../config.js";
import { ctx, view } from "../core/canvas.js";
import { camera, mysteryBox as box, world } from "../core/state.js";
import { isOnScreen } from "../systems/combat.js";
import { isPlayerNearBox } from "../systems/mysteryBox.js";
import { ICONS } from "../data/icons.js";
import { drawText, fillCircle, strokeCircle } from "./draw.js";
import { drawSprite, getSprite } from "./sprites.js";

const GRID_SIZE = 60;
const MAJOR_EVERY = 4; // une ligne plus lumineuse toutes les 4 cases
const iconPaths = new Map();

/** Icône (data/icons.js) convertie une fois en Path2D pour le canvas. */
function iconPath(name) {
  let p = iconPaths.get(name);
  if (!p) iconPaths.set(name, (p = new Path2D(ICONS[name])));
  return p;
}

/** Dessine une icône de 24×24 centrée en (x, y) à la taille voulue. */
function drawIcon(name, x, y, size, color) {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowBlur = 8;
  ctx.shadowColor = color;
  ctx.stroke(iconPath(name));
  ctx.restore();
}

/** Sol : grille néon (lignes fines + lignes principales) en coordonnées écran. */
export function drawGrid() {
  const ox = -camera.x % GRID_SIZE;
  const oy = -camera.y % GRID_SIZE;
  const major = GRID_SIZE * MAJOR_EVERY;
  ctx.lineWidth = 1;
  for (const pass of ["minor", "major"]) {
    ctx.strokeStyle = pass === "minor" ? "rgba(157, 0, 255, 0.12)" : "rgba(0, 220, 255, 0.16)";
    ctx.beginPath();
    for (let x = ox; x < view.width; x += GRID_SIZE) {
      const isMajor = Math.round(x + camera.x) % major === 0;
      if (isMajor !== (pass === "major")) continue;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, view.height);
    }
    for (let y = oy; y < view.height; y += GRID_SIZE) {
      const isMajor = Math.round(y + camera.y) % major === 0;
      if (isMajor !== (pass === "major")) continue;
      ctx.moveTo(0, y);
      ctx.lineTo(view.width, y);
    }
    ctx.stroke();
  }
}

export function drawMapBorder() {
  ctx.strokeStyle = "#ff0055";
  ctx.lineWidth = 5;
  ctx.shadowBlur = 20;
  ctx.shadowColor = "#ff0055";
  ctx.strokeRect(MAP_BOUNDS.minX, MAP_BOUNDS.minY, MAP_SIZE, MAP_SIZE);
  ctx.shadowBlur = 0;
  // Bande de danger hachurée à l'intérieur de la bordure
  ctx.strokeStyle = "rgba(255, 0, 85, 0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(MAP_BOUNDS.minX + 12, MAP_BOUNDS.minY + 12, MAP_SIZE - 24, MAP_SIZE - 24);
}

export function drawMysteryBox() {
  if (!box.active) return;
  const now = performance.now();
  const broken = box.state === "BROKEN";
  const color = broken ? "#555555" : box.state === "OPENING" ? MYSTERY_BOX.colors[box.colorIdx] : "#00ffff";
  const bob = broken ? 0 : Math.sin(now / 300) * 3;
  const left = box.x - box.w / 2;
  const top = box.y - box.h / 2 + bob;

  // Socle lumineux au sol
  ctx.globalAlpha = broken ? 0.2 : 0.35 + Math.sin(now / 300) * 0.1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(box.x, box.y + box.h / 2 + 8, box.w * 0.7, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = broken ? "#1a1a1a" : "#04203a";
  ctx.fillRect(left, top, box.w, box.h);
  ctx.shadowBlur = 25;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(left, top, box.w, box.h);
  ctx.shadowBlur = 0;
  // Couvercle et sangles
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(left, top + box.h * 0.3);
  ctx.lineTo(left + box.w, top + box.h * 0.3);
  ctx.moveTo(box.x, top);
  ctx.lineTo(box.x, top + box.h);
  ctx.stroke();

  if (broken) drawText("×", box.x, box.y + bob + 10, "900 30px Orbitron", "#777");
  else drawText("?", box.x, box.y + bob + 14, "900 30px Orbitron", "#fff");

  if (box.state === "OPENING") {
    const pct = 1 - box.timer / MYSTERY_BOX.openDuration;
    ctx.fillStyle = "#111";
    ctx.fillRect(box.x - 40, box.y - 50, 80, 6);
    ctx.fillStyle = "#ffff00";
    ctx.fillRect(box.x - 40, box.y - 50, 80 * pct, 6);
  }
  if (box.state === "IDLE" && isPlayerNearBox()) {
    drawText(`[E] ${box.cost} OR`, box.x, box.y - 40, "bold 12px Orbitron", "#fff");
  }
}

export function drawShrines(now) {
  for (const s of world.shrines) {
    const pulse = Math.sin(now / 200);
    ctx.globalAlpha = 0.18;
    fillCircle(s.x, s.y, s.size, s.color);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 15;
    ctx.shadowColor = s.color;
    strokeCircle(s.x, s.y, s.size, s.color, 2.5);
    ctx.shadowBlur = 0;
    strokeCircle(s.x, s.y, s.size + 6 + pulse * 4, s.color, 1);
    drawIcon(s.icon, s.x, s.y, s.size * 1.1, s.color);
  }
}

export function drawPickups() {
  const now = performance.now();
  for (const g of world.gems) {
    if (!isOnScreen(g.x, g.y, 10)) continue;
    drawSprite(ctx, getSprite("gem", 5, g.color), g.x, g.y + Math.sin(now / 250 + g.x) * 2);
  }
  for (const b of world.lootBoxes) {
    const r = b.size / 2;
    drawSprite(ctx, getSprite("crate", r, "#00ff88"), b.x, b.y + Math.sin(now / 300 + b.y) * 2);
  }
}
