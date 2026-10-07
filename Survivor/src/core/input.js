// Clavier, souris et joystick tactile.
// Le jeu raisonne en ACTIONS (haut, dash, compétence...) ; chaque action est liée à une
// ou plusieurs touches, modifiables dans les Options (sauvegardées dans les réglages).

import { settings, updateSettings } from "../services/settings.js";
import { toViewCoords, view } from "./canvas.js";

export const mouse = { x: view.width / 2, y: view.height / 2 };

// Direction du joystick tactile (x, y entre -1 et 1), écrite par ui/touchControls.js.
export const touchMove = { x: 0, y: 0 };

/** Actions et touches par défaut (ZQSD et WASD fonctionnent tous les deux, plus les flèches). */
export const ACTIONS = {
  up: { label: "Haut", keys: ["z", "w", "arrowup"] },
  down: { label: "Bas", keys: ["s", "arrowdown"] },
  left: { label: "Gauche", keys: ["q", "a", "arrowleft"] },
  right: { label: "Droite", keys: ["d", "arrowright"] },
  dash: { label: "Dash", keys: ["space"] },
  skill: { label: "Compétence", keys: ["r"] },
  box: { label: "Boîte mystère", keys: ["e"] },
  autoShoot: { label: "Tir auto", keys: ["t"] },
  pause: { label: "Pause", keys: ["p", "escape"] },
};

const held = {}; // touches enfoncées
const virtual = {}; // actions tenues par les boutons tactiles
const listeners = {}; // action → fonction appelée à l'appui
let capture = null; // attente d'une touche pour la réassigner

/** Touches liées à une action (réglage du joueur, sinon défaut). */
export function bindingsOf(action) {
  return settings.keyBindings?.[action] || ACTIONS[action].keys;
}

export function isDown(action) {
  return !!virtual[action] || bindingsOf(action).some((k) => held[k]);
}

/** Relâche une action (évite qu'un appui maintenu la redéclenche en boucle). */
export function releaseAction(action) {
  virtual[action] = false;
  for (const k of bindingsOf(action)) held[k] = false;
}

/** Bouton tactile maintenu = action enfoncée. */
export function setVirtualAction(action, down) {
  virtual[action] = down;
}

/** Appelle `fn` à chaque nouvel appui sur l'action (pause, compétence, tir auto...). */
export function onAction(action, fn) {
  listeners[action] = fn;
}

/** Attend la prochaine touche (Échap annule → null) pour la réassigner. */
export function captureNextKey(fn) {
  capture = fn;
}

/**
 * Lie une touche à une action. Si une autre action l'utilisait, elle la perd
 * (et récupère l'ancienne touche de celle-ci si elle n'en avait plus).
 */
export function rebind(action, key) {
  const next = {};
  for (const a of Object.keys(ACTIONS)) next[a] = [...bindingsOf(a)];
  const previous = next[action][0];
  next[action] = [key];
  for (const [a, list] of Object.entries(next)) {
    if (a === action || !list.includes(key)) continue;
    next[a] = list.filter((k) => k !== key);
    if (next[a].length === 0 && previous !== key) next[a] = [previous];
  }
  updateSettings({ keyBindings: next });
}

export function resetBindings() {
  updateSettings({ keyBindings: null });
}

const KEY_LABELS = {
  space: "ESPACE",
  escape: "ÉCHAP",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  enter: "ENTRÉE",
  shift: "MAJ",
  control: "CTRL",
  tab: "TAB",
};

export function keyLabel(key) {
  return KEY_LABELS[key] || key.toUpperCase();
}

function normalize(e) {
  return e.code === "Space" ? "space" : e.key.toLowerCase();
}

function isTyping(e) {
  return e.target instanceof HTMLElement && e.target.matches("input, textarea");
}

document.addEventListener("keydown", (e) => {
  const key = normalize(e);
  if (capture) {
    e.preventDefault();
    const fn = capture;
    capture = null;
    fn(key === "escape" ? null : key);
    return;
  }
  if (isTyping(e)) return; // taper son pseudo ne doit pas mettre en pause, etc.
  if (key === "space" || key.startsWith("arrow")) e.preventDefault(); // pas de défilement de la page
  if (!e.repeat) {
    for (const [action, fn] of Object.entries(listeners)) if (bindingsOf(action).includes(key)) fn();
  }
  held[key] = true;
});

document.addEventListener("keyup", (e) => {
  held[normalize(e)] = false;
});

// Fenêtre qui perd le focus : on relâche tout (sinon une touche peut rester « collée »).
window.addEventListener("blur", () => {
  for (const k of Object.keys(held)) held[k] = false;
});

window.addEventListener("mousemove", (e) => {
  const p = toViewCoords(e.clientX, e.clientY);
  mouse.x = p.x;
  mouse.y = p.y;
});
