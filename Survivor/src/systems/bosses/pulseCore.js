// Cœur du Pulse (boss final) : immobile au centre de l'arène, il bat de plus en plus vite. Chaque
// battement joue le pas suivant du motif de sa phase (onde, artères, caillots, veines) ; les coups
// annoncés tombent sur le battement suivant. Sous 66 % puis 33 % de vie, il passe à la phase
// suivante : battements plus rapides, motif plus dense et arène qui se resserre (`e.arenaScale`,
// lu par systems/arena.js).

import { game, player } from "../../core/state.js";
import { PULSE_CORE as P } from "../../data/bosses.js";
import { playSfx } from "../../services/sfx.js";
import { dist } from "../../utils/math.js";
import { addFloatingText, addScreenShake, createParticles, flashScreen } from "../effects.js";
import { addBeam, addCircle, addRing } from "../hazards.js";
import { arenaCenter, clampToZone } from "../arena.js";
import { aim, fireEnemyProjectile } from "./kit.js";

export function updatePulseCore(e) {
  e.rooted = 1;
  if (e.pulsePhase === undefined) takeCenter(e);
  checkPhase(e);
  const phase = P.phases[e.pulsePhase];
  e.barTag = `PHASE ${e.pulsePhase + 1}`;
  if (--e.beatIn > 0) return;
  e.beatIn = phase.beat;
  e.beatAt = game.time; // pulsation au rendu (render/bosses.js)
  e.step = ((e.step ?? -1) + 1) % phase.pattern.length;
  beat(e, phase.pattern[e.step], phase.beat);
}

/** Arrivée : il prend place au centre de l'arène, à bonne distance du joueur. */
function takeCenter(e) {
  e.pulsePhase = 0;
  e.beatIn = 90; // un temps avant le premier battement
  e.arenaScale = 1;
  let { x, y } = arenaCenter();
  const d = dist(x, y, player.worldX, player.worldY);
  if (d < P.keepAway) {
    const a = d > 0 ? Math.atan2(y - player.worldY, x - player.worldX) : Math.random() * Math.PI * 2;
    ({ x, y } = clampToZone(
      player.worldX + Math.cos(a) * P.keepAway,
      player.worldY + Math.sin(a) * P.keepAway,
      e.size,
    ));
  }
  createParticles(e.x, e.y, e.color, 20);
  e.x = x;
  e.y = y;
  createParticles(e.x, e.y, e.color, 30);
}

/** Changement de phase : annonce, onde, battements plus rapides et arène plus petite. */
function checkPhase(e) {
  const next = P.phases[e.pulsePhase + 1];
  if (!next || e.health >= e.maxHealth * next.below) return;
  e.pulsePhase++;
  e.enraged = e.pulsePhase === P.phases.length - 1; // dernière phase : halo de furie
  e.arenaScale = next.arena;
  e.step = -1;
  e.beatIn = 70;
  addRing(e.x, e.y, P.ring.max, e.damage * P.ring.damage, { color: "#ffffff", speed: 6 });
  addFloatingText(e.x, e.y - e.size - 30, `PHASE ${e.pulsePhase + 1} · LE PULSE S'ACCÉLÈRE`, e.color, 24, 90);
  flashScreen(e.color, 0.35);
  addScreenShake(14);
  playSfx("boss");
}

function beat(e, step, interval) {
  addScreenShake(2);
  if (step === "ring") ring(e);
  else if (step === "arteries") arteries(e, interval);
  else if (step === "clots") clots(e, interval);
  else if (step === "veins") veins(e);
}

/** Onde du battement, à franchir au dash. */
function ring(e) {
  addRing(e.x, e.y, P.ring.max, e.damage * P.ring.damage, { color: e.color, speed: P.ring.speed });
}

/** Artères : lasers en étoile, annoncés un battement à l'avance. */
function arteries(e, interval) {
  const a = P.arteries;
  const count = e.enraged ? a.beamsLast : a.beams;
  const base = aim(e) + Math.PI / count; // décalés : le joueur n'est jamais pile dans l'axe à l'annonce
  for (let k = 0; k < count; k++) {
    addBeam(e.x, e.y, base + (Math.PI * 2 * k) / count, e.damage * a.damage, {
      length: 1100,
      width: a.width,
      delay: interval,
      active: a.active,
      color: e.color,
    });
  }
}

/** Caillots : zones autour du joueur qui tombent sur le battement suivant. */
function clots(e, interval) {
  const c = P.clots;
  for (let k = 0; k < c.count; k++) {
    const off = k === 0 ? 0 : c.spread * (0.5 + Math.random() * 0.5);
    const a = Math.random() * Math.PI * 2;
    const at = clampToZone(player.worldX + Math.cos(a) * off, player.worldY + Math.sin(a) * off, c.radius);
    addCircle(at.x, at.y, c.radius, e.damage * c.damage, { delay: interval, color: "#ff5c8a" });
  }
}

/** Veines : salve de tirs tout autour du cœur. */
function veins(e) {
  const v = P.veins;
  const count = e.enraged ? v.countLast : v.count;
  const offset = Math.random();
  for (let k = 0; k < count; k++) {
    fireEnemyProjectile(e.x, e.y, offset + (Math.PI * 2 * k) / count, v.speed, {
      size: 10,
      damage: e.damage * v.damage,
      color: "#ff5c8a",
    });
  }
}
