// Point d'entrée du rendu : enchaîne les couches dans le bon ordre.

import { WAVE_DURATION } from "../config.js";
import { canvas, ctx } from "../core/canvas.js";
import { camera, game } from "../core/state.js";
import { drawEnemies, drawPlayer, drawProjectiles } from "./entities.js";
import { drawFloatingTexts, drawParticles, drawVisualEffects } from "./effects.js";
import { drawGrid, drawMapBorder, drawMysteryBox, drawPickups, drawShrines } from "./world.js";

export function render() {
  const now = performance.now();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate((Math.random() - 0.5) * game.screenShake, (Math.random() - 0.5) * game.screenShake);
  drawGrid();

  // Tout ce qui suit est dessiné directement en coordonnées monde.
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawMapBorder();
  drawMysteryBox();
  drawShrines(now);
  drawPickups();
  drawPlayer(now);
  drawEnemies();
  drawProjectiles();
  drawParticles();
  drawVisualEffects();
  drawFloatingTexts();
  ctx.restore();

  drawWaveTimer();
  ctx.restore();
}

function drawWaveTimer() {
  const pct = Math.min(1, game.waveTimer / WAVE_DURATION);
  const x = canvas.width / 2 - 150;
  ctx.fillStyle = "#003344";
  ctx.fillRect(x, 55, 300, 6);
  ctx.fillStyle = "#00ffff";
  ctx.shadowBlur = 10;
  ctx.shadowColor = "#00ffff";
  ctx.fillRect(x, 55, 300 * pct, 6);
  ctx.shadowBlur = 0;
}

/** Fond étoilé scintillant affiché derrière les menus. */
export function renderMenuBackground() {
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 100; i++) {
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
  }
}
