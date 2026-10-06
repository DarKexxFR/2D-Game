// Menu pause avec l'inventaire des améliorations de la partie.

import { game, player } from "../core/state.js";
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
  const names = Object.keys(player.inventory).sort();
  if (names.length === 0) {
    list.append(el("div", "inv-empty", "Inventaire vide"));
    return;
  }
  for (const name of names) {
    const row = el("div", "inv-item");
    row.append(el("span", "", name), el("span", "inv-count", "x" + player.inventory[name]));
    list.append(row);
  }
}
