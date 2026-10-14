// Classement : onglet mondial (Supabase), onglet local (ce navigateur) et classement ELO du duel en ligne.

import { fetchDuelRanking } from "../services/duelRanking.js";
import { fetchTopScores, isOnlineEnabled } from "../services/onlineLeaderboard.js";
import { currentUser } from "../services/auth.js";
import { getLeaderboard } from "../services/storage.js";
import { $, el, setText } from "./dom.js";
import { showScreen } from "./screens.js";

let activeTab = "global";
let requestId = 0;

export function initLeaderboardMenu({ onBack }) {
  $("btnLeaderboardBack").addEventListener("click", onBack);
  $("lbTabGlobal").addEventListener("click", () => selectTab("global"));
  $("lbTabLocal").addEventListener("click", () => selectTab("local"));
  $("lbTabDuel").addEventListener("click", () => selectTab("duel"));
}

export function openLeaderboard() {
  selectTab(isOnlineEnabled() ? activeTab : "local");
  showScreen("leaderboardMenu");
}

function selectTab(tab) {
  activeTab = tab;
  $("lbTabGlobal").classList.toggle("active", tab === "global");
  $("lbTabLocal").classList.toggle("active", tab === "local");
  $("lbTabDuel").classList.toggle("active", tab === "duel");
  setText("lbCol3", tab === "duel" ? "ELO" : "VAGUE");
  setText("lbCol4", tab === "duel" ? "V / D" : "XP");
  setText("lbMe", "");
  if (tab === "local") renderRows(getLeaderboard(), "Aucun score enregistré");
  else if (tab === "duel") loadDuel();
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

async function loadDuel() {
  if (!isOnlineEnabled()) {
    renderMessage("Classement non configuré");
    return;
  }
  const id = ++requestId;
  renderMessage("Chargement...");
  try {
    const { top, me } = await fetchDuelRanking();
    if (id !== requestId || activeTab !== "duel") return;
    const rows = top.map((p) => ({ name: p.name, wave: p.rating, xp: `${p.wins} / ${p.losses}` }));
    renderRows(rows, "Aucun duel classé pour l'instant");
    if (me) setText("lbMe", `Ta place : #${me.rank} · ${me.rating} ELO · ${me.wins} V / ${me.losses} D`);
    else if (currentUser())
      setText("lbMe", "Joue un duel en ligne contre un joueur connecté pour être classé.");
    else setText("lbMe", "Connecte-toi à ton compte pour être classé en duel.");
  } catch (err) {
    console.warn("Classement ELO indisponible :", err);
    if (id === requestId && activeTab === "duel") renderMessage("Classement ELO indisponible");
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
        el("td", "", typeof entry.xp === "number" ? Math.floor(entry.xp) : entry.xp),
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
