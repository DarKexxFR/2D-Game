// Coffres de la boutique et écran d'ouverture.

import { CHESTS, FREE_CHEST, PRESTIGE_COPIES } from "../data/items.js";
import {
  canPrestige,
  freeChestRemainingMs,
  getOwned,
  isFreeChestReady,
  openChest,
  openFreeChest,
} from "../services/inventory.js";
import { account } from "../services/storage.js";
import { $, el, forgetCached, setClass, setText } from "./dom.js";
import { RARITY_LABELS, rarityColor, rarityTag, starsText, statsText } from "./itemView.js";
import { showScreen } from "./screens.js";

let lastChestId = null;
let onChange = () => {};

export function initChestMenu({ onAccountChange }) {
  onChange = onAccountChange;
  $("btnChestOk").addEventListener("click", () => showScreen("shopMenu"));
  $("btnChestAgain").addEventListener("click", () => buy(lastChestId));
  // Compte à rebours du coffre gratuit + badge sur le bouton Boutique
  updateFreeChest();
  setInterval(updateFreeChest, 1000);
}

function formatRemaining(ms) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s).padStart(2, "0")}s`;
}

function updateFreeChest() {
  const ready = isFreeChestReady();
  setClass("btnShop", "has-free", ready);
  const btn = $("btnFreeChest");
  if (!btn) return;
  btn.disabled = !ready;
  setText("btnFreeChest", ready ? "OUVRIR !" : formatRemaining(freeChestRemainingMs()));
  setClass("freeChestCard", "ready", ready);
}

function freeChestCard() {
  const chest = CHESTS.find((c) => c.id === FREE_CHEST.chestId);
  const card = el("div", "chest-card chest-free");
  card.id = "freeChestCard";
  const info = el("div", "chest-info");
  info.append(
    el("h4", "", `🎁 Coffre gratuit`),
    el("p", "chest-odds", `Un ${chest.name.toLowerCase()} offert toutes les ${FREE_CHEST.intervalHours} h`),
  );
  const btn = el("button", "shop-btn");
  btn.id = "btnFreeChest";
  btn.addEventListener("click", () => {
    const outcome = openFreeChest();
    if (!outcome) return;
    lastChestId = null;
    onChange();
    showReveal(outcome);
  });
  card.append(info, btn);
  return card;
}

export function renderChests() {
  const list = $("chestList");
  list.replaceChildren(
    freeChestCard(),
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
  // Les éléments viennent d'être recréés : on vide le cache de $() pour eux.
  forgetCached("btnFreeChest", "freeChestCard");
  updateFreeChest();
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

  // « Encore » rachète le même coffre (masqué après un coffre gratuit)
  const chest = CHESTS.find((c) => c.id === lastChestId);
  const again = $("btnChestAgain");
  again.style.display = chest ? "" : "none";
  if (chest) {
    again.disabled = account.gold < chest.cost;
    again.textContent = `ENCORE (${chest.cost} 💰)`;
  }
  showScreen("chestReveal");
}
