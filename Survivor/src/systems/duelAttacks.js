// Duel : attaques entre joueurs. Chaque élimination remplit deux jauges :
// - attaque : pleine, elle envoie des ennemis dans la partie de l'adversaire (tuer un boss envoie
//   aussi des élites) ;
// - sort : pleine, elle donne un sort tiré au hasard (ralenti, brouillard, tir coupé), que le joueur
//   lance quand il veut (touche ou bouton) et qui gêne l'adversaire quelques secondes.
// Sur un écran, tout arrive directement dans l'autre partie ; en ligne, par le réseau.

import { VERSUS } from "../config.js";
import { emit } from "../core/events.js";
import { game, player, world } from "../core/state.js";
import { sendGame } from "../services/netplay.js";
import { addFloatingText } from "./effects.js";
import { spawnEnemy } from "./spawner.js";
import { versus, withRun } from "./versus.js";

/** Un ennemi vient de mourir dans la partie chargée : la jauge d'attaque de son joueur avance. */
export function chargeAttack(enemy) {
  if (!versus.active || versus.winner !== null || game.over) return;
  const A = VERSUS.attack;
  if (enemy.template.isBoss) launch(A.bossElites, true);
  if (++game.duelAttack >= A.killsPerSend) {
    game.duelAttack = 0;
    launch(A.mobs, false);
  }
  if (!game.spellReady && ++game.duelSpell >= VERSUS.spell.killsPerSpell) {
    game.duelSpell = 0;
    game.spellReady = SPELL_TYPES[Math.floor(Math.random() * SPELL_TYPES.length)];
    addFloatingText(
      player.worldX,
      player.worldY - 80,
      `SORT PRÊT : ${SPELLS[game.spellReady]}`,
      "#00ff88",
      16,
      90,
    );
  }
}

export const SPELLS = { slow: "RALENTI", fog: "BROUILLARD", jam: "TIR COUPÉ" };
const SPELL_TYPES = Object.keys(SPELLS);

/** Part de la jauge d'attaque remplie (0 à 1), pour les bandeaux. */
export function attackProgress() {
  return Math.min(1, (game.duelAttack || 0) / VERSUS.attack.killsPerSend);
}

/** Part de la jauge de sort remplie (1 quand un sort est prêt). */
export function spellProgress() {
  return game.spellReady ? 1 : Math.min(1, (game.duelSpell || 0) / VERSUS.spell.killsPerSpell);
}

/** Temps du récap : ms depuis le début du duel. */
export function duelTime() {
  return performance.now() - versus.startedAt;
}

function mark(kind) {
  game.duelLog.marks.push({ t: duelTime(), k: kind });
}

function launch(count, elite) {
  game.duelLog.sent++;
  mark(elite ? "elite" : "atk");
  addFloatingText(player.worldX, player.worldY - 60, "ATTAQUE ENVOYÉE !", "#aa66ff", 18, 80);
  if (versus.split) {
    const from = versus.current;
    withRun(1 - from, () => receiveAttack(count, elite, from));
  } else if (versus.online) sendGame({ t: "atk", n: count, e: elite });
}

/** Ennemis envoyés par l'adversaire (`from` : son index) dans la partie chargée. */
export function receiveAttack(count, elite, from = 1) {
  if (!game.started || game.over || versus.winner !== null) return;
  const n = Math.max(0, Math.min(20, count | 0)); // en ligne, le message vient de l'autre appareil
  for (let i = 0; i < n; i++) {
    spawnEnemy(undefined, null, null, !!elite);
    world.enemies[world.enemies.length - 1].sent = true;
  }
  if (n > 0) emit("attackReceived", { count: n, elite: !!elite, from });
}

/** Lance le sort prêt du joueur dont la partie est chargée. */
export function castSpell() {
  const type = game.spellReady;
  if (!type || !versus.active || versus.winner !== null || game.over) return;
  game.spellReady = null;
  game.duelLog.cast++;
  mark("hex");
  addFloatingText(player.worldX, player.worldY - 60, `${SPELLS[type]} ENVOYÉ !`, "#00ff88", 18, 80);
  if (versus.split) {
    const from = versus.current;
    withRun(1 - from, () => receiveSpell(type, from));
  } else if (versus.online) sendGame({ t: "hex", s: type });
}

/** Sort lancé par l'adversaire sur la partie chargée. */
export function receiveSpell(type, from = 1) {
  if (!SPELLS[type] || !game.started || game.over || versus.winner !== null) return;
  game.hex = { type, ticks: VERSUS.spell[type].ticks };
  emit("spellReceived", { type, name: SPELLS[type], from });
}

/** À chaque tick de la partie : le sort subi s'estompe ; en duel, la vie est notée chaque seconde. */
export function updateHex() {
  if (game.hex && --game.hex.ticks <= 0) game.hex = null;
  if (versus.active) logHealth(game.duelLog, healthPct());
}

/** Vie du joueur de la partie chargée, en %. */
export function healthPct() {
  return (Math.max(0, player.health) / player.maxHealth) * 100;
}

/** Note la vie (en %) dans un récap, au plus une fois par seconde (sauf `force` : point final). */
export function logHealth(log, pct, force = false) {
  const t = duelTime();
  if (!force && t - log.lastT < 1000) return;
  log.lastT = t;
  log.hp.push({ t, h: Math.round(pct) });
}
