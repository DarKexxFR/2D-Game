// Skins : options possédées, achat et apparence effective du vaisseau (forme, couleurs, traînée).

import { DEFAULT_SKIN, RAINBOW, RAINBOW_UNLOCK, SKIN_HULLS, SKIN_TRAILS } from "../data/skins.js";
import { account, saveAccount } from "./storage.js";

const HULL_IDS = new Set(SKIN_HULLS.map((h) => h.id));
const TRAIL_IDS = new Set(SKIN_TRAILS.map((t) => t.id));
const COLOR = /^#[0-9a-f]{6}$/i;

/** @typedef {{ id: string, name: string, price: number, unlock: string, season?: boolean }} SkinOffer */

/**
 * Option achetable (ou exclusive du passe de saison) correspondant à une valeur d'une pièce (null si elle
 * est gratuite).
 * @returns {SkinOffer | null}
 */
export function skinOffer(key, value) {
  if (value === RAINBOW) return { ...RAINBOW_UNLOCK, unlock: RAINBOW_UNLOCK.id };
  const list = key === "hull" ? SKIN_HULLS : key === "trail" ? SKIN_TRAILS : null;
  const option = list?.find((o) => o.id === value);
  return option?.price || option?.season ? { ...option, unlock: `${key}:${value}` } : null;
}

/** Débloque une option exclusive (passe de saison). Renvoie false si elle était déjà possédée. */
export function grantSkin(unlock) {
  if (account.skinsOwned.includes(unlock)) return false;
  account.skinsOwned.push(unlock);
  saveAccount();
  return true;
}

export function ownsSkin(key, value) {
  const offer = skinOffer(key, value);
  return !offer || account.skinsOwned.includes(offer.unlock);
}

/** Valeur acceptée pour une pièce (les sauvegardes anciennes ou modifiées retombent sur le défaut). */
function isValid(key, value) {
  if (key === "hull") return HULL_IDS.has(value);
  if (key === "trail") return TRAIL_IDS.has(value);
  return value === null || value === RAINBOW || COLOR.test(value);
}

/** Choisit une valeur possédée pour une pièce. Renvoie true si le choix est pris en compte. */
export function setSkinPart(key, value) {
  if (!(key in DEFAULT_SKIN) || !isValid(key, value) || !ownsSkin(key, value)) return false;
  account.skin[key] = value;
  saveAccount();
  return true;
}

/** Achète l'option d'une pièce puis l'équipe. Renvoie true si l'achat a réussi. */
export function buySkin(key, value) {
  const offer = skinOffer(key, value);
  if (!offer || offer.season || ownsSkin(key, value) || account.gold < offer.price) return false;
  account.gold -= offer.price;
  account.skinsOwned.push(offer.unlock);
  account.skin[key] = value;
  saveAccount();
  return true;
}

/** Réglages effectifs : une pièce invalide ou non possédée reprend sa valeur par défaut. */
export function currentSkin(skin = account.skin) {
  const out = {};
  for (const key of Object.keys(DEFAULT_SKIN)) {
    const value = skin?.[key];
    out[key] = value !== undefined && isValid(key, value) && ownsSkin(key, value) ? value : DEFAULT_SKIN[key];
  }
  return out;
}

/** Couleur arc-en-ciel à l'instant `t` (ms), arrondie à 24 teintes (les sprites sont mis en cache). */
export function rainbowColor(t, offset = 0) {
  const hue = Math.floor((t / 40 + offset) / 15) * 15;
  return hslToHex(((hue % 360) + 360) % 360, 1, 0.6);
}

/** Couleur d'une pièce : valeur choisie, arc-en-ciel animé ou couleur par défaut. */
export function resolveColor(value, fallback, t = performance.now(), offset = 0) {
  if (value === RAINBOW) return rainbowColor(t, offset);
  return value || fallback;
}

/** Apparence du vaisseau pour un héros donné (accueil, partie, aperçu). */
export function shipLook(hero, skin = currentSkin(), t = performance.now()) {
  const ship = resolveColor(skin.ship, hero?.color || "#00ccff", t);
  return {
    hull: skin.hull === "hero" ? hero?.hull || "arrow" : skin.hull,
    color: ship,
    trail: skin.trail,
    trailColor: resolveColor(skin.trailColor, ship, t, 120),
  };
}

function hslToHex(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}
