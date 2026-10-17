// Écran de victoire (boss final vaincu, voir systems/endless.js) : terminer la partie sur une victoire
// ou continuer en Endless Pulse.

import { ENDLESS } from "../config.js";
import { getStat } from "../services/achievements.js";
import { $, setText } from "./dom.js";
import { showScreen } from "./screens.js";
import { showTouchControls } from "./touchControls.js";

export function initVictoryMenu({ onContinue, onFinish }) {
  $("btnEndless").addEventListener("click", onContinue);
  $("btnVictoryEnd").addEventListener("click", onFinish);
}

export function showVictory() {
  showTouchControls(false);
  setText("victoryGold", `+${ENDLESS.victoryGold}`);
  const best = getStat("bestPulse");
  setText("endlessBest", best > 0 ? `Ton record : pulsation ${best}` : "");
  /** @type {HTMLElement} */ (document.activeElement)?.blur?.(); // un dash en cours ne doit pas valider un bouton
  showScreen("victoryMenu");
}
