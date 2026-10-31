// Fenêtre du Marchand Noir (voir systems/blackMarket.js) : 1) la carte que l'on prend (une légendaire et
// une corrompue tirées par ui/upgradeMenu.js), 2) ce que l'on donne (une carte déjà prise, rendue par
// `removeCard`, ou BLACK_MARKET.hpCost des PV max). ÉCHANGER fait l'affaire, PARTIR la refuse ; dans
// les deux cas le marchand est parti. Au clavier : 1 / 2 choisissent la carte, Entrée échange.

import { BLACK_MARKET, RARITIES } from "../config.js";
import { cardDesc, removeCard, tradeableCards } from "../data/upgrades.js";
import { addStat } from "../services/achievements.js";
import { playSfx } from "../services/sfx.js";
import { addFloatingText } from "../systems/effects.js";
import { RARITY_NAMES } from "./buildView.js";
import { $, el, isVisible } from "./dom.js";
import { icon } from "./icons.js";
import { showScreen } from "./screens.js";

/**
 * @typedef {object} MarketDeal
 * @property {any} p joueur
 * @property {any[]} picks cartes proposées
 * @property {any} reward carte choisie (ou null)
 * @property {string | null} price "hp" ou nom de la carte donnée
 * @property {(u: any) => void} take applique la carte prise
 * @property {() => void} done ferme la fenêtre (choix suivant ou reprise de la partie)
 */

/** @type {MarketDeal | null} */
let deal = null;

export function initBlackMarket() {
  $("btnMarketDeal").addEventListener("click", confirmDeal);
  $("btnMarketLeave").addEventListener("click", () => close("LE MARCHAND HAUSSE LES ÉPAULES"));
  document.addEventListener("keydown", (e) => {
    if (!deal || !isVisible("blackMarket")) return;
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (digit && deal.picks[Number(digit[1]) - 1]) {
      e.preventDefault();
      chooseReward(deal.picks[Number(digit[1]) - 1]);
    } else if (e.key === "Enter" && !e.repeat) {
      e.preventDefault();
      confirmDeal();
    }
  });
}

/** Ouvre l'échange pour le joueur `p` avec les cartes `picks`. */
export function openBlackMarket(p, picks, { take, done }) {
  deal = { p, picks, reward: null, price: null, take, done };
  renderOffers();
  renderPrices();
  refresh();
  showScreen("blackMarket");
}

/** Prix possibles : une part des PV max (s'il en reste assez), ou une carte rendable. */
export function marketPrices(p) {
  const prices = [];
  if (p.maxHealth >= BLACK_MARKET.minHealth) {
    const loss = Math.round(p.maxHealth * BLACK_MARKET.hpCost);
    prices.push({
      id: "hp",
      name: `${Math.round(BLACK_MARKET.hpCost * 100)} % de tes PV max`,
      desc: `-${loss} PV max`,
    });
  }
  for (const { card, count, freesSlot } of tradeableCards(p)) {
    prices.push({
      id: card.name,
      name: count > 1 ? `${card.name} · niv. ${count}` : card.name,
      card,
      freesSlot,
      desc: freesSlot ? "Rends le pouvoir (libère sa place)" : "Perd un niveau",
    });
  }
  return prices;
}

function renderOffers() {
  const list = $("marketOffers");
  list.replaceChildren();
  for (const [i, u] of deal.picks.entries()) {
    const card = el("div", `upgrade-option rarity-${u.rarity}`);
    card.dataset.name = u.name;
    const tag = el("span", "rarity-tag", RARITY_NAMES[u.rarity] || u.rarity);
    tag.style.color = RARITIES[u.rarity].color;
    const info = el("div", "upg-info");
    info.append(el("h4", "", u.name), el("p", "", cardDesc(u, deal.p)));
    if (u.malus) info.append(el("p", "upg-malus", u.malus));
    const ico = el("div", "icon");
    ico.append(icon(u.icon, RARITIES[u.rarity].color));
    card.append(tag, el("span", "upg-key", String(i + 1)), ico, info);
    card.addEventListener("click", () => chooseReward(u));
    list.append(card);
  }
}

function renderPrices() {
  const list = $("marketPrices");
  list.replaceChildren();
  for (const price of marketPrices(deal.p)) {
    const btn = el("button", "market-price secondary");
    btn.dataset.price = price.id;
    btn.dataset.frees = price.freesSlot ? "1" : "";
    const color = price.card ? RARITIES[price.card.rarity].color : "#ff2a6d";
    btn.append(
      icon(price.card ? price.card.icon : "heart", color),
      el("b", "", price.name),
      el("small", "", price.desc),
    );
    btn.addEventListener("click", () => {
      deal.price = price.id;
      refresh();
    });
    list.append(btn);
  }
}

function chooseReward(u) {
  deal.reward = u;
  refresh();
}

/** Nouveau pouvoir alors que les emplacements sont pleins : il faut rendre un pouvoir de niveau 1. */
const needsSlot = (u) => !!u?.power && !u.canApply(deal.p);

/**
 * Surligne la carte et le prix choisis ; ÉCHANGER n'est possible qu'avec les deux. Une carte qui
 * demande une place grise les prix qui n'en libèrent pas.
 */
function refresh() {
  const slot = needsSlot(deal.reward);
  for (const card of $("marketOffers").children) {
    card.classList.toggle("selected", card.dataset.name === deal.reward?.name);
  }
  for (const btn of /** @type {HTMLCollectionOf<HTMLButtonElement>} */ ($("marketPrices").children)) {
    btn.disabled = slot && !btn.dataset.frees;
    if (btn.disabled && btn.dataset.price === deal.price) deal.price = null;
    btn.classList.toggle("selected", btn.dataset.price === deal.price);
  }
  $("marketNote").textContent = slot
    ? "Emplacements de pouvoir pleins : rends un pouvoir pour lui faire place"
    : "";
  /** @type {HTMLButtonElement} */ ($("btnMarketDeal")).disabled = !deal.reward || !deal.price;
}

function confirmDeal() {
  if (!deal?.reward || !deal.price) return;
  const { p, reward, price } = deal;
  if (price === "hp") {
    p.maxHealth *= 1 - BLACK_MARKET.hpCost;
    p.health = Math.min(p.health, p.maxHealth);
  } else if (!removeCard(p, price)) return;
  deal.take(reward);
  addStat("blackMarketDeals");
  playSfx("chest");
  close("MARCHÉ CONCLU !", "#ffd700");
}

function close(text, color = BLACK_MARKET.color) {
  if (!deal) return;
  const { p, done } = deal;
  deal = null;
  addFloatingText(p.worldX, p.worldY - 60, text, color, 18, 90);
  done();
}
