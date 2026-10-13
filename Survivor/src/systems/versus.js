// Duel : chaque joueur joue sa propre partie de survie (les règles du mode normal) ; le premier
// qui meurt perd, et le gagnant empoche l'XP et l'or des deux parties.
//
// Sur un écran, les deux parties tournent en même temps, écran scindé en deux. Le jeu n'a qu'un
// état global (game, player, world...) : la partie qui n'avance pas est rangée de côté (`stash`)
// et échangée avec l'état global le temps de faire avancer ou de dessiner l'autre (`withRun`).
// En ligne (voir versusOnline.js), chaque appareil ne fait tourner que sa propre partie.

import { TICK_MS } from "../config.js";
import { view } from "../core/canvas.js";
import { emit } from "../core/events.js";
import { useInputProfile } from "../core/input.js";
import { camera, game, mysteryBox, pet, player, world } from "../core/state.js";
import { activateSkill } from "./skills.js";
import { trailState } from "./trail.js";

export const versus = {
  active: false,
  split: false, // deux parties sur cet écran
  online: null, // en ligne : { role: "host" | "guest" } ; la partie 0 est celle de ce joueur
  names: ["JOUEUR 1", "JOUEUR 2"],
  paused: false, // écran scindé : pause commune aux deux parties
  winner: null, // index du gagnant, une fois le duel joué
  current: 0, // écran scindé : partie chargée dans l'état global
};

/** Joystick et touche « dash » tactiles de chaque joueur (écrits par ui/versusTouch.js). */
export const versusTouch = [
  { x: 0, y: 0, dash: false },
  { x: 0, y: 0, dash: false },
];

/** Écran scindé : touches de chaque joueur (J1 à gauche du clavier, J2 autour des flèches). */
export const VERSUS_KEYS = [
  { up: ["z", "w"], down: ["s"], left: ["q", "a"], right: ["d"], dash: ["space"], skill: ["e", "r"] },
  {
    up: ["arrowup"],
    down: ["arrowdown"],
    left: ["arrowleft"],
    right: ["arrowright"],
    dash: ["enter", "0"],
    skill: ["shift", "1"],
  },
];

const profiles = VERSUS_KEYS.map((keys, i) => ({ keys, virtual: {}, stick: versusTouch[i] }));

export function fighterName(i) {
  return versus.names[i] || `JOUEUR ${i + 1}`;
}

// --- DEUX PARTIES DANS UN SEUL ÉTAT ---

const LIVE = { game, camera, player, pet, mysteryBox, trail: trailState };
const stash = { world: {} }; // la partie rangée de côté
for (const name of Object.keys(LIVE)) stash[name] = {};

function swapObject(a, b) {
  const copy = { ...a };
  for (const k of Object.keys(a)) delete a[k];
  Object.assign(a, b);
  for (const k of Object.keys(b)) delete b[k];
  Object.assign(b, copy);
}

function swapRuns() {
  for (const [name, live] of Object.entries(LIVE)) swapObject(live, stash[name]);
  for (const k of Object.keys(world)) [world[k], stash.world[k]] = [stash.world[k] ?? [], world[k]];
  versus.current = 1 - versus.current;
}

let depth = 0; // withRun imbriqués (un événement pendant le tick d'une partie, par exemple)
let rect = null; // moitié d'écran de la partie chargée
const full = { width: 0, height: 0 };

/** Moitié d'écran de la partie `i` : côte à côte, ou l'une sur l'autre en portrait (J1 en bas). */
export function halfRect(i) {
  const w = depth > 0 ? full.width : view.width;
  const h = depth > 0 ? full.height : view.height;
  if (w >= h) return { x: (i * w) / 2, y: 0, w: w / 2, h };
  return { x: 0, y: i === 0 ? h / 2 : 0, w, h: h / 2 };
}

/**
 * Écran scindé : exécute `fn(moitié d'écran)` avec la partie `i` chargée dans l'état global,
 * la vue réduite à sa moitié d'écran et les commandes de son joueur.
 */
export function withRun(i, fn) {
  if (depth > 0 && i === versus.current) return fn(rect);
  if (depth === 0) {
    full.width = view.width;
    full.height = view.height;
  }
  const saved = { rect, width: view.width, height: view.height };
  const swap = i !== versus.current;
  rect = halfRect(i);
  view.width = rect.w;
  view.height = rect.h;
  if (swap) swapRuns();
  useInputProfile(profiles[i]);
  depth++;
  try {
    return fn(rect);
  } finally {
    depth--;
    if (swap) swapRuns();
    ({ rect } = saved);
    view.width = saved.width;
    view.height = saved.height;
    useInputProfile(depth > 0 ? profiles[versus.current] : null);
  }
}

// --- DÉROULEMENT ---

/** Duel en ligne : la partie de ce joueur tourne normalement, l'adversaire est suivi à part. */
export function startOnlineVersus(online, names) {
  stopVersus();
  Object.assign(versus, { active: true, online, names: [...names] });
}

/** Écran scindé : `setupRun()` prépare une partie (appelée une fois par joueur). */
export function startSplitVersus(setupRun) {
  stopVersus();
  Object.assign(versus, { active: true, split: true });
  for (const i of [0, 1]) withRun(i, setupRun);
}

export function stopVersus() {
  for (const t of versusTouch) Object.assign(t, { x: 0, y: 0, dash: false });
  for (const [name, obj] of Object.entries(stash)) {
    if (name !== "world") for (const k of Object.keys(obj)) delete obj[k];
  }
  stash.world = {};
  slowTicks.fill(0);
  Object.assign(versus, {
    active: false,
    split: false,
    online: null,
    names: ["JOUEUR 1", "JOUEUR 2"],
    paused: false,
    winner: null,
    current: 0,
  });
}

const slowTicks = [0, 0];

/**
 * Tick de l'écran scindé : fait avancer chaque partie avec `simulate()` ; `waiting(i)` est appelé
 * pour une partie arrêtée sur un choix d'amélioration.
 */
export function updateSplit(simulate, waiting) {
  if (versus.paused || versus.winner !== null) return;
  for (const i of [0, 1]) {
    withRun(i, () => {
      if (game.over) return;
      if (!game.running || game.paused) return waiting(i);
      if (game.slowMo > 0 && ++slowTicks[i] % 3) return; // ralenti à la mort d'un boss (×1/3)
      const touch = versusTouch[i];
      profiles[i].virtual.dash = touch.dash;
      touch.dash = false;
      game.time += TICK_MS;
      simulate();
      profiles[i].virtual.dash = false;
    });
    if (versus.winner !== null) return; // l'un des deux vient de mourir
  }
}

/** Compétence du joueur `i` (touche ou bouton tactile). */
export function useSkill(i) {
  if (!versus.split || versus.paused || versus.winner !== null) return;
  withRun(i, () => game.running && !game.paused && activateSkill());
}

/** Bilan d'une partie (écran du vainqueur, envoyé à l'adversaire en ligne). */
export function runStats() {
  return {
    w: game.wave,
    l: player.level,
    h: Math.round(Math.max(0, player.health)),
    m: Math.round(player.maxHealth),
    k: game.kills,
    s: game.score,
    x: Math.floor(game.totalRunXp),
    g: game.runGold,
  };
}

/** Écran scindé : le joueur `loser` vient de mourir, l'autre gagne. */
export function splitDeath(loser) {
  versus.winner = 1 - loser;
  const runs = [0, 1].map((i) => withRun(i, runStats));
  emit("versusOver", { winner: versus.winner, runs });
}

/** Écran scindé : annonce dans la moitié d'écran de la partie en cours (boss, biome...). */
export function splitBanner(text, color) {
  game.banner = { text, color, until: game.time + 3000 };
}
