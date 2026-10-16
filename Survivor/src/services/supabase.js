// Accès à l'API REST de Supabase (aucune bibliothèque nécessaire) : tables, fonctions RPC
// et authentification (GoTrue, voir services/auth.js).

import { ONLINE } from "../config.js";

export function isOnlineEnabled() {
  return Boolean(ONLINE.supabaseUrl && ONLINE.supabaseAnonKey);
}

// Les anciennes clés « anon » (JWT, eyJ...) vont aussi dans Authorization ;
// les nouvelles clés « sb_publishable_... » ne passent que par l'en-tête apikey.
// Un joueur connecté envoie son propre jeton (`token`) : Supabase sait alors qui il est (auth.uid()).
function authHeaders(token) {
  const key = ONLINE.supabaseAnonKey;
  if (token) return { apikey: key, Authorization: `Bearer ${token}` };
  return key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

const baseUrl = () => ONLINE.supabaseUrl.replace(/\/$/, "");

/** URL de l'API d'authentification (redirection vers Google). */
export function authUrl(path) {
  return `${baseUrl()}/auth/v1/${path}`;
}

export function request(path, options) {
  return send(`${baseUrl()}/rest/v1/${path}`, options);
}

/** Requête vers l'API d'authentification (/auth/v1/...). */
export function authRequest(path, options) {
  return send(authUrl(path), options);
}

/**
 * @param {string} url
 * @param {RequestInit & { token?: string }} [opts]
 */
async function send(url, { token, ...options } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ONLINE.timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...authHeaders(token),
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

/** Appelle une fonction SQL exposée (voir supabase/schema.sql) et renvoie son résultat. */
export async function rpc(name, args = {}, token) {
  const res = await request(`rpc/${name}`, { method: "POST", body: JSON.stringify(args), token });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
