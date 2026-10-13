// Duel : bandeau des vies et des PV en jeu, et écran du vainqueur.

import { VERSUS } from "../config.js";
import { fighterName, versus } from "../systems/versus.js";
import { $, setText, setVisible, setWidth } from "./dom.js";
import { showScreen } from "./screens.js";
import { isTouchDevice, showTouchControls } from "./touchControls.js";
import { showVersusTouch } from "./versusTouch.js";

const HINT_KEYBOARD = "J1 : ZQSD + ESPACE (dash) · J2 : FLÈCHES + ENTRÉE (dash) · tir automatique";
const HINT_TOUCH = "Une moitié d'écran par joueur : glisser pour bouger, toucher pour dasher";
const COLOR_NAMES = ["BLEU", "ROSE"];

/** Aide affichée sous le bandeau (en ligne : quel vaisseau on pilote, ou ce qu'on attend). */
function hint() {
  if (!versus.online) return isTouchDevice ? HINT_TOUCH : HINT_KEYBOARD;
  if (versus.wait) return versus.wait;
  const color = COLOR_NAMES[versus.online.local];
  const keys = isTouchDevice ? "joystick + DASH" : "ZQSD ou flèches + ESPACE (dash)";
  return `Tu pilotes le vaisseau ${color} · ${keys} · tir automatique`;
}

export function initVersusMenu({ onReplay, onMenu }) {
  $("btnVersusReplay").addEventListener("click", onReplay);
  $("btnVersusMenu").addEventListener("click", onMenu);
}

export function showVersusHud(visible) {
  setVisible("versusHud", visible);
  document.body.classList.toggle("versus", visible); // masque l'aide des touches du mode survie
  // En ligne, chacun pilote un seul vaisseau : commandes tactiles habituelles (joystick + dash)
  showVersusTouch(visible && !versus.online);
  showTouchControls(visible && !!versus.online);
}

const hearts = (n) => "♥".repeat(Math.max(0, n)) + "♡".repeat(Math.max(0, VERSUS.lives - n));

export function updateVersusHud() {
  setText("versusHint", hint());
  versus.fighters.forEach((f, i) => {
    setText(`vsName${i + 1}`, fighterName(i));
    setText(`vsLives${i + 1}`, hearts(versus.lives[i]));
    setWidth(`vsHealth${i + 1}`, Math.max(0, f.health) / f.maxHealth);
    setText(
      `vsUpgrades${i + 1}`,
      Object.values(f.inventory).reduce((a, b) => a + b, 0),
    );
  });
}

/** Fin du duel ; `winner` = null quand la connexion avec l'adversaire est perdue. */
export function showVersusOver(winner) {
  showVersusHud(false);
  const lost = winner === null;
  setText("versusWinner", lost ? "CONNEXION PERDUE" : `${fighterName(winner)} GAGNE !`);
  $("versusWinner").style.color = lost ? "#aaa" : VERSUS.colors[winner];
  setText(
    "versusScore",
    lost ? "L'adversaire a quitté la partie." : `Vies restantes : ${versus.lives[0]} - ${versus.lives[1]}`,
  );
  setVisible("btnVersusReplay", !lost);
  showScreen("versusOver");
}

/** En ligne : l'invité a demandé la revanche, l'hôte doit la lancer. */
export function showRematchWaiting() {
  setText("versusScore", "Revanche demandée. En attente de l'adversaire…");
}
