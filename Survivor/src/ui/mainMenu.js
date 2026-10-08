// Menu principal et compte (les coffres de la boutique sont dans chestMenu.js).

import { HEROES, PETS } from "../data/items.js";
import { TALENTS } from "../data/talents.js";
import { getDailyBest } from "../services/daily.js";
import { getEquipped } from "../services/inventory.js";
import { account, loadPseudo, resetProgress, savePseudo } from "../services/storage.js";
import { $, setClass, setText, setWidth } from "./dom.js";
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
  $("heroStage").addEventListener("click", openInventory); // toucher son héros = le changer
  initInventoryMenu({ onBack: showMainMenu, onAccountChange: refreshAccountUI });
  initChestMenu({ onAccountChange: refreshAccountUI });
  $("btnReset").addEventListener("click", () => {
    if (confirm("Effacer la progression (Niveau, Or) ?\nLe classement et le pseudo seront CONSERVÉS.")) {
      resetProgress();
      location.reload();
    }
  });
  $("btnShopBack").addEventListener("click", showMainMenu);
  initLeaderboardMenu({ onBack: showMainMenu });
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
  refreshHomeTiles();
  setText("shopGoldDisplay", account.gold);
  setText("invGoldDisplay", account.gold);
  renderChests();
}

/** Infos rapides de l'écran d'accueil : héros équipé, défi du jour, talents. */
function refreshHomeTiles() {
  const hero = HEROES[getEquipped("hero")?.id] || HEROES.pilot;
  const pet = PETS[getEquipped("pet")?.id];
  setText("homeHeroName", hero.name.toUpperCase());
  setText("homeHeroSub", pet ? `+ ${pet.name}` : "Changer de héros");
  $("homeHeroName").style.color = hero.color;

  const best = getDailyBest();
  setText("dailyTileSub", best ? `Record : vague ${best.wave}` : "Nouveau défi !");
  setClass("btnDaily", "has-new", !best);

  const ranks = TALENTS.reduce((sum, t) => sum + Math.min(account.talents[t.id] || 0, t.max), 0);
  const max = TALENTS.reduce((sum, t) => sum + t.max, 0);
  setText("talentTileSub", `${ranks} / ${max} rangs`);
}
