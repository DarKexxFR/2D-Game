// Menu principal et compte (les coffres de la boutique sont dans chestMenu.js).

import { DIFFICULTIES } from "../config.js";
import { HEROES, PETS } from "../data/items.js";
import { TALENTS } from "../data/talents.js";
import { getDailyBest } from "../services/daily.js";
import { getEquipped } from "../services/inventory.js";
import { isDifficultyUnlocked, selectedDifficulty, setDifficulty } from "../services/difficulty.js";
import { getWeeklyQuests } from "../services/quests.js";
import { account, loadPseudo, savePseudo } from "../services/storage.js";
import { $, setClass, setText, setWidth } from "./dom.js";
import { initChestMenu, renderChests } from "./chestMenu.js";
import { initInventoryMenu, openInventory } from "./inventoryMenu.js";
import { initLeaderboardMenu, openLeaderboard } from "./leaderboardMenu.js";
import { showScreen } from "./screens.js";
import { refreshSeasonTile } from "./seasonMenu.js";
import { renderResumeRun } from "./resumeRun.js";

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
  for (const btn of document.querySelectorAll(/** @type {"button"} */ (".diff-btn"))) {
    btn.addEventListener("click", () => pickDifficulty(btn.dataset.diff));
  }
  $("btnShop").addEventListener("click", () => showScreen("shopMenu"));
  $("btnLeaderboard").addEventListener("click", openLeaderboard);
  $("btnInventory").addEventListener("click", openInventory);
  $("heroStage").addEventListener("click", openInventory); // toucher son héros = le changer
  initInventoryMenu({ onBack: showMainMenu, onAccountChange: refreshAccountUI });
  initChestMenu({ onAccountChange: refreshAccountUI });
  $("btnShopBack").addEventListener("click", showMainMenu);
  initLeaderboardMenu({ onBack: showMainMenu });
}

export function showMainMenu() {
  refreshAccountUI();
  renderResumeRun();
  showScreen("mainMenu");
}

export function refreshAccountUI() {
  setText("acLvlDisplay", account.level);
  setText("acXpDisplay", `${Math.floor(account.currentXp)}/${Math.floor(account.nextLevelXp)} XP`);
  setWidth("acBarFill", account.currentXp / account.nextLevelXp);
  setText("acGoldDisplay", account.gold);
  refreshHomeTiles();
  refreshDifficulty();
  setText("shopGoldDisplay", account.gold);
  setText("invGoldDisplay", account.gold);
  renderChests();
}

/** Infos rapides de l'écran d'accueil : héros équipé, défi du jour, talents, quêtes. */
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

  const { quests } = getWeeklyQuests();
  const ready = quests.filter((q) => q.done && !q.claimed).length;
  const done = quests.filter((q) => q.done).length;
  setText("questTileSub", ready ? "Or à récupérer !" : `${done} / ${quests.length} accomplies`);
  setClass("btnQuests", "has-new", ready > 0);
  refreshSeasonTile();
}

// --- DIFFICULTÉ ---

let lockedHint = null; // niveau verrouillé touché : son indice reste affiché

function pickDifficulty(id) {
  lockedHint = setDifficulty(id) ? null : id;
  refreshDifficulty();
}

function refreshDifficulty() {
  const current = selectedDifficulty();
  for (const btn of document.querySelectorAll(/** @type {"button"} */ (".diff-btn"))) {
    const id = btn.dataset.diff;
    const unlocked = isDifficultyUnlocked(id);
    btn.classList.toggle("active", id === current);
    btn.classList.toggle("locked", !unlocked);
    btn.setAttribute("aria-checked", String(id === current));
    btn.style.setProperty("--diff", DIFFICULTIES[id].color);
  }
  const hint = lockedHint && !isDifficultyUnlocked(lockedHint) ? lockedHint : null;
  const d = DIFFICULTIES[hint || current];
  setText("difficultyHint", hint ? `Atteins la vague ${d.unlockWave} pour débloquer ${d.name}` : d.desc);
  $("difficultyHint").style.color = hint ? "#ff2a6d" : "";
}
