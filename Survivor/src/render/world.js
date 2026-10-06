// Décor et objets posés au sol : grille, bordure, boîte mystère, sanctuaires, butin.

import { MAP_BOUNDS, MAP_SIZE, MYSTERY_BOX } from "../config.js";
import { canvas, ctx } from "../core/canvas.js";
import { camera, mysteryBox as box, world } from "../core/state.js";
import { isOnScreen } from "../systems/combat.js";
import { isPlayerNearBox } from "../systems/mysteryBox.js";
import { drawText, fillCircle, strokeCircle } from "./draw.js";

const GRID_SIZE = 60;

/** Grille de fond, dessinée en coordonnées écran en un seul tracé. */
export function drawGrid() {
  ctx.strokeStyle = "rgba(157, 0, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -camera.x % GRID_SIZE; x < canvas.width; x += GRID_SIZE) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }
  for (let y = -camera.y % GRID_SIZE; y < canvas.height; y += GRID_SIZE) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();
}

export function drawMapBorder() {
  ctx.strokeStyle = "#ff0055";
  ctx.lineWidth = 5;
  ctx.shadowBlur = 20;
  ctx.shadowColor = "#ff0055";
  ctx.strokeRect(MAP_BOUNDS.minX, MAP_BOUNDS.minY, MAP_SIZE, MAP_SIZE);
  ctx.shadowBlur = 0;
}

export function drawMysteryBox() {
  if (!box.active) return;
  const left = box.x - box.w / 2;
  const top = box.y - box.h / 2;

  ctx.shadowBlur = 30;
  ctx.shadowColor = box.state === "OPENING" ? MYSTERY_BOX.colors[box.colorIdx] : "#00ffff";
  ctx.fillStyle = box.state === "BROKEN" ? "#333" : "#0055aa";
  ctx.fillRect(left, top, box.w, box.h);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(left, top, box.w, box.h / 2);
  ctx.shadowBlur = 0;

  if (box.state === "BROKEN") drawText("🧸", box.x, box.y + 5, "24px Arial", "#000");
  else drawText("?", box.x, box.y + 10, "900 30px Orbitron", "#fff");

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
    fillCircle(s.x, s.y, s.size, s.color, 20);
    drawText(s.label, s.x, s.y + 7, "20px Arial", "#fff");
    strokeCircle(s.x, s.y, s.size + Math.sin(now / 200) * 5, s.color);
  }
}

export function drawPickups() {
  for (const g of world.gems) {
    if (!isOnScreen(g.x, g.y, 10)) continue;
    ctx.fillStyle = g.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = g.color;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y - 6);
    ctx.lineTo(g.x + 6, g.y);
    ctx.lineTo(g.x, g.y + 6);
    ctx.lineTo(g.x - 6, g.y);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  for (const b of world.lootBoxes) {
    ctx.fillStyle = "#00ff00";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#00ff00";
    ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
  }
  ctx.shadowBlur = 0;
}
