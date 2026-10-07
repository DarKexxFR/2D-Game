// Point d'entrée du rendu : enchaîne les couches dans le bon ordre.

import { WAVE_DURATION } from "../config.js";
import { ctx, resetTransform, view } from "../core/canvas.js";
import { camera, game } from "../core/state.js";
import { drawEnemies, drawPlayer, drawProjectiles, drawSkillEffects } from "./entities.js";
import { drawFloatingTexts, drawParticles, drawVisualEffects } from "./effects.js";
import { drawGrid, drawMapBorder, drawMysteryBox, drawPickups, drawShrines } from "./world.js";

export function render() {
  const now = performance.now();
  resetTransform();
  ctx.clearRect(0, 0, view.width, view.height);

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
  drawSkillEffects();
  drawParticles();
  drawVisualEffects();
  drawFloatingTexts();
  ctx.restore();

  // Sur petit écran, le minuteur du HUD suffit (évite le chevauchement).
  if (view.scale === 1) drawWaveTimer();
  ctx.restore();
}

function drawWaveTimer() {
  const pct = Math.min(1, game.waveTimer / WAVE_DURATION);
  const x = view.width / 2 - 150;
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
  resetTransform();
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 100; i++) {
    ctx.fillRect(Math.random() * view.width, Math.random() * view.height, 2, 2);
  }
}
