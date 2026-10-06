// Écran de fin de partie.

import { setText, setVisible } from "./dom.js";
import { showScreen } from "./screens.js";

export function showGameOver({ pseudo, level, wave, xp, gold, isNewRecord }) {
  setText("finalPseudo", pseudo);
  setText("finalLvl", level);
  setText("finalWave", wave);
  setText("runXpGain", Math.floor(xp));
  setText("runGoldGain", gold);
  setVisible("newRecordMsg", isNewRecord);
  showScreen("gameOver");
}
