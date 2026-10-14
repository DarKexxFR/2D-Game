// Duel sur écran tactile : une moitié d'écran par joueur, chacune avec son joystick flottant.
// Une touche rapide (sans glisser) déclenche le dash ; un bouton par joueur pour sa compétence.

import { useSkill, useSpell, versusTouch } from "../systems/versus.js";
import { $, setVisible } from "./dom.js";
import { isTouchDevice } from "./touchControls.js";

const JOYSTICK_RADIUS = 55; // px CSS
const DEAD_ZONE = 0.15;
const TAP_MS = 250;
const TAP_MOVE = 15; // px : au-delà, c'est un glissement, pas une touche

const sticks = [];

export function initVersusTouch() {
  if (!isTouchDevice) return;
  for (let i = 0; i < 2; i++) {
    sticks.push(createStick(i));
    $(`vsSkill${i + 1}`).addEventListener("pointerdown", (e) => {
      e.preventDefault();
      useSkill(i);
    });
    $(`vsSpell${i + 1}`).addEventListener("pointerdown", (e) => {
      e.preventDefault();
      useSpell(i);
    });
  }
  $("versusTouch").addEventListener("contextmenu", (e) => e.preventDefault());
}

export function showVersusTouch(visible) {
  if (!isTouchDevice) return;
  setVisible("versusTouch", visible);
  for (const s of sticks) s.reset();
}

function createStick(i) {
  const zone = $(`vsZone${i + 1}`);
  const base = $(`vsBase${i + 1}`);
  const knob = base.firstElementChild;
  const out = versusTouch[i];
  let pointer = null;
  let origin = { x: 0, y: 0 };
  let startTime = 0;
  let moved = 0;

  function reset() {
    pointer = null;
    out.x = 0;
    out.y = 0;
    base.classList.remove("active");
    knob.style.transform = "";
  }

  function move(e) {
    if (e.pointerId !== pointer) return;
    let dx = e.clientX - origin.x;
    let dy = e.clientY - origin.y;
    const d = Math.hypot(dx, dy);
    moved = Math.max(moved, d);
    if (d > JOYSTICK_RADIUS) {
      dx = (dx / d) * JOYSTICK_RADIUS;
      dy = (dy / d) * JOYSTICK_RADIUS;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const strong = Math.min(1, d / JOYSTICK_RADIUS) >= DEAD_ZONE;
    out.x = strong ? dx / JOYSTICK_RADIUS : 0;
    out.y = strong ? dy / JOYSTICK_RADIUS : 0;
  }

  zone.addEventListener("pointerdown", (e) => {
    if (pointer !== null) return;
    pointer = e.pointerId;
    try {
      zone.setPointerCapture(e.pointerId);
    } catch {
      // pointeur déjà relâché : sans importance
    }
    origin = { x: e.clientX, y: e.clientY };
    startTime = performance.now();
    moved = 0;
    base.style.left = `${origin.x}px`;
    base.style.top = `${origin.y}px`;
    base.classList.add("active");
    move(e);
  });
  zone.addEventListener("pointermove", move);
  const end = (e) => {
    if (e.pointerId !== pointer) return;
    if (performance.now() - startTime < TAP_MS && moved < TAP_MOVE) out.dash = true;
    reset();
  };
  zone.addEventListener("pointerup", end);
  zone.addEventListener("pointercancel", end);
  return { reset };
}
