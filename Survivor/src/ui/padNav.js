// Menus à la manette : un cercle de sélection (`.pad-focus`) passe d'un bouton à l'autre selon leur
// position à l'écran (navigation « spatiale »), sans liste à tenir à jour par écran.
//
// Est sélectionnable dans l'écran affiché : bouton, lien, champ, ou tout élément cliquable
// (curseur « main », comme les cartes d'amélioration ou les objets de l'inventaire). `data-pad-focus`
// désigne l'élément choisi d'office à l'ouverture (sinon le premier) ; `data-pad-back` le bouton
// que B actionne (sinon B fait comme le retour du navigateur).

import { GAMEPAD } from "../config.js";
import { BUTTON, consumeButtons } from "../core/gamepad.js";
import { currentScreen } from "./screens.js";

// Fenêtres posées par-dessus l'écran (prioritaires sur lui quand elles sont visibles)
const OVERLAYS = ["friendInvite"];

const NATIVE = "button, a[href], input:not([type=hidden]), select, textarea, [data-pad]";

/** @type {HTMLElement | null} */
let focused = null;
let rootKey = ""; // écran (ou fenêtre) où se trouve la sélection
let shownAt = 0; // ouverture de cet écran (A ignoré juste après)
/** Dernier élément choisi par écran : on y revient en rouvrant l'écran. */
const memory = new Map();
/** Pour retrouver la sélection quand un menu redessine sa liste : id, ou rang dans la liste. */
let lastId = "";
let lastIndex = 0;

let backHandler = () => {};

/** `onBack()` : B sans bouton `data-pad-back` (même effet que le retour du navigateur). */
export function initPadNav({ onBack }) {
  backHandler = onBack;
}

function isShown(el) {
  if (!el.isConnected || el.getClientRects().length === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

/** Écran ou fenêtre où se passe la navigation (null : aucun menu ouvert). */
export function navRoot() {
  for (const id of OVERLAYS) {
    const el = document.getElementById(id);
    if (el && isShown(el)) return el;
  }
  const id = currentScreen();
  const el = id ? document.getElementById(id) : null;
  return el && isShown(el) ? el : null;
}

function isClickable(el) {
  if (el.matches(NATIVE)) return !el.disabled && !el.closest("[inert]");
  if (getComputedStyle(el).cursor !== "pointer") return false;
  // Les enfants d'une carte cliquable héritent du curseur : seule la carte compte
  const parent = el.parentElement;
  return !parent || getComputedStyle(parent).cursor !== "pointer" || parent.matches(NATIVE);
}

/** Éléments sélectionnables de `root`, dans l'ordre du document. */
function candidates(root) {
  /** @type {HTMLElement[]} */
  const list = [];
  for (const el of root.querySelectorAll("*")) {
    if (!(el instanceof HTMLElement) || !isClickable(el) || !isShown(el)) continue;
    // Bouton dans un bouton (pastille dans une carte) : on garde le plus extérieur
    if (list.some((c) => c.contains(el) && c.matches(NATIVE))) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    list.push(el);
  }
  return list;
}

function setFocus(el, list = null) {
  if (list && el) lastIndex = Math.max(0, list.indexOf(el));
  if (focused === el) return;
  focused?.classList.remove("pad-focus");
  focused = el;
  if (!el) return;
  el.classList.add("pad-focus");
  el.focus?.({ preventScroll: true });
  el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  // Survol simulé : surligne la carte d'amélioration, ouvre les infos au survol...
  el.dispatchEvent(new MouseEvent("mouseenter"));
  el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  memory.set(rootKey, el);
  lastId = el.id;
}

/** Sélection par défaut de l'écran : mémorisée, `data-pad-focus`, ou le premier élément. */
function defaultFocus(root, list) {
  const remembered = memory.get(rootKey);
  if (remembered && list.includes(remembered)) return remembered;
  return list.find((el) => el.matches("[data-pad-focus]")) || list[0] || null;
}

/** Garde la sélection valide (écran changé, liste redessinée). Appelé à chaque image dans un menu. */
export function syncPadNav(now, padMode) {
  const root = navRoot();
  const key = root ? root.id : "";
  if (key !== rootKey) {
    rootKey = key;
    shownAt = now;
    setFocus(null);
    if (root && padMode) {
      const list = candidates(root);
      setFocus(defaultFocus(root, list), list);
    }
    return;
  }
  if (!root) return;
  if (!padMode) {
    if (focused) {
      focused.classList.remove("pad-focus"); // souris ou clavier repris : le cercle disparaît
      focused = null;
    }
    return;
  }
  if (focused && root.contains(focused) && isShown(focused)) return;
  // Élément disparu (liste redessinée, bouton masqué) : même id, sinon même rang
  const list = candidates(root);
  const sameId = lastId ? list.find((el) => el.id === lastId) : null;
  focused = null;
  setFocus(sameId || list[Math.min(lastIndex, list.length - 1)] || null, list);
}

const AXIS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** Élément le plus proche dans la direction `dir` (distance dans l'axe + 2 × écart sur le côté). */
function nearest(from, list, dir) {
  const [ax, ay] = AXIS[dir];
  const a = from.getBoundingClientRect();
  const fx = a.left + a.width / 2;
  const fy = a.top + a.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === from || el.contains(from) || from.contains(el)) continue;
    const r = el.getBoundingClientRect();
    // Écart entre les bords dans l'axe (0 si les deux se chevauchent), écart des centres sur le côté
    const along =
      ax > 0 ? r.left - a.right : ax < 0 ? a.left - r.right : ay > 0 ? r.top - a.bottom : a.top - r.bottom;
    const centerAlong = ax ? (r.left + r.width / 2 - fx) * ax : (r.top + r.height / 2 - fy) * ay;
    if (centerAlong <= 2 || along < -Math.min(a.width, a.height) / 2) continue;
    const side = ax ? Math.abs(r.top + r.height / 2 - fy) : Math.abs(r.left + r.width / 2 - fx);
    const score = Math.max(0, along) + side * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

/** Curseur (input range) : gauche / droite changent sa valeur. */
function nudgeRange(el, sign) {
  const step = Number(el.step) || 1;
  const value = Math.min(Number(el.max), Math.max(Number(el.min), Number(el.value) + sign * step));
  if (value === Number(el.value)) return;
  el.value = String(value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Commande de manette dans un menu. Renvoie true si elle a servi.
 * @param {import("../core/gamepad.js").PadEvent} ev
 * @param {number} now
 */
export function padNavInput(ev, now) {
  // La croix arrive aussi en direction (`nav`, répétée si tenue) : son appui de bouton est ignoré
  if (ev.button >= BUTTON.UP && ev.button <= BUTTON.RIGHT) return false;
  const root = navRoot();
  if (!root) return false;
  const list = candidates(root);
  if (!focused || !root.contains(focused)) {
    // Premier appui : il ne fait que montrer la sélection (sauf B, qui ferme toujours)
    if (ev.button !== BUTTON.B) {
      setFocus(defaultFocus(root, list), list);
      return true;
    }
  }
  if (ev.nav) {
    const horizontal = ev.nav === "left" || ev.nav === "right";
    if (horizontal && focused instanceof HTMLInputElement && focused.type === "range") {
      nudgeRange(focused, ev.nav === "right" ? 1 : -1);
      return true;
    }
    const next = nearest(focused, list, ev.nav);
    if (next) setFocus(next, list);
    return true;
  }
  if (ev.button === BUTTON.A) {
    if (now - shownAt < GAMEPAD.confirmDelay) return true; // l'écran vient de s'ouvrir
    // A encore enfoncé quand la partie reprend : il a servi au menu, pas au dash
    consumeButtons(ev.slot, [BUTTON.A]);
    activate(focused);
    return true;
  }
  if (ev.button === BUTTON.B || (ev.button === BUTTON.START && currentScreen() === "pauseMenu")) {
    consumeButtons(ev.slot, [ev.button]); // B relâché après la reprise : pas de sort lancé
    const back = [...root.querySelectorAll("[data-pad-back]")].find((el) => isShown(el));
    if (back instanceof HTMLElement) back.click();
    else backHandler();
    return true;
  }
  return false;
}

function activate(el) {
  if (!el) return;
  if (el.matches("input:not([type=button]):not([type=submit]):not([type=checkbox]), textarea, select")) {
    el.focus(); // champ de texte : le clavier (virtuel) prend le relais
    return;
  }
  el.click();
}

/** Stick droit dans un menu : fait défiler la liste qui contient la sélection. */
export function scrollPadNav(aim) {
  if (!aim || !aim.y) return;
  let el = focused || navRoot();
  while (el && el !== document.body) {
    const style = getComputedStyle(el);
    if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) {
      el.scrollTop += aim.y * GAMEPAD.scrollSpeed;
      return;
    }
    el = el.parentElement;
  }
}

/** Élément sélectionné à la manette (tests, diagnostic). */
export function padFocused() {
  return focused;
}
