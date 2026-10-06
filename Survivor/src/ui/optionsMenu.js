// Menu Options : volumes, vibrations et qualité graphique.
// Accessible depuis le menu principal et depuis la pause (retour au bon écran).

import { settings, updateSettings } from "../services/settings.js";
import { canVibrate, playSfx, vibrate } from "../services/sfx.js";
import { $, setText } from "./dom.js";
import { showScreen } from "./screens.js";
import { isTouchDevice } from "./touchControls.js";

let returnTo = "mainMenu";

export function initOptionsMenu() {
  bindVolume("optMusic", "musicVolume");
  bindVolume("optSfx", "sfxVolume", () => playSfx("pickup"));

  $("optVibrationRow").style.display = canVibrate && isTouchDevice ? "" : "none";
  $("optVibration").addEventListener("click", () => {
    updateSettings({ vibration: !settings.vibration });
    vibrate(60);
    render();
  });

  for (const btn of document.querySelectorAll("#optionsMenu [data-quality]")) {
    btn.addEventListener("click", () => {
      updateSettings({ quality: btn.dataset.quality });
      render();
    });
  }

  $("btnOptionsBack").addEventListener("click", () => showScreen(returnTo));
}

/** Ouvre les options ; `from` est l'écran auquel revenir. */
export function openOptions(from) {
  returnTo = from;
  render();
  showScreen("optionsMenu");
}

function bindVolume(id, key, preview) {
  const input = $(id);
  input.addEventListener("input", () => {
    updateSettings({ [key]: Number(input.value) / 100 });
    render();
  });
  if (preview) input.addEventListener("change", preview);
}

function render() {
  $("optMusic").value = Math.round(settings.musicVolume * 100);
  $("optSfx").value = Math.round(settings.sfxVolume * 100);
  setText("optMusicValue", `${Math.round(settings.musicVolume * 100)}%`);
  setText("optSfxValue", `${Math.round(settings.sfxVolume * 100)}%`);
  const vib = $("optVibration");
  vib.textContent = settings.vibration ? "ACTIVÉES" : "DÉSACTIVÉES";
  vib.classList.toggle("on", settings.vibration);
  for (const btn of document.querySelectorAll("#optionsMenu [data-quality]")) {
    btn.classList.toggle("active", btn.dataset.quality === settings.quality);
  }
}
