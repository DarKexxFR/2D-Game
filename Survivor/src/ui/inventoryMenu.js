// Écran Équipement : emplacements équipés, collection en grille et fiche détaillée de l'objet
// sélectionné (équiper, niveau, prestige).

import { CHESTS, CHEST_POOLS, ITEMS, MAX_PRESTIGE, maxLevel } from "../data/items.js";
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

const RARITY_ORDER = ["common", "rare", "epic", "legendary", "mythic"];
const TABS = { hero: "invTabHero", pet: "invTabPet", weapon: "invTabWeapon", armor: "invTabArmor" };
const EQUIPPED_SLOTS = [
  ["equippedHero", "hero", "Héros", "Aucun héros"],
  ["equippedPet", "pet", "Familier", "Aucun"],
  ["equippedWeapon", "weapon", "Arme", "Aucune"],
  ["equippedArmor", "armor", "Armure", "Aucune"],
];
let activeSlot = "weapon";
let selectedId = null;
let onChange = () => {};

export function initInventoryMenu({ onBack, onAccountChange }) {
  onChange = onAccountChange;
  $("btnInventoryBack").addEventListener("click", onBack);
  for (const [slot, tab] of Object.entries(TABS)) $(tab).addEventListener("click", () => selectSlot(slot));
  for (const [id, slot] of EQUIPPED_SLOTS) $(id).addEventListener("click", () => selectSlot(slot));
}

export function openInventory() {
  selectedId = null;
  renderInventory();
  showScreen("inventoryMenu");
}

function selectSlot(slot) {
  activeSlot = slot;
  selectedId = null; // l'objet équipé de cet emplacement sera sélectionné
  renderInventory();
}

function selectItem(id) {
  selectedId = id;
  renderInventory();
  $("itemDetail").scrollIntoView({ block: "nearest" });
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
  if (!items.some((it) => it.id === selectedId)) {
    selectedId = account.equipped[activeSlot] || items.find((it) => getOwned(it.id))?.id || items[0].id;
  }
  $("itemList").replaceChildren(...items.map(itemCard));
  renderDetail(ITEMS[selectedId]);
}

function renderEquippedSlot(id, slot, label, emptyText) {
  const eq = getEquipped(slot);
  const box = $(id);
  box.classList.toggle("active", slot === activeSlot);
  const head = el("span", "slot-label", label);
  if (!eq) {
    box.replaceChildren(head, el("span", "slot-empty", emptyText));
    box.style.removeProperty("--rarity");
    return;
  }
  const item = ITEMS[eq.id];
  box.style.setProperty("--rarity", rarityColor(item.rarity));
  box.replaceChildren(
    head,
    itemIcon(item, "slot-icon"),
    el("span", "slot-name", item.name),
    el("span", "slot-stars", `${starsText(eq.prestige)} · Nv ${eq.level}`),
  );
}

/** Vignette de la grille : icône, nom, étoiles ; grisée si l'objet n'est pas encore obtenu. */
function itemCard(item) {
  const owned = getOwned(item.id);
  const equipped = account.equipped[item.slot] === item.id;
  const card = el(
    "button",
    `item-card rarity-card-${item.rarity}${owned ? "" : " locked"}${equipped ? " equipped" : ""}${item.id === selectedId ? " selected" : ""}`,
  );
  card.style.setProperty("--rarity", rarityColor(item.rarity));
  card.append(
    owned ? itemIcon(item, "item-icon") : itemIcon({ icon: "lock", color: "#555" }, "item-icon"),
    el("span", "item-name", item.name),
    el("span", "item-stars", owned ? starsText(owned.prestige) : "Non obtenu"),
  );
  if (owned) card.append(el("span", "item-level", `Nv ${owned.level}`));
  if (equipped) card.append(el("span", "item-badge", "ÉQUIPÉ"));
  if (owned && (canPrestige(item.id) || (canLevelUp(item.id) && account.gold >= levelUpPrice(item.id)))) {
    card.append(el("span", "item-up", "▲")); // amélioration possible
  }
  card.addEventListener("click", () => selectItem(item.id));
  return card;
}

/** Coffres dans lesquels on peut trouver un objet. */
function chestsFor(item) {
  return CHESTS.filter((c) => CHEST_POOLS[c.pool || "gear"].includes(item.slot) && c.odds[item.rarity])
    .map((c) => c.name)
    .join(", ");
}

function renderDetail(item) {
  const owned = getOwned(item.id);
  const box = $("itemDetail");
  box.style.setProperty("--rarity", rarityColor(item.rarity));

  const head = el("div", "detail-head");
  const title = el("div", "detail-title");
  title.append(el("h3", "", item.name), rarityTag(item.rarity));
  head.append(itemIcon(owned ? item : { icon: "lock", color: "#666" }, "detail-icon"), title);

  if (!owned) {
    box.replaceChildren(
      head,
      el("p", "item-desc", item.desc),
      el("p", "item-stats", statsText(item, 1, 1)),
      el("p", "detail-locked", `Non obtenu — à trouver dans : ${chestsFor(item)}.`),
    );
    return;
  }

  // Niveau et doublons (progression vers le prestige suivant)
  const progress = el("div", "detail-progress");
  progress.append(
    el("span", "item-stars", starsText(owned.prestige)),
    el("span", "", `Niveau ${owned.level} / ${maxLevel(owned.prestige)}`),
  );
  if (owned.prestige < MAX_PRESTIGE) {
    const needed = prestigeCopiesNeeded(item.id);
    const track = el("div", "copies-track");
    const fill = el("div");
    fill.style.width = `${Math.min(1, owned.copies / needed) * 100}%`;
    track.append(fill);
    progress.append(el("span", "", `Doublons ${owned.copies}/${needed}`), track);
  }

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
  const lvlBtn = el("button", "level-btn", "NIV MAX");
  if (canLevelUp(item.id)) setLabel(lvlBtn, `NIV ▲ ${price} `, "coin", { color: "#ffd700" });
  lvlBtn.disabled = !canLevelUp(item.id) || account.gold < price;
  lvlBtn.addEventListener("click", () => act(() => levelUp(item.id)));

  const maxed = owned.prestige >= MAX_PRESTIGE;
  const prestigeBtn = el("button", "prestige-btn", maxed ? "★ MAX" : `PRESTIGE ★${owned.prestige + 1}`);
  prestigeBtn.disabled = !canPrestige(item.id);
  prestigeBtn.addEventListener("click", () => act(() => prestigeUp(item.id)));

  actions.append(equipBtn, lvlBtn, prestigeBtn);
  box.replaceChildren(
    head,
    progress,
    el("p", "item-desc", item.desc),
    el("p", "item-stats", statsText(item, owned.level, owned.prestige)),
    actions,
  );
}
