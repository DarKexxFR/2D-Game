// Écran « K.O. » : revivre en regardant une pub (une fois par partie, hors défi du jour),
// sinon fin de partie. Sans choix au bout de quelques secondes, la partie se termine.

import { ADS } from "../config.js";
import { game } from "../core/state.js";
import { adsEnabled, showRewardedAd } from "../services/ads.js";
import { $, setText } from "./dom.js";
import { hideScreens, showScreen } from "./screens.js";
import { showTouchControls } from "./touchControls.js";

let callbacks = { onRevive: () => {}, onGiveUp: () => {} };
let deadline = 0;
let timer = null;
let watching = false;

export function initReviveMenu({ onRevive, onGiveUp }) {
  callbacks = { onRevive, onGiveUp };
  $("btnReviveAd").addEventListener("click", watchAd);
  $("btnReviveGiveUp").addEventListener("click", giveUp);
}

export function canOfferRevive() {
  return adsEnabled() && !game.daily && !game.adReviveUsed;
}

export function showReviveOffer() {
  showTouchControls(false);
  setText("reviveMessage", "");
  $("btnReviveAd").disabled = false;
  deadline = performance.now() + ADS.reviveDecisionMs;
  clearInterval(timer);
  timer = setInterval(updateTimer, 200);
  updateTimer();
  showScreen("reviveMenu");
}

function updateTimer() {
  if (watching) return;
  const left = Math.max(0, deadline - performance.now());
  setText("reviveTimer", `Fin de la partie dans ${Math.ceil(left / 1000)} s`);
  if (left === 0) giveUp();
}

function stop() {
  clearInterval(timer);
  timer = null;
}

async function watchAd() {
  if (watching) return;
  watching = true;
  $("btnReviveAd").disabled = true;
  const rewarded = await showRewardedAd("revive");
  watching = false;
  if (rewarded) {
    stop();
    hideScreens();
    showTouchControls(true);
    callbacks.onRevive();
    return;
  }
  // Pub fermée ou indisponible : on laisse encore un peu de temps pour réessayer
  $("btnReviveAd").disabled = false;
  deadline = performance.now() + ADS.reviveDecisionMs;
  setText("reviveMessage", "Publicité interrompue : pas de récompense.");
}

function giveUp() {
  if (watching || !timer) return;
  stop();
  callbacks.onGiveUp();
}
