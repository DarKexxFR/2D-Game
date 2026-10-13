// Point d'entrée du rendu : enchaîne les couches dans le bon ordre.

import { WAVE_DURATION } from "../config.js";
import { ctx, resetTransform, view } from "../core/canvas.js";
import { camera, game, world } from "../core/state.js";
import { drawEnemies, drawPlayer, drawProjectiles, drawSkillEffects } from "./entities.js";
import { drawFloatingTexts, drawParticles, drawVisualEffects } from "./effects.js";
import { drawBolts, drawBossChests, drawHazards, drawTurrets } from "./hazards.js";
import { drawGrid, drawMapBorder, drawMysteryBox, drawPickups, drawShrines } from "./world.js";
import { drawVersus } from "./versus.js";
import { versus } from "../systems/versus.js";

export { renderMenuBackground } from "./menuScene.js";

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
  drawHazards(now); // au sol, sous les entités
  drawBossChests(now);
  drawTurrets(now);
  if (versus.active) drawVersus(now);
  else drawPlayer(now);
  drawEnemies();
  drawProjectiles();
  drawBolts();
  drawSkillEffects();
  drawParticles();
  drawVisualEffects();
  drawFloatingTexts();
  ctx.restore();

  if (game.flash) {
    ctx.globalAlpha = game.flash.alpha;
    ctx.fillStyle = game.flash.color;
    ctx.fillRect(0, 0, view.width, view.height);
    ctx.globalAlpha = 1;
  }

  drawGoblinPointer(now);
  // Sur petit écran, le minuteur du HUD suffit (évite le chevauchement).
  if (view.scale === 1 && !versus.active) drawWaveTimer();
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

/** Flèche dorée au bord de l'écran qui pointe vers le Voleur doré quand il est hors champ. */
function drawGoblinPointer(now) {
  const g = world.enemies.find((e) => e.type === "goblin" && !e.dead);
  if (!g) return;
  const sx = g.x - camera.x;
  const sy = g.y - camera.y;
  const margin = 40;
  if (sx > 0 && sx < view.width && sy > 0 && sy < view.height) return;
  const cx = view.width / 2;
  const cy = view.height / 2;
  const a = Math.atan2(sy - cy, sx - cx);
  // Point sur le bord de l'écran dans la direction du voleur
  const k = Math.min(
    (cx - margin) / Math.abs(Math.cos(a) || 1e-6),
    (cy - margin) / Math.abs(Math.sin(a) || 1e-6),
  );
  ctx.save();
  ctx.translate(cx + Math.cos(a) * k, cy + Math.sin(a) * k);
  ctx.rotate(a);
  ctx.globalAlpha = 0.7 + Math.sin(now / 120) * 0.3;
  ctx.fillStyle = "#ffd700";
  ctx.shadowBlur = 14;
  ctx.shadowColor = "#ffd700";
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-8, -11);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-8, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
