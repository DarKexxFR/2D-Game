// Réglage des touches (menu Options) et aide des commandes affichée en jeu.

import { ACTIONS, bindingsOf, captureNextKey, keyLabel, rebind, resetBindings } from "../core/input.js";
import { onSettingsChange } from "../services/settings.js";
import { $, el } from "./dom.js";
import { isTouchDevice } from "./touchControls.js";

let waitingFor = null;

export function initKeyBindings() {
  $("optKeysSection").style.display = isTouchDevice ? "none" : "";
  $("btnResetKeys").addEventListener("click", resetBindings);
  onSettingsChange(() => {
    renderKeyList();
    renderControlsHelp();
  });
}

const labelOf = (action) => bindingsOf(action).map(keyLabel).join(" / ");

function renderKeyList() {
  const rows = Object.entries(ACTIONS).map(([action, { label }]) => {
    const row = el("div", "key-row");
    row.dataset.action = action;
    const waiting = waitingFor === action;
    const btn = el("button", waiting ? "waiting" : "", waiting ? "Touche ?" : labelOf(action));
    btn.addEventListener("click", () => startCapture(action));
    row.append(el("span", "", label), btn);
    return row;
  });
  $("keyBindingList").replaceChildren(...rows);
}

function startCapture(action) {
  waitingFor = action;
  renderKeyList();
  captureNextKey((key) => {
    waitingFor = null;
    if (key)
      rebind(action, key); // rebind sauvegarde → renderKeyList via onSettingsChange
    else renderKeyList();
  });
}

/** Encadré d'aide en bas à droite pendant la partie. */
function renderControlsHelp() {
  const lines = [
    "SOURIS : Viser",
    `${["up", "left", "down", "right"].map((a) => keyLabel(bindingsOf(a)[0])).join("")} : Bouger`,
    ...["dash", "skill", "box", "autoShoot", "pause"].map((a) => `${labelOf(a)} : ${ACTIONS[a].label}`),
  ];
  $("controls").replaceChildren(...lines.flatMap((line, i) => (i ? [el("br"), line] : [line])));
}
