// Écran de fin de partie.

import { setText, setVisible } from "./dom.js";
import { renderRunStats } from "./runStats.js";
import { showScreen } from "./screens.js";

export function showGameOver({ pseudo, level, wave, waveLabel = "Vague", xp, gold, isNewRecord }) {
  setText("finalPseudo", pseudo);
  setText("finalWaveLabel", waveLabel);
  setText("finalLvl", level);
  setText("finalWave", wave);
  setText("runXpGain", Math.floor(xp));
  setText("runGoldGain", gold);
  setVisible("newRecordMsg", isNewRecord);
  renderRunStats();
  showScreen("gameOver");
}

export function setOnlineStatus(text) {
  setText("onlineStatus", text);
}
