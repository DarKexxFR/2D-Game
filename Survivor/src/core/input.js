import { canvas } from "./canvas.js";

export const keys = {};
export const mouse = { x: canvas.width / 2, y: canvas.height / 2 };

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
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});
