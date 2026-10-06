// Classement mondial via l'API REST de Supabase (aucune bibliothèque nécessaire).

import { ONLINE } from "../config.js";

export function isOnlineEnabled() {
  return Boolean(ONLINE.supabaseUrl && ONLINE.supabaseAnonKey);
}

// Les anciennes clés « anon » (JWT, eyJ...) vont aussi dans Authorization ;
// les nouvelles clés « sb_publishable_... » ne passent que par l'en-tête apikey.
function authHeaders() {
  const key = ONLINE.supabaseAnonKey;
  return key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ONLINE.timeoutMs);
  try {
    const res = await fetch(`${ONLINE.supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** Envoie le score d'une partie. Renvoie true si l'envoi a réussi. */
export async function submitScore({ name, wave, xp, lvl }) {
  if (!isOnlineEnabled()) return false;
  try {
    await request(ONLINE.table, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ name, wave, xp: Math.floor(xp), lvl }),
    });
    return true;
  } catch (err) {
    console.warn("Score non envoyé :", err);
    return false;
  }
}

/** Meilleur score de chaque joueur, trié par XP décroissante. */
export async function fetchTopScores() {
  const query = `select=name,wave,xp,lvl&order=xp.desc&limit=${ONLINE.topCount}`;
  const res = await request(`${ONLINE.leaderboardView}?${query}`);
  return res.json();
}
