// Choix d'une amélioration à la montée de niveau (tirage pondéré par rareté).

import { RARITIES } from "../config.js";
import { game, player } from "../core/state.js";
import { applyUpgrade, availableUpgrades } from "../data/upgrades.js";
import { heal } from "../systems/player.js";
import { weightedPick } from "../utils/math.js";
import { $, el } from "./dom.js";
import { hideScreens, showScreen } from "./screens.js";

const CHOICES = 3;

function drawUpgrades(count) {
  const pool = availableUpgrades(player);
  const picks = [];
  while (picks.length < count && pool.length > 0) {
    const pick = weightedPick(pool, (u) => RARITIES[u.rarity]?.weight ?? 10);
    picks.push(pick);
    pool.splice(pool.indexOf(pick), 1); // pas de doublon
  }
  return picks;
}

function resume() {
  hideScreens();
  game.running = true;
  game.paused = false;
}

export function showUpgradeMenu() {
  const picks = drawUpgrades(CHOICES);
  if (picks.length === 0) {
    heal(50); // soin de secours si plus rien n'est disponible
    return;
  }

  game.running = false;
  game.paused = true;
  const options = $("upgradeOptions");
  options.replaceChildren();

  for (const u of picks) {
    const card = el("div", `upgrade-option rarity-${u.rarity}`);
    const tag = el("span", "rarity-tag", u.rarity);
    tag.style.color = RARITIES[u.rarity].color;
    const info = el("div", "upg-info");
    info.append(el("h4", "", u.name), el("p", "", u.desc));
    card.append(tag, el("div", "icon", u.icon), info);
    card.addEventListener("click", () => {
      applyUpgrade(u, player);
      resume();
    });
    options.append(card);
  }
  showScreen("upgradeMenu");
}
