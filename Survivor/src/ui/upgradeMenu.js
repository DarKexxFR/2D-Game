// Choix d'une amélioration : à la montée de niveau (tirage pondéré par rareté)
// ou à l'ouverture d'un coffre de boss (raretés supérieures + or bonus).

import { BOSS_CHEST, RARITIES, VERSUS } from "../config.js";
import { bindingsOf } from "../core/input.js";
import { game, player } from "../core/state.js";
import {
  POWER_RULES,
  applyUpgrade,
  availableEvolutions,
  availableUpgrades,
  cardDesc,
  evolutionsFor,
  ownedPowers,
} from "../data/upgrades.js";
import { addStat, recordBest } from "../services/achievements.js";
import { heal } from "../systems/player.js";
import { weightedPick } from "../utils/math.js";
import { RARITY_NAMES } from "./buildView.js";
import { $, el, isVisible, setClass, setText, setVisible } from "./dom.js";
import { icon } from "./icons.js";
import { hideScreens, showScreen } from "./screens.js";
import { isTouchDevice } from "./touchControls.js";

const CHOICES = 3;

// Cartes autorisées selon l'origine du choix : un coffre de boss ne propose ni commune ni corrompue,
// un sanctuaire maudit seulement des rares et des épiques.
const ALLOWED = {
  level: () => true,
  chest: (u) => u.rarity !== "common" && u.rarity !== "corrupted",
  shrine: (u) => u.rarity === "rare" || u.rarity === "epic",
};

// Cartes de secours : proposées seulement quand les pouvoirs, armes et évolutions ne suffisent plus à
// remplir le choix (tout est au maximum). Ni pouvoir ni emplacement : rien n'est noté dans l'inventaire.
const F = POWER_RULES.filler;
export const FILLER_CARDS = [
  {
    name: "Réparation",
    rarity: "common",
    icon: "heartPlus",
    desc: `Soigne ${Math.round(F.heal * 100)}% de vos PV max`,
    filler: true,
    apply: (p) => heal(p.maxHealth * F.heal),
  },
  {
    name: "Butin",
    rarity: "common",
    icon: "coin",
    desc: "Or immédiat (plus à chaque vague)",
    describe: () => `+${fillerGold()} or`,
    filler: true,
    apply: () => (game.runGold += fillerGold()),
  },
];
const fillerGold = () => F.gold + game.wave * F.goldPerWave;

/** Choix en attente (un coffre ramassé pendant qu'un autre choix est affiché, par exemple). */
const queue = [];
// Choix affiché : { kind: "level" | "chest" | "shrine", target (joueur qui reçoit) }
let current = null;
// Duel en ligne : choix automatique au bout de quelques secondes (l'adversaire, lui, continue)
let autoPick = false;
let autoPickTimer = null;
// Choix au clavier : carte surlignée, et heure d'affichage (un dash en cours ne doit pas valider)
let selected = 0;
let shownAt = 0;
const CONFIRM_DELAY_MS = 350;

function drawUpgrades(count, req = current) {
  const chest = req.kind === "chest";
  const p = req.target;
  const allowed = ALLOWED[req.kind];
  const pool = availableUpgrades(p).filter(allowed);
  const weight = (u) => (chest ? BOSS_CHEST.weights[u.rarity] : RARITIES[u.rarity]?.weight) ?? 10;
  const picks = availableEvolutions(p).filter(allowed).slice(0, 1); // une évolution prête passe en premier
  while (picks.length < count && pool.length > 0) {
    const pick = weightedPick(pool, weight);
    picks.push(pick);
    pool.splice(pool.indexOf(pick), 1); // pas de doublon
  }
  for (const filler of FILLER_CARDS) if (picks.length < count) picks.push(filler);
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
    const picks = drawUpgrades(CHOICES);
    current.picks = picks.map((u) => u.name);
    renderChoices(picks);
  });
  document.addEventListener("keydown", onKey);
}

/**
 * Choix sans souris : 1 / 2 / 3 prennent directement une carte, flèches (ou ZQSD) déplacent la
 * sélection, Entrée / Espace la valident.
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
  clearTimeout(autoPickTimer);
}

/** Duel en ligne : au-delà de `VERSUS.pickSeconds`, la carte surlignée est prise. */
export function setAutoPick(enabled) {
  autoPick = enabled;
}

/** Tirage des cartes proposées à `target` (duel sur un écran : voir ui/duelPicks.js). */
export function drawChoices(kind, target) {
  return drawUpgrades(CHOICES, { kind, target });
}

/** Or d'un coffre de boss à la vague en cours. */
export function chestGold() {
  return BOSS_CHEST.gold + game.wave * BOSS_CHEST.goldPerWave;
}

/** Montée de niveau. */
export function showUpgradeMenu() {
  request({ kind: "level", target: player });
}

/** Coffre lâché par un boss : une augmentation au choix + de l'or. */
export function showBossChest() {
  request({ kind: "chest", target: player });
}

/** Sanctuaire maudit réussi : une carte rare ou épique au choix. */
export function showShrineReward() {
  request({ kind: "shrine", target: player });
}

function request(req) {
  // Mort dans le même tick (gemme ramassée, coffre...) : le choix attend, il ne doit pas recouvrir
  // l'écran de fin ni relancer une partie terminée. Repris si une pub ramène à la vie.
  if (current || game.over) queue.push(req);
  else open(req);
}

/**
 * Mort du joueur : le choix affiché (ouvert plus tôt dans le même tick) est remis en tête de la file
 * d'attente. Sinon il restait « en cours » derrière l'écran de fin et bloquait les suivants.
 */
export function holdUpgrades() {
  clearTimeout(autoPickTimer);
  if (current) queue.unshift(current);
  current = null;
}

/** Retour à la vie (pub) : propose les choix mis de côté à la mort. */
export function resumeUpgrades() {
  if (!current && queue.length > 0) open(queue.shift());
}

function open(req) {
  current = req;
  const picks = restoredPicks(req) ?? drawUpgrades(CHOICES, req);
  req.picks = picks.map((u) => u.name);
  const chest = req.kind === "chest";
  // Or du coffre compté une seule fois (un choix repris après une partie interrompue l'a déjà donné)
  if (chest && req.gold === undefined) {
    req.gold = chestGold();
    game.runGold += req.gold;
  }
  const gold = req.gold ?? 0;
  if (picks.length === 0) {
    // soin de secours si plus rien n'est disponible
    heal(50);
    current = null;
    if (queue.length > 0) open(queue.shift());
    return;
  }

  game.running = false;
  game.paused = true;
  const shrine = req.kind === "shrine";
  setText("upgradeTitle", chest ? "COFFRE DE BOSS" : shrine ? "SANCTUAIRE MAUDIT" : "CHOISISSEZ !");
  setText(
    "upgradeSubtitle",
    chest
      ? `+${gold} or · choisis une augmentation`
      : shrine
        ? "Défi relevé · choisis une carte"
        : powerSlotsText(req.target),
  );
  setClass("upgradeMenu", "boss-chest", chest);
  setClass("upgradeMenu", "cursed-reward", shrine);
  renderChoices(picks);
  showScreen("upgradeMenu");
  startAutoPick();
}

// --- PARTIE INTERROMPUE (voir services/runSave.js) ---

/**
 * Choix d'amélioration en attente, à sauvegarder avec la partie : celui affiché (avec ses cartes, pour
 * qu'interrompre la partie ne serve pas à retirer d'autres cartes) puis la file d'attente.
 * @returns {{ kind: string, gold?: number, picks?: string[] }[]}
 */
export function pendingChoices() {
  return [current, ...queue]
    .filter((req) => req && req.target === player)
    .map(({ kind, gold, picks }) => ({ kind, gold, picks }));
}

/** Reprise d'une partie : rouvre les choix sauvegardés. Renvoie true si un choix est affiché. */
export function restoreChoices(list = []) {
  resetUpgradeMenu();
  for (const { kind, gold, picks } of list) {
    if (ALLOWED[kind]) queue.push({ kind, gold, picks, target: player });
  }
  if (queue.length > 0) open(queue.shift());
  return current !== null;
}

/** Cartes déjà tirées pour ce choix (partie reprise), si elles sont toujours disponibles. */
function restoredPicks(req) {
  if (!req.picks?.length) return null;
  const cards = [...availableEvolutions(req.target), ...availableUpgrades(req.target), ...FILLER_CARDS];
  const picks = req.picks.map((name) => cards.find((u) => u.name === name));
  return picks.every(Boolean) ? picks : null;
}

/** Barre qui se vide, puis choix de la carte surlignée (duel en ligne seulement). */
function startAutoPick() {
  clearTimeout(autoPickTimer);
  const timer = $("upgradeTimer");
  const autoPickMs = autoPick ? VERSUS.pickSeconds * 1000 : 0;
  setVisible("upgradeTimer", autoPick);
  if (!autoPick) return;
  const fill = timer.firstElementChild;
  fill.style.transition = "none";
  fill.style.width = "100%";
  void fill.offsetWidth; // relance la transition
  fill.style.transition = `width ${autoPickMs}ms linear`;
  fill.style.width = "0%";
  const req = current;
  autoPickTimer = setTimeout(
    () => current === req && $("upgradeOptions").children[selected]?.click(),
    autoPickMs,
  );
}

/**
 * Bas de carte : icône (et nom) des évolutions que cette carte rapproche, quand l'autre ingrédient de
 * la recette est déjà possédé (ex. Perçage avec le Railgun équipé → Lance ionique).
 */
export function evolutionHint(u, p) {
  const evos = evolutionsFor(u, p);
  if (evos.length === 0) return null;
  const color = RARITIES.evolution.color;
  const hint = el("div", "upg-evo");
  hint.title = evos.map((e) => `${e.name} (${e.recipe})`).join("\n");
  for (const e of evos) {
    const tag = el("span", "upg-evo-item");
    tag.append(icon(e.icon, color), el("span", "", e.name));
    hint.append(tag);
  }
  return hint;
}

/** « Pouvoirs 4/6 », ou le rappel que seuls les pouvoirs possédés montent encore. */
export function powerSlotsText(p) {
  const n = ownedPowers(p).length;
  return n >= POWER_RULES.slots
    ? `Pouvoirs ${n}/${POWER_RULES.slots} · améliore ceux que tu as`
    : `Pouvoirs ${n}/${POWER_RULES.slots}`;
}

/** Titre d'une carte : nom, puis le niveau visé pour un pouvoir déjà possédé (« niv. 3/5 »). */
export function cardTitle(u, p) {
  const level = p.inventory[u.name] || 0;
  if (level === 0) return u.power && u.max > 1 ? `${u.name} · nouveau` : u.name;
  return u.max ? `${u.name} · niv. ${level + 1}/${u.max}` : `${u.name} · niv. ${level + 1}`;
}

/** Carte choisie : appliquée au joueur `p`, puis comptée pour les succès (évolutions, armes d'appoint). */
export function takeCard(u, p) {
  applyUpgrade(u, p);
  if (u.rarity === "evolution") addStat("evolutions");
  if (u.rarity === "fusion") addStat("fusions");
  if (u.sideWeapon) recordBest("bestSideWeapons", p.sideWeapons.length);
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
    info.append(el("h4", "", cardTitle(u, p)), el("p", "", cardDesc(u, p)));
    if (u.malus) info.append(el("p", "upg-malus", u.malus));
    if (u.recipe)
      info.append(el("p", "upg-recipe", `${u.rarity === "fusion" ? "Fusion" : "Évolution"} : ${u.recipe}`));
    const hint = evolutionHint(u, p);
    if (hint) info.append(hint);
    const ico = el("div", "icon");
    ico.append(icon(u.icon, RARITIES[u.rarity].color));
    const key = el("span", "upg-key", String(i + 1));
    card.append(tag, key, ico, info);
    card.addEventListener("mouseenter", () => select(i));
    card.addEventListener("click", () => {
      if (!current) return;
      clearTimeout(autoPickTimer);
      takeCard(u, p);
      resume();
    });
    options.append(card);
  }
  // Première carte surlignée d'office au clavier ; sur écran tactile, seulement si on utilise un clavier
  select(0, !isTouchDevice);
}
