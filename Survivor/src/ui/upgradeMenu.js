// Choix d'une amélioration : à la montée de niveau (tirage pondéré par rareté)
// ou à l'ouverture d'un coffre de boss (raretés supérieures + or bonus).

import { BOSS_CHEST, RARITIES } from "../config.js";
import { game, player } from "../core/state.js";
import { applyUpgrade, availableEvolutions, availableUpgrades } from "../data/upgrades.js";
import { addStat } from "../services/achievements.js";
import { heal } from "../systems/player.js";
import { weightedPick } from "../utils/math.js";
import { $, el, setClass, setText } from "./dom.js";
import { icon } from "./icons.js";
import { hideScreens, showScreen } from "./screens.js";

const CHOICES = 3;
const RARITY_NAMES = {
  common: "Commun",
  rare: "Rare",
  epic: "Épique",
  legendary: "Légendaire",
  evolution: "Évolution",
};

/** Choix en attente (un coffre ramassé pendant qu'un autre choix est affiché, par exemple). */
const queue = [];
let current = null; // "level" | "chest"

function drawUpgrades(count, kind = current) {
  const chest = kind === "chest";
  // Coffre de boss : pas de cartes communes, raretés hautes favorisées
  const pool = availableUpgrades(player).filter((u) => !chest || u.rarity !== "common");
  const weight = (u) => (chest ? BOSS_CHEST.weights[u.rarity] : RARITIES[u.rarity]?.weight) ?? 10;
  const picks = availableEvolutions(player).slice(0, 1); // une évolution prête passe en premier
  while (picks.length < count && pool.length > 0) {
    const pick = weightedPick(pool, weight);
    picks.push(pick);
    pool.splice(pool.indexOf(pick), 1); // pas de doublon
  }
  return picks;
}

function resume() {
  current = null;
  if (queue.length > 0) return open(queue.shift());
  hideScreens();
  game.running = true;
  game.paused = false;
}

export function initUpgradeMenu() {
  // Talent « Relance » : retire de nouvelles cartes
  $("btnReroll").addEventListener("click", () => {
    if (player.rerolls <= 0) return;
    player.rerolls--;
    renderChoices(drawUpgrades(CHOICES));
  });
}

/** Nouvelle partie : oublie les choix en attente de la précédente. */
export function resetUpgradeMenu() {
  queue.length = 0;
  current = null;
}

/** Montée de niveau. */
export function showUpgradeMenu() {
  request("level");
}

/** Coffre lâché par un boss : une augmentation au choix + de l'or. */
export function showBossChest() {
  request("chest");
}

function request(kind) {
  if (current) queue.push(kind);
  else open(kind);
}

function open(kind) {
  current = kind;
  const picks = drawUpgrades(CHOICES, kind);
  const chest = kind === "chest";
  let gold = 0;
  if (chest) {
    gold = BOSS_CHEST.gold + game.wave * BOSS_CHEST.goldPerWave;
    game.runGold += gold;
  }
  if (picks.length === 0) {
    heal(50); // soin de secours si plus rien n'est disponible
    current = null;
    if (queue.length > 0) open(queue.shift());
    return;
  }

  game.running = false;
  game.paused = true;
  setText("upgradeTitle", chest ? "COFFRE DE BOSS" : "CHOISISSEZ !");
  setText("upgradeSubtitle", chest ? `+${gold} or · choisis une augmentation` : "");
  setClass("upgradeMenu", "boss-chest", chest);
  renderChoices(picks);
  showScreen("upgradeMenu");
}

function renderChoices(picks) {
  $("btnReroll").textContent = player.rerolls > 0 ? `RELANCER (${player.rerolls})` : "";
  const options = $("upgradeOptions");
  options.replaceChildren();

  for (const u of picks) {
    const card = el("div", `upgrade-option rarity-${u.rarity}`);
    const tag = el("span", "rarity-tag", RARITY_NAMES[u.rarity] || u.rarity);
    tag.style.color = RARITIES[u.rarity].color;
    const info = el("div", "upg-info");
    const level = player.inventory[u.name] || 0;
    info.append(el("h4", "", level > 0 ? `${u.name} · niv. ${level + 1}` : u.name), el("p", "", u.desc));
    if (u.recipe) info.append(el("p", "upg-recipe", `Évolution : ${u.recipe}`));
    const ico = el("div", "icon");
    ico.append(icon(u.icon, RARITIES[u.rarity].color));
    card.append(tag, ico, info);
    card.addEventListener("click", () => {
      applyUpgrade(u, player);
      if (u.rarity === "evolution") addStat("evolutions");
      resume();
    });
    options.append(card);
  }
}
