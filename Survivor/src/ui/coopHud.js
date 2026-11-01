// Coop en partie : panneau de l'équipe (vie de chaque joueur, à terre, parti) et bandeau d'attente quand
// un coéquipier choisit une amélioration (la partie l'attend).

import { game } from "../core/state.js";
import { memberObj, party } from "../systems/party.js";
import { $, el, setText, setVisible } from "./dom.js";

const REFRESH_MS = 150;
let last = 0;
let rows = [];

export function showCoopHud(on) {
  setVisible("coopParty", on);
  document.body.classList.toggle("coop-run", on);
  if (!on) setVisible("coopWait", false);
  rows = [];
  last = 0;
  if (on) buildRows();
}

function buildRows() {
  const box = $("coopParty");
  rows = party.members.map((m, k) => {
    const row = el("div", "coop-member");
    row.style.setProperty("--member", m.color);
    const name = el("div", "coop-name");
    const tag = el("span", "coop-tag", "");
    name.append(el("b", "", k === party.local ? `${m.name} (toi)` : m.name), tag);
    const bar = el("div", "vs-bar");
    const fill = el("div", "vs-fill");
    bar.append(fill);
    row.append(name, bar);
    return { row, tag, fill };
  });
  box.replaceChildren(...rows.map((r) => r.row));
}

/** À chaque image (rafraîchi quelques fois par seconde). */
export function updateCoopHud(now) {
  if (!party.active || now - last < REFRESH_MS) return;
  last = now;
  if (rows.length !== party.members.length) buildRows();
  party.members.forEach((m, k) => {
    const p = memberObj(k);
    const r = rows[k];
    const pct = p.maxHealth > 0 ? Math.max(0, p.health) / p.maxHealth : 0;
    r.fill.style.width = `${Math.round(pct * 100)}%`;
    r.row.classList.toggle("down", !!p.downed);
    r.row.classList.toggle("gone", m.gone);
    r.tag.textContent = m.gone ? "PARTI" : p.downed ? "À TERRE" : `NIV. ${p.level ?? 1}`;
  });
  const waiting = (game.coopWaiting || []).filter((name) => name !== party.members[party.local]?.name);
  const text = waiting.length > 0 && !game.over ? `${waiting.join(", ")} choisit une amélioration…` : "";
  setText("coopWait", text);
  setVisible("coopWait", text !== "");
}
