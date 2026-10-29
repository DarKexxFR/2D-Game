// L'Architecte (boss final) : il dérive lentement et rejoue les attaques des boss passés, en quatre phases
// (sous 75, 50 puis 25 % de vie) de plus en plus rapides, l'arène se resserrant à chaque phase
// (`e.arenaScale`, lu par systems/arena.js). Sa mort lance l'Endless Pulse (systems/endless.js).

import { player } from "../../core/state.js";
import { ARCHITECT as A } from "../../data/bosses.js";
import { playSfx } from "../../services/sfx.js";
import { dist } from "../../utils/math.js";
import { addFloatingText, addScreenShake, flashScreen } from "../effects.js";
import { addBeam, addBubble, addCircle, addRing } from "../hazards.js";
import { clampToZone } from "../arena.js";
import { isProtected } from "../player.js";
import { aim, fireEnemyProjectile, nextAttack, shout } from "./kit.js";

const GOLD = "#ffe9a8";

export function updateArchitect(e) {
  // `e.stage` et non `e.phase` : `phase` est le décalage d'animation que le spawner donne à chaque ennemi
  if (e.stage === undefined) {
    e.stage = 0;
    e.arenaScale = 1;
    e.attackTimer = 90;
  }
  checkPhase(e);
  const phase = A.phases[e.stage];
  e.barTag = `PHASE ${e.stage + 1} · ${phase.name}`;
  if (e.glitchIn > 0 && --e.glitchIn === 0) glitchPlayer();
  // Garde ses distances : il s'arrête quand le joueur s'approche (il ne fonce jamais au corps à corps)
  if (dist(e.x, e.y, player.worldX, player.worldY) < A.keepAway) e.rooted = 1;
  if (--e.attackTimer > 0) return;
  e.attackTimer = phase.every;
  ATTACKS[nextAttack(e, phase.cycle)](e);
}

function checkPhase(e) {
  const next = A.phases[e.stage + 1];
  if (!next || e.health >= e.maxHealth * next.below) return;
  e.stage++;
  e.turn = -1;
  e.enraged = e.stage === A.phases.length - 1; // dernière phase : halo de furie
  e.arenaScale = next.arena;
  e.attackTimer = 70;
  addRing(e.x, e.y, A.ring.max, e.damage * A.ring.damage, { color: "#ffffff", speed: 6 });
  addFloatingText(e.x, e.y - e.size - 30, `PHASE ${e.stage + 1} · ${next.name}`, GOLD, 24, 90);
  flashScreen(GOLD, 0.35);
  addScreenShake(14);
  playSfx("boss");
}

/** Point au hasard autour du joueur (le premier pile sur lui), dans l'arène. */
function around(k, spread, margin) {
  const off = k === 0 ? 0 : spread * (0.4 + Math.random() * 0.6);
  const a = Math.random() * Math.PI * 2;
  return clampToZone(player.worldX + Math.cos(a) * off, player.worldY + Math.sin(a) * off, margin);
}

/** @type {Record<string, (e: any) => void>} */
const ATTACKS = {
  /** Plan : quadrillage de lasers (horizontaux ou verticaux) décalé pour laisser des couloirs. */
  grid(e) {
    const g = A.grid;
    const vertical = Math.random() < 0.5;
    const shift = (Math.random() - 0.5) * g.gap;
    for (let k = -g.lines; k <= g.lines; k++) {
      const off = k * g.gap + shift + g.gap / 2;
      const x = vertical ? player.worldX + off : player.worldX - g.length / 2;
      const y = vertical ? player.worldY - g.length / 2 : player.worldY + off;
      addBeam(x, y, vertical ? Math.PI / 2 : 0, e.damage * g.damage, {
        length: g.length,
        width: g.width,
        delay: g.delay,
        active: g.active,
        color: GOLD,
      });
    }
    shout(e, "PLAN !", GOLD, 20, 45);
  },
  ring(e) {
    addRing(e.x, e.y, A.ring.max, e.damage * A.ring.damage, { color: GOLD, speed: A.ring.speed });
  },
  /** Orbes qui suivent le joueur. */
  orbs(e) {
    const o = A.orbs;
    const base = aim(e);
    for (let k = 0; k < o.count; k++) {
      fireEnemyProjectile(e.x, e.y, base + (Math.PI * 2 * k) / o.count, o.speed, {
        size: 10,
        damage: e.damage * o.damage,
        color: GOLD,
        homing: o.homing,
        life: o.life,
      });
    }
  },
  /** Caillots (Cœur du Pulse). */
  clots(e) {
    const c = A.clots;
    for (let k = 0; k < c.count; k++) {
      const at = around(k, c.spread, c.radius);
      addCircle(at.x, at.y, c.radius, e.damage * c.damage, { delay: c.delay, color: "#ff5c8a" });
    }
  },
  /** Orage (Titan de l'orage) : éclairs qui étourdissent. */
  storm(e) {
    const s = A.storm;
    for (let k = 0; k < s.count; k++) {
      const at = around(k, s.spread, s.radius);
      addCircle(at.x, at.y, s.radius, e.damage * s.damage, {
        delay: s.delay,
        color: "#ffe94d",
        stun: s.stun,
      });
    }
    shout(e, "ORAGE !", "#ffe94d");
  },
  /** Prisme (Sentinelle prismatique) : lasers tournants. */
  prism(e) {
    const p = A.prism;
    const base = aim(e) + Math.PI / p.beams;
    const dir = Math.random() < 0.5 ? -1 : 1;
    for (let k = 0; k < p.beams; k++) {
      addBeam(e.x, e.y, base + (Math.PI * 2 * k) / p.beams, e.damage * p.damage, {
        length: p.length,
        width: p.width,
        delay: p.delay,
        active: p.active,
        spin: p.spin * dir,
        color: "#9ff3ff",
      });
    }
    shout(e, "PRISME !", "#9ff3ff");
  },
  /** Pluie collante (Roi Slime). */
  rain(e) {
    const r = A.rain;
    for (let k = 0; k < r.count; k++) {
      const at = around(k, r.spread, r.radius);
      addCircle(at.x, at.y, r.radius, e.damage * r.damage, {
        delay: r.delay,
        color: "#7dff7d",
        pool: r.pool,
        slow: r.slow,
      });
    }
  },
  /** Réécriture (Hacker) : commandes inversées après une alerte. */
  glitch(e) {
    e.glitchIn = A.glitch.warn;
    player.buffs.glitchWarn = A.glitch.warn;
    addFloatingText(player.worldX, player.worldY - 60, "RÉÉCRITURE !", "#ff2a6d", 22, 50);
  },
  /** Bulles temporelles (Chronophage) : vos tirs y ralentissent. */
  bubbles(e) {
    const b = A.bubbles;
    for (let k = 0; k < b.count; k++) {
      const at = around(k + 1, b.spread, b.radius);
      addBubble(at.x, at.y, b.radius, { duration: b.duration, factor: b.factor });
    }
    shout(e, "TEMPS FIGÉ !", "#8c7bff");
  },
};

function glitchPlayer() {
  if (isProtected()) return;
  player.buffs.glitch = A.glitch.duration;
  addFloatingText(player.worldX, player.worldY - 40, "COMMANDES INVERSÉES !", "#ff2a6d", 18, 70);
}
