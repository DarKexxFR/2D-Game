// Classement : mondial (Supabase), saison (mois en cours), Cauchemar, Endless Pulse, classement ELO du duel en
// ligne et scores locaux (ce navigateur).

import { fetchDuelRanking } from "../services/duelRanking.js";
import {
  fetchEndlessScores,
  fetchNightmareScores,
  fetchSeasonScores,
  fetchTopScores,
  isOnlineEnabled,
} from "../services/onlineLeaderboard.js";
import { getSeason } from "../services/season.js";
import { currentUser } from "../services/auth.js";
import { getLeaderboard } from "../services/storage.js";
import { $, el, setText } from "./dom.js";
import { formatDelay } from "./questMenu.js";
import { showScreen } from "./screens.js";

const TABS = {
  global: "lbTabGlobal",
  season: "lbTabSeason",
  nightmare: "lbTabNightmare",
  endless: "lbTabEndless",
  duel: "lbTabDuel",
  local: "lbTabLocal",
};

let activeTab = "global";
let requestId = 0;

export function initLeaderboardMenu({ onBack }) {
  $("btnLeaderboardBack").addEventListener("click", onBack);
  for (const [tab, id] of Object.entries(TABS)) $(id).addEventListener("click", () => selectTab(tab));
}

export function openLeaderboard() {
  selectTab(isOnlineEnabled() ? activeTab : "local");
  showScreen("leaderboardMenu");
}

function selectTab(tab) {
  activeTab = tab;
  for (const [t, id] of Object.entries(TABS)) $(id).classList.toggle("active", t === tab);
  setText("lbCol3", tab === "duel" ? "ELO" : tab === "endless" ? "PULSE" : "VAGUE");
  setText("lbCol4", tab === "duel" ? "V / D" : "XP");
  setText("lbMe", "");
  if (tab === "local") renderRows(getLeaderboard(), "Aucun score enregistré");
  else if (tab === "duel") loadDuel();
  else if (tab === "nightmare")
    loadGlobal(tab, fetchNightmareScores, "Aucun score en Cauchemar pour l'instant");
  else if (tab === "season") {
    const s = getSeason();
    setText("lbMe", `Saison ${s.number} · remise à zéro dans ${formatDelay(s.timeLeft)}`);
    loadGlobal(tab, fetchSeasonScores, "Aucun score ce mois-ci : à toi de jouer !");
  } else if (tab === "endless") {
    setText("lbMe", "Parties qui ont continué après la victoire sur l'Architecte (☠ = Cauchemar).");
    loadGlobal(tab, fetchEndlessRows, "Personne n'a encore dépassé l'Architecte");
  } else loadGlobal(tab, fetchTopScores, "Aucun score mondial pour l'instant");
}

/** Endless : la colonne « PULSE » montre les pulsations franchies (vagues après le boss final). */
async function fetchEndlessRows() {
  const rows = await fetchEndlessScores();
  return rows.map((r) => ({ ...r, name: r.nightmare ? `${r.name} ☠` : r.name, wave: r.pulse }));
}

async function loadGlobal(tab, fetchRows, emptyText) {
  if (!isOnlineEnabled()) {
    renderMessage("Classement mondial non configuré");
    return;
  }
  const id = ++requestId;
  renderMessage("Chargement...");
  try {
    const rows = await fetchRows();
    if (id === requestId && activeTab === tab) renderRows(rows, emptyText);
  } catch (err) {
    console.warn("Classement mondial indisponible :", err);
    if (id === requestId && activeTab === tab) renderMessage("Classement mondial indisponible");
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
