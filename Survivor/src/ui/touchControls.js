// Commandes tactiles : joystick flottant (moitié gauche de l'écran)
// et boutons d'action (dash, ultime, boîte, pause).

import { keys, touchMove } from "../core/input.js";
import { $, setVisible } from "./dom.js";

const JOYSTICK_RADIUS = 55; // px CSS
const DEAD_ZONE = 0.15;

export const isTouchDevice = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

let joystickPointer = null;
let origin = { x: 0, y: 0 };

export function initTouchControls({ onUltimate, onPause }) {
  if (!isTouchDevice) return;
  document.body.classList.add("touch");

  const zone = $("joystickZone");
  zone.addEventListener("pointerdown", startJoystick);
  zone.addEventListener("pointermove", moveJoystick);
  zone.addEventListener("pointerup", endJoystick);
  zone.addEventListener("pointercancel", endJoystick);

  holdButton("btnTouchDash", "space");
  holdButton("btnTouchBox", "e");
  tapButton("btnTouchUlt", onUltimate);
  tapButton("btnTouchPause", onPause);

  // Évite le menu contextuel / la loupe lors d'un appui long.
  $("touchControls").addEventListener("contextmenu", (e) => e.preventDefault());
}

export function showTouchControls(visible) {
  if (!isTouchDevice) return;
  setVisible("touchControls", visible);
  if (!visible) resetJoystick();
}

function startJoystick(e) {
  if (joystickPointer !== null) return;
  joystickPointer = e.pointerId;
  e.currentTarget.setPointerCapture(e.pointerId);
  origin = { x: e.clientX, y: e.clientY };
  const base = $("joystickBase");
  base.style.left = `${origin.x}px`;
  base.style.top = `${origin.y}px`;
  base.classList.add("active");
  moveJoystick(e);
}

function moveJoystick(e) {
  if (e.pointerId !== joystickPointer) return;
  let dx = e.clientX - origin.x;
  let dy = e.clientY - origin.y;
  const d = Math.hypot(dx, dy);
  if (d > JOYSTICK_RADIUS) {
    dx = (dx / d) * JOYSTICK_RADIUS;
    dy = (dy / d) * JOYSTICK_RADIUS;
  }
  $("joystickKnob").style.transform = `translate(${dx}px, ${dy}px)`;
  const strength = Math.min(1, d / JOYSTICK_RADIUS);
  if (strength < DEAD_ZONE) {
    touchMove.x = 0;
    touchMove.y = 0;
  } else {
    touchMove.x = dx / JOYSTICK_RADIUS;
    touchMove.y = dy / JOYSTICK_RADIUS;
  }
}

function endJoystick(e) {
  if (e.pointerId === joystickPointer) resetJoystick();
}

function resetJoystick() {
  joystickPointer = null;
  touchMove.x = 0;
  touchMove.y = 0;
  $("joystickBase").classList.remove("active");
  $("joystickKnob").style.transform = "";
}

/** Bouton maintenu = touche clavier enfoncée. */
function holdButton(id, key) {
  const btn = $(id);
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    keys[key] = true;
  });
  const release = () => (keys[key] = false);
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointercancel", release);
  btn.addEventListener("pointerleave", release);
}

function tapButton(id, fn) {
  $(id).addEventListener("pointerdown", (e) => {
    e.preventDefault();
    fn();
  });
}
