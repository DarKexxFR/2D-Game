// Menu pause avec l'inventaire des améliorations de la partie.

import { game, player } from "../core/state.js";
import { activeMutators } from "../systems/endless.js";
import { fighterName, versus, withRun } from "../systems/versus.js";
import { $, el, isVisible } from "./dom.js";
import { corruptionPercent } from "./hud.js";
import { icon } from "./icons.js";
import { hideScreens, showScreen } from "./screens.js";

export function canTogglePause() {
  // Écran scindé : pause commune, même quand l'un des joueurs choisit une amélioration
  if (versus.split) return game.started && versus.winner === null;
  return game.started && game.running && !isVisible("upgradeMenu");
}

export function togglePause() {
  const paused = versus.split ? (versus.paused = !versus.paused) : (game.paused = !game.paused);
  if (!paused) {
    hideScreens();
    return;
  }
  renderCorruption();
  renderInventory();
  showScreen("pauseMenu");
}

/** Rappel de la corruption des soins (vague 12+), aussi pour les écrans tactiles sans survol. */
function renderCorruption() {
  const box = $("pauseCorruption");
  box.replaceChildren();
  const add = (prefix = "") => {
    const pct = corruptionPercent();
    if (pct <= 0) return;
    const row = el("div", "corruption-row");
    row.append(icon("heartCrack", "#aa66ff"), el("span", "", `${prefix}Corruption : soins −${pct} %`));
    box.append(row);
  };
  if (versus.split) for (const i of [0, 1]) withRun(i, () => add(fighterName(i) + " · "));
  else add();
  if (game.endless) renderPulse(box);
}

/** Endless Pulse : pulsation atteinte et mutations cumulées des ennemis. */
function renderPulse(box) {
  const head = el("div", "pulse-row");
  head.append(icon("infinity", "#ff00aa"), el("b", "", `ENDLESS PULSE · PULSATION ${game.endless.depth}`));
  box.append(head);
  for (const m of activeMutators()) {
    const row = el("div", "pulse-row");
    row.append(icon(m.icon, m.color), el("span", "", `${m.name} ×${m.count} · ${m.desc}`));
    box.append(row);
  }
}

function renderInventory() {
  const list = $("pauseInventory");
  list.replaceChildren();
  if (versus.split) {
    for (const i of [0, 1]) withRun(i, () => renderItems(list, player.inventory, fighterName(i) + " · "));
    if (list.children.length === 0) list.append(el("div", "inv-empty", "Inventaire vide"));
    return;
  }
  renderItems(list, player.inventory);
}

function renderItems(list, inventory, prefix = "") {
  const names = Object.keys(inventory).sort();
  if (names.length === 0 && !prefix) {
    list.append(el("div", "inv-empty", "Inventaire vide"));
    return;
  }
  for (const name of names) {
    const row = el("div", "inv-item");
    row.append(el("span", "", prefix + name), el("span", "inv-count", "x" + inventory[name]));
    list.append(row);
  }
}
