// Menu pause avec l'inventaire des améliorations de la partie.

import { game, player } from "../core/state.js";
import { fighterName, versus } from "../systems/versus.js";
import { $, el, isVisible } from "./dom.js";
import { hideScreens, showScreen } from "./screens.js";

export function canTogglePause() {
  return game.started && game.running && !isVisible("upgradeMenu");
}

export function togglePause() {
  game.paused = !game.paused;
  if (!game.paused) {
    hideScreens();
    return;
  }
  renderInventory();
  showScreen("pauseMenu");
}

function renderInventory() {
  const list = $("pauseInventory");
  list.replaceChildren();
  if (versus.active) {
    versus.fighters.forEach((f, i) => renderItems(list, f.inventory, fighterName(i) + " · "));
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
