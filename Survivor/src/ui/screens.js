// Gestion des fenêtres (menus superposés) : une seule visible à la fois.

import { setVisible } from "./dom.js";

const SCREENS = ["mainMenu", "shopMenu", "leaderboardMenu", "upgradeMenu", "pauseMenu", "gameOver"];

export function showScreen(id) {
  for (const s of SCREENS) setVisible(s, s === id);
}

export function hideScreens() {
  showScreen(null);
}
