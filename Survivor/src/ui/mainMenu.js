// Menu principal, boutique et classement.

import { DRONE, droneCost, droneDamage } from "../config.js";
import {
  account,
  getLeaderboard,
  loadPseudo,
  resetProgress,
  savePseudo,
  upgradePet,
} from "../services/storage.js";
import { $, el, setText, setVisible, setWidth } from "./dom.js";
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
  $("btnReset").addEventListener("click", () => {
    if (confirm("Effacer la progression (Niveau, Or) ?\nLe classement et le pseudo seront CONSERVÉS.")) {
      resetProgress();
      location.reload();
    }
  });
  $("btnShopBack").addEventListener("click", () => showScreen("mainMenu"));
  $("btnLeaderboardBack").addEventListener("click", () => showScreen("mainMenu"));
  $("btnDrone").addEventListener("click", () => {
    if (upgradePet("drone")) refreshAccountUI();
  });
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
  refreshShop();
}

function refreshShop() {
  const level = account.petLevels.drone || 0;
  const cost = droneCost(level);
  const affordable = account.gold >= cost;
  const btn = $("btnDrone");

  setVisible("droneLvlBadge", level > 0);
  setText("droneLvlBadge", "Lvl " + level);
  setText(
    "droneStats",
    level === 0
      ? `Dégâts: ${DRONE.baseDamage} | Vitesse: ${DRONE.baseCooldown / 1000}s`
      : `Actuel: ${droneDamage(level)} Dmg | Coût: ${cost} 💰`,
  );
  btn.disabled = !affordable;
  btn.textContent = !affordable ? `PAS D'OR (${cost} 💰)` : level === 0 ? `ACHETER (${cost} 💰)` : "UPGRADE";
}

function openLeaderboard() {
  const tbody = $("lbContent");
  tbody.replaceChildren();
  const lb = getLeaderboard();
  if (lb.length === 0) {
    const row = el("tr");
    const cell = el("td", "lb-empty", "Aucun score enregistré");
    cell.colSpan = 4;
    row.append(cell);
    tbody.append(row);
  } else {
    lb.forEach((entry, i) => {
      const row = el("tr");
      row.append(
        el("td", "lb-rank", i + 1),
        el("td", "", entry.name),
        el("td", "", entry.wave),
        el("td", "", Math.floor(entry.xp)),
      );
      tbody.append(row);
    });
  }
  showScreen("leaderboardMenu");
}
