// Connexion facultative (Google, Discord ou code reçu par e-mail) via l'API d'authentification
// de Supabase, sans bibliothèque. On peut toujours jouer sans compte ; la connexion sert
// à retrouver sa progression sur tous ses appareils (voir services/accountSync.js).
//
// Google / Discord : redirection vers le service puis retour sur le jeu avec la session dans l'URL (#access_token=...).
// E-mail : Supabase envoie un code à 6 chiffres (ou un lien, selon le modèle d'e-mail) à saisir dans le jeu.

import { STORAGE_KEYS } from "../config.js";
import { authRequest, authUrl, isOnlineEnabled } from "./supabase.js";

const REFRESH_MARGIN_MS = 60_000; // on renouvelle la session une minute avant son expiration

/** Session courante : { accessToken, refreshToken, expiresAt, user: { id, email, provider } } ou null. */
let session = null;
const listeners = [];

export function onAuthChange(fn) {
  listeners.push(fn);
}

function setSession(next) {
  session = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEYS.auth);
  } catch {}
  for (const fn of listeners) fn(session);
}

export function currentUser() {
  return session?.user ?? null;
}

/** Réponse de Supabase (verify, token, retour de Google ou Discord) → notre format de session. */
function toSession(data, user = data.user) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
    user: user && {
      id: user.id,
      email: user.email || "",
      provider: user.app_metadata?.provider || "email",
    },
  };
}

/**
 * Au démarrage : récupère la session revenue de Google / Discord (ou d'un lien reçu par e-mail) dans l'URL,
 * sinon celle enregistrée. Renvoie true si le joueur vient de se connecter par redirection.
 */
export async function initAuth() {
  try {
    session = JSON.parse(localStorage.getItem(STORAGE_KEYS.auth) || "null");
  } catch {
    session = null;
  }
  if (!isOnlineEnabled()) return false;
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.has("access_token") && !params.has("error_description")) return false;
  history.replaceState(null, "", location.pathname + location.search); // nettoie l'URL
  if (!params.has("access_token")) {
    console.warn("Connexion refusée :", params.get("error_description"));
    return false;
  }
  try {
    const data = Object.fromEntries(params);
    const res = await authRequest("user", { token: data.access_token });
    setSession(toSession(data, await res.json()));
    return true;
  } catch (err) {
    console.warn("Connexion impossible :", err);
    return false;
  }
}

/** Adresse de retour après Google, Discord ou un lien e-mail : la page du jeu elle-même. */
function returnUrl() {
  return location.origin + location.pathname;
}

/** Connexion par un service externe (« google », « discord ») activé dans Supabase. */
export function signInWith(provider) {
  location.assign(authUrl(`authorize?provider=${provider}&redirect_to=${encodeURIComponent(returnUrl())}`));
}

/** Envoie un code de connexion par e-mail (le compte est créé au besoin). */
export async function sendEmailCode(email) {
  await authRequest(`otp?redirect_to=${encodeURIComponent(returnUrl())}`, {
    method: "POST",
    body: JSON.stringify({ email, create_user: true }),
  });
}

/** Vérifie le code reçu par e-mail et ouvre la session. */
export async function verifyEmailCode(email, code) {
  const res = await authRequest("verify", {
    method: "POST",
    body: JSON.stringify({ type: "email", email, token: code }),
  });
  setSession(toSession(await res.json()));
}

/** Jeton valide pour appeler Supabase en tant que joueur (renouvelé si besoin), ou null. */
export async function getAccessToken() {
  if (!session) return null;
  if (Date.now() < session.expiresAt - REFRESH_MARGIN_MS) return session.accessToken;
  try {
    const res = await authRequest("token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
    const data = await res.json();
    setSession({ ...toSession(data), user: session.user });
    return session.accessToken;
  } catch (err) {
    console.warn("Session expirée :", err);
    return null;
  }
}

/** Déconnexion : la progression reste sur l'appareil, seule la session est oubliée. */
export async function signOut() {
  const token = session?.accessToken;
  setSession(null);
  if (!token) return;
  try {
    await authRequest("logout", { method: "POST", token });
  } catch {}
}
