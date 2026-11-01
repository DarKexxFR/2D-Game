// Carte « Manette » des Options : activer la manette et ses vibrations, manettes branchées
// (avec le joueur qu'elles commandent) et liste des boutons.

import { on } from "../core/events.js";
import { pads } from "../core/gamepad.js";
import { onSettingsChange, settings, updateSettings } from "../services/settings.js";
import { $, el } from "./dom.js";
import { padLegend } from "./gamepadControls.js";

export function initGamepadOptions() {
  $("optGamepad").addEventListener("click", () => updateSettings({ gamepad: !settings.gamepad }));
  $("optPadVibration").addEventListener("click", () =>
    updateSettings({ padVibration: !settings.padVibration }),
  );
  onSettingsChange(render);
  on("gamepad", render);
}

function toggle(id, on, [yes, no]) {
  const btn = $(id);
  btn.textContent = on ? yes : no;
  btn.classList.toggle("on", on);
}

function render() {
  toggle("optGamepad", settings.gamepad, ["ACTIVÉE", "DÉSACTIVÉE"]);
  toggle("optPadVibration", settings.padVibration, ["ACTIVÉES", "DÉSACTIVÉES"]);

  const rows = [];
  for (const [i, pad] of pads.entries()) {
    if (!pad) continue;
    const row = el("div", "pad-row");
    row.dataset.slot = String(i);
    row.append(el("span", "pad-player", `J${i + 1}`), el("span", "pad-name", pad.name));
    if (!pad.standard) row.append(el("span", "pad-warn", "boutons non standard"));
    rows.push(row);
  }
  if (rows.length === 0)
    rows.push(
      el(
        "p",
        "pad-empty",
        settings.gamepad
          ? "Aucune manette détectée : branche-la (ou connecte-la en Bluetooth) puis appuie sur un bouton."
          : "Manette désactivée.",
      ),
    );
  $("padList").replaceChildren(...rows);

  const family = pads.find(Boolean)?.family;
  $("padLegend").replaceChildren(
    ...padLegend(family).map(([label, buttons]) => {
      const row = el("div", "key-row");
      row.append(el("span", "", label), el("b", "", buttons));
      return row;
    }),
  );
}
