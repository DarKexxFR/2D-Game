// Menu principal et compte (les coffres de la boutique sont dans chestMenu.js).

import { account, loadPseudo, resetProgress, savePseudo } from "../services/storage.js";
import { $, setText, setWidth } from "./dom.js";
import { initChestMenu, renderChests } from "./chestMenu.js";
import { initInventoryMenu, openInventory } from "./inventoryMenu.js";
import { initLeaderboardMenu, openLeaderboard } from "./leaderboardMenu.js";
import { showScreen } from "./screens.js";

let pseudo = loadPseudo();

export function getPseudo() {
  return pseudo;
}

/** Lit le champ pseudo, l'enregistre et le renvoie. */
export function commitPseudo() {
  const value = $("playerPseudo").value.trim().substring(0, 12);
  if (value) {
    pseudo = value;
    savePseudo(pseudo);
  }
  return pseudo;
}

export function initMainMenu({ onPlay }) {
  $("playerPseudo").value = pseudo;
  $("playerPseudo").addEventListener("change", commitPseudo);

  $("btnPlay").addEventListener("click", onPlay);
  $("btnShop").addEventListener("click", () => showScreen("shopMenu"));
  $("btnLeaderboard").addEventListener("click", openLeaderboard);
  $("btnInventory").addEventListener("click", openInventory);
  initInventoryMenu({ onBack: () => showScreen("mainMenu"), onAccountChange: refreshAccountUI });
  initChestMenu({ onAccountChange: refreshAccountUI });
  $("btnReset").addEventListener("click", () => {
    if (confirm("Effacer la progression (Niveau, Or) ?\nLe classement et le pseudo seront CONSERVÉS.")) {
      resetProgress();
      location.reload();
    }
  });
  $("btnShopBack").addEventListener("click", () => showScreen("mainMenu"));
  initLeaderboardMenu({ onBack: () => showScreen("mainMenu") });
}

export function showMainMenu() {
  refreshAccountUI();
  showScreen("mainMenu");
}

export function refreshAccountUI() {
  setText("acLvlDisplay", account.level);
  setText("acXpDisplay", `${Math.floor(account.currentXp)}/${Math.floor(account.nextLevelXp)} XP`);
  setWidth("acBarFill", account.currentXp / account.nextLevelXp);
  setText("acGoldDisplay", account.gold);
  setText("shopGoldDisplay", account.gold);
  setText("invGoldDisplay", account.gold);
  renderChests();
}
