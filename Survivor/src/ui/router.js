// Adresse de la page selon l'écran ouvert : « #modal=option » pour les options, « #jeu » pendant une
// partie, rien sur l'accueil. Le bouton retour du navigateur (ou du téléphone) ferme l'écran ouvert,
// et un lien vers un menu (https://last-pulse.com/#modal=option) l'ouvre directement.
//
// L'historique garde au plus deux entrées pour le jeu : l'accueil, puis l'écran ouvert par-dessus
// (marqué { lastPulse: true }). Passer d'un écran à l'autre remplace la seconde au lieu d'empiler.
// Les fragments des autres scripts (#transfer=..., #access_token=...) sont lus et effacés avant
// que ce module ne touche à l'adresse (voir transfer.js et services/auth.js).

const ROUTES = {
  optionsMenu: "option",
  loginMenu: "connexion",
  installMenu: "installer",
  shopMenu: "boutique",
  inventoryMenu: "equipement",
  chestReveal: "coffre",
  leaderboardMenu: "classement",
  achievementMenu: "succes",
  dailyMenu: "defi",
  questMenu: "quetes",
  seasonMenu: "saison",
  streakMenu: "serie",
  newsMenu: "nouveautes",
  bossRushMenu: "boss-rush",
  talentMenu: "talents",
  cyberCoreMenu: "coeur",
  skinMenu: "skins",
  upgradeMenu: "amelioration",
  pauseMenu: "pause",
  reviveMenu: "revivre",
  gameOver: "fin",
  shareMenu: "partage",
  versusOver: "fin-duel",
  duelMenu: "duel",
  friendsMenu: "amis",
};
const PLAYING = "#jeu";

let ready = false; // l'adresse ne bouge qu'une fois le jeu démarré (voir initRouter)
let pendingBack = false; // history.back() lancé par le jeu lui-même
let current = () => "mainMenu";

/** Fragment d'adresse d'un écran : "" pour l'accueil, "#jeu" en pleine partie (aucun écran). */
export function routeOf(screenId) {
  if (!screenId) return PLAYING;
  return ROUTES[screenId] ? `#modal=${ROUTES[screenId]}` : "";
}

/** Écran désigné par l'adresse : "mainMenu", null (partie) ou l'identifiant d'un menu. */
export function screenFromUrl() {
  const hash = location.hash;
  if (hash === PLAYING) return null;
  const slug = hash.match(/^#modal=([\w-]+)$/)?.[1];
  return Object.keys(ROUTES).find((id) => ROUTES[id] === slug) || "mainMenu";
}

const isOurs = () => history.state?.lastPulse === true;
const cleanUrl = () => location.pathname + location.search;

/** Met l'adresse en accord avec l'écran affiché (appelé par showScreen). */
export function syncUrl(screenId) {
  if (!ready) return;
  const hash = routeOf(screenId);
  if (location.hash === hash) return;
  if (!hash) {
    // Retour à l'accueil : on revient sur l'entrée de l'accueil plutôt que d'en empiler une autre
    if (isOurs()) {
      pendingBack = true;
      history.back();
    } else history.replaceState(null, "", cleanUrl());
  } else if (isOurs()) history.replaceState({ lastPulse: true }, "", hash);
  else history.pushState({ lastPulse: true }, "", hash);
}

/**
 * Démarre le suivi de l'adresse. `navigate(screenId)` est appelé quand le joueur change l'adresse
 * (retour, avancer, lien) ; `getCurrent()` donne l'écran affiché ; `deepLinks` sont les écrans
 * qu'un lien peut ouvrir au chargement (les menus de l'accueil, pas ceux d'une partie).
 */
export function initRouter({ navigate, getCurrent, deepLinks }) {
  current = getCurrent;
  // Un lien reçu ouvre son menu ; un rechargement de la page (entrée déjà marquée) revient à l'accueil,
  // comme le font les rechargements du jeu après une restauration de progression.
  const target = isOurs() ? "mainMenu" : screenFromUrl();
  history.replaceState(null, "", cleanUrl());
  ready = true;
  window.addEventListener("popstate", () => {
    if (pendingBack) {
      // Fin de notre propre history.back() : seulement remettre l'adresse de l'écran affiché
      pendingBack = false;
      syncUrl(current());
      return;
    }
    navigate(screenFromUrl());
    syncUrl(current());
  });
  if (deepLinks.includes(target)) navigate(target);
}
