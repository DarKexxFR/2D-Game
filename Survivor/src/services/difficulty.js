// Niveaux de difficulté (Facile / Normal / Cauchemar), choisis à l'accueil et retenus dans le compte.

import { DIFFICULTIES } from "../config.js";
import { getStat } from "./achievements.js";
import { account, saveAccount } from "./storage.js";

export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES);

/** Vrai si le niveau est jouable (Cauchemar : record de vague suffisant). */
export function isDifficultyUnlocked(id) {
  const d = DIFFICULTIES[id];
  return !!d && getStat("bestWave") >= (d.unlockWave ?? 0);
}

/** Niveau choisi (Normal s'il n'existe plus ou n'est pas encore débloqué). */
export function selectedDifficulty() {
  return isDifficultyUnlocked(account.difficulty) ? account.difficulty : "normal";
}

export function setDifficulty(id) {
  if (!isDifficultyUnlocked(id)) return false;
  account.difficulty = id;
  saveAccount();
  return true;
}

/** Modificateur de partie (`game.modifier`, voir systems/spawner.js) d'un niveau de difficulté. */
export function difficultyModifier(id) {
  const d = DIFFICULTIES[id] || DIFFICULTIES.normal;
  return {
    enemyHealth: d.enemyHealth ?? 1,
    enemyDamage: d.enemyDamage ?? 1,
    enemySpeed: d.enemySpeed ?? 1,
    eliteShift: d.eliteShift ?? 0,
    enemyXp: d.rewards,
    goldMult: d.rewards,
  };
}
