// Gestion des fenêtres (menus superposés) : une seule visible à la fois.

import { setVisible } from "./dom.js";
import { syncUrl } from "./router.js";

const SCREENS = [
  "mainMenu",
  "shopMenu",
  "inventoryMenu",
  "chestReveal",
  "leaderboardMenu",
  "achievementMenu",
  "dailyMenu",
  "bossRushMenu",
  "talentMenu",
  "upgradeMenu",
  "pauseMenu",
  "optionsMenu",
  "loginMenu",
  "reviveMenu",
  "gameOver",
  "versusOver",
  "duelMenu",
];

let current = null;

/** Affiche un écran (null = aucun, en pleine partie) et met l'adresse de la page à jour. */
export function showScreen(id) {
  current = id || null;
  for (const s of SCREENS) setVisible(s, s === id);
  document.body.dataset.screen = id || "";
  syncUrl(current);
}

export function currentScreen() {
  return current;
}

export function hideScreens() {
  showScreen(null);
}
