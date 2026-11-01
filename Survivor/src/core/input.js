// Clavier, souris, joystick tactile et manette.
// Le jeu raisonne en ACTIONS (haut, dash, compétence...) ; chaque action est liée à une
// ou plusieurs touches, modifiables dans les Options (sauvegardées dans les réglages),
// et à des boutons de manette (GAMEPAD.bindings dans config.js, lus par core/gamepad.js).

import { GAMEPAD } from "../config.js";
import { settings, updateSettings } from "../services/settings.js";
import { toViewCoords, view } from "./canvas.js";
import { consumeButtons, padAim, padHeld, padStick, rumblePad } from "./gamepad.js";

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
  spell: { label: "Sort (duel)", keys: ["f"] },
  autoShoot: { label: "Tir auto", keys: ["t"] },
  pause: { label: "Pause", keys: ["p", "escape"] },
};

const held = {}; // touches enfoncées
const virtual = {}; // actions tenues par les boutons tactiles
const listeners = {}; // action → fonction appelée à l'appui
let capture = null; // attente d'une touche pour la réassigner
// Duel sur un écran (ou coop) : touches, joystick et manette du joueur dont la partie avance
// (voir systems/versus.js)
/** @type {{ keys: Record<string, string[]>, virtual: Record<string, boolean>, stick: { x: number, y: number }, pad?: number } | null} */
let profile = null;
let padMode = false; // dernière commande utilisée : la manette (sinon clavier, souris ou tactile)

/** Touches liées à une action (réglage du joueur, sinon défaut). */
export function bindingsOf(action) {
  return settings.keyBindings?.[action] || ACTIONS[action].keys;
}

/** Boutons de manette liés à une action. */
export function padButtonsOf(action) {
  return GAMEPAD.bindings[action] || [];
}

/** Manette à lire : celle du joueur en cours (duel sur un écran, coop), sinon n'importe laquelle. */
function padSlot() {
  return profile ? (profile.pad ?? -1) : null;
}

export function isDown(action) {
  const slot = padSlot();
  if (slot !== -1 && padHeld(slot, padButtonsOf(action))) return true;
  if (profile) return !!profile.virtual[action] || (profile.keys[action] || []).some((k) => held[k]);
  return !!virtual[action] || bindingsOf(action).some((k) => held[k]);
}

/**
 * Duel sur un écran (ou coop) : `p` = { keys: { action: [touches] }, virtual: { action: bool },
 * stick: { x, y }, pad: place de la manette (0 à 3, facultatif) } remplace les commandes habituelles
 * le temps de faire avancer la partie d'un joueur ; null = normal.
 */
export function useInputProfile(p) {
  profile = p;
}

/** Direction du joystick tactile, sinon du stick gauche (ceux du joueur en cours en duel sur un écran). */
export function stickDirection() {
  const touch = profile ? profile.stick : touchMove;
  const slot = padSlot();
  if (touch.x || touch.y || slot === -1) return touch;
  return padStick(slot);
}

/**
 * Angle de visée du tir manuel (tir auto coupé) : stick droit s'il est incliné ; à la manette sans
 * stick droit, `fallback` (dernière visée) ; sinon la souris, depuis le centre de la vue.
 */
export function aimAngle(fallback) {
  const slot = padSlot();
  const aim = slot === -1 ? null : padAim(slot);
  if (aim) return Math.atan2(aim.y, aim.x);
  if (padMode || profile?.pad != null) return fallback;
  return Math.atan2(mouse.y - view.height / 2, mouse.x - view.width / 2);
}

/** Relâche une action (évite qu'un appui maintenu la redéclenche en boucle). */
export function releaseAction(action) {
  virtual[action] = false;
  for (const k of bindingsOf(action)) held[k] = false;
  const slot = padSlot();
  if (slot !== -1) consumeButtons(slot, padButtonsOf(action));
}

/** Déclenche l'action comme un appui de touche (bouton de manette : pause, compétence, tir auto...). */
export function triggerAction(action) {
  listeners[action]?.();
}

/** Vibration de la manette du joueur en cours (toutes en partie solo), durée selon `pattern`. */
export function rumble(pattern) {
  const slot = padSlot();
  if (slot === -1) return;
  const ms = Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : Number(pattern) || 0;
  rumblePad(slot, ms);
}

/** La manette est-elle la dernière commande utilisée ? (cercle de sélection, textes du tutoriel...) */
export function usingPad() {
  return padMode;
}

/** Bascule entre manette et clavier / souris / tactile (classe `pad-mode` sur la page). */
export function setPadMode(on) {
  if (padMode === on) return;
  padMode = on;
  document.body.classList.toggle("pad-mode", on);
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
  setPadMode(false);
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
  if (e.movementX || e.movementY) setPadMode(false);
  const p = toViewCoords(e.clientX, e.clientY);
  mouse.x = p.x;
  mouse.y = p.y;
});

window.addEventListener("pointerdown", (e) => {
  if (e.pointerType) setPadMode(false); // les clics simulés (manette dans les menus) n'en sont pas
});
