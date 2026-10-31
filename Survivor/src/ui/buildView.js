// Build de la partie (menu Pause, écran de fin) : armes (équipée + armes d'appoint), évolutions obtenues
// et pouvoirs (emplacements limités), chacun avec son icône à la couleur de sa rareté, son niveau et son effet.

import { RARITIES } from "../config.js";
import { SIDE_WEAPON_RULES, sideLook } from "../data/sideWeapons.js";
import { POWER_RULES, cardByName, ownedEvolutions, ownedPowers } from "../data/upgrades.js";
import { el } from "./dom.js";
import { icon } from "./icons.js";

export const RARITY_NAMES = {
  common: "Commun",
  rare: "Rare",
  epic: "Épique",
  legendary: "Légendaire",
  evolution: "Évolution",
  fusion: "Fusion",
  corrupted: "Corrompue",
  weapon: "Arme",
};
// Ordre d'affichage des améliorations : les plus rares d'abord
const RARITY_ORDER = ["corrupted", "legendary", "epic", "rare", "common"];

const rarityColor = (rarity) => RARITIES[rarity]?.color || "#aaa";

/**
 * Bloc du build du joueur `p`.
 * @param {any} p joueur
 * @param {{ compact?: boolean, title?: string }} [opts] compact : icônes seules (écran de fin)
 */
export function buildView(p, { compact = false, title = "" } = {}) {
  const root = el("div", `build-view${compact ? " compact" : ""}`);
  if (title) root.append(el("div", "bv-owner", title));
  root.append(section("Armes", weaponTiles(p, compact)));
  const evos = ownedEvolutions(p);
  if (evos.length > 0) {
    const list = el("div", "bv-evos");
    for (const e of evos) {
      const chip = el("span", "bv-evo");
      chip.title = e.desc;
      chip.append(icon(e.icon, rarityColor(e.rarity)), el("span", "", e.name));
      list.append(chip);
    }
    root.append(section("Évolutions", list));
  }
  root.append(section(`Pouvoirs ${ownedPowers(p).length}/${POWER_RULES.slots}`, cardTiles(p, compact)));
  return root;
}

function section(name, body) {
  const box = el("section", "bv-section");
  box.append(el("h3", "bv-title", name), body);
  return box;
}

function weaponTiles(p, compact) {
  const list = el("div", "bv-weapons");
  const w = p.weapon;
  if (w) {
    list.append(
      weaponTile(
        w.icon || "blaster",
        w.color || "#00ffff",
        w.name,
        w.evolved ? "Arme évoluée" : "Arme équipée",
        {
          evolved: !!w.evolved,
          compact,
        },
      ),
    );
  }
  for (const s of p.sideWeapons || []) {
    const look = sideLook(s, p);
    const evolved = look.kind !== "";
    const sub = look.kind === "fusion" ? "Fusion" : evolved ? "Évoluée" : `Niveau ${s.level}`;
    const tile = weaponTile(look.icon, look.color, look.name, sub, { evolved, compact });
    if (!evolved && !compact)
      tile.querySelector(".bv-wtext").append(pips(s.level, SIDE_WEAPON_RULES.maxLevel));
    list.append(tile);
  }
  for (let i = (p.sideWeapons || []).length; i < SIDE_WEAPON_RULES.slots; i++) {
    const empty = el("div", "bv-weapon empty");
    empty.title = "Emplacement d'arme d'appoint libre (cartes « Arme »)";
    empty.append(el("div", "bv-wicon"), compact ? "" : el("div", "bv-wtext", "Emplacement libre"));
    list.append(empty);
  }
  return list;
}

function weaponTile(ico, color, name, sub, { evolved, compact }) {
  const tile = el("div", `bv-weapon${evolved ? " evolved" : ""}`);
  tile.style.setProperty("--c", color);
  tile.title = `${name} · ${sub}`;
  const box = el("div", "bv-wicon");
  box.append(icon(ico, color));
  tile.append(box);
  if (!compact) {
    const text = el("div", "bv-wtext");
    text.append(el("b", "", name), el("small", "", sub));
    tile.append(text);
  }
  return tile;
}

/** Niveau en pastilles : ●●●○○ */
function pips(level, max) {
  const row = el("span", "bv-pips");
  for (let i = 1; i <= max; i++) row.append(el("i", i <= level ? "on" : ""));
  return row;
}

function cardTiles(p, compact) {
  const cards = Object.entries(p.inventory)
    .map(([name, count]) => ({ def: cardByName(name), name, count }))
    .filter((c) => c.def && !c.def.sideWeapon) // les armes d'appoint sont dans « Armes »
    .sort(
      (a, b) =>
        RARITY_ORDER.indexOf(a.def.rarity) - RARITY_ORDER.indexOf(b.def.rarity) ||
        b.count - a.count ||
        a.name.localeCompare(b.name),
    );
  const grid = el("div", "bv-cards");
  if (cards.length === 0) {
    grid.append(el("p", "bv-empty", "Aucune amélioration pour l'instant"));
    return grid;
  }
  for (const { def, name, count } of cards) {
    const color = rarityColor(def.rarity);
    const tile = el("div", `bv-card rarity-${def.rarity}`);
    tile.style.setProperty("--c", color);
    const max = def.max ?? count;
    tile.title = `${name} · niv. ${count}/${max} · ${RARITY_NAMES[def.rarity] || ""} · ${def.desc}`;
    const box = el("div", "bv-cicon");
    box.append(icon(def.icon, color));
    if (count > 1 || compact) box.append(el("span", "bv-count", `${count}`));
    tile.append(box);
    if (!compact) {
      const text = el("div", "bv-ctext");
      text.append(el("b", "", name));
      if (max > 1) text.append(pips(count, max));
      text.append(el("small", "", def.malus ? `${def.desc} · ${def.malus}` : def.desc));
      tile.append(text);
    }
    grid.append(tile);
  }
  // Emplacements de pouvoir encore libres
  for (let i = cards.length; i < POWER_RULES.slots; i++) {
    const empty = el("div", "bv-card empty");
    empty.title = "Emplacement de pouvoir libre";
    empty.append(el("div", "bv-cicon"), compact ? "" : el("div", "bv-ctext", "Libre"));
    grid.append(empty);
  }
  return grid;
}
