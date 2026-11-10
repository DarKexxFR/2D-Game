// Défi entre amis : un code de 6 caractères désigne une partie à graine (héros, arme, modificateur et hasard
// imposés, comme le défi du jour, sans niveau de compte ni talents). On le partage par un lien qui emporte son
// score (« bats-moi : vague 12 ») ; l'ami joue la même partie et voit s'il a fait mieux. Hors classements, aucun
// serveur : le code suffit à retrouver les règles, le score à battre voyage dans le lien.
//
// Lien : https://last-pulse.com/#defi=K7Q2M9 ou #defi=K7Q2M9.12.4530.Pseudo (vague, XP, pseudo de l'auteur).
// Il est lu puis effacé de l'adresse avant le routeur (comme #transfer=... et #access_token=...).

import { FRIEND_CHALLENGE } from "../config.js";
import { hash, rulesFromSeed } from "./daily.js";
import { account, saveAccount } from "./storage.js";

/**
 * @typedef {{ wave: number, xp: number }} ChallengeScore
 * @typedef {{ code: string, from: string, target: ChallengeScore | null, best: ChallengeScore | null,
 *   at: number }} SavedChallenge
 */

/** Code tapé ou collé → code valide (majuscules, sans espaces ni tirets), ou "" s'il n'en est pas un. */
export function normalizeCode(text) {
  const code = String(text || "")
    .toUpperCase()
    .replace(/[\s-]/g, "");
  const ok =
    code.length === FRIEND_CHALLENGE.codeLength &&
    [...code].every((c) => FRIEND_CHALLENGE.alphabet.includes(c));
  return ok ? code : "";
}

/** Nouveau code au hasard (jamais avec Math.random, qui peut être remplacé par une graine en partie). */
export function newChallengeCode() {
  const { alphabet, codeLength } = FRIEND_CHALLENGE;
  const bytes = crypto.getRandomValues(new Uint8Array(codeLength));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

/** Règles d'un défi : graine, héros, arme et modificateur, les mêmes pour tous ceux qui ont le code. */
export function challengeRules(code) {
  return { code, ...rulesFromSeed(hash(`survivor-defi-${code}`)) };
}

/** Pseudo emporté par un lien : texte simple et court. */
function cleanName(name) {
  return String(name || "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .trim()
    .slice(0, FRIEND_CHALLENGE.nameMax);
}

/** Meilleur des deux scores : la vague d'abord, l'XP pour départager. */
export function isBetter(a, b) {
  if (!a) return false;
  if (!b) return true;
  return a.wave > b.wave || (a.wave === b.wave && a.xp > b.xp);
}

/**
 * Lien à partager (avec son meilleur score s'il en a un).
 * @param {string} code
 * @param {ChallengeScore | null} score
 * @param {string} name
 */
export function challengeLink(code, score = null, name = "") {
  const base = location.origin + location.pathname;
  const tail = score ? `.${score.wave}.${Math.floor(score.xp)}.${encodeURIComponent(cleanName(name))}` : "";
  return `${base}#defi=${code}${tail}`;
}

/** Lit un fragment « #defi=... » ; null s'il n'en est pas un. */
export function parseChallengeHash(fragment) {
  const m = /^#defi=([A-Za-z0-9]+)(?:\.(\d{1,4})\.(\d{1,10})\.(.*))?$/.exec(fragment);
  const code = normalizeCode(m?.[1]);
  if (!code) return null;
  let from = "";
  try {
    from = cleanName(decodeURIComponent(m[4] || ""));
  } catch {
    // pseudo mal encodé : le défi reste valable, sans nom
  }
  const target = m[2] ? { wave: Number(m[2]), xp: Number(m[3]) } : null;
  return { code, from, target };
}

/** Lien de défi reçu : lu puis retiré de l'adresse (à appeler avant le routeur). */
export function takeChallengeLink() {
  const link = parseChallengeHash(location.hash);
  if (link) history.replaceState(history.state, "", location.pathname + location.search);
  return link;
}

// --- Défis gardés dans le compte (synchronisés avec lui) ---

/** @returns {SavedChallenge[]} */
export function savedChallenges() {
  return account.challenges;
}

export function findChallenge(code) {
  return account.challenges.find((c) => c.code === code) || null;
}

/**
 * Retient un défi (en tête de liste). Un lien reçu garde le meilleur score à battre déjà connu pour ce code.
 * @param {string} code
 * @param {{ from?: string, target?: ChallengeScore | null }} [link]
 */
export function rememberChallenge(code, link = {}) {
  const list = account.challenges;
  const old = findChallenge(code);
  /** @type {SavedChallenge} */
  const entry = old || { code, from: "", target: null, best: null, at: 0 };
  if (link.target && isBetter(link.target, entry.target)) {
    entry.target = link.target;
    entry.from = link.from || "";
  }
  entry.at = Date.now();
  if (old) list.splice(list.indexOf(old), 1);
  list.unshift(entry);
  list.length = Math.min(list.length, FRIEND_CHALLENGE.saved);
  saveAccount();
  return entry;
}

/**
 * Fin d'une partie de défi : nouveau record pour ce code ? score de l'ami battu ?
 * @param {string} code
 * @param {ChallengeScore} score
 */
export function recordChallengeRun(code, score) {
  const entry = findChallenge(code) || rememberChallenge(code);
  const run = { wave: score.wave, xp: Math.floor(score.xp) };
  const isRecord = isBetter(run, entry.best);
  if (isRecord) entry.best = run;
  saveAccount();
  return { entry, isRecord, beat: !!entry.target && isBetter(run, entry.target) };
}

/** Sauvegarde relue (services/storage.js) : seuls des défis bien formés sont gardés. */
export function sanitizeChallenges(raw) {
  if (!Array.isArray(raw)) return [];
  const score = (s) =>
    s && Number.isFinite(s.wave) && Number.isFinite(s.xp) ? { wave: s.wave, xp: s.xp } : null;
  return raw
    .filter((c) => c && normalizeCode(c.code))
    .slice(0, FRIEND_CHALLENGE.saved)
    .map((c) => ({
      code: normalizeCode(c.code),
      from: cleanName(c.from),
      target: score(c.target),
      best: score(c.best),
      at: Number(c.at) || 0,
    }));
}
