// Bestiaire : chaque type d'ennemi éliminé débloque sa fiche (page bestiaire.html, textes dans data/bestiary.js).
// Compteur d'éliminations par type dans `account.bestiary`, donc synchronisé avec le compte.

import { emit } from "../core/events.js";
import { BESTIARY, BESTIARY_TYPES } from "../data/bestiary.js";
import { account } from "./storage.js";

/** Fiches débloquées et nombre total de fiches. */
export function bestiaryProgress(save = account) {
  const kills = save.bestiary || {};
  return { found: BESTIARY_TYPES.filter((t) => kills[t] > 0).length, total: BESTIARY_TYPES.length };
}

/**
 * Élimination d'un ennemi : compte le type, et à la première émet `bestiaryUnlocked` (notification en jeu).
 * Renvoie le nombre de fiches débloquées (statistique de succès « bestiary »).
 */
export function recordBestiaryKill(type) {
  if (!BESTIARY[type]) return null;
  account.bestiary ??= {};
  const first = !account.bestiary[type];
  account.bestiary[type] = (account.bestiary[type] || 0) + 1;
  const { found } = bestiaryProgress();
  if (first) emit("bestiaryUnlocked", { type, found });
  return found;
}
