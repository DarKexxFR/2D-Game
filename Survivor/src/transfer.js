// Déménagement vers last-pulse.com sans perte de progression.
//
// La progression est rangée dans le navigateur (localStorage), et chaque domaine a la sienne :
// last-pulse.com ne voit pas celle de darkexxfr.github.io. Ce script (classique, chargé avant
// le jeu) fait donc passer les données d'un domaine à l'autre :
//  - sur l'ancienne adresse : il emporte toutes les clés « survivor_* » dans l'URL de la nouvelle
//    (#transfer=...), une seule fois ; ensuite il redirige simplement ;
//  - sur la nouvelle adresse : il les réécrit avant que le jeu ne les lise, puis nettoie l'URL.
// Rien n'est envoyé à un serveur : le fragment après # reste dans le navigateur.
(function () {
  "use strict";

  // Passer à true une fois last-pulse.com en ligne (voir HEBERGEMENT.md).
  var REDIRECT_ENABLED = false;
  var NEW_ORIGIN = "https://last-pulse.com";
  var OLD_HOSTS = ["darkexxfr.github.io"];
  var PREFIX = "survivor_";
  var MOVED_KEY = "survivor_moved"; // ancienne adresse : progression déjà emportée
  // La session de connexion ne voyage pas dans l'URL : il suffit de se reconnecter.
  var SKIPPED_KEYS = ["survivor_auth", MOVED_KEY];

  function storage() {
    try {
      return window.localStorage;
    } catch (e) {
      return null;
    }
  }

  function collect(store) {
    var data = {};
    for (var i = 0; i < store.length; i++) {
      var key = store.key(i);
      if (key.indexOf(PREFIX) === 0 && SKIPPED_KEYS.indexOf(key) < 0) data[key] = store.getItem(key);
    }
    return data;
  }

  // base64 « URL » d'une chaîne UTF-8 (accents des pseudos compris)
  function encode(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decode(text) {
    var bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function saveSummary(raw) {
    try {
      var s = JSON.parse(raw);
      return "niveau " + (s.level || 1) + ", " + (s.gold || 0) + " or";
    } catch (e) {
      return "?";
    }
  }

  /** Ancienne adresse : part vers la nouvelle, avec la progression la première fois. */
  function leaveOldSite(store) {
    var target = NEW_ORIGIN + "/";
    if (store && !store.getItem(MOVED_KEY)) {
      var data = collect(store);
      if (Object.keys(data).length > 0) {
        target += "#transfer=" + encode(JSON.stringify(data));
        store.setItem(MOVED_KEY, String(Date.now()));
      }
    }
    window.__lastPulseLeaving = true; // le jeu ne démarre pas (voir main.js)
    location.replace(target);
  }

  /** Nouvelle adresse : réécrit la progression transférée (en demandant si une existe déjà). */
  function importTransfer(store) {
    var match = location.hash.match(/^#transfer=([A-Za-z0-9_-]+)$/);
    if (!match) return;
    history.replaceState(null, "", location.pathname + location.search);
    if (!store) return;
    var data;
    try {
      data = JSON.parse(decode(match[1]));
    } catch (e) {
      console.warn("Transfert illisible :", e);
      return;
    }
    var save = "survivor_save_v11";
    var here = store.getItem(save);
    if (here && data[save] && here !== data[save]) {
      var keep = confirm(
        "Ta progression de l'ancienne adresse est arrivée (" +
          saveSummary(data[save]) +
          ").\nUne autre progression existe déjà ici (" +
          saveSummary(here) +
          ").\n\nOK : garder l'ancienne adresse · Annuler : garder celle d'ici",
      );
      if (!keep) return;
    }
    for (var key in data) {
      if (key.indexOf(PREFIX) === 0 && SKIPPED_KEYS.indexOf(key) < 0) store.setItem(key, data[key]);
    }
  }

  var store = storage();
  if (OLD_HOSTS.indexOf(location.hostname) >= 0) {
    if (REDIRECT_ENABLED) leaveOldSite(store);
  } else {
    importTransfer(store);
  }
})();
