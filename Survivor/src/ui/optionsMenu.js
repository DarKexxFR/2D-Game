// Menu Options : volumes, vibrations, qualité graphique et sauvegarde en ligne.
// Accessible depuis le menu principal et depuis la pause (retour au bon écran).

import {
  cloud,
  enableCloudSave,
  getCloudCode,
  onCloudChange,
  restoreFromCode,
} from "../services/cloudSave.js";
import { analyticsEnabled, setAnalyticsEnabled } from "../services/analytics.js";
import { journalText } from "../services/diagnostics.js";
import { settings, updateSettings } from "../services/settings.js";
import { allyAlpha } from "../render/allyAlpha.js";
import { isOnlineEnabled } from "../services/supabase.js";
import { canVibrate, playSfx, vibrate } from "../services/sfx.js";
import { $, setText, setVisible } from "./dom.js";
import { showScreen } from "./screens.js";
import { isTouchDevice } from "./touchControls.js";
import { replayTutorial } from "./tutorial.js";
import { openNews } from "./newsMenu.js";

let returnTo = "mainMenu";

export function initOptionsMenu() {
  bindVolume("optMusic", "musicVolume");
  bindVolume("optSfx", "sfxVolume", () => playSfx("pickup"));
  bindVolume("optShotOpacity", "shotOpacity");

  $("optVibrationRow").style.display = canVibrate && isTouchDevice ? "" : "none";
  $("optVibration").addEventListener("click", () => {
    updateSettings({ vibration: !settings.vibration });
    vibrate(60);
    render();
  });

  for (const btn of document.querySelectorAll(/** @type {"button"} */ ("#optionsMenu [data-quality]"))) {
    btn.addEventListener("click", () => {
      updateSettings({ quality: btn.dataset.quality });
      render();
    });
  }

  $("btnNewsReplay").addEventListener("click", () => openNews(() => showScreen("optionsMenu")));
  $("btnTutorialReplay").addEventListener("click", () => {
    replayTutorial();
    setText("tutorialReplayHint", "Le tutoriel s'affichera à ta prochaine partie.");
  });

  $("optAnalytics").addEventListener("click", () => {
    setAnalyticsEnabled(!analyticsEnabled());
    render();
  });

  $("btnCopyJournal").addEventListener("click", copyJournal);

  $("btnOptionsBack").addEventListener("click", closeOptions);
  initCloudSection();
}

const JOURNAL_HINT = "Un bug ? Copie le journal et envoie-le au développeur : il montre ce qui s'est passé.";

/** Journal de diagnostic dans le presse-papiers ; sinon téléchargé en fichier texte. */
async function copyJournal() {
  const text = journalText();
  try {
    await navigator.clipboard.writeText(text);
    setText("journalHint", "Journal copié : colle-le dans ton message (Discord, e-mail...).");
  } catch {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    link.download = `last-pulse-journal-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setText("journalHint", "Copie impossible : journal téléchargé en fichier texte.");
  }
}

// --- SAUVEGARDE EN LIGNE ---

const CLOUD_STATUS = {
  syncing: "Synchronisation...",
  synced: "Progression sauvegardée en ligne",
  error: "Hors ligne : nouvel essai à la prochaine sauvegarde",
};

const RESTORE_MESSAGES = {
  invalid: "Code invalide (format XXXX-XXXX-XXXX).",
  notFound: "Aucune sauvegarde pour ce code.",
  error: "Serveur indisponible, réessaie plus tard.",
};

function initCloudSection() {
  onCloudChange(renderCloud);
  $("btnCloudEnable").addEventListener("click", async () => {
    $("btnCloudEnable").disabled = true;
    await enableCloudSave();
    $("btnCloudEnable").disabled = false;
    renderCloud();
  });
  $("btnCloudCopy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(getCloudCode());
      setText("cloudMessage", "Code copié !");
    } catch {
      setText("cloudMessage", "Copie impossible : recopie le code à la main.");
    }
  });
  $("btnCloudRestore").addEventListener("click", restore);
}

async function restore() {
  const input = $("cloudRestoreInput").value;
  if (!confirm("Remplacer la progression de cet appareil par celle de ce code ?")) return;
  setText("cloudMessage", "Récupération...");
  const result = await restoreFromCode(input);
  if (result === "ok") {
    setText("cloudMessage", "Progression récupérée ! Rechargement...");
    location.reload();
    return;
  }
  setText("cloudMessage", RESTORE_MESSAGES[result]);
}

function renderCloud() {
  const online = isOnlineEnabled();
  const code = getCloudCode();
  setVisible("cloudOff", online && !code);
  setVisible("cloudOn", online && !!code);
  if (code) setText("cloudCode", code);
  setText("cloudStatus", CLOUD_STATUS[cloud.status] || "");
}

/** Ouvre les options ; `from` est l'écran auquel revenir. */
export function openOptions(from) {
  returnTo = from;
  render();
  showScreen("optionsMenu");
}

/** Ferme les options et revient à l'écran d'où elles ont été ouvertes. */
export function closeOptions() {
  showScreen(returnTo);
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
  renderCloud();
  setText("tutorialReplayHint", "");
  setText("journalHint", JOURNAL_HINT);
  $("optMusic").value = Math.round(settings.musicVolume * 100);
  $("optSfx").value = Math.round(settings.sfxVolume * 100);
  setText("optMusicValue", `${Math.round(settings.musicVolume * 100)}%`);
  setText("optSfxValue", `${Math.round(settings.sfxVolume * 100)}%`);
  const shots = Math.round(allyAlpha() * 100);
  $("optShotOpacity").value = shots;
  setText("optShotOpacityValue", `${shots}%`);
  const vib = $("optVibration");
  vib.textContent = settings.vibration ? "ACTIVÉES" : "DÉSACTIVÉES";
  vib.classList.toggle("on", settings.vibration);
  const stats = $("optAnalytics");
  stats.textContent = analyticsEnabled() ? "ACTIVÉES" : "DÉSACTIVÉES";
  stats.classList.toggle("on", analyticsEnabled());
  for (const btn of document.querySelectorAll(/** @type {"button"} */ ("#optionsMenu [data-quality]"))) {
    btn.classList.toggle("active", btn.dataset.quality === settings.quality);
  }
}
