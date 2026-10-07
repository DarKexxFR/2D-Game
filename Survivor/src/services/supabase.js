// Accès à l'API REST de Supabase (aucune bibliothèque nécessaire) : tables et fonctions RPC.

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

export async function request(path, options = {}) {
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

/** Appelle une fonction SQL exposée (voir supabase/schema.sql) et renvoie son résultat. */
export async function rpc(name, args) {
  const res = await request(`rpc/${name}`, { method: "POST", body: JSON.stringify(args) });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
