// Gestion des fenêtres (menus superposés) : une seule visible à la fois.

import { setVisible } from "./dom.js";

const SCREENS = [
  "mainMenu",
  "shopMenu",
  "inventoryMenu",
  "chestReveal",
  "leaderboardMenu",
  "achievementMenu",
  "dailyMenu",
  "talentMenu",
  "upgradeMenu",
  "pauseMenu",
  "optionsMenu",
  "gameOver",
];

export function showScreen(id) {
  for (const s of SCREENS) setVisible(s, s === id);
  document.body.dataset.screen = id || "";
}

export function hideScreens() {
  showScreen(null);
}
