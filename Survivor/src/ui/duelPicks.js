// Duel sur un écran : choix d'amélioration dans la moitié d'écran du joueur. Seule sa partie
// s'arrête le temps du choix ; au-delà de quelques secondes, la carte surlignée est prise.
// Clavier : J1 Q / D (ou A / D) pour choisir, ESPACE pour valider ; J2 ← / → puis ENTRÉE.

import { RARITIES, TICK_MS, VERSUS } from "../config.js";
import { game, player } from "../core/state.js";
import { applyUpgrade } from "../data/upgrades.js";
import { addStat } from "../services/achievements.js";
import { heal } from "../systems/player.js";
import { VERSUS_KEYS, fighterName, versus, withRun } from "../systems/versus.js";
import { $, el, setVisible } from "./dom.js";
import { icon } from "./icons.js";
import { chestGold, drawChoices } from "./upgradeMenu.js";

const CONFIRM_DELAY_MS = 350; // un dash en cours ne doit pas valider la carte

const picks = [0, 1].map(() => ({ queue: [], cards: null, selected: 0, ticks: 0, shownAt: 0 }));

export function initDuelPicks() {
  document.addEventListener("keydown", onKey);
}

export function resetDuelPicks() {
  for (const [i, p] of picks.entries()) {
    Object.assign(p, { queue: [], cards: null, selected: 0 });
    setVisible(`duelPick${i + 1}`, false);
  }
}

/** Montée de niveau ou coffre de boss du joueur `i` (appelé pendant le tick de sa partie). */
export function requestDuelPick(i, kind) {
  const p = picks[i];
  withRun(i, () => {
    game.running = false;
    game.paused = true;
  });
  p.queue.push(kind);
  if (!p.cards) open(i);
}

/** Tick d'une partie arrêtée sur un choix : la carte surlignée est prise à la fin du temps. */
export function tickDuelPick(i) {
  const p = picks[i];
  if (!p.cards) return;
  p.ticks++;
  const total = (VERSUS.pickSeconds * 1000) / TICK_MS;
  const fill = $(`duelPick${i + 1}`).querySelector(".pick-timer div");
  fill.style.width = `${Math.max(0, 1 - p.ticks / total) * 100}%`;
  if (p.ticks >= total) choose(i, p.selected);
}

function open(i) {
  const p = picks[i];
  const kind = p.queue.shift();
  const box = $(`duelPick${i + 1}`);
  const cards = withRun(i, () => {
    const list = drawChoices(kind, player);
    let gold = 0;
    if (kind === "chest") game.runGold += gold = chestGold();
    if (list.length === 0) heal(50); // plus rien à proposer : soin de secours
    box.querySelector(".dp-sub").textContent =
      kind === "chest"
        ? `Coffre de boss · +${gold} or`
        : kind === "shrine"
          ? "Sanctuaire maudit · choisis une carte"
          : `Niveau ${player.level} · choisis une amélioration`;
    return list.map((u) => ({ u, level: player.inventory[u.name] || 0 }));
  });
  if (cards.length === 0) return next(i);

  Object.assign(p, { cards, selected: 0, ticks: 0, shownAt: performance.now() });
  box.querySelector(".dp-title").textContent = fighterName(i);
  box.querySelector(".dp-title").style.color = VERSUS.colors[i];
  const list = box.querySelector(".dp-cards");
  list.replaceChildren();
  for (const [n, { u, level }] of cards.entries()) {
    const card = el("div", `dp-card rarity-${u.rarity}`);
    const color = RARITIES[u.rarity]?.color || "#fff";
    const ico = el("div", "icon");
    ico.append(icon(u.icon, color));
    const info = el("div", "dp-info");
    info.append(el("h4", "", level > 0 ? `${u.name} · niv. ${level + 1}` : u.name), el("p", "", u.desc));
    if (u.malus) info.append(el("p", "upg-malus", u.malus));
    card.style.borderColor = color;
    card.append(ico, info);
    card.addEventListener("click", () => choose(i, n));
    list.append(card);
  }
  select(i, 0);
  setVisible(`duelPick${i + 1}`, true);
}

function select(i, n) {
  const p = picks[i];
  p.selected = n;
  const cards = $(`duelPick${i + 1}`).querySelector(".dp-cards").children;
  for (let k = 0; k < cards.length; k++) cards[k].classList.toggle("selected", k === n);
}

function choose(i, n) {
  const p = picks[i];
  const pick = p.cards?.[n];
  if (!pick || versus.winner !== null) return;
  p.cards = null;
  withRun(i, () => {
    applyUpgrade(pick.u, player);
    if (pick.u.rarity === "evolution") addStat("evolutions");
  });
  next(i);
}

/** Choix suivant en attente, sinon la partie reprend. */
function next(i) {
  if (picks[i].queue.length > 0) return open(i);
  setVisible(`duelPick${i + 1}`, false);
  withRun(i, () => {
    if (game.over) return;
    game.running = true;
    game.paused = false;
  });
}

function onKey(e) {
  if (!versus.split || versus.paused) return;
  const key = e.code === "Space" ? "space" : e.key.toLowerCase();
  for (const [i, p] of picks.entries()) {
    if (!p.cards) continue;
    const keys = VERSUS_KEYS[i];
    const count = p.cards.length;
    if (keys.left.includes(key) || keys.up.includes(key)) select(i, (p.selected - 1 + count) % count);
    else if (keys.right.includes(key) || keys.down.includes(key)) select(i, (p.selected + 1) % count);
    else if (keys.dash.includes(key) && !e.repeat && performance.now() - p.shownAt >= CONFIRM_DELAY_MS)
      choose(i, p.selected);
  }
}
