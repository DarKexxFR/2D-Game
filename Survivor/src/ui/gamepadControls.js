// Manette : aiguillage des appuis à chaque image (menus, choix du duel, actions de jeu) et
// annonces de branchement. L'état des manettes vit dans core/gamepad.js, les actions tenues
// (déplacement, dash, boîte) sont lues par core/input.js pendant les ticks.

import { BUTTON, padAim, pads, pollGamepads } from "../core/gamepad.js";
import { on } from "../core/events.js";
import { ACTIONS, padButtonsOf, setPadMode, triggerAction, usingPad } from "../core/input.js";
import { game } from "../core/state.js";
import { versus } from "../systems/versus.js";
import { showToast } from "./achievementMenu.js";
import { pickInput } from "./duelPicks.js";
import { padNavInput, scrollPadNav, syncPadNav } from "./padNav.js";

/** Actions déclenchées à l'appui (les autres, comme le dash, sont tenues : lues par isDown). */
const PRESS_ACTIONS = ["pause", "skill", "autoShoot", "spell"];

/**
 * @typedef {{
 *   useSkill: (i: number) => void,
 *   useSpell: (i: number) => void,
 *   onPadLost: (slot: number) => void,
 * }} PadHandlers
 */
/** @type {PadHandlers} */
let handlers;

/** @param {PadHandlers} h */
export function initGamepadControls(h) {
  handlers = h;
  on("gamepad", ({ connected, slot }) => {
    const name = connected ? pads[slot]?.name : "";
    showToast(
      connected
        ? `Manette ${slot + 1} connectée${name ? ` · ${name}` : ""}`
        : `Manette ${slot + 1} déconnectée`,
      "gamepad",
    );
    if (!connected) handlers.onPadLost(slot);
  });
}

/** Un menu est-il ouvert ? (accueil, pause, choix d'amélioration, fin de partie...) */
function inMenu() {
  return !game.started || !!document.body.dataset.screen || isVisibleOverlay();
}

function isVisibleOverlay() {
  const invite = document.getElementById("friendInvite");
  return !!invite && invite.style.display !== "none" && invite.getClientRects().length > 0;
}

/** Relit les manettes et aiguille leurs appuis ; appelé à chaque image (partie et menus). */
export function updateGamepads(now) {
  const events = pollGamepads(now);
  if (document.body.classList.contains("booting")) return; // écran de chargement : rien à piloter
  if (events.length > 0 || padMoved()) setPadMode(true);

  const menu = inMenu();
  if (menu) {
    for (const ev of events) padNavInput(ev, now);
    syncPadNav(now, usingPad());
    scrollPadNav(padAim(null));
  } else {
    syncPadNav(now, false);
    for (const ev of events) gameInput(ev);
  }
}

/** Stick incliné depuis l'image précédente (montre le cercle des menus dès qu'on touche la manette). */
function padMoved() {
  return pads.some((s) => s && (s.stick.x || s.stick.y || s.aim.x || s.aim.y));
}

/** Appui pendant la partie : choix d'amélioration du duel, compétence, pause, tir auto... */
function gameInput(ev) {
  if (versus.split) {
    // Écran scindé : chaque manette commande son joueur (place 0 = J1, place 1 = J2)
    if (ev.slot > 1) return;
    if (ev.nav) {
      pickInput(ev.slot, ev.nav === "left" || ev.nav === "up" ? "prev" : "next");
      return;
    }
    if (ev.button === BUTTON.A && pickInput(ev.slot, "confirm")) return;
    for (const action of PRESS_ACTIONS) {
      if (!padButtonsOf(action).includes(ev.button)) continue;
      if (action === "skill") handlers.useSkill(ev.slot);
      else if (action === "spell") handlers.useSpell(ev.slot);
      else if (action === "pause") triggerAction("pause");
    }
    return;
  }
  for (const action of PRESS_ACTIONS) if (padButtonsOf(action).includes(ev.button)) triggerAction(action);
}

/** Libellés des boutons selon la famille de manette (Xbox par défaut). */
const LABELS = {
  xbox: ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "VIEW", "MENU", "L3", "R3", "↑", "↓", "←", "→"],
  playstation: [
    "✕",
    "○",
    "□",
    "△",
    "L1",
    "R1",
    "L2",
    "R2",
    "SHARE",
    "OPTIONS",
    "L3",
    "R3",
    "↑",
    "↓",
    "←",
    "→",
  ],
  nintendo: ["B", "A", "Y", "X", "L", "R", "ZL", "ZR", "−", "+", "L3", "R3", "↑", "↓", "←", "→"],
};

/** Nom d'un bouton pour la manette branchée (la première), ou une manette Xbox par défaut. */
export function buttonLabel(button, family = pads.find(Boolean)?.family || "xbox") {
  return (LABELS[family] || LABELS.xbox)[button] ?? `B${button}`;
}

/** Boutons d'une action, lisibles (« A / RB / RT »). */
export function actionPadLabel(action, family) {
  return padButtonsOf(action)
    .map((b) => buttonLabel(b, family))
    .join(" / ");
}

/** Liste des commandes à la manette (Options, tutoriel) : [libellé, boutons]. */
export function padLegend(family) {
  return [
    ["Se déplacer", "Stick gauche / croix"],
    ["Viser (tir auto coupé)", "Stick droit"],
    ...["dash", "skill", "box", "spell", "autoShoot", "pause"].map((a) => [
      ACTIONS[a].label,
      actionPadLabel(a, family),
    ]),
    ["Menus : valider / retour", `${buttonLabel(BUTTON.A, family)} / ${buttonLabel(BUTTON.B, family)}`],
  ];
}
