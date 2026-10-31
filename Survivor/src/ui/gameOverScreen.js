// Écran de fin de partie.

import { startKillCam, stopKillCam } from "../render/killCam.js";
import { hasKillCam } from "../systems/killCam.js";
import { player } from "../core/state.js";
import { buildView } from "./buildView.js";
import { $, setText, setVisible } from "./dom.js";
import { renderRunStats } from "./runStats.js";
import { showScreen } from "./screens.js";
import { runSummary, setShareSummary } from "./shareMenu.js";

const SKIP_AFTER_MS = 400; // le clic qui lance le ralenti ne doit pas l'arrêter aussitôt

export function showGameOver({ pseudo, level, wave, waveLabel = "Vague", xp, gold, isNewRecord }) {
  setText("finalPseudo", pseudo);
  setText("finalWaveLabel", waveLabel);
  setText("finalLvl", level);
  setText("finalWave", wave);
  setText("runXpGain", Math.floor(xp));
  setText("runGoldGain", gold);
  setVisible("newRecordMsg", isNewRecord);
  setVisible("btnKillCam", hasKillCam());
  renderRunStats();
  $("runBuild").replaceChildren(buildView(player, { compact: true }));
  setShareSummary(runSummary({ pseudo, wave, valueLabel: waveLabel.split(" · ")[0], isNewRecord }));
  showScreen("gameOver");
}

export function setOnlineStatus(text) {
  setText("onlineStatus", text);
}

/**
 * « REVOIR MA MORT » : l'écran de fin s'efface le temps du ralenti (render/killCam.js). Le bouton
 * REJOUER (`#btnKillCamReplay`, visible pendant le ralenti) relance une partie sans revenir à l'écran de fin.
 * @param {() => void} onReplay relance une partie du même mode
 */
export function initKillCamButton(onReplay) {
  let startedAt = 0;
  const replayBtn = $("btnKillCamReplay");
  const skip = (e) => {
    if (e.target instanceof Node && replayBtn.contains(e.target)) return; // le clic sur REJOUER s'en charge
    if (performance.now() - startedAt < SKIP_AFTER_MS) return;
    if (e.type === "keydown" && e.repeat) return;
    stopKillCam();
  };
  $("btnKillCam").addEventListener("click", () => {
    startedAt = performance.now();
    document.body.classList.add("kill-cam");
    document.addEventListener("pointerdown", skip);
    document.addEventListener("keydown", skip);
    startKillCam(() => {
      document.body.classList.remove("kill-cam");
      document.removeEventListener("pointerdown", skip);
      document.removeEventListener("keydown", skip);
    });
  });
  replayBtn.addEventListener("click", () => {
    stopKillCam();
    onReplay();
  });
}
