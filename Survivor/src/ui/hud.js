// Interface en jeu (panneau de stats, barres d'XP / dash / ultime).

import { WAVE_DURATION } from "../config.js";
import { game, mysteryBox, player } from "../core/state.js";
import { isPlayerNearBox } from "../systems/mysteryBox.js";
import { setClass, setText, setVisible, setWidth } from "./dom.js";
import { isTouchDevice, showTouchControls } from "./touchControls.js";

const HUD_ELEMENTS = ["ui", "xpContainer", "levelIndicator"];

export function showHud(visible) {
  for (const id of HUD_ELEMENTS) setVisible(id, visible);
  if (!visible) setVisible("boxIndicator", false);
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

  setText("statAtk", Math.round(player.attack));
  setText("statDef", player.defense);
  setText("statSpd", player.baseSpeed.toFixed(1));
  setText("statMagnet", Math.round(player.magnetRadius));
  setText("statCrit", Math.round(player.critChance * 100) + "%");
  setText("statCdmg", Math.round(player.critMultiplier * 100) + "%");
  setText("uiRunGold", game.runGold);
  setText("autoShootState", player.autoShoot ? "ON" : "OFF");

  setWidth("ultBar", player.ultCharge / player.maxUltCharge);
  setVisible("ultReadyText", player.isUltReady);
  setVisible("boxIndicator", mysteryBox.active && player.worldY > -400);

  if (isTouchDevice) {
    setVisible("btnTouchBox", mysteryBox.state === "IDLE" && isPlayerNearBox());
    setClass("btnTouchUlt", "ready", player.isUltReady);
    setClass("btnTouchDash", "cooldown", player.dashCooldownTimer > 0);
  }
}

let bossWarningTimeout = null;
export function showBossWarning(text) {
  setText("bossWarning", text);
  setVisible("bossWarning", true);
  clearTimeout(bossWarningTimeout);
  bossWarningTimeout = setTimeout(() => setVisible("bossWarning", false), 3000);
}
