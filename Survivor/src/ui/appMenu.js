// Application installable et notifications côté interface :
//  - bouton « Installer » de l'accueil et écran d'installation (#modal=installer) : fenêtre du
//    navigateur, ou marche à suivre sur iPhone / iPad ;
//  - section « Application » des Options (installation, notifications et leurs thèmes) ;
//  - proposition « Être prévenu ? » au bon moment (après la série du jour, au retour d'une partie).

import { PUSH, PWA } from "../config.js";
import {
  disablePush,
  enablePush,
  markPushAsked,
  onPushChange,
  pushEnabled,
  pushSupport,
  setPushTopic,
  shouldAskPush,
} from "../services/notifications.js";
import { appState } from "../services/appState.js";
import { canOfferInstall, installState, onPwaChange, promptInstall } from "../services/pwa.js";
import { account } from "../services/storage.js";
import { showToast } from "./achievementMenu.js";
import { $, el, setClass, setText } from "./dom.js";
import { showScreen } from "./screens.js";

let returnTo = "mainMenu";

/** Affiche ou cache un élément en gardant son affichage CSS (grille, flex...). */
const show = (id, visible) => ($(id).style.display = visible ? "" : "none");

const PUSH_HINTS = {
  "needs-install":
    "Sur iPhone et iPad, les notifications arrivent une fois le jeu installé sur l'écran d'accueil.",
  denied: "Bloquées par le navigateur : autorise les notifications dans les réglages du site.",
  unsupported: "Ton navigateur ne gère pas les notifications.",
};

export function initAppMenu() {
  $("btnInstall").addEventListener("click", () => openInstall("mainMenu"));
  $("btnOptionsInstall").addEventListener("click", () => openInstall("optionsMenu"));
  $("btnInstallNow").addEventListener("click", async () => {
    if ((await promptInstall()) === "accepted") showToast("Last Pulse est installé !", "download");
    renderInstall();
  });
  $("btnInstallBack").addEventListener("click", closeInstall);

  $("optPush").addEventListener("click", togglePush);
  $("pushTopics").replaceChildren(
    ...Object.entries(PUSH.topics).map(([topic, { label }]) => {
      const chip = el("button", "push-topic");
      chip.dataset.topic = topic;
      chip.textContent = label;
      chip.addEventListener("click", () => setPushTopic(topic, !appState.push.topics[topic]));
      return chip;
    }),
  );

  $("btnPushAskYes").addEventListener("click", async () => {
    hidePushAsk();
    const result = await enablePush();
    if (result === "ok") showToast("Notifications activées", "bell");
  });
  $("btnPushAskNo").addEventListener("click", hidePushAsk);

  onPwaChange(renderApp);
  onPushChange(renderApp);
  renderApp();
}

/** Ouvre l'écran d'installation ; `from` est l'écran auquel revenir. */
export function openInstall(from = "mainMenu") {
  returnTo = from;
  renderInstall();
  showScreen("installMenu");
}

/** Revient à l'écran d'où l'installation a été ouverte (accueil ou Options). */
export function closeInstall() {
  showScreen(returnTo);
}

function renderInstall() {
  const state = installState();
  setText("installReward", `+${PWA.installReward} or`);
  show("installPrompt", state === "prompt");
  show("installIos", state === "ios");
  show("installDone", state === "installed");
  show("installUnavailable", state === "unavailable");
}

/** Met à jour tout ce qui dépend de l'installation et des notifications. */
export function renderApp() {
  const state = installState();
  setClass("btnInstall", "shown", canOfferInstall());
  setText("installBadge", account.appInstalled ? "" : `+${PWA.installReward}`);
  // Options : installation
  show("optAppRow", state !== "unavailable");
  const install = $("btnOptionsInstall");
  install.textContent = state === "installed" ? "INSTALLÉ" : "INSTALLER";
  install.disabled = state === "installed";
  // Options : notifications
  const support = pushSupport();
  show("optPushSection", support !== "off");
  const on = pushEnabled();
  const toggle = $("optPush");
  toggle.textContent = on ? "ACTIVÉES" : "DÉSACTIVÉES";
  toggle.classList.toggle("on", on);
  toggle.disabled = support !== "ok";
  setClass("pushTopics", "shown", on);
  for (const chip of document.querySelectorAll(/** @type {"button"} */ ("#pushTopics .push-topic"))) {
    chip.classList.toggle("on", appState.push.topics[chip.dataset.topic]);
  }
  setText("pushHint", PUSH_HINTS[support] || (on ? "Touche un thème pour le couper ou le remettre." : ""));
  if (document.body.dataset.screen === "installMenu") renderInstall();
}

async function togglePush() {
  $("optPush").disabled = true;
  let error = "";
  if (pushEnabled()) await disablePush();
  else if ((await enablePush()) === "error")
    error = "Serveur injoignable : nouvel essai à la prochaine ouverture.";
  renderApp();
  if (error) setText("pushHint", error);
}

/** Propose les notifications si le moment s'y prête (joueur habitué, pas déjà refusé récemment). */
export function maybeAskPush() {
  if (!shouldAskPush()) return false;
  markPushAsked();
  $("pushAsk").classList.add("visible");
  return true;
}

function hidePushAsk() {
  $("pushAsk").classList.remove("visible");
}
