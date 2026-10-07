// Écran Équipement : arme / armure équipées, collection, niveau et prestige.

import { ITEMS, MAX_PRESTIGE, maxLevel } from "../data/items.js";
import {
  canLevelUp,
  canPrestige,
  equip,
  getEquipped,
  getOwned,
  levelUp,
  levelUpPrice,
  prestigeCopiesNeeded,
  prestigeUp,
  unequip,
} from "../services/inventory.js";
import { account } from "../services/storage.js";
import { $, el } from "./dom.js";
import { setLabel } from "./icons.js";
import { itemIcon, rarityColor, rarityTag, starsText, statsText } from "./itemView.js";
import { showScreen } from "./screens.js";

const RARITY_ORDER = ["common", "rare", "epic", "legendary"];
const TABS = { hero: "invTabHero", pet: "invTabPet", weapon: "invTabWeapon", armor: "invTabArmor" };
const EQUIPPED_SLOTS = [
  ["equippedHero", "hero", "Aucun héros"],
  ["equippedPet", "pet", "Aucun familier"],
  ["equippedWeapon", "weapon", "Aucune arme"],
  ["equippedArmor", "armor", "Aucune armure"],
];
let activeSlot = "weapon";
let onChange = () => {};

export function initInventoryMenu({ onBack, onAccountChange }) {
  onChange = onAccountChange;
  $("btnInventoryBack").addEventListener("click", onBack);
  for (const [slot, tab] of Object.entries(TABS)) $(tab).addEventListener("click", () => selectSlot(slot));
}

export function openInventory() {
  renderInventory();
  showScreen("inventoryMenu");
}

function selectSlot(slot) {
  activeSlot = slot;
  renderInventory();
}

/** Après une action : sauvegarde déjà faite, on rafraîchit tout l'affichage. */
function act(fn) {
  if (fn()) {
    onChange();
    renderInventory();
  }
}

export function renderInventory() {
  for (const [slot, tab] of Object.entries(TABS)) $(tab).classList.toggle("active", activeSlot === slot);
  for (const args of EQUIPPED_SLOTS) renderEquippedSlot(...args);

  const items = Object.values(ITEMS)
    .filter((it) => it.slot === activeSlot)
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
  $("itemList").replaceChildren(...items.map(itemCard));
}

function renderEquippedSlot(id, slot, emptyText) {
  const eq = getEquipped(slot);
  const box = $(id);
  if (!eq) {
    box.replaceChildren(el("span", "slot-empty", emptyText));
    box.style.borderColor = "";
    return;
  }
  const item = ITEMS[eq.id];
  box.style.borderColor = rarityColor(item.rarity);
  box.replaceChildren(
    itemIcon(item, "slot-icon"),
    el("span", "slot-name", item.name),
    el("span", "slot-stars", `${starsText(eq.prestige)} Nv ${eq.level}`),
  );
}

function itemCard(item) {
  const owned = getOwned(item.id);
  const card = el("div", `item-card${owned ? "" : " locked"}`);
  card.style.borderLeftColor = rarityColor(item.rarity);

  const head = el("div", "item-head");
  head.append(
    owned ? itemIcon(item, "item-icon") : itemIcon({ icon: "unknown", color: "#666" }, "item-icon"),
    el("h4", "", item.name),
    rarityTag(item.rarity),
  );
  card.append(head);

  if (!owned) {
    card.append(el("p", "item-desc", "Non obtenu — à trouver dans les coffres."));
    return card;
  }

  const meta = el("div", "item-meta");
  meta.append(
    el("span", "item-stars", starsText(owned.prestige)),
    el("span", "", `Nv ${owned.level}/${maxLevel(owned.prestige)}`),
  );
  const needed = prestigeCopiesNeeded(item.id);
  if (owned.prestige < MAX_PRESTIGE) meta.append(el("span", "", `Doublons ${owned.copies}/${needed}`));
  card.append(
    meta,
    el("p", "item-desc", item.desc),
    el("p", "item-stats", statsText(item, owned.level, owned.prestige)),
  );

  const actions = el("div", "item-actions");
  const isEquipped = account.equipped[item.slot] === item.id;
  const equipBtn = el("button", isEquipped ? "secondary" : "", isEquipped ? "ÉQUIPÉ" : "ÉQUIPER");
  if (isEquipped && (item.slot === "armor" || item.slot === "pet")) {
    equipBtn.textContent = "RETIRER";
    equipBtn.addEventListener("click", () => act(() => unequip(item.slot)));
  } else {
    equipBtn.disabled = isEquipped;
    equipBtn.addEventListener("click", () => act(() => equip(item.id)));
  }

  const price = levelUpPrice(item.id);
  const lvlBtn = el("button", "secondary", "NIV MAX");
  if (canLevelUp(item.id)) setLabel(lvlBtn, `NIV ▲ ${price} `, "coin", { color: "#ffd700" });
  lvlBtn.disabled = !canLevelUp(item.id) || account.gold < price;
  lvlBtn.addEventListener("click", () => act(() => levelUp(item.id)));

  const maxed = owned.prestige >= MAX_PRESTIGE;
  const prestigeBtn = el("button", "prestige-btn", maxed ? "★ MAX" : `PRESTIGE ★${owned.prestige + 1}`);
  prestigeBtn.disabled = !canPrestige(item.id);
  prestigeBtn.addEventListener("click", () => act(() => prestigeUp(item.id)));

  actions.append(equipBtn, lvlBtn, prestigeBtn);
  card.append(actions);
  return card;
}
