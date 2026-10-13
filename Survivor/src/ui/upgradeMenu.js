// Choix d'une amélioration : à la montée de niveau (tirage pondéré par rareté),
// à l'ouverture d'un coffre de boss (raretés supérieures + or bonus)
// ou après une mort en duel (le joueur qui meurt choisit plusieurs améliorations).

import { BOSS_CHEST, RARITIES } from "../config.js";
import { bindingsOf } from "../core/input.js";
import { game, player } from "../core/state.js";
import { applyUpgrade, availableEvolutions, availableUpgrades } from "../data/upgrades.js";
import { addStat } from "../services/achievements.js";
import { heal } from "../systems/player.js";
import { weightedPick } from "../utils/math.js";
import { $, el, isVisible, setClass, setText } from "./dom.js";
import { icon } from "./icons.js";
import { hideScreens, showScreen } from "./screens.js";
import { isTouchDevice } from "./touchControls.js";

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
// Choix affiché : { kind: "level" | "chest" | "versus" | "remote", target (joueur qui reçoit), title, subtitle }
let current = null;
// Choix au clavier : carte surlignée, et heure d'affichage (un dash en cours ne doit pas valider)
let selected = 0;
let shownAt = 0;
const CONFIRM_DELAY_MS = 350;

function drawUpgrades(count, req = current) {
  const chest = req.kind === "chest";
  const p = req.target;
  // Coffre de boss : pas de cartes communes ; duel : pas de cartes inutiles contre un joueur
  const allowed = (u) => (!chest || u.rarity !== "common") && !(req.kind === "versus" && u.noVersus);
  const pool = availableUpgrades(p).filter(allowed);
  const weight = (u) => (chest ? BOSS_CHEST.weights[u.rarity] : RARITIES[u.rarity]?.weight) ?? 10;
  const picks = availableEvolutions(p).filter(allowed).slice(0, 1); // une évolution prête passe en premier
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
    if (!current || current.target.rerolls <= 0) return;
    current.target.rerolls--;
    renderChoices(drawUpgrades(CHOICES));
  });
  document.addEventListener("keydown", onKey);
}

/**
 * Choix sans souris : 1 / 2 / 3 prennent directement une carte, flèches (ou ZQSD) déplacent la
 * sélection, Entrée / Espace la valident. Marche aussi pour le duel (touches des deux joueurs).
 */
function onKey(e) {
  if (!current || !isVisible("upgradeMenu") || e.target.matches?.("input, textarea")) return;
  const cards = [...$("upgradeOptions").children];
  if (cards.length === 0) return;
  const key = e.code === "Space" ? "space" : e.key.toLowerCase();
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  const is = (action) => bindingsOf(action).includes(key);
  if (digit) {
    const card = cards[Number(digit[1]) - 1];
    if (!card) return;
    e.preventDefault();
    if (!e.repeat) card.click();
  } else if (is("up") || is("left") || key === "arrowup" || key === "arrowleft") {
    e.preventDefault();
    select((selected - 1 + cards.length) % cards.length);
  } else if (is("down") || is("right") || key === "arrowdown" || key === "arrowright") {
    e.preventDefault();
    select((selected + 1) % cards.length);
  } else if (key === "enter" || key === "space" || is("dash")) {
    e.preventDefault();
    if (!e.repeat && performance.now() - shownAt >= CONFIRM_DELAY_MS) cards[selected]?.click();
  }
}

/** Surligne la carte `index` (`show` : rendre la sélection visible, même sur écran tactile). */
function select(index, show = true) {
  selected = index;
  const cards = $("upgradeOptions").children;
  for (let i = 0; i < cards.length; i++) cards[i].classList.toggle("selected", show && i === index);
}

/** Nouvelle partie : oublie les choix en attente de la précédente. */
export function resetUpgradeMenu() {
  queue.length = 0;
  current = null;
}

/** Montée de niveau. */
export function showUpgradeMenu() {
  request({ kind: "level", target: player });
}

/** Coffre lâché par un boss : une augmentation au choix + de l'or. */
export function showBossChest() {
  request({ kind: "chest", target: player });
}

/** Duel : `count` améliorations d'affilée pour le joueur `target` (affiché sous le nom `name`). */
export function showVersusUpgrades(target, count, name) {
  for (let i = 0; i < count; i++) {
    request({ kind: "versus", target, title: name, subtitle: `Amélioration ${i + 1}/${count}` });
  }
}

/** Duel en ligne (hôte) : tire les cartes proposées à l'invité. */
export function drawVersusChoices(target) {
  return drawUpgrades(CHOICES, { kind: "versus", target });
}

/**
 * Duel en ligne (invité) : affiche des cartes tirées par l'hôte ; `onPick(carte)` envoie le choix.
 * La partie n'est pas mise en pause ici : c'est l'hôte qui l'arrête pour les deux joueurs.
 */
export function showRemoteChoices(picks, { title, subtitle, target, onPick }) {
  current = { kind: "remote", target, onPick };
  setText("upgradeTitle", title);
  setText("upgradeSubtitle", subtitle);
  setClass("upgradeMenu", "boss-chest", false);
  renderChoices(picks);
  showScreen("upgradeMenu");
}

function request(req) {
  if (current) queue.push(req);
  else open(req);
}

function open(req) {
  current = req;
  const picks = drawUpgrades(CHOICES, req);
  const chest = req.kind === "chest";
  let gold = 0;
  if (chest) {
    gold = BOSS_CHEST.gold + game.wave * BOSS_CHEST.goldPerWave;
    game.runGold += gold;
  }
  if (picks.length === 0) {
    // soin de secours si plus rien n'est disponible
    if (req.target === player) heal(50);
    else req.target.health = Math.min(req.target.maxHealth, req.target.health + 50);
    current = null;
    if (queue.length > 0) open(queue.shift());
    return;
  }

  game.running = false;
  game.paused = true;
  setText("upgradeTitle", req.title ?? (chest ? "COFFRE DE BOSS" : "CHOISISSEZ !"));
  setText("upgradeSubtitle", req.subtitle ?? (chest ? `+${gold} or · choisis une augmentation` : ""));
  setClass("upgradeMenu", "boss-chest", chest);
  renderChoices(picks);
  showScreen("upgradeMenu");
}

function renderChoices(picks) {
  const p = current.target;
  $("btnReroll").textContent = p.rerolls > 0 ? `RELANCER (${p.rerolls})` : "";
  const options = $("upgradeOptions");
  options.replaceChildren();
  shownAt = performance.now();

  for (const [i, u] of picks.entries()) {
    const card = el("div", `upgrade-option rarity-${u.rarity}`);
    const tag = el("span", "rarity-tag", RARITY_NAMES[u.rarity] || u.rarity);
    tag.style.color = RARITIES[u.rarity].color;
    const info = el("div", "upg-info");
    const level = p.inventory[u.name] || 0;
    info.append(el("h4", "", level > 0 ? `${u.name} · niv. ${level + 1}` : u.name), el("p", "", u.desc));
    if (u.recipe) info.append(el("p", "upg-recipe", `Évolution : ${u.recipe}`));
    const ico = el("div", "icon");
    ico.append(icon(u.icon, RARITIES[u.rarity].color));
    const key = el("span", "upg-key", String(i + 1));
    card.append(tag, key, ico, info);
    card.addEventListener("mouseenter", () => select(i));
    card.addEventListener("click", () => {
      if (current.onPick) {
        const send = current.onPick;
        current = null;
        hideScreens();
        return send(u);
      }
      applyUpgrade(u, p);
      if (u.rarity === "evolution" && current.kind !== "versus") addStat("evolutions");
      resume();
    });
    options.append(card);
  }
  // Première carte surlignée d'office au clavier ; sur écran tactile, seulement si on utilise un clavier
  select(0, !isTouchDevice);
}
