// Partie interrompue : l'état complet de la partie en cours (game, player, world, pet, boîte mystère,
// caméra) est copié dans le stockage de l'appareil (`survivor_run`), puis rechargé par REPRENDRE sur
// l'accueil. Tout l'état d'une partie vit déjà dans ces objets (règle du duel sur un écran, voir
// systems/versus.js) : rien d'autre à sauvegarder, à part les choix d'amélioration en attente, que
// main.js passe dans `extra`. Propre à l'appareil : jamais envoyé avec la sauvegarde du compte.

import { STORAGE_KEYS } from "../config.js";
import {
  camera,
  game,
  mysteryBox,
  pet,
  player,
  resetGame,
  resetMysteryBox,
  resetPet,
  resetPlayer,
  world,
} from "../core/state.js";
import { BUILD } from "../build.js";
import { SnapshotError, decodeSnapshot, encodeSnapshot } from "../utils/snapshot.js";
import { captureError, logEvent } from "./diagnostics.js";

/** Format de la sauvegarde : un changement incompatible = numéro suivant (l'ancienne est oubliée). */
const VERSION = 1;

/** Listes purement visuelles : sauvegardées vides (elles se remplissent à nouveau en jouant). */
const VISUAL_LISTS = ["particles", "visualEffects", "floatingTexts", "ghosts", "bolts", "slashes", "trail"];

/**
 * @typedef {object} RunMeta résumé affiché sur l'accueil (bouton REPRENDRE)
 * @property {string} mode "normal" | "daily" | "rush"
 * @property {string} difficulty
 * @property {number} wave vague (Boss Rush : boss vaincus)
 * @property {number} level
 * @property {number} seconds durée de jeu
 * @property {number} pulse pulsation de l'Endless Pulse (0 = pas commencé)
 * @property {number} kills
 * @property {string} hero
 * @property {string} weapon
 */

/**
 * @typedef {object} SavedRun
 * @property {number} v
 * @property {string} build version du jeu qui a sauvegardé
 * @property {number} savedAt horodatage (ms)
 * @property {RunMeta} meta
 * @property {any} extra état propre à main.js (choix d'amélioration en attente...)
 * @property {{ roots: string[], table: any[] }} state
 */

/** Objets sauvegardés. Les listes de `world` d'abord : la reprise les remplit en place (même tableau). */
function roots() {
  const lists = Object.fromEntries(Object.keys(world).map((k) => [`world.${k}`, world[k]]));
  return { game, player, pet, mysteryBox, camera, ...lists, world };
}

/** Une partie peut-elle être sauvegardée maintenant ? (`duel` : une partie de duel est en cours) */
export function canSaveRun(duel) {
  return game.started && !game.over && !duel && player.health > 0;
}

/** Résumé de la partie chargée (accueil, statistiques d'un abandon). */
export function runMeta(mode) {
  return {
    mode,
    difficulty: game.difficulty,
    wave: game.rush ? game.rush.defeated : game.wave,
    level: player.level,
    seconds: Math.floor(game.time / 1000),
    pulse: game.endless?.depth || 0,
    kills: game.kills,
    hero: player.hero?.id || "",
    weapon: player.weapon?.id || "",
  };
}

let failed = false; // une valeur non sauvegardable n'est signalée qu'une fois par session

/**
 * Sauvegarde la partie chargée. Renvoie false si elle n'a pas pu l'être (stockage plein ou
 * indisponible, valeur impossible à copier : signalée au journal de diagnostic).
 * @param {string} mode
 * @param {any} [extra]
 */
export function saveRun(mode, extra = null) {
  try {
    const state = encodeSnapshot(roots(), {
      empty: [...VISUAL_LISTS.map((k) => world[k]).filter(Boolean), game.killCam?.frames].filter(Boolean),
    });
    /** @type {SavedRun} */
    const saved = { v: VERSION, build: BUILD, savedAt: Date.now(), meta: runMeta(mode), extra, state };
    localStorage.setItem(STORAGE_KEYS.run, JSON.stringify(saved));
    return true;
  } catch (err) {
    if (err instanceof SnapshotError) {
      if (!failed) captureError(err);
      failed = true;
    } else logEvent("partie", `sauvegarde impossible : ${err?.message || err}`);
    return false;
  }
}

/** Partie interrompue enregistrée sur cet appareil, ou null. Une sauvegarde illisible est oubliée. */
export function savedRun() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEYS.run);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    /** @type {SavedRun} */
    const saved = JSON.parse(raw);
    if (saved?.v === VERSION && saved.meta && Array.isArray(saved.state?.table)) return saved;
  } catch {
    // illisible : oubliée ci-dessous
  }
  clearRun();
  return null;
}

export function hasSavedRun() {
  return savedRun() !== null;
}

export function clearRun() {
  try {
    localStorage.removeItem(STORAGE_KEYS.run);
  } catch {
    // stockage indisponible : rien à effacer
  }
}

/**
 * Recharge une partie sauvegardée dans l'état global. Les champs apparus depuis la sauvegarde (mise à
 * jour du jeu entre-temps) prennent leur valeur de départ, pour qu'une partie d'avant une mise à jour
 * reste jouable.
 * @param {SavedRun} saved
 */
export function restoreRunState(saved) {
  resetGame();
  resetPlayer(1);
  resetPet(null);
  resetMysteryBox();
  const defaults = {
    game: { ...game },
    player: { ...player },
    pet: { ...pet },
    mysteryBox: { ...mysteryBox },
  };
  const lists = { ...world };
  decodeSnapshot(saved.state, roots());
  for (const [name, values] of Object.entries(defaults)) {
    const live = { game, player, pet, mysteryBox }[name];
    for (const key of Object.keys(values)) if (!(key in live)) live[key] = values[key];
  }
  for (const [key, list] of Object.entries(lists)) if (!Array.isArray(world[key])) world[key] = list;
  game.killCam = { frames: [], tick: 0, killer: null };
  // Marque de la grille spatiale (utils/spatialHash.js) : propre à la session qui l'a posée
  for (const list of Object.values(world)) for (const item of list) delete item?._hashStamp;
}
