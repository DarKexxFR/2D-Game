// État propre à cet appareil (pas à la progression du compte) : abonnement aux notifications, thèmes
// choisis et identifiant anonyme des statistiques. Un abonnement aux notifications appartient au
// navigateur qui l'a créé : il ne doit pas voyager avec la sauvegarde du compte.

import { PUSH, STORAGE_KEYS } from "../config.js";

/**
 * @typedef {object} PushState
 * @property {boolean} enabled notifications voulues sur cet appareil
 * @property {Record<string, boolean>} topics thèmes cochés (voir PUSH.topics)
 * @property {string} endpoint adresse d'abonnement déjà envoyée au serveur ("" = aucune)
 * @property {string} syncedHash empreinte du dernier envoi (rien n'est renvoyé s'il n'a pas changé)
 * @property {number} syncedAt horodatage (ms) du dernier envoi réussi
 * @property {number} askedAt horodatage (ms) de la dernière proposition « Être prévenu ? »
 */

const defaultTopics = () => Object.fromEntries(Object.keys(PUSH.topics).map((t) => [t, true]));

/**
 * @typedef {object} AnalyticsState
 * @property {string} id identifiant anonyme de l'appareil (tiré au hasard, "" = pas encore tiré)
 * @property {boolean} enabled statistiques anonymes acceptées (Options)
 */

export const appState = {
  /** @type {PushState} */
  push: { enabled: false, topics: defaultTopics(), endpoint: "", syncedHash: "", syncedAt: 0, askedAt: 0 },
  /** @type {AnalyticsState} statistiques de fréquentation (voir services/analytics.js) */
  analytics: { id: "", enabled: true },
};

export function loadAppState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.app) || "{}");
    const push = saved.push || {};
    appState.push = {
      ...appState.push,
      ...push,
      topics: { ...defaultTopics(), ...push.topics },
    };
    appState.analytics = { ...appState.analytics, ...saved.analytics };
  } catch {
    // État illisible : valeurs par défaut.
  }
}

export function saveAppState() {
  try {
    localStorage.setItem(STORAGE_KEYS.app, JSON.stringify(appState));
  } catch {
    // Stockage indisponible (navigation privée...) : on continue sans sauvegarder.
  }
}

loadAppState();
