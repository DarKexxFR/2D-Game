// Écran Talents : achat de bonus permanents avec l'or de la banque.

import { TALENTS, talentCost } from "../data/talents.js";
import { account, buyTalent } from "../services/storage.js";
import { playSfx } from "../services/sfx.js";
import { $, el, setText } from "./dom.js";
import { icon, setLabel } from "./icons.js";
import { showScreen } from "./screens.js";

let onChange = () => {};

export function initTalentMenu({ onBack, onChange: changed }) {
  onChange = changed;
  $("btnTalents").addEventListener("click", openTalents);
  $("btnTalentsBack").addEventListener("click", onBack);
}

export function openTalents() {
  renderTalents();
  showScreen("talentMenu");
}

function renderTalents() {
  setText("talentGoldDisplay", account.gold);
  $("talentList").replaceChildren(...TALENTS.map(talentCard));
}

function talentCard(t) {
  const rank = account.talents[t.id] || 0;
  const maxed = rank >= t.max;
  const card = el("div", `talent-card${maxed ? " maxed" : ""}`);
  card.dataset.talent = t.id;

  const info = el("div");
  const pips = el("div", "talent-pips");
  for (let i = 0; i < t.max; i++) pips.append(el("span", i < rank ? "on" : ""));
  info.append(
    el("h4", "", `${t.name} ${rank}/${t.max}`),
    el("p", "", rank > 0 ? `Actuel : ${t.desc(rank)}` : t.desc(1)),
    pips,
  );

  const btn = el("button", maxed ? "secondary" : "", "MAX");
  if (!maxed) {
    const cost = talentCost(t, rank);
    setLabel(btn, `▲ ${cost} `, "coin", { color: "#ffd700" });
    btn.disabled = account.gold < cost;
    btn.addEventListener("click", () => {
      if (!buyTalent(t, cost)) return;
      playSfx("levelUp");
      onChange();
      renderTalents();
    });
  } else {
    btn.disabled = true;
  }
  card.append(icon(t.icon), info, btn);
  return card;
}
