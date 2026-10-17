// Écran de chargement : script classique chargé dans <head>, avant les modules du jeu.
//
// Tant que le jeu n'est pas prêt, l'accueil reste caché (classe « booting » sur <body>) : un clic
// sur JOUER avant l'initialisation était perdu et l'écran montrait un compte vide (niveau 1, 0 or,
// icônes absentes). Deux phases :
//  - téléchargement des modules (~100 fichiers) : progression estimée en comptant les fichiers
//    reçus (PerformanceObserver), sans liste à tenir à jour ;
//  - préparation (main.js, via ui/loadingScreen.js) : polices, images, compte en ligne, puis done().
// Une erreur de chargement, ou un démarrage trop long, propose de réessayer au lieu de rester bloqué.
(function () {
  "use strict";

  var DOWNLOAD_SHARE = 0.7; // part de la barre réservée au téléchargement des modules
  var DOWNLOAD_SCALE = 45; // nombre de fichiers pour lequel la barre atteint ~63 % de cette part
  var STUCK_MS = 25000; // au-delà, on propose de recharger

  var progress = 0;
  var finished = false;
  var files = 0;
  var stuckTimer = 0;

  function el(id) {
    return document.getElementById(id);
  }

  function paint(label) {
    var bar = el("loadingFill");
    if (bar) bar.style.width = Math.round(progress * 100) + "%";
    var pct = el("loadingPercent");
    if (pct) pct.textContent = Math.round(progress * 100) + " %";
    var root = el("loadingScreen");
    if (root) root.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
    if (label) {
      var text = el("loadingLabel");
      if (text) text.textContent = label;
    }
  }

  /** La barre ne recule jamais. */
  function set(value, label) {
    if (finished) return;
    progress = Math.max(progress, Math.min(1, value));
    paint(label);
  }

  function fail(message) {
    if (finished) return;
    clearTimeout(stuckTimer);
    var root = el("loadingScreen");
    if (!root) return;
    root.classList.add("loading-failed");
    paint(message);
    var retry = el("btnLoadingRetry");
    if (retry)
      retry.onclick = function () {
        location.reload();
      };
  }

  // Phase 1 : chaque fichier reçu fait avancer la barre (courbe qui ralentit sans jamais finir).
  if (typeof PerformanceObserver === "function") {
    try {
      new PerformanceObserver(function (list) {
        files += list.getEntries().length;
        set(DOWNLOAD_SHARE * (1 - Math.exp(-files / DOWNLOAD_SCALE)));
      }).observe({ type: "resource", buffered: true });
    } catch (e) {}
  }

  // Un module introuvable (réseau coupé en plein chargement) ou une erreur au démarrage
  window.addEventListener(
    "error",
    function (e) {
      var target = /** @type {Element} */ (e.target);
      if (target && target.tagName === "SCRIPT") fail("Chargement interrompu. Vérifie ta connexion.");
      else if (e instanceof ErrorEvent) fail("Le jeu n'a pas pu démarrer.");
    },
    true,
  );

  stuckTimer = window.setTimeout(function () {
    fail("Le chargement est très long. Vérifie ta connexion.");
  }, STUCK_MS);

  window.__boot = {
    progress: set,
    fail: fail,
    /** Jeu prêt : l'accueil apparaît (fondu), l'écran de chargement disparaît. */
    done: function () {
      if (finished) return;
      progress = 1;
      paint("Prêt");
      finished = true;
      clearTimeout(stuckTimer);
      document.body.classList.remove("booting");
      var root = el("loadingScreen");
      if (!root) return;
      root.classList.add("loading-done");
      window.setTimeout(function () {
        root.hidden = true;
      }, 400);
    },
  };

  document.addEventListener("DOMContentLoaded", function () {
    paint(window.__lastPulseLeaving ? "Transfert vers last-pulse.com..." : "");
  });
})();
