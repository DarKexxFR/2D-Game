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
export async function submitScore({ name, wave, xp, lvl, day, nightmare = false, pulse = 0 }) {
  if (name.trim().toLowerCase() === DEFAULT_PSEUDO.toLowerCase()) return "defaultName";
  if (Math.floor(xp) <= 0) return "empty";
  // Avec `day`, le score va au classement du défi quotidien ; `nightmare` : classement Cauchemar
  // `pulse` : pulsations franchies en Endless Pulse (classement Endless), envoyé seulement s'il y en a
  const row = {
    name,
    wave,
    xp: Math.floor(xp),
    lvl,
    ...(day ? { day } : {}),
    ...(pulse > 0 ? { pulse } : {}),
  };
  const table = day ? ONLINE.dailyTable : nightmare ? ONLINE.nightmareTable : ONLINE.table;
  try {
    await request(table, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(row),
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

/** Classement du mode Cauchemar (meilleur score de chaque joueur). */
export async function fetchNightmareScores() {
  const query = `select=name,wave,xp,lvl&order=xp.desc&limit=${ONLINE.topCount}`;
  const res = await request(`${ONLINE.nightmareView}?${query}`);
  return res.json();
}

/** Classement de la saison (mois UTC en cours) : meilleur score de chaque joueur depuis le 1er du mois. */
export async function fetchSeasonScores() {
  const query = `select=name,wave,xp,lvl&order=xp.desc&limit=${ONLINE.topCount}`;
  const res = await request(`${ONLINE.seasonView}?${query}`);
  return res.json();
}

/**
 * Classement Endless Pulse : parties qui ont continué après la victoire (Normal et Cauchemar), triées par
 * pulsations franchies puis par XP. `nightmare` = partie en Cauchemar.
 */
export async function fetchEndlessScores() {
  const query = `select=name,pulse,wave,xp,lvl,nightmare&order=pulse.desc,xp.desc&limit=${ONLINE.topCount}`;
  const res = await request(`${ONLINE.endlessView}?${query}`);
  return res.json();
}

/** Classement du défi quotidien d'un jour donné (meilleur score de chaque joueur). */
export async function fetchDailyScores(day) {
  const query = `select=name,wave,xp,lvl&day=eq.${day}&order=xp.desc&limit=${ONLINE.topCount}`;
  const res = await request(`${ONLINE.dailyView}?${query}`);
  return res.json();
}
