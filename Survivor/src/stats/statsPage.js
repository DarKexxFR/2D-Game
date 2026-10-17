// Page stats.html : tableau de bord des statistiques de fréquentation (RPC admin_stats, réservée aux
// comptes listés dans analytics_admins, voir supabase/STATISTIQUES.md). La connexion est celle du jeu
// (même adresse, même session) : on se connecte dans le jeu, puis on ouvre cette page.

import { DIFFICULTIES } from "../config.js";
import { HEROES, WEAPONS } from "../data/items.js";
import { currentUser, getAccessToken, initAuth } from "../services/auth.js";
import { isOnlineEnabled, rpc } from "../services/supabase.js";
import { drawBars, drawLines } from "./charts.js";

const REFRESH_MS = 60_000;
const MODE_NAMES = {
  normal: "Survie",
  daily: "Défi du jour",
  rush: "Boss Rush",
  duel: "Duel en ligne",
  "duel-local": "Duel sur un écran",
};

let days = 30;
let last = null;
let timer = null;

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

function message(html) {
  $("stMessage").innerHTML = html;
  $("stMessage").hidden = false;
  $("stContent").hidden = true;
}

async function load() {
  if (!isOnlineEnabled()) return message("Supabase n'est pas configuré dans <code>config.js</code>.");
  const token = await getAccessToken();
  if (!token) {
    $("stSub").textContent = "Non connecté";
    return message(
      'Connecte-toi d\'abord dans le jeu avec ton compte administrateur (<a href="./#modal=connexion">ouvrir la connexion</a>), puis reviens sur cette page.',
    );
  }
  $("stSub").textContent = "Chargement...";
  try {
    last = await rpc("admin_stats", { p_days: days }, token);
    render(last);
  } catch (err) {
    const user = currentUser();
    if (String(err.message).includes("42501")) {
      message(
        `Ce compte (${user?.email || "?"}) n'est pas administrateur. Ajoute son identifiant dans Supabase :<br><code>insert into public.analytics_admins (user_id) values ('${user?.id}');</code>`,
      );
    } else
      message("Statistiques indisponibles : le schéma est-il à jour dans Supabase ? (supabase/schema.sql)");
    $("stSub").textContent = "Erreur";
    console.warn(err);
  }
}

// --- RENDU ---

const fmt = (n, unit = "") =>
  n === null || n === undefined ? "—" : `${Number(n).toLocaleString("fr-FR")}${unit}`;

function kpi(label, value, hint = "") {
  const card = document.createElement("div");
  card.className = "st-kpi";
  card.innerHTML = `<small></small><b></b><span></span>`;
  card.querySelector("small").textContent = label;
  card.querySelector("b").textContent = value;
  card.querySelector("span").textContent = hint;
  return card;
}

function render(d) {
  $("stMessage").hidden = true;
  $("stContent").hidden = false;
  const time = new Date(d.generated_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  $("stSub").textContent = `${d.days} derniers jours · mis à jour à ${time} (${d.timezone})`;

  const r = d.retention || {};
  $("stKpis").replaceChildren(
    kpi("En ligne maintenant", fmt(d.online_now), "actifs depuis 2 min"),
    kpi("Joueurs aujourd'hui", fmt(d.players_today), `${fmt(d.new_today)} nouveaux`),
    kpi("Joueurs sur 7 jours", fmt(d.players_7d)),
    kpi("Joueurs sur 30 jours", fmt(d.players_30d)),
    kpi("Nouveaux joueurs", fmt(d.new_period), `sur ${d.days} jours`),
    kpi("Joueurs au total", fmt(d.players_total), "appareils différents"),
    kpi(
      "Session moyenne",
      fmt(d.avg_session_minutes, " min"),
      `médiane ${fmt(d.median_session_minutes, " min")}`,
    ),
    kpi("Temps par joueur et par jour", fmt(d.avg_daily_minutes_per_player, " min")),
    kpi("Heures de jeu", fmt(d.play_hours_period, " h"), `sur ${d.days} jours`),
    kpi("Parties", fmt(d.runs_period), `${fmt(d.abandons)} abandons · ${fmt(d.victories_period)} victoires`),
    kpi(
      "Rétention J1 / J7 / J30",
      `${fmt(r.d1, "%")} · ${fmt(r.d7, "%")} · ${fmt(r.d30, "%")}`,
      "nouveaux joueurs revenus",
    ),
    kpi(
      "Mobile · appli · compte",
      `${fmt(d.share_mobile, "%")} · ${fmt(d.share_installed, "%")} · ${fmt(d.share_logged, "%")}`,
      "part des sessions",
    ),
  );
  drawCharts(d);
  table("tbModes", ["Mode", "Parties", "Vague moy.", "Min. moy."], d.modes, (m) => [
    MODE_NAMES[m.mode] || m.mode,
    fmt(m.runs),
    fmt(m.avg_wave),
    fmt(m.avg_minutes),
  ]);
  const diffs = (d.difficulties || [])
    .map((x) => `${DIFFICULTIES[x.difficulty]?.name || x.difficulty} ${x.runs}`)
    .join(" · ");
  if (diffs) $("tbModes").append(row(["Survie : " + diffs], "td", 4));
  table("tbKillers", ["Ennemi", "Morts"], d.killers, (k) => [k.name, fmt(k.runs)]);
  table("tbHeroes", ["Héros", "Parties"], d.heroes, (h) => [HEROES[h.name]?.name || h.name, fmt(h.runs)]);
  table("tbWeapons", ["Arme", "Parties"], d.weapons, (w) => [WEAPONS[w.name]?.name || w.name, fmt(w.runs)]);
}

function drawCharts(d) {
  const daily = d.daily || [];
  const labels = daily.map((x) => x.day.slice(8, 10) + "/" + x.day.slice(5, 7));
  drawLines(/** @type {HTMLCanvasElement} */ ($("chPlayers")), labels, [
    { values: daily.map((x) => x.players), color: "#00ffff" },
    { values: daily.map((x) => x.new_players), color: "#ff2a6d" },
  ]);
  drawBars(/** @type {HTMLCanvasElement} */ ($("chTime")), labels, [
    { values: daily.map((x) => x.active_minutes), color: "#aa66ff" },
    { values: daily.map((x) => x.play_minutes), color: "#00ff88" },
  ]);
  const hours = Array.from(
    { length: 24 },
    (_, h) => (d.hours || []).find((x) => x.hour === h)?.sessions || 0,
  );
  drawBars(
    /** @type {HTMLCanvasElement} */ ($("chHours")),
    hours.map((_, h) => `${h}h`),
    [{ values: hours, color: "#ffd700" }],
  );
  const lengths = d.session_lengths || [];
  drawBars(
    /** @type {HTMLCanvasElement} */ ($("chLengths")),
    lengths.map((x) => x.label),
    [{ values: lengths.map((x) => x.sessions), color: "#00ccff" }],
  );
  const waves = d.waves || [];
  drawBars(
    /** @type {HTMLCanvasElement} */ ($("chWaves")),
    waves.map((x) => x.label),
    [{ values: waves.map((x) => x.runs), color: "#ff00aa" }],
  );
}

function row(cells, tag = "td", span = 0) {
  const tr = document.createElement("tr");
  for (const text of cells) {
    const cell = /** @type {HTMLTableCellElement} */ (document.createElement(tag));
    cell.textContent = text;
    if (span) cell.colSpan = span;
    tr.append(cell);
  }
  return tr;
}

function table(id, headers, items, toCells) {
  const t = $(id);
  if (!items?.length) {
    t.replaceChildren(row([headers[0]], "th"), row(["Pas encore de données"], "td"));
    return;
  }
  t.replaceChildren(row(headers, "th"), ...items.map((it) => row(toCells(it))));
}

// --- DÉMARRAGE ---

function selectPeriod(n) {
  days = n;
  for (const btn of document.querySelectorAll(".st-period button")) {
    const b = /** @type {HTMLButtonElement} */ (btn);
    b.classList.toggle("active", Number(b.dataset.days) === n);
    b.setAttribute("aria-checked", String(Number(b.dataset.days) === n));
  }
}

async function start() {
  for (const btn of document.querySelectorAll(".st-period button")) {
    btn.addEventListener("click", () => {
      selectPeriod(Number(/** @type {HTMLButtonElement} */ (btn).dataset.days));
      load();
    });
  }
  $("stRefresh").addEventListener("click", load);
  addEventListener("resize", () => last && drawCharts(last));
  selectPeriod(days);
  await initAuth();
  await load();
  clearInterval(timer);
  timer = setInterval(() => !document.hidden && load(), REFRESH_MS);
}

start();
