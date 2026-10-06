// Classement : onglet mondial (Supabase) et onglet local (ce navigateur).

import { fetchTopScores, isOnlineEnabled } from "../services/onlineLeaderboard.js";
import { getLeaderboard } from "../services/storage.js";
import { $, el } from "./dom.js";
import { showScreen } from "./screens.js";

let activeTab = "global";
let requestId = 0;

export function initLeaderboardMenu({ onBack }) {
  $("btnLeaderboardBack").addEventListener("click", onBack);
  $("lbTabGlobal").addEventListener("click", () => selectTab("global"));
  $("lbTabLocal").addEventListener("click", () => selectTab("local"));
}

export function openLeaderboard() {
  selectTab(isOnlineEnabled() ? activeTab : "local");
  showScreen("leaderboardMenu");
}

function selectTab(tab) {
  activeTab = tab;
  $("lbTabGlobal").classList.toggle("active", tab === "global");
  $("lbTabLocal").classList.toggle("active", tab === "local");
  if (tab === "local") renderRows(getLeaderboard(), "Aucun score enregistré");
  else loadGlobal();
}

async function loadGlobal() {
  if (!isOnlineEnabled()) {
    renderMessage("Classement mondial non configuré");
    return;
  }
  const id = ++requestId;
  renderMessage("Chargement...");
  try {
    const rows = await fetchTopScores();
    if (id === requestId && activeTab === "global") renderRows(rows, "Aucun score mondial pour l'instant");
  } catch (err) {
    console.warn("Classement mondial indisponible :", err);
    if (id === requestId && activeTab === "global") renderMessage("Classement mondial indisponible");
  }
}

function renderRows(rows, emptyText) {
  if (rows.length === 0) {
    renderMessage(emptyText);
    return;
  }
  $("lbContent").replaceChildren(
    ...rows.map((entry, i) => {
      const row = el("tr");
      row.append(
        el("td", "lb-rank", i + 1),
        el("td", "", entry.name),
        el("td", "", entry.wave),
        el("td", "", Math.floor(entry.xp)),
      );
      return row;
    }),
  );
}

function renderMessage(text) {
  const row = el("tr");
  const cell = el("td", "lb-empty", text);
  cell.colSpan = 4;
  row.append(cell);
  $("lbContent").replaceChildren(row);
}
