// Interface en jeu (panneau de stats, barres d'XP / dash / ultime).

import { WAVE_DURATION } from "../config.js";
import { game, mysteryBox, player, world } from "../core/state.js";
import { ENEMY_NAMES } from "../data/enemies.js";
import { isPlayerNearBox } from "../systems/mysteryBox.js";
import { heroSkill } from "../systems/skills.js";
import { setClass, setText, setVisible, setWidth } from "./dom.js";
import { isTouchDevice, showTouchControls } from "./touchControls.js";

const HUD_ELEMENTS = ["ui", "xpContainer", "levelIndicator"];

export function showHud(visible) {
  for (const id of HUD_ELEMENTS) setVisible(id, visible);
  if (!visible) {
    setVisible("boxIndicator", false);
    setVisible("bossBar", false);
  }
  showTouchControls(visible);
}

export function updateHud() {
  setText("wave", game.wave);
  setText("kills", game.kills);
  setText("healthText", `${Math.round(Math.max(0, player.health))}/${Math.round(player.maxHealth)}`);
  setWidth("playerHealth", player.health / player.maxHealth);
  setWidth("timerBar", game.waveTimer / WAVE_DURATION);
  setWidth("dashBar", 1 - player.dashCooldownTimer / player.dashCooldown);
  setWidth("xpBar", player.xp / player.xpToNextLevel);
  setText("lvlVal", player.level);
  updateCombo();
  updateBossBar();

  setText("statAtk", Math.round(player.attack));
  setText("statDef", Math.round(player.defense));
  setText("statSpd", player.baseSpeed.toFixed(1));
  setText("statMagnet", Math.round(player.magnetRadius));
  setText("statCrit", Math.round(player.critChance * 100) + "%");
  setText("statCdmg", Math.round(player.critMultiplier * 100) + "%");
  setText("uiRunGold", game.runGold);
  setText("autoShootState", player.autoShoot ? "ON" : "OFF");

  setWidth("ultBar", player.ultCharge / player.maxUltCharge);
  setText("ultName", heroSkill().name.toUpperCase());
  setVisible("ultReadyText", player.isUltReady);
  setVisible("boxIndicator", mysteryBox.active && player.worldY > -400);

  if (isTouchDevice) {
    setVisible("btnTouchBox", mysteryBox.state === "IDLE" && isPlayerNearBox());
    setClass("btnTouchUlt", "ready", player.isUltReady);
    setClass("btnTouchDash", "cooldown", player.dashCooldownTimer > 0);
  }
}

let bossWarningTimeout = null;
let biomeTimeout;

/** Bandeau « NOUVEAU BIOME » affiché quelques secondes, dans la couleur du biome. */
export function showBiomeBanner(biome) {
  const banner = document.getElementById("biomeBanner");
  banner.textContent = biome.name;
  banner.style.color = biome.color;
  banner.classList.remove("show");
  void banner.offsetWidth; // relance l'animation
  banner.classList.add("show");
  clearTimeout(biomeTimeout);
  biomeTimeout = setTimeout(() => banner.classList.remove("show"), 3500);
}

const COMBO_SHOWN_FROM = 5;

/** Compteur de combo : grossit à chaque élimination, s'efface quand le combo retombe. */
function updateCombo() {
  const shown = game.combo >= COMBO_SHOWN_FROM ? game.combo : 0;
  setText("comboDisplay", shown ? `×${shown} COMBO` : "");
  setClass("comboDisplay", "hot", shown >= 25);
}

/** Barre de vie du boss le plus imposant encore en vie, en haut de l'écran. */
function updateBossBar() {
  let boss = null;
  for (const e of world.enemies) {
    if (!e.dead && e.template.isBoss && (!boss || e.maxHealth > boss.maxHealth)) boss = e;
  }
  setVisible("bossBar", !!boss);
  if (!boss) return;
  setText("bossBarName", (ENEMY_NAMES[boss.type] || "Boss") + (boss.enraged ? " · FURIE" : ""));
  setWidth("bossBarFill", boss.health / boss.maxHealth);
  setClass("bossBar", "enraged", !!boss.enraged);
}

/** Annonce du Voleur doré (même bandeau que les boss, en or). */
export function showGoblinWarning() {
  showBossWarning("VOLEUR DORÉ !", true);
}

export function showBossWarning(text, gold = false) {
  setClass("bossWarning", "gold", gold);
  setText("bossWarning", text);
  setVisible("bossWarning", true);
  clearTimeout(bossWarningTimeout);
  bossWarningTimeout = setTimeout(() => setVisible("bossWarning", false), 3000);
}
