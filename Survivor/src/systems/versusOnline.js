// Duel en ligne : chaque joueur fait tourner sa propre partie de survie chez lui (voir
// services/netplay.js pour la connexion) et envoie ses statistiques à l'adversaire quelques fois
// par seconde. Le premier mort perd ; si les deux meurent avant d'avoir reçu la nouvelle de l'autre,
// le meilleur score gagne (puis l'XP, puis l'hôte). Les deux appareils tranchent avec les mêmes chiffres.

import { NET } from "../config.js";
import { emit } from "../core/events.js";
import { game } from "../core/state.js";
import { checkConnection, sendGame } from "../services/netplay.js";
import { receiveAttack, receiveSpell } from "./duelAttacks.js";
import { runStats, versus } from "./versus.js";

const EMPTY = { w: 1, l: 1, h: 0, m: 1, k: 0, s: 0, x: 0, g: 0 };

/** Adversaire : dernières statistiques reçues, bilan final quand il est mort, connecté à un compte (duel classé). */
export const rival = { stats: null, alive: true, final: null, left: false, ranked: false };
let mine = null; // bilan de sa propre partie à sa mort
let lastSend = 0;

export function resetOnline() {
  Object.assign(rival, { stats: null, alive: true, final: null, left: false, ranked: false });
  mine = null;
  lastSend = 0;
}

/** À chaque image : envoie ses statistiques, surveille la connexion. */
export function netTick(now) {
  if (!versus.online) return;
  checkConnection(now);
  if (!versus.online || versus.winner !== null || mine) return;
  if (now - lastSend < 1000 / NET.statsPerSecond) return;
  lastSend = now;
  sendGame({ t: "st", ...runStats() });
}

/** Message reçu de l'adversaire. */
export function onNetMessage(msg) {
  if (!msg || !versus.online) return;
  if (msg.t === "ranked") rival.ranked = !!msg.on;
  else if (msg.t === "st" && rival.alive) rival.stats = msg;
  else if (msg.t === "atk" && rival.alive) receiveAttack(msg.n, msg.e);
  else if (msg.t === "hex" && rival.alive) receiveSpell(msg.s);
  else if (msg.t === "dead" && rival.alive) {
    rival.alive = false;
    rival.final = rival.stats = msg;
    decide();
  }
}

/** Sa propre partie vient de se terminer. */
export function onOwnDeath() {
  mine = runStats();
  sendGame({ t: "dead", ...mine });
  decide();
}

/** L'adversaire a quitté le duel (ou la connexion est perdue) : abandon de sa part. */
export function onRivalLeft() {
  rival.left = true;
  if (versus.winner !== null || !rival.alive) return;
  rival.alive = false;
  rival.final = rival.stats || EMPTY;
  decide();
}

/** Vainqueur : 0 = ce joueur, 1 = l'adversaire. Peut s'inverser une fois si les deux morts se croisent. */
function decide() {
  let winner;
  if (mine && !rival.alive) winner = beats(mine, rival.final) ? 0 : 1;
  else if (!rival.alive) winner = 0;
  else if (mine) winner = 1;
  else return;
  if (winner === versus.winner) return;
  versus.winner = winner;
  if (winner === 0 && !mine) {
    // L'adversaire est tombé le premier : sa propre partie s'arrête là
    game.running = false;
    game.over = true;
  }
  emit("versusOver", { winner, runs: [mine || runStats(), rival.final || rival.stats || EMPTY] });
}

function beats(a, b) {
  if (a.s !== b.s) return a.s > b.s;
  if (a.x !== b.x) return a.x > b.x;
  return versus.online.role === "host";
}
