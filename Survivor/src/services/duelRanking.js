// Classement ELO du duel en ligne (voir supabase/schema.sql : report_duel, get_duel_ranking).
// Seuls les joueurs connectés sont classés ; chaque joueur déclare le résultat de son duel et
// le serveur ne compte le duel que lorsque les deux déclarations concordent.

import { ONLINE } from "../config.js";
import { currentUser, getAccessToken } from "./auth.js";
import { isOnlineEnabled, rpc } from "./supabase.js";

/** Ce joueur peut-il jouer un duel classé (connecté à son compte) ? */
export function canRank() {
  return isOnlineEnabled() && !!currentUser();
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
