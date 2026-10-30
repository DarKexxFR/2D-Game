// Duel en ligne : chaque joueur fait tourner sa propre partie de survie chez lui (voir
// services/netplay.js pour la connexion) et envoie ses statistiques à l'adversaire quelques fois
// par seconde. Le premier mort perd ; si les deux meurent avant d'avoir reçu la nouvelle de l'autre,
// le meilleur score gagne (puis l'XP, puis l'hôte). Les deux appareils tranchent avec les mêmes chiffres.

import { NET } from "../config.js";
import { emit } from "../core/events.js";
import { game, player, world } from "../core/state.js";
import { ENEMY_TYPES } from "../data/enemies.js";
import { checkConnection, net, sendGame } from "../services/netplay.js";
import { currentSkin, shipLook } from "../services/skins.js";
import { duelTime, healthPct, logHealth, receiveAttack, receiveSpell } from "./duelAttacks.js";
import { runStats, versus } from "./versus.js";

const EMPTY = { w: 1, l: 1, h: 0, m: 1, k: 0, s: 0, x: 0, g: 0, a: 0, p: 0 };
const newLog = () => ({ hp: [], marks: [], sent: 0, cast: 0, lastT: -1e9 });

/** Adversaire : dernières statistiques reçues, bilan final quand il est mort, connecté à un compte (duel classé). */
export const rival = {
  stats: null,
  alive: true,
  final: null,
  left: false,
  ranked: false,
  rating: null, // son ELO annoncé (affichage du rang seulement, le serveur fait foi pour le classement)
  view: null,
  log: newLog(), // récap de fin : sa vie (reçue avec ses statistiques), ses attaques et sorts reçus ici
};
let mine = null; // bilan de sa propre partie à sa mort
let lastSend = 0;
let lastView = 0;

export function resetOnline() {
  Object.assign(rival, {
    stats: null,
    alive: true,
    final: null,
    left: false,
    ranked: false,
    rating: null,
    view: null,
    log: newLog(),
  });
  mine = null;
  lastSend = 0;
  lastView = 0;
}

export const ENEMY_KEYS = Object.keys(ENEMY_TYPES);

/**
 * Scène de sa partie pour l'aperçu de l'adversaire : vaisseau { x, y, a (visée), h (vie), w (vague),
 * s: [coque, couleur] } et ennemis proches [id, type, x, y, taille, drapeaux (1 élite, 2 furie), vie %].
 */
function sceneSnapshot() {
  const { viewEnemies, viewRange } = NET;
  const px = player.worldX;
  const py = player.worldY;
  const near = [];
  for (const e of world.enemies) {
    if (e.dead || Math.abs(e.x - px) > viewRange || Math.abs(e.y - py) > viewRange) continue;
    near.push(e);
  }
  if (near.length > viewEnemies) {
    near.sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
    near.length = viewEnemies;
  }
  const look = shipLook(player.hero, currentSkin());
  return {
    t: "vw",
    x: Math.round(px),
    y: Math.round(py),
    a: Math.round((player.aimAngle || 0) * 100) / 100,
    h: Math.round((Math.max(0, player.health) / player.maxHealth) * 100),
    w: game.wave,
    s: [look.hull, look.color],
    e: near.map((e) => [
      e.id,
      ENEMY_KEYS.indexOf(e.type),
      Math.round(e.x),
      Math.round(e.y),
      Math.round(e.size),
      (e.elite ? 1 : 0) | (e.enraged ? 2 : 0),
      Math.round((Math.max(0, e.health) / e.maxHealth) * 100),
    ]),
  };
}

/** À chaque image : envoie ses statistiques, surveille la connexion. */
export function netTick(now) {
  if (!versus.online) return;
  checkConnection(now);
  if (!versus.online || versus.winner !== null || mine) return;
  if (now - lastView >= 1000 / (net.relay ? NET.viewPerSecondRelay : NET.viewPerSecond)) {
    lastView = now;
    sendGame(sceneSnapshot());
  }
  if (now - lastSend < 1000 / NET.statsPerSecond) return;
  lastSend = now;
  sendGame({ t: "st", ...runStats() });
}

/** Scène reçue : les deux dernières sont gardées pour lisser les mouvements entre deux envois. */
function onView(msg) {
  if (!Array.isArray(msg.e) || !Array.isArray(msg.s)) return;
  const now = performance.now();
  const v = rival.view;
  rival.view = { prev: v?.cur || msg, cur: msg, at: now, gap: v ? Math.min(500, now - v.at) : 125 };
}

/** ELO annoncé par l'adversaire : un nombre plausible, sinon rien. */
export const ratingOf = (v) => (Number.isFinite(v) && v >= 0 && v < 10000 ? Math.round(v) : null);

/** Message reçu de l'adversaire. */
export function onNetMessage(msg) {
  if (!msg || !versus.online) return;
  if (msg.t === "ranked") {
    rival.ranked = !!msg.on;
    rival.rating = ratingOf(msg.rating);
  } else if (msg.t === "st" && rival.alive) {
    rival.stats = msg;
    if (msg.m > 0) logHealth(rival.log, (msg.h / msg.m) * 100);
  } else if (msg.t === "vw" && rival.alive) onView(msg);
  else if (msg.t === "atk" && rival.alive) {
    rival.log.marks.push({ t: duelTime(), k: msg.e ? "elite" : "atk" });
    receiveAttack(msg.n, msg.e);
  } else if (msg.t === "hex" && rival.alive) {
    rival.log.marks.push({ t: duelTime(), k: "hex" });
    receiveSpell(msg.s);
  } else if (msg.t === "dead" && rival.alive) {
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
  logHealth(game.duelLog, mine ? 0 : healthPct(), true); // points finals des courbes
  if (!rival.alive) logHealth(rival.log, 0, true);
  emit("versusOver", {
    winner,
    runs: [mine || runStats(), rival.final || rival.stats || EMPTY],
    logs: [game.duelLog, rival.log],
  });
}

function beats(a, b) {
  if (a.s !== b.s) return a.s > b.s;
  if (a.x !== b.x) return a.x > b.x;
  return versus.online.role === "host";
}
