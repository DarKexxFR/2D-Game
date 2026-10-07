// Statistiques de la partie affichées sur l'écran de fin : durée, boss, ennemi le plus tué,
// et dégâts infligés par source (arme, kunai, familier, compétence...).

import { game, pet, player } from "../core/state.js";
import { ENEMY_NAMES } from "../data/enemies.js";
import { ITEMS } from "../data/items.js";
import { heroSkill } from "../systems/skills.js";
import { $, el } from "./dom.js";

const MAX_ROWS = 5;

function sourceName(source) {
  switch (source) {
    case "weapon":
      return player.weapon?.name || "Arme";
    case "kunai":
      return player.evolutions.bladeStorm ? "Tempête de lames" : "Kunai";
    case "pet":
      return ITEMS[pet.kind]?.name || "Familier";
    case "aura":
      return player.evolutions.inferno ? "Enfer" : "Aura de feu";
    case "orbit":
      return "Orbes";
    case "explosion":
      return "Explosions";
    case "thorns":
      return "Épines";
    case "skill":
      return heroSkill().name;
    default:
      return "Autres";
  }
}

export function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Remplit le bloc #runStats avec les chiffres de la partie qui vient de se terminer. */
export function renderRunStats() {
  const { damage, kills, bosses } = game.stats;
  const [topType, topCount] = Object.entries(kills).sort((a, b) => b[1] - a[1])[0] || [null, 0];

  const tiles = el("div", "run-tiles");
  const tile = (value, label) => {
    const t = el("div", "run-tile");
    t.append(el("b", "", value), el("span", "", label));
    return t;
  };
  tiles.append(
    tile(formatDuration(game.time), "Durée"),
    tile(bosses, "Boss vaincus"),
    tile(`×${game.stats.bestCombo}`, "Meilleur combo"),
    tile(topType ? `${topCount}×` : "—", topType ? ENEMY_NAMES[topType] || topType : "Ennemi favori"),
  );

  const rows = Object.entries(damage)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ROWS);
  const best = rows[0]?.[1] || 1;
  const list = el("div", "dmg-list");
  for (const [source, value] of rows) {
    const row = el("div", "dmg-row");
    row.dataset.source = source;
    const bar = el("div", "dmg-bar");
    const fill = el("div");
    fill.style.width = `${(value / best) * 100}%`;
    bar.append(fill);
    row.append(el("span", "", sourceName(source)), bar, el("em", "", formatNumber(value)));
    list.append(row);
  }
  $("runStats").replaceChildren(tiles, ...(rows.length ? [list] : []));
}

function formatNumber(n) {
  return n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
}
