import { MAP_BOUNDS, MAP_SIZE } from "../config.js";
import { view } from "../core/canvas.js";
import { camera, game, mysteryBox, player, world } from "../core/state.js";

const canvas = document.getElementById("miniMap");
const ctx = canvas.getContext("2d");
const DISPLAY_SIZE = 132;
const SCALE = canvas.width / DISPLAY_SIZE;
const PADDING = 9;
const AREA_SIZE = DISPLAY_SIZE - PADDING * 2;

function mapX(x) {
  return PADDING + ((x - MAP_BOUNDS.minX) / MAP_SIZE) * AREA_SIZE;
}

function mapY(y) {
  return PADDING + ((y - MAP_BOUNDS.minY) / MAP_SIZE) * AREA_SIZE;
}

export function drawMiniMap() {
  if (!game.started) return;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
  ctx.fillStyle = "rgba(4, 12, 22, 0.94)";
  ctx.fillRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);

  ctx.strokeStyle = "rgba(0, 255, 255, 0.42)";
  ctx.lineWidth = 1;
  ctx.strokeRect(PADDING, PADDING, AREA_SIZE, AREA_SIZE);

  ctx.save();
  ctx.beginPath();
  ctx.rect(PADDING, PADDING, AREA_SIZE, AREA_SIZE);
  ctx.clip();

  ctx.strokeStyle = "rgba(0, 255, 255, 0.32)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    mapX(camera.x),
    mapY(camera.y),
    (view.width / MAP_SIZE) * AREA_SIZE,
    (view.height / MAP_SIZE) * AREA_SIZE,
  );

  if (mysteryBox.active) {
    ctx.fillStyle = "#ffd700";
    ctx.fillRect(mapX(mysteryBox.x), mapY(mysteryBox.y), 3, 3);
  }

  for (const enemy of world.enemies) {
    if (enemy.dead) continue;
    ctx.fillStyle = enemy.template?.isBoss ? "#ff9b45" : "#ff2a6d";
    ctx.beginPath();
    ctx.arc(mapX(enemy.x), mapY(enemy.y), enemy.template?.isBoss ? 3 : 1.7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#00ffff";
  ctx.shadowColor = "#00ffff";
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(mapX(player.worldX), mapY(player.worldY), 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.fillText(`V${game.wave}`, PADDING, DISPLAY_SIZE - 3);
}