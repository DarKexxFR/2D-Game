// Menu pause avec l'inventaire des améliorations de la partie.

import { game, player } from "../core/state.js";
import { fighterName, versus, withRun } from "../systems/versus.js";
import { $, el, isVisible } from "./dom.js";
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
  renderInventory();
  showScreen("pauseMenu");
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
