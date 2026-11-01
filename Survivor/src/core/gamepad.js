// Manettes (Gamepad API) : lecture à chaque image, une manette par joueur.
//
// Le navigateur ne prévient pas des appuis : `pollGamepads()` (appelé à chaque image par
// ui/gamepadControls.js) relit les manettes, met à jour l'état de chaque « place » (joueur 1 à 4)
// et renvoie les nouveaux appuis. Les branchements et débranchements sont repérés à la lecture
// (Chrome ne montre une manette qu'après un premier appui) et annoncés par l'événement « gamepad ».
// Le reste du jeu lit cet état par core/input.js (actions, stick, visée) : rien ici ne dépend du jeu.

import { GAMEPAD } from "../config.js";
import { settings } from "../services/settings.js";
import { emit } from "./events.js";

/** Numéros des boutons dans la disposition « standard ». */
export const BUTTON = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  SELECT: 8,
  START: 9,
  LS: 10,
  RS: 11,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
};

const DIR_BUTTONS = { up: BUTTON.UP, down: BUTTON.DOWN, left: BUTTON.LEFT, right: BUTTON.RIGHT };

/**
 * @typedef {{ x: number, y: number }} Vec
 * @typedef {"up" | "down" | "left" | "right"} Dir
 * @typedef {{
 *   index: number, id: string, name: string, family: string, standard: boolean,
 *   buttons: boolean[], prev: boolean[], consumed: boolean[],
 *   stick: Vec, aim: Vec, nav: { dir: Dir | null, next: number }
 * }} PadSlot
 * @typedef {{ slot: number, button?: number, nav?: Dir }} PadEvent
 */

/** Places des joueurs : `pads[i]` = manette du joueur i + 1 (null = aucune). */
/** @type {(PadSlot | null)[]} */
export const pads = Array.from({ length: GAMEPAD.maxPads }, () => null);

/** Instant (performance.now) de la dernière action faite à la manette. */
let lastActivity = 0;

function readGamepads() {
  try {
    return navigator.getGamepads ? [...navigator.getGamepads()].filter((g) => g && g.connected) : [];
  } catch {
    return []; // navigateur qui refuse l'accès (cadre sans permission « gamepad »)
  }
}

/** Nom lisible : « Xbox Wireless Controller (STANDARD GAMEPAD Vendor…) » → « Xbox Wireless Controller ». */
export function padName(id) {
  const name = String(id || "")
    .replace(/\s*\(.*\)\s*/g, " ")
    .replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, "") // Firefox : « 045e-02fd-Xbox Wireless Controller »
    .trim();
  return name || "Manette";
}

/** Famille de la manette, pour nommer ses boutons : "playstation", "nintendo" ou "xbox" (défaut). */
export function padFamily(id) {
  const s = String(id || "").toLowerCase();
  if (/054c|playstation|dualsense|dualshock/.test(s)) return "playstation";
  if (/057e|nintendo|switch|joy-con|pro controller/.test(s)) return "nintendo";
  return "xbox";
}

/** Inclinaison d'un stick, zone morte retirée (0 à 1 au-delà, en gardant la direction). */
function readStick(x, y, deadZone) {
  x = Number(x) || 0;
  y = Number(y) || 0;
  const len = Math.hypot(x, y);
  if (len < deadZone) return { x: 0, y: 0 };
  const scaled = Math.min(1, (len - deadZone) / (1 - deadZone));
  return { x: (x / len) * scaled, y: (y / len) * scaled };
}

function newSlot(g) {
  return {
    index: g.index,
    id: g.id,
    name: padName(g.id),
    family: padFamily(g.id),
    standard: g.mapping === "standard",
    buttons: [],
    prev: [],
    consumed: [],
    stick: { x: 0, y: 0 },
    aim: { x: 0, y: 0 },
    nav: { dir: null, next: 0 },
  };
}

/** Direction tenue pour les menus : croix d'abord, sinon stick gauche franchement incliné. */
function heldDir(slot, g) {
  for (const [dir, b] of Object.entries(DIR_BUTTONS)) if (slot.buttons[b]) return /** @type {Dir} */ (dir);
  const x = Number(g.axes[0]) || 0;
  const y = Number(g.axes[1]) || 0;
  const t = GAMEPAD.menuThreshold;
  if (Math.max(Math.abs(x), Math.abs(y)) < t) return null;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? "right" : "left";
  return y > 0 ? "down" : "up";
}

/** Débranche toutes les manettes (option « Manette » coupée). */
function dropAll() {
  for (let i = 0; i < pads.length; i++) {
    if (!pads[i]) continue;
    const { id } = pads[i];
    pads[i] = null;
    emit("gamepad", { connected: false, slot: i, id });
  }
}

/**
 * Relit les manettes. Renvoie les nouveaux appuis (`{ slot, button }`) et les directions des
 * menus (`{ slot, nav }`, répétées tant qu'elles sont tenues).
 * @param {number} now performance.now()
 * @returns {PadEvent[]}
 */
export function pollGamepads(now) {
  if (!settings.gamepad) {
    dropAll();
    return [];
  }
  const live = readGamepads();
  /** @type {PadEvent[]} */
  const events = [];

  // Débranchées : la place se libère, les autres joueurs gardent la leur
  for (let i = 0; i < pads.length; i++) {
    const slot = pads[i];
    if (slot && !live.some((g) => g.index === slot.index)) {
      pads[i] = null;
      emit("gamepad", { connected: false, slot: i, id: slot.id });
    }
  }

  for (const g of live) {
    let i = pads.findIndex((s) => s?.index === g.index);
    if (i < 0) {
      i = pads.indexOf(null);
      if (i < 0) continue; // plus de place : manette ignorée
      pads[i] = newSlot(g);
      emit("gamepad", { connected: true, slot: i, id: g.id });
    }
    const slot = pads[i];
    slot.prev = slot.buttons;
    slot.buttons = [...g.buttons].map((b) => !!b && (b.pressed || b.value > 0.5));
    slot.stick = readStick(g.axes[0], g.axes[1], GAMEPAD.deadZone);
    slot.aim = readStick(g.axes[2], g.axes[3], GAMEPAD.aimDeadZone);

    let active = slot.stick.x !== 0 || slot.stick.y !== 0 || slot.aim.x !== 0 || slot.aim.y !== 0;
    for (let b = 0; b < slot.buttons.length; b++) {
      if (!slot.buttons[b])
        slot.consumed[b] = false; // bouton relâché : de nouveau utilisable
      else if (!slot.prev[b]) {
        active = true;
        events.push({ slot: i, button: b });
      }
    }

    // Directions des menus : une à l'appui, puis répétée si elle reste tenue
    const dir = heldDir(slot, g);
    if (dir !== slot.nav.dir) {
      slot.nav.dir = dir;
      slot.nav.next = now + GAMEPAD.repeatDelay;
      if (dir) events.push({ slot: i, nav: dir });
    } else if (dir && now >= slot.nav.next) {
      slot.nav.next = now + GAMEPAD.repeatMs;
      events.push({ slot: i, nav: dir });
    }
    if (active) lastActivity = now;
  }
  return events;
}

/** Instant de la dernière action à la manette (0 = jamais). */
export function lastPadActivity() {
  return lastActivity;
}

/** Places à lire : celle d'un joueur, ou toutes (`slot` null : partie solo, n'importe quelle manette). */
function slotsOf(slot) {
  return slot == null ? pads : [pads[slot]];
}

/** Un des `buttons` est-il enfoncé (et pas déjà « consommé ») ? */
export function padHeld(slot, buttons) {
  for (const s of slotsOf(slot)) if (s && buttons.some((b) => s.buttons[b] && !s.consumed[b])) return true;
  return false;
}

/** Les boutons enfoncés ne comptent plus jusqu'à leur relâchement (un appui = une seule action). */
export function consumeButtons(slot, buttons) {
  for (const s of slotsOf(slot)) if (s) for (const b of buttons) if (s.buttons[b]) s.consumed[b] = true;
}

const ZERO = Object.freeze({ x: 0, y: 0 });

/** Stick gauche (déplacement analogique) ; `slot` null = la première manette inclinée. */
export function padStick(slot) {
  for (const s of slotsOf(slot)) if (s && (s.stick.x || s.stick.y)) return s.stick;
  return ZERO;
}

/** Stick droit (visée) ; null s'il est au repos. */
export function padAim(slot) {
  for (const s of slotsOf(slot)) if (s && (s.aim.x || s.aim.y)) return s.aim;
  return null;
}

/** Nombre de manettes branchées. */
export function padCount() {
  return pads.filter(Boolean).length;
}

/**
 * Vibration de la manette d'un joueur (`slot` null = toutes) pendant `ms` millisecondes.
 * Chrome / Edge / Safari : `vibrationActuator.playEffect` ; Firefox : `hapticActuators[0].pulse`.
 */
export function rumblePad(slot, ms) {
  if (!settings.padVibration || !(ms > 0)) return;
  const { strong, weak, maxMs } = GAMEPAD.rumble;
  const duration = Math.min(ms, maxMs);
  const live = readGamepads(); // objets à jour : ceux d'une image précédente ne vibrent pas partout
  for (const s of slotsOf(slot)) {
    const g = s && live.find((p) => p.index === s.index);
    if (!g) continue;
    try {
      const actuator = /** @type {any} */ (g).vibrationActuator;
      if (actuator?.playEffect) {
        actuator
          .playEffect("dual-rumble", { duration, strongMagnitude: strong, weakMagnitude: weak })
          ?.catch?.(() => {});
      } else /** @type {any} */ (g).hapticActuators?.[0]?.pulse?.(strong, duration)?.catch?.(() => {});
    } catch {
      // Manette sans vibration : rien à faire
    }
  }
}
