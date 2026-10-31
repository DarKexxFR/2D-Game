// Recyclage mythique dans l'écran Équipement : démantèlement des doublons légendaires (dans la Forge)
// et attributs de Pulse d'un objet mythique (dans sa fiche). Règles dans data/pulseShards.js,
// logique dans services/inventory.js.

import { ITEMS } from "../data/items.js";
import { AFFIX_IDS, AFFIX_RULES, DISMANTLE, MYTHIC_AFFIXES } from "../data/pulseShards.js";
import { affixesOf, dismantle, dismantleSources, rerollAffix, targetAffix } from "../services/inventory.js";
import { playSfx } from "../services/sfx.js";
import { account } from "../services/storage.js";
import { el } from "./dom.js";
import { icon, setLabel } from "./icons.js";
import { itemIcon } from "./itemView.js";

const SHARD_COLOR = "#ff3b30";

/** Pastille « ◆ n » des Éclats de Pulse. */
export function shardPill(className = "shard-pill") {
  const pill = el("span", className);
  pill.append(icon("gem", SHARD_COLOR), el("span", "shard-count", String(account.pulseShards)));
  return pill;
}

/** Libellé d'un bouton avec son prix en éclats. */
function shardLabel(btn, text, cost) {
  return setLabel(btn, `${text} ${cost} `, "gem", { color: SHARD_COLOR });
}

/**
 * Bloc « Démantèlement » de la Forge pour l'emplacement ouvert : un doublon légendaire = des éclats.
 * @param {string} slot
 * @param {() => void} refresh
 */
export function dismantleSection(slot, refresh) {
  const box = el("div", "dismantle");
  const head = el("div", "dismantle-head");
  head.append(el("h4", "dismantle-title", "DÉMANTÈLEMENT"), shardPill());
  box.append(
    head,
    el(
      "p",
      "forge-sub",
      `Un doublon légendaire = ${DISMANTLE.shards} Éclats de Pulse, pour relancer ou cibler les attributs d'un objet mythique.`,
    ),
  );
  const sources = dismantleSources().filter((it) => it.slot === slot);
  if (sources.length === 0) box.append(el("p", "dismantle-empty", "Aucun doublon légendaire ici."));
  for (const it of sources) {
    const row = el("div", "dismantle-row");
    row.dataset.item = it.id;
    const name = el("span", "dismantle-name");
    name.append(itemIcon(it, "dismantle-icon"), el("span", "", `${it.name} ×${account.items[it.id].copies}`));
    const btn = shardLabel(el("button", "dismantle-btn"), "+", DISMANTLE.shards);
    btn.addEventListener("click", () => {
      if (dismantle(it.id) === 0) return;
      playSfx("pickup");
      refresh();
    });
    row.append(name, btn);
    box.append(row);
  }
  return box;
}

/**
 * Attributs de Pulse d'un objet mythique possédé (fiche de l'objet), ou null pour les autres objets.
 * @param {string} id
 * @param {() => void} refresh
 */
export function affixPanel(id, refresh) {
  const affixes = affixesOf(id);
  if (!affixes || ITEMS[id].rarity !== AFFIX_RULES.rarity) return null;
  const box = el("div", "affix-panel");
  const head = el("div", "dismantle-head");
  head.append(el("b", "affix-title", "ATTRIBUTS DE PULSE"), shardPill());
  box.append(head);
  affixes.forEach((current, slot) => {
    const row = el("div", "affix-row");
    row.dataset.slot = String(slot);
    const a = current && MYTHIC_AFFIXES[current];
    row.append(
      el("span", `affix-name${a ? "" : " empty"}`, a ? `${a.name} : ${a.text}` : "Emplacement vide"),
    );

    const reroll = shardLabel(
      el("button", "affix-reroll"),
      a ? "RELANCER" : "IMPRÉGNER",
      AFFIX_RULES.cost.reroll,
    );
    reroll.disabled = account.pulseShards < AFFIX_RULES.cost.reroll;
    reroll.addEventListener("click", () => {
      if (!rerollAffix(id, slot)) return;
      playSfx("levelUp");
      refresh();
    });

    const pick = /** @type {HTMLSelectElement} */ (el("select", "affix-select"));
    pick.setAttribute("aria-label", "Attribut à cibler");
    for (const aid of AFFIX_IDS) {
      if (aid === current || affixes.includes(aid)) continue;
      const opt = /** @type {HTMLOptionElement} */ (el("option", "", MYTHIC_AFFIXES[aid].text));
      opt.value = aid;
      pick.append(opt);
    }
    const target = shardLabel(el("button", "affix-target"), "CIBLER", AFFIX_RULES.cost.target);
    target.disabled = account.pulseShards < AFFIX_RULES.cost.target;
    target.addEventListener("click", () => {
      if (!targetAffix(id, slot, pick.value)) return;
      playSfx("levelUp");
      refresh();
    });
    const actions = el("div", "affix-actions");
    actions.append(reroll, pick, target);
    row.append(actions);
    box.append(row);
  });
  return box;
}
