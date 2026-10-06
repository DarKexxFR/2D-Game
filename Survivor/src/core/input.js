import { toViewCoords, view } from "./canvas.js";

export const keys = {};
export const mouse = { x: view.width / 2, y: view.height / 2 };

// Direction du joystick tactile (x, y entre -1 et 1), écrite par ui/touchControls.js.
export const touchMove = { x: 0, y: 0 };

// Raccourcis ponctuels (pause, tir auto...) enregistrés par les autres modules.
const keyActions = new Map();
export function onKeyPress(key, fn) {
  keyActions.set(key, fn);
}

/** Lit et consomme une touche (évite qu'un appui maintenu déclenche plusieurs fois). */
export function consumeKey(key) {
  const pressed = !!keys[key];
  keys[key] = false;
  return pressed;
}

function normalize(e) {
  return e.code === "Space" ? "space" : e.key.toLowerCase();
}

document.addEventListener("keydown", (e) => {
  const key = normalize(e);
  if (!e.repeat) keyActions.get(key)?.();
  keys[key] = true;
});

document.addEventListener("keyup", (e) => {
  keys[normalize(e)] = false;
});

window.addEventListener("mousemove", (e) => {
  const p = toViewCoords(e.clientX, e.clientY);
  mouse.x = p.x;
  mouse.y = p.y;
});
