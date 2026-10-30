// Classement ELO du duel en ligne (voir supabase/schema.sql : report_duel, get_duel_ranking).
// Seuls les joueurs connectés sont classés ; chaque joueur déclare le résultat de son duel et
// le serveur ne compte le duel que lorsque les deux déclarations concordent.

import { ONLINE } from "../config.js";
import { emit } from "../core/events.js";
import { DUEL_RANKS } from "../data/duelRanks.js";
import { currentUser, getAccessToken, onAuthChange } from "./auth.js";
import { isOnlineEnabled, rpc } from "./supabase.js";

/** Ce joueur peut-il jouer un duel classé (connecté à son compte) ? */
export function canRank() {
  return isOnlineEnabled() && !!currentUser();
}

/** Son propre ELO (null = pas encore de duel classé compté, ou pas connecté). */
let myRating = null;
let lastUser = null;

/**
 * Rang d'un ELO : palier atteint, palier suivant (null au sommet) et avancée vers lui (0 à 1).
 * @param {number} rating
 */
export function duelRankOf(rating) {
  let i = 0;
  while (i + 1 < DUEL_RANKS.length && rating >= DUEL_RANKS[i + 1].min) i++;
  const rank = DUEL_RANKS[i];
  const next = DUEL_RANKS[i + 1] || null;
  const from = i === 0 ? Math.min(rating, 1000) : rank.min; // Bronze : la barre part de l'ELO de départ
  const progress = next ? Math.max(0, Math.min(1, (rating - from) / (next.min - from))) : 1;
  return { rank, next, progress, index: i };
}

export function myDuelRating() {
  return myRating;
}

/** Met à jour son ELO connu (réponse de report_duel ou du classement) ; prévient l'interface s'il change. */
export function setMyDuelRating(rating) {
  const value = Number.isFinite(rating) ? rating : null;
  if (value === myRating) return;
  const before = myRating;
  myRating = value;
  emit("duelRating", { rating: value, before });
}

/** Relit son ELO sur le serveur (accueil, écran Duel) ; sans compte, il est oublié. */
export async function refreshMyDuelRating() {
  if (!canRank()) return setMyDuelRating(null);
  try {
    const { me } = await fetchDuelRanking();
    if (currentUser()) setMyDuelRating(me ? me.rating : null);
  } catch (err) {
    console.warn("ELO indisponible :", err);
  }
}

/** À la connexion (ou au changement de compte), relit son ELO ; à la déconnexion, l'oublie. */
export function initDuelRanking() {
  onAuthChange((session) => {
    const id = session?.user?.id || null;
    if (id === lastUser) return;
    lastUser = id;
    if (!id) setMyDuelRating(null);
    else refreshMyDuelRating();
  });
  lastUser = currentUser()?.id || null;
  if (lastUser) refreshMyDuelRating();
}

/** Déclare le résultat d'un duel. Renvoie { status: "pending" | "settled", rating, delta } ou null. */
export async function reportDuel(match, won, name) {
  const token = await getAccessToken();
  if (!token) return null;
  return rpc("report_duel", { p_match: match, p_won: won, p_name: name.slice(0, 12) }, token);
}

/** Meilleurs joueurs ({ top: [{ name, rating, wins, losses }], me: {..., rank} | null }). */
export async function fetchDuelRanking() {
  const token = await getAccessToken();
  return rpc("get_duel_ranking", { p_limit: ONLINE.topCount }, token || undefined);
}
