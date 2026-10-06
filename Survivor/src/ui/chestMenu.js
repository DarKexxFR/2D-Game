// Coffres de la boutique et écran d'ouverture.

import { CHESTS, PRESTIGE_COPIES } from "../data/items.js";
import { canPrestige, getOwned, openChest } from "../services/inventory.js";
import { account } from "../services/storage.js";
import { $, el } from "./dom.js";
import { RARITY_LABELS, rarityColor, rarityTag, starsText, statsText } from "./itemView.js";
import { showScreen } from "./screens.js";

let lastChestId = null;
let onChange = () => {};

export function initChestMenu({ onAccountChange }) {
  onChange = onAccountChange;
  $("btnChestOk").addEventListener("click", () => showScreen("shopMenu"));
  $("btnChestAgain").addEventListener("click", () => buy(lastChestId));
}

export function renderChests() {
  const list = $("chestList");
  list.replaceChildren(
    ...CHESTS.map((chest) => {
      const card = el("div", `chest-card chest-${chest.id}`);
      const odds = Object.entries(chest.odds)
        .map(([r, p]) => `${RARITY_LABELS[r]} ${p}%`)
        .join(" · ");
      const info = el("div", "chest-info");
      info.append(el("h4", "", `${chest.icon} ${chest.name}`), el("p", "chest-odds", odds));
      const btn = el("button", "shop-btn", `${chest.cost} 💰`);
      btn.disabled = account.gold < chest.cost;
      btn.addEventListener("click", () => buy(chest.id));
      card.append(info, btn);
      return card;
    }),
  );
}

function buy(chestId) {
  const outcome = openChest(chestId);
  if (!outcome) return;
  lastChestId = chestId;
  onChange();
  showReveal(outcome);
}

function showReveal({ item, result, refund }) {
  const owned = getOwned(item.id);
  const box = el("div", `chest-reveal rarity-glow-${item.rarity}`);
  box.style.setProperty("--rarity", rarityColor(item.rarity));

  let message;
  if (result === "new") message = "✨ NOUVEL OBJET !";
  else if (result === "gold") message = `★ MAX — converti en ${refund} 💰`;
  else {
    message = `Doublon +1 (${owned.copies}/${PRESTIGE_COPIES[owned.prestige]} pour ★${owned.prestige + 1})`;
    if (canPrestige(item.id)) message += " — prestige disponible !";
  }

  box.append(
    el("div", "reveal-icon", item.icon),
    rarityTag(item.rarity),
    el("h3", "reveal-name", item.name),
    el("div", "reveal-stars", starsText(owned.prestige)),
    el("p", "reveal-stats", statsText(item, owned.level, owned.prestige)),
    el("p", "reveal-result", message),
  );
  $("chestRevealContent").replaceChildren(box);

  const chest = CHESTS.find((c) => c.id === lastChestId);
  $("btnChestAgain").disabled = account.gold < chest.cost;
  $("btnChestAgain").textContent = `ENCORE (${chest.cost} 💰)`;
  showScreen("chestReveal");
}
