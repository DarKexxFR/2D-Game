// Écran du défi quotidien : règles du jour, meilleur score local et classement mondial du jour.

import { HEROES, WEAPONS } from "../data/items.js";
import { dailyChallenge, getDailyBest } from "../services/daily.js";
import { fetchDailyScores, isOnlineEnabled } from "../services/onlineLeaderboard.js";
import { $, el, setText } from "./dom.js";
import { icon } from "./icons.js";
import { showScreen } from "./screens.js";

let requestId = 0;

export function initDailyMenu({ onPlay, onBack }) {
  $("btnDaily").addEventListener("click", openDaily);
  $("btnDailyPlay").addEventListener("click", onPlay);
  $("btnDailyBack").addEventListener("click", onBack);
}

export function openDaily() {
  const d = dailyChallenge();
  setText("dailyDate", `${formatDay(d.day)} · nouveau défi dans ${timeUntilTomorrow()}`);
  rule("dailyHero", icon(HEROES[d.hero].icon, HEROES[d.hero].color), "Héros", HEROES[d.hero].name);
  rule("dailyWeapon", icon(WEAPONS[d.weapon].icon, WEAPONS[d.weapon].color), "Arme", WEAPONS[d.weapon].name);
  rule("dailyModifier", icon("warning", "#ff2a6d"), d.modifier.name, d.modifier.desc);
  const best = getDailyBest(d.day);
  setText(
    "dailyBest",
    best ? `Ton record du jour : vague ${best.wave} · ${best.xp} XP` : "Pas encore joué aujourd'hui",
  );
  showScreen("dailyMenu");
  loadScores(d.day);
}

function rule(id, ico, title, text) {
  $(id).replaceChildren(ico, el("strong", "", title), el("span", "", text));
}

function formatDay(day) {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

function timeUntilTomorrow(now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const minutes = Math.ceil((next - now.getTime()) / 60000);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

async function loadScores(day) {
  if (!isOnlineEnabled()) return message("Classement en ligne non configuré");
  const id = ++requestId;
  message("Chargement...");
  try {
    const rows = await fetchDailyScores(day);
    if (id !== requestId) return;
    if (rows.length === 0) return message("Personne n'a encore relevé le défi du jour");
    $("dailyLbContent").replaceChildren(
      ...rows.map((r, i) => {
        const row = el("tr");
        row.append(
          el("td", "lb-rank", i + 1),
          el("td", "", r.name),
          el("td", "", r.wave),
          el("td", "", r.xp),
        );
        return row;
      }),
    );
  } catch (err) {
    console.warn("Classement du jour indisponible :", err);
    if (id === requestId) message("Classement du jour indisponible");
  }
}

function message(text) {
  const cell = el("td", "lb-empty", text);
  cell.colSpan = 4;
  const row = el("tr");
  row.append(cell);
  $("dailyLbContent").replaceChildren(row);
}
