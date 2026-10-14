// Duel sur un écran : chaque partie est dessinée dans sa moitié d'écran, avec un petit bandeau
// (le HUD habituel ne suit qu'une partie).

import { VERSUS, WAVE_DURATION } from "../config.js";
import { ctx, view } from "../core/canvas.js";
import { game, player, world } from "../core/state.js";
import { ENEMY_NAMES } from "../data/enemies.js";
import { SPELLS, attackProgress, spellProgress } from "../systems/duelAttacks.js";
import { fighterName, versus, withRun } from "../systems/versus.js";
import { isTouchDevice } from "../ui/touchControls.js";

const SKILL_KEYS = ["E", "MAJ"];
const SPELL_KEYS = ["F", "CTRL"];
const FONT = "Orbitron, sans-serif";

/** Dessine les deux parties ; `drawScene(now)` dessine celle qui est chargée, dans la vue courante. */
export function renderSplit(now, drawScene) {
  for (const i of [0, 1]) {
    withRun(i, (r) => {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.beginPath();
      ctx.rect(0, 0, r.w, r.h);
      ctx.clip();
      drawScene(now);
      drawRunHud(i, now);
      ctx.restore();
    });
  }
  // Séparation entre les deux moitiés
  const landscape = view.width >= view.height;
  ctx.fillStyle = "#aa66ff";
  ctx.shadowBlur = 12;
  ctx.shadowColor = "#aa66ff";
  if (landscape) ctx.fillRect(view.width / 2 - 1.5, 0, 3, view.height);
  else ctx.fillRect(0, view.height / 2 - 1.5, view.width, 3);
  ctx.shadowBlur = 0;
}

function bar(x, y, w, h, pct, color) {
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, pct)), h);
}

function text(str, x, y, size, color, align = "left") {
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

/** Bandeau d'une moitié d'écran : nom, vague, PV, XP, compétence, or, boss, annonces. */
function drawRunHud(i, now) {
  const color = VERSUS.colors[i];
  const w = view.width;
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(10, 5, 20, 0.75)";
  ctx.fillRect(10, 10, 196, 120);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(10.5, 10.5, 195, 119);

  text(fighterName(i), 18, 16, 13, color);
  text(`VAGUE ${game.wave} · NIV. ${player.level} · ${game.kills} ÉLIM.`, 18, 34, 10, "#ddd");
  bar(18, 50, 180, 9, player.health / player.maxHealth, "#ff2a6d");
  text(
    `${Math.round(Math.max(0, player.health))}/${Math.round(player.maxHealth)}`,
    196,
    50,
    8,
    "#fff",
    "right",
  );
  bar(18, 63, 180, 4, player.xp / player.xpToNextLevel, "#ffd700");
  bar(18, 70, 180, 3, game.waveTimer / WAVE_DURATION, "#00ffff");
  if (player.isUltReady) {
    const blink = 0.6 + Math.sin(now / 150) * 0.4;
    ctx.globalAlpha = blink;
    text(`COMPÉTENCE PRÊTE (${SKILL_KEYS[i]})`, 18, 80, 9, "#ffaa00");
    ctx.globalAlpha = 1;
  } else {
    bar(18, 83, 180, 4, player.ultCharge / player.maxUltCharge, "#ffaa00");
  }
  // Jauge d'attaque : pleine, elle envoie des ennemis chez l'adversaire
  text("ATTAQUE", 18, 94, 8, "#aa66ff");
  bar(70, 96, 128, 4, attackProgress(), "#aa66ff");
  if (game.spellReady) {
    ctx.globalAlpha = 0.6 + Math.sin(now / 150) * 0.4;
    const key = isTouchDevice ? "" : ` (${SPELL_KEYS[i]})`;
    text(`SORT : ${SPELLS[game.spellReady]}${key}`, 18, 106, 9, "#00ff88");
    ctx.globalAlpha = 1;
  } else {
    text("SORT", 18, 108, 8, "#00ff88");
    bar(70, 110, 128, 4, spellProgress(), "#00ff88");
  }
  if (game.hex) text(`${SPELLS[game.hex.type]} SUBI !`, 18, 138, 11, "#00ff88");

  text(`${game.runGold} OR`, w - 14, 16, 12, "#ffd700", "right");
  if (game.combo >= 5) text(`×${game.combo} COMBO`, w - 14, 34, 11, "#ff2a6d", "right");

  drawBossBar();
  drawBanner(now);
  if (versus.winner !== null) {
    const won = versus.winner === i;
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 20;
    ctx.shadowColor = won ? "#ffd700" : "#ff2a6d";
    text(won ? "GAGNÉ !" : "ÉLIMINÉ", w / 2, view.height / 2, 34, won ? "#ffd700" : "#ff2a6d", "center");
    ctx.shadowBlur = 0;
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawBossBar() {
  let boss = null;
  for (const e of world.enemies) {
    if (!e.dead && e.template.isBoss && (!boss || e.maxHealth > boss.maxHealth)) boss = e;
  }
  if (!boss) return;
  const bw = Math.min(320, view.width - 40);
  const x = (view.width - bw) / 2;
  const y = view.height - 34;
  text(
    (ENEMY_NAMES[boss.type] || "Boss") + (boss.submerged ? " · SOUS L'EAU" : boss.enraged ? " · FURIE" : ""),
    view.width / 2,
    y - 14,
    10,
    "#ff4444",
    "center",
  );
  bar(x, y, bw, 8, boss.health / boss.maxHealth, boss.enraged ? "#ff2a00" : "#ff4444");
}

/** Annonce (boss, biome, Voleur doré) au milieu de la moitié d'écran, quelques secondes. */
function drawBanner(now) {
  const b = game.banner;
  if (!b || game.time > b.until) return;
  ctx.globalAlpha = Math.min(1, (b.until - game.time) / 500);
  ctx.shadowBlur = 16;
  ctx.shadowColor = b.color;
  text(b.text, view.width / 2, view.height * 0.28, Math.min(22, view.width / 22), b.color, "center");
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}
