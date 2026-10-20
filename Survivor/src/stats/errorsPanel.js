// Page stats.html, partie « Erreurs » : rapports envoyés par le jeu (services/errorReports.js), regroupés par
// erreur (RPC admin_errors), avec le détail des derniers rapports d'une erreur (admin_error_reports) : pile
// d'appels, état du jeu, journal des dernières secondes, appareil. Une erreur corrigée se marque « corrigée »
// (admin_error_resolve) ; si elle revient, elle repasse en tête avec la mention « revenue ».

import { rpc } from "../services/supabase.js";

const KINDS = { error: "Exception", rejection: "Promesse", load: "Fichier", freeze: "Gel" };

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/** @type {{ token: string, days: number, open: string, groups: any[] }} */
const state = { token: "", days: 30, open: "", groups: [] };

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const when = (iso) =>
  new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Charge la liste des erreurs de la période (appelé à chaque actualisation de la page). */
export async function loadErrors(days, token) {
  state.days = days;
  state.token = token;
  try {
    const data = await rpc("admin_errors", { p_days: days }, token);
    state.groups = data.groups || [];
    renderList();
    if (state.open) await openGroup(state.open, false);
  } catch (err) {
    $("tbErrors").replaceChildren();
    $("stErrorsInfo").textContent =
      "Rapports d'erreurs indisponibles : le schéma est-il à jour dans Supabase ? (supabase/schema.sql)";
    console.warn(err);
  }
}

function renderList() {
  const open = state.groups.filter((g) => !g.resolved_at);
  $("stErrorsInfo").textContent = state.groups.length
    ? `${open.length} à corriger · ${state.groups.length - open.length} corrigée(s) · ${state.days} derniers jours`
    : `Aucune erreur reçue sur les ${state.days} derniers jours.`;
  const head = el("tr");
  for (const h of ["Erreur", "Fois", "Appareils", "Dernière", "Version"]) head.append(el("th", "", h));
  const rows = state.groups.map((g) => {
    const tr = el("tr", "st-error-row");
    tr.dataset.fingerprint = g.fingerprint;
    tr.classList.toggle("resolved", !!g.resolved_at);
    tr.classList.toggle("selected", g.fingerprint === state.open);
    const name = el("td");
    name.append(el("span", `st-badge ${g.kind}`, KINDS[g.kind] || g.kind));
    if (g.regressed_at) name.append(el("span", "st-badge back", "revenue"));
    if (g.resolved_at) name.append(el("span", "st-badge done", "corrigée"));
    name.append(el("span", "st-error-msg", g.message));
    tr.append(name, el("td", "", String(g.occurrences)), el("td", "", String(g.devices)));
    tr.append(el("td", "", when(g.last_seen)), el("td", "", g.last_build || "—"));
    tr.addEventListener("click", () => openGroup(g.fingerprint));
    return tr;
  });
  $("tbErrors").replaceChildren(head, ...rows);
}

/** Détail d'une erreur : ses derniers rapports. */
async function openGroup(fingerprint, toggle = true) {
  const detail = $("stErrorDetail");
  if (toggle && state.open === fingerprint) {
    state.open = "";
    detail.hidden = true;
    renderList();
    return;
  }
  state.open = fingerprint;
  renderList();
  const group = state.groups.find((g) => g.fingerprint === fingerprint);
  if (!group) {
    detail.hidden = true;
    return;
  }
  detail.hidden = false;
  detail.replaceChildren(el("p", "st-legend", "Chargement..."));
  try {
    const reports = await rpc("admin_error_reports", { p_fingerprint: fingerprint }, state.token);
    renderDetail(group, reports || [], 0);
  } catch (err) {
    detail.replaceChildren(el("p", "st-legend", "Détail indisponible."));
    console.warn(err);
  }
}

function renderDetail(group, reports, index) {
  const detail = $("stErrorDetail");
  const report = reports[index];
  const head = el("div", "st-error-head");
  head.append(el("b", "", `${KINDS[group.kind] || group.kind} · ${group.fingerprint}`));
  head.append(
    el(
      "span",
      "st-legend",
      `vue ${group.occurrences} fois sur ${group.devices} appareil(s) · depuis le ${when(group.first_seen)} (version ${group.first_build || "—"})`,
    ),
  );
  const actions = el("div", "st-error-actions");
  const resolve = el("button", "st-refresh", group.resolved_at ? "ROUVRIR" : "MARQUER CORRIGÉE");
  resolve.addEventListener("click", async () => {
    const args = { p_fingerprint: group.fingerprint, p_resolved: !group.resolved_at };
    try {
      await rpc("admin_error_resolve", args, state.token);
    } catch (err) {
      console.warn(err);
    }
    await loadErrors(state.days, state.token);
  });
  actions.append(resolve);
  if (report) {
    const copy = el("button", "st-refresh", "COPIER LE RAPPORT");
    copy.addEventListener("click", async () => {
      await navigator.clipboard.writeText(reportText(group, report)).catch(() => {});
      copy.textContent = "COPIÉ";
    });
    actions.append(copy);
  }
  const parts = [head, actions];
  if (reports.length > 1) {
    const tabs = el("div", "st-period st-error-tabs");
    reports.forEach((r, i) => {
      const b = el("button", i === index ? "active" : "", when(r.created_at));
      b.addEventListener("click", () => renderDetail(group, reports, i));
      tabs.append(b);
    });
    parts.push(tabs);
  }
  if (report) parts.push(el("pre", "st-pre", reportText(group, report)));
  else parts.push(el("p", "st-legend", "Plus aucun rapport détaillé (gardés 90 jours)."));
  detail.replaceChildren(...parts);
}

const flat = (obj) =>
  Object.entries(obj || {})
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(" · ");

/** Rapport en texte : à lire ici, ou à coller tel quel pour le faire corriger. */
function reportText(group, r) {
  const at = new Date(r.occurred_at).getTime();
  const journal = (r.journal || []).map(([t, c, m]) => {
    const s = ((t - at) / 1000).toFixed(1);
    return `${s.startsWith("-") ? s : "+" + s} s  [${c}] ${m}`;
  });
  return [
    `${KINDS[r.kind] || r.kind} ${group.fingerprint} · ${new Date(r.occurred_at).toLocaleString("fr-FR")} · version ${r.build || "—"}${r.count > 1 ? ` · ×${r.count} dans la session` : ""}`,
    r.message,
    "",
    r.stack || "(pas de pile d'appels)",
    "",
    `État du jeu : ${flat(r.context)}`,
    `Appareil : ${flat(r.device_info)}`,
    "",
    "Journal (secondes avant l'erreur) :",
    ...journal,
  ].join("\n");
}
