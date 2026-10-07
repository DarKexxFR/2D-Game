// Classement mondial (table « scores » de Supabase).

import { ONLINE } from "../config.js";
import { DEFAULT_PSEUDO } from "./storage.js";
import { isOnlineEnabled, request } from "./supabase.js";

export { isOnlineEnabled };

/**
 * Envoie le score d'une partie. Renvoie un statut :
 *  "sent", "defaultName" (pseudo par défaut, partagé par tout le monde),
 *  "empty" (partie sans XP), "rateLimited" (anti-spam côté base) ou "error".
 */
export async function submitScore({ name, wave, xp, lvl }) {
  if (name.trim().toLowerCase() === DEFAULT_PSEUDO.toLowerCase()) return "defaultName";
  if (Math.floor(xp) <= 0) return "empty";
  try {
    await request(ONLINE.table, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ name, wave, xp: Math.floor(xp), lvl }),
    });
    return "sent";
  } catch (err) {
    // P0001 = exception levée par le trigger anti-spam (voir supabase/schema.sql)
    if (String(err.message).includes("P0001")) return "rateLimited";
    console.warn("Score non envoyé :", err);
    return "error";
  }
}

export const SUBMIT_MESSAGES = {
  sent: "Score envoyé au classement mondial",
  defaultName: "Choisis un pseudo pour apparaître au classement mondial",
  empty: "",
  rateLimited: "⏱️ Score non envoyé : parties trop rapprochées",
  error: "Classement mondial indisponible",
};

/** Meilleur score de chaque joueur, trié par XP décroissante. */
export async function fetchTopScores() {
  const query = `select=name,wave,xp,lvl&order=xp.desc&limit=${ONLINE.topCount}`;
  const res = await request(`${ONLINE.leaderboardView}?${query}`);
  return res.json();
}
