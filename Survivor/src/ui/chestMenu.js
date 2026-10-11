// Coffres de la boutique et écran d'ouverture.

import { ADS } from "../config.js";
import { CHEST_GROUPS, CHESTS, FREE_CHEST, PRESTIGE_COPIES } from "../data/items.js";
import { adsEnabled, showRewardedAd } from "../services/ads.js";
import {
  canPrestige,
  freeChestRemainingMs,
  getOwned,
  adChestsLeft,
  isFreeChestReady,
  openAdChest,
  openChest,
  openFreeChest,
} from "../services/inventory.js";
import { playSfx } from "../services/sfx.js";
import { account } from "../services/storage.js";
import { $, el, forgetCached, setClass, setText } from "./dom.js";
import { icon, setLabel } from "./icons.js";
import { RARITY_LABELS, itemIcon, rarityColor, rarityTag, starsText, statsText } from "./itemView.js";
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
  setText(
    "shopTileSub",
    ready ? "Coffre gratuit prêt !" : `Gratuit dans ${formatRemaining(freeChestRemainingMs())}`,
  );
  const btn = $("btnFreeChest");
  if (!btn) return;
  btn.disabled = !ready;
  setText("btnFreeChest", ready ? "OUVRIR !" : formatRemaining(freeChestRemainingMs()));
  setClass("freeChestCard", "ready", ready);
}

/** Carte « récompense » (coffre gratuit, coffre bonus) : icône, texte, bouton. */
function rewardCard(id, className, iconName, color, title, text, btn) {
  const card = el("div", `chest-card reward-card ${className}`);
  card.id = id;
  card.style.setProperty("--chest", color);
  const ico = el("span", "reward-icon");
  ico.append(icon(iconName, color));
  const info = el("div", "chest-info");
  info.append(el("h4", "", title), el("p", "chest-odds", text));
  card.append(ico, info, btn);
  return card;
}

function freeChestCard() {
  const chest = CHESTS.find((c) => c.id === FREE_CHEST.chestId);
  const btn = el("button", "shop-btn");
  btn.id = "btnFreeChest";
  btn.addEventListener("click", () => {
    const outcome = openFreeChest();
    if (!outcome) return;
    lastChestId = null;
    onChange();
    showReveal(outcome);
  });
  return rewardCard(
    "freeChestCard",
    "chest-free",
    "gift",
    "#00ff88",
    "Coffre gratuit",
    `Un ${chest.name.toLowerCase()} offert toutes les ${FREE_CHEST.intervalHours} h`,
    btn,
  );
}

/** Coffre bonus : un coffre basique de plus en regardant une pub (quelques fois par jour). */
function adChestCard() {
  const chest = CHESTS.find((c) => c.id === FREE_CHEST.chestId);
  const left = adChestsLeft();
  const btn = setLabel(el("button", "shop-btn"), left > 0 ? " PUB" : " DEMAIN", "play", { before: true });
  btn.id = "btnAdChest";
  btn.disabled = left === 0;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const rewarded = await showRewardedAd("chest");
    const outcome = rewarded ? openAdChest() : null;
    if (!outcome) {
      renderChests();
      return;
    }
    lastChestId = null;
    onChange();
    showReveal(outcome);
  });
  return rewardCard(
    "adChestCard",
    "chest-ad",
    "play",
    "#ffd700",
    "Coffre bonus",
    `Un ${chest.name.toLowerCase()} contre une pub · ${left}/${ADS.adChestsPerDay} aujourd'hui`,
    btn,
  );
}

const POOL_LABELS = { gear: "Armes & armures", hero: "Héros", pet: "Familiers" };

/** Tuile d'un coffre payant : grande icône, contenu, chances en barre colorée, prix. */
function chestTile(chest) {
  const card = el("div", `chest-card chest-tile chest-${chest.id}`);
  card.style.setProperty("--chest", chest.color);
  const ico = el("span", "chest-icon");
  ico.append(icon(chest.icon, chest.color));

  const bar = el("div", "odds-bar");
  const legend = el("div", "odds-legend");
  for (const [rarity, pct] of Object.entries(chest.odds)) {
    const seg = el("span");
    seg.style.flex = pct;
    seg.style.background = rarityColor(rarity);
    bar.append(seg);
    const chip = el("span", "odds-chip", `${RARITY_LABELS[rarity]} ${pct}%`);
    chip.style.setProperty("--r", rarityColor(rarity));
    legend.append(chip);
  }

  const btn = setLabel(el("button", "shop-btn"), `${chest.cost} `, "coin", { color: "#ffd700" });
  btn.disabled = account.gold < chest.cost;
  btn.addEventListener("click", () => buy(chest.id));
  card.append(
    ico,
    el("h4", "", chest.name),
    el("p", "chest-pool", POOL_LABELS[chest.pool || "gear"]),
    bar,
    legend,
    btn,
  );
  return card;
}

export function renderChests() {
  const free = el("div", "reward-row");
  free.append(freeChestCard(), ...(adsEnabled() ? [adChestCard()] : []));
  const sections = [el("h3", "shop-section", "Récompenses"), free];
  for (const group of CHEST_GROUPS) {
    const grid = el("div", `chest-grid cols-${group.ids.length}`);
    grid.append(...group.ids.map((id) => chestTile(CHESTS.find((c) => c.id === id))));
    sections.push(el("h3", "shop-section", group.title), grid);
  }
  $("chestList").replaceChildren(...sections);
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
  playSfx("chest");
  const owned = getOwned(item.id);
  const box = el("div", `chest-reveal rarity-glow-${item.rarity}`);
  box.style.setProperty("--rarity", rarityColor(item.rarity));

  let message;
  if (result === "new") message = "NOUVEL OBJET !";
  else if (result === "gold") message = `★ MAX — converti en ${refund} OR`;
  else {
    message = `Doublon +1 (${owned.copies}/${PRESTIGE_COPIES[owned.prestige]} pour ★${owned.prestige + 1})`;
    if (canPrestige(item.id)) message += " — prestige disponible !";
  }

  box.append(
    itemIcon(item, "reveal-icon"),
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
    setLabel(again, `ENCORE (${chest.cost} `, "coin", { color: "#ffd700" }).append(")");
  }
  showScreen("chestReveal");
}
