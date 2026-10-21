// Page du bestiaire (bestiaire.html) : une carte par ennemi, regroupées par catégorie, recherche et filtre,
// fiche détaillée dans une fenêtre (adresse #fiche-<type> pour partager un lien direct).
// Une fiche verrouillée montre la silhouette et où trouver l'ennemi, jamais ses capacités ni ses chiffres.

import { BESTIARY, BESTIARY_GROUPS, BESTIARY_TYPES, whereText } from "../data/bestiary.js";
import { ENEMY_NAMES, ENEMY_TYPES } from "../data/enemies.js";
import { ENEMY_LOOKS } from "../render/enemyLooks.js";
import { drawSprite, getSprite } from "../render/sprites.js";
import { account, loadAccount } from "../services/storage.js";

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/**
 * @param {string} tag
 * @param {string} [cls]
 * @param {string} [text]
 */
function el(tag, cls = "", text = "") {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

loadAccount();
const kills = account.bestiary || {};
const isFound = (type) => kills[type] > 0;
const groupOf = (type) => BESTIARY_GROUPS.find((g) => g.id === BESTIARY[type].group);

let filter = "all";
let search = "";

// --- SPRITES ---

/** Dessine l'ennemi `type` centré dans `canvas` (silhouette sombre s'il est verrouillé). */
function paint(canvas, type, angle = 0) {
  const t = ENEMY_TYPES[type];
  const look = ENEMY_LOOKS[type] || ENEMY_LOOKS.normal;
  const sprite = getSprite(look.sprite, t.size, t.color);
  const c = /** @type {HTMLCanvasElement} */ (canvas).getContext("2d");
  const box = canvas.width;
  c.clearRect(0, 0, box, box);
  const scale = Math.min(1.6, (box * 0.82) / (sprite.half * 2));
  drawSprite(c, sprite, box / 2, box / 2, angle, scale);
  if (!isFound(type)) {
    // Silhouette : on garde la forme, on retire les couleurs
    c.globalCompositeOperation = "source-atop";
    c.fillStyle = "#0b0614";
    c.fillRect(0, 0, box, box);
    c.globalCompositeOperation = "source-over";
  }
}

/** Orientation de départ : les ennemis « face » regardent vers le haut de la carte. */
const restAngle = (type) => {
  const mode = (ENEMY_LOOKS[type] || ENEMY_LOOKS.normal).mode;
  return mode === "spin" || mode === "wobble" || mode === "hydra" || mode === "pulse" ? 0 : -Math.PI / 2;
};

// --- LISTE ---

function renderFilters() {
  const options = [{ id: "all", name: "Tous" }, ...BESTIARY_GROUPS];
  $("bsFilters").replaceChildren(
    ...options.map((o) => {
      const b = /** @type {HTMLButtonElement} */ (el("button", "bs-chip", o.name));
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(o.id === filter));
      b.addEventListener("click", () => {
        filter = o.id;
        renderFilters();
        renderList();
      });
      return b;
    }),
  );
}

function matches(type) {
  if (filter !== "all" && BESTIARY[type].group !== filter) return false;
  if (!search) return true;
  // une fiche verrouillée ne se trouve pas par son nom (il resterait caché)
  const text = isFound(type) ? `${ENEMY_NAMES[type]} ${BESTIARY[type].desc}` : whereText(type);
  return normalize(text).includes(search);
}

const normalize = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function renderList() {
  const sections = [];
  for (const group of BESTIARY_GROUPS) {
    const types = BESTIARY_TYPES.filter((t) => BESTIARY[t].group === group.id);
    const shown = types.filter(matches);
    if (shown.length === 0) continue;
    const title = el("h2", "bs-group");
    title.style.setProperty("--group", group.color);
    title.append(
      el("span", "", group.name),
      el("small", "", `${types.filter(isFound).length}/${types.length}`),
    );
    const grid = el("div", "bs-grid");
    grid.append(...shown.map(card));
    sections.push(title, grid);
  }
  if (sections.length === 0)
    sections.push(el("p", "bs-empty", "Aucun ennemi ne correspond à cette recherche."));
  $("bsList").replaceChildren(...sections);
}

function card(type) {
  const found = isFound(type);
  const group = groupOf(type);
  const item = /** @type {HTMLButtonElement} */ (el("button", `bs-card${found ? "" : " locked"}`));
  item.type = "button";
  item.dataset.type = type;
  item.style.setProperty("--group", group.color);
  const canvas = /** @type {HTMLCanvasElement} */ (el("canvas"));
  canvas.width = canvas.height = 96;
  paint(canvas, type, restAngle(type));
  item.append(canvas, el("h3", "", found ? ENEMY_NAMES[type] : "???"));
  item.append(el("p", "", found ? `${kills[type]} éliminé${kills[type] > 1 ? "s" : ""}` : "Verrouillée"));
  item.addEventListener("click", () => openEntry(type));
  return item;
}

// --- FICHE ---

let animation = 0;

function openEntry(type) {
  const found = isFound(type);
  const entry = BESTIARY[type];
  const group = groupOf(type);
  const dialog = /** @type {HTMLDialogElement} */ ($("bsEntry"));
  dialog.style.setProperty("--group", group.color);
  dialog.classList.toggle("locked", !found);
  $("bsEntryGroup").textContent = group.name;
  $("bsEntryName").textContent = found ? ENEMY_NAMES[type] : "Fiche verrouillée";
  $("bsEntryWhere").textContent = whereText(type);
  $("bsEntryKills").textContent = found
    ? `Éliminés : ${kills[type].toLocaleString("fr-FR")}`
    : "Éliminez cet ennemi en jeu pour débloquer sa fiche.";
  $("bsEntryBody").replaceChildren(...(found ? entryBody(type, entry) : []));
  animate(type);
  if (!dialog.open) dialog.showModal();
  history.replaceState(null, "", `#fiche-${type}`);
}

function entryBody(type, entry) {
  const t = ENEMY_TYPES[type];
  const nodes = [el("p", "bs-desc", entry.desc)];
  const stats = el("dl", "bs-stats");
  const row = (label, value) => stats.append(el("dt", "", label), el("dd", "", String(value)));
  row("PV", t.health);
  row("Dégâts", t.damage);
  row("Vitesse", t.speed);
  row("XP", t.xp);
  row("Or", t.gold);
  nodes.push(el("h3", "", "Statistiques de base"), stats);
  nodes.push(
    el("p", "bs-note", "Les PV et les dégâts augmentent avec les vagues (et pour les boss, en combat seul)."),
  );
  const skills = el("ul", "bs-skills");
  skills.append(...entry.skills.map((s) => el("li", "", s)));
  nodes.push(el("h3", "", "Capacités"), skills);
  const tip = el("p", "bs-tip");
  tip.append(el("b", "", "Astuce · "), document.createTextNode(entry.tip));
  nodes.push(tip);
  return nodes;
}

/** Fiche ouverte : le sprite s'anime comme en jeu (rotation, gélatine, battement). */
function animate(type) {
  cancelAnimationFrame(animation);
  const canvas = $("bsEntrySprite");
  const look = ENEMY_LOOKS[type] || ENEMY_LOOKS.normal;
  const frame = (now) => {
    const spin = look.spin && look.mode !== "sway" ? now * look.spin : restAngle(type);
    paint(canvas, type, spin);
    if (/** @type {HTMLDialogElement} */ ($("bsEntry")).open) animation = requestAnimationFrame(frame);
  };
  animation = requestAnimationFrame(frame);
}

function closeEntry() {
  /** @type {HTMLDialogElement} */ ($("bsEntry")).close();
}

// --- DÉMARRAGE ---

$("bsFound").textContent = String(BESTIARY_TYPES.filter(isFound).length);
$("bsTotal").textContent = String(BESTIARY_TYPES.length);
$("bsBar").style.width = `${(BESTIARY_TYPES.filter(isFound).length / BESTIARY_TYPES.length) * 100}%`;
$("bsSearch").addEventListener("input", (e) => {
  search = normalize(/** @type {HTMLInputElement} */ (e.target).value.trim());
  renderList();
});
const dialog = /** @type {HTMLDialogElement} */ ($("bsEntry"));
dialog.querySelector(".bs-close").addEventListener("click", closeEntry);
dialog.addEventListener("click", (e) => e.target === dialog && closeEntry()); // clic hors de la fiche
dialog.addEventListener("close", () => history.replaceState(null, "", location.pathname + location.search));

renderFilters();
renderList();
/** Lien direct vers une fiche (#fiche-<type>), au chargement ou en cours de visite. */
function openLinked() {
  const linked = /^#fiche-(\w+)$/.exec(location.hash)?.[1];
  if (linked && BESTIARY[linked]) openEntry(linked);
}
window.addEventListener("hashchange", openLinked);
openLinked();
