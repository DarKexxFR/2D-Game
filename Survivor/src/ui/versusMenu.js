// Duel : bandeau des vies et des PV en jeu, et écran du vainqueur.

import { VERSUS } from "../config.js";
import { fighterName, versus } from "../systems/versus.js";
import { $, setText, setVisible, setWidth } from "./dom.js";
import { showScreen } from "./screens.js";
import { isTouchDevice } from "./touchControls.js";
import { showVersusTouch } from "./versusTouch.js";

const HINT_KEYBOARD = "J1 : ZQSD + ESPACE (dash) · J2 : FLÈCHES + ENTRÉE (dash) · tir automatique";
const HINT_TOUCH = "Une moitié d'écran par joueur : glisser pour bouger, toucher pour dasher";

export function initVersusMenu({ onReplay, onMenu }) {
  $("btnVersusReplay").addEventListener("click", onReplay);
  $("btnVersusMenu").addEventListener("click", onMenu);
  setText("versusHint", isTouchDevice ? HINT_TOUCH : HINT_KEYBOARD);
}

export function showVersusHud(visible) {
  setVisible("versusHud", visible);
  document.body.classList.toggle("versus", visible); // masque l'aide des touches du mode survie
  showVersusTouch(visible);
}

const hearts = (n) => "♥".repeat(Math.max(0, n)) + "♡".repeat(Math.max(0, VERSUS.lives - n));

export function updateVersusHud() {
  versus.fighters.forEach((f, i) => {
    setText(`vsLives${i + 1}`, hearts(versus.lives[i]));
    setWidth(`vsHealth${i + 1}`, Math.max(0, f.health) / f.maxHealth);
    setText(
      `vsUpgrades${i + 1}`,
      Object.values(f.inventory).reduce((a, b) => a + b, 0),
    );
  });
}

export function showVersusOver(winner) {
  showVersusHud(false);
  setText("versusWinner", `${fighterName(winner)} GAGNE !`);
  $("versusWinner").style.color = VERSUS.colors[winner];
  setText("versusScore", `Vies restantes : ${versus.lives[0]} - ${versus.lives[1]}`);
  showScreen("versusOver");
}
