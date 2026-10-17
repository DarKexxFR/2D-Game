// Chronophage : il manipule le temps. Cadran de zones qui explosent l'une après l'autre, bulles
// temporelles où les tirs du joueur ralentissent, pendule, et « retour arrière » qui ramène le
// joueur là où il était 3 s plus tôt (au milieu d'une zone qui va exploser). Rembobinage : s'il
// ne perd pas assez de vie en quelques secondes, il en récupère une partie. En furie, ses attaques
// de zone ont un écho qui se répète un peu plus tard au même endroit.

import { player } from "../../core/state.js";
import { CHRONO as C } from "../../data/bosses.js";
import { addFloatingText, addScreenShake, createParticles } from "../effects.js";
import { addBeam, addBubble, addCircle } from "../hazards.js";
import { clampToZone } from "../arena.js";
import { isProtected } from "../player.js";
import { aim, enrage, nextAttack, shout } from "./kit.js";

const GOLD = "#ffd27a";

export function updateChronophage(e) {
  recordPlayer(e);
  if (enrage(e, "#d27bff", 1.2, "BOUCLE TEMPORELLE !")) e.echoes = [];
  rewindHealth(e);
  playEchoes(e);
  if (e.rewindIn > 0 && --e.rewindIn === 0) snapBack(e);
  if (--e.attackTimer > 0) return;
  e.attackTimer = C.attackEvery * (e.enraged ? 0.8 : 1);
  const attack = nextAttack(e, C.cycle);
  if (attack === "dial") dial(e);
  else if (attack === "bubbles") bubbles(e);
  else if (attack === "rewind") rewind(e);
  else pendulum(e);
}

/** Positions du joueur sur les dernières secondes (rangées sur le boss : chaque partie a la sienne). */
function recordPlayer(e) {
  e.history ??= [];
  e.history.push({ x: player.worldX, y: player.worldY });
  if (e.history.length > C.rewind.back) e.history.shift();
}

/**
 * Rembobinage : toutes les `every` ticks, s'il a perdu moins de `minLoss` de sa vie, il récupère
 * `restore` de ce qu'il a perdu. La barre du boss montre le sablier qui s'écoule.
 */
function rewindHealth(e) {
  const r = C.rewindHealth;
  e.hourglass ??= r.every;
  e.mark ??= e.health;
  e.barTag = `SABLIER ${Math.ceil(e.hourglass / 60)} s`;
  if (--e.hourglass > 0) return;
  e.hourglass = r.every;
  const lost = e.mark - e.health;
  if (lost > 0 && lost < e.maxHealth * r.minLoss) {
    e.health = Math.min(e.maxHealth, e.health + lost * r.restore);
    addFloatingText(e.x, e.y - e.size - 20, "REMBOBINAGE !", GOLD, 22, 60);
    createParticles(e.x, e.y, GOLD, 16);
  }
  e.mark = e.health;
}

/** Écho (furie) : l'attaque se rejoue `C.echo` ticks plus tard, au même endroit. */
function echo(e, replay) {
  if (e.enraged) e.echoes.push({ in: C.echo, replay });
}

function playEchoes(e) {
  if (!e.echoes) return;
  for (let i = e.echoes.length - 1; i >= 0; i--) {
    if (--e.echoes[i].in > 0) continue;
    const { replay } = e.echoes.splice(i, 1)[0];
    replay();
  }
}

/** Cadran : douze zones autour du boss, qui explosent l'une après l'autre comme une aiguille. */
function dial(e) {
  const d = C.dial;
  const x = e.x;
  const y = e.y;
  const start = aim(e);
  const dir = Math.random() < 0.5 ? -1 : 1;
  const play = () => {
    for (const [radius, sense] of e.enraged
      ? [
          [d.radius, dir],
          [d.outer, -dir],
        ]
      : [[d.radius, dir]]) {
      for (let k = 0; k < d.count; k++) {
        const a = start + sense * ((Math.PI * 2 * k) / d.count);
        addCircle(x + Math.cos(a) * radius, y + Math.sin(a) * radius, d.zone, e.damage * d.damage, {
          delay: d.delay + k * d.step,
          color: k === 0 ? GOLD : e.color,
        });
      }
    }
  };
  play();
  echo(e, play);
  shout(e, "CADRAN !", GOLD);
}

/** Bulles temporelles : les tirs du joueur qui y entrent avancent au ralenti. */
function bubbles(e) {
  const b = C.bubbles;
  const offset = Math.random() * Math.PI * 2;
  for (let k = 0; k < b.count; k++) {
    const r = k === 0 ? 0 : b.spread; // la première se pose sur le joueur
    const a = offset + (Math.PI * 2 * k) / b.count;
    const at = clampToZone(player.worldX + Math.cos(a) * r, player.worldY + Math.sin(a) * r, 40);
    addBubble(at.x, at.y, b.radius, { duration: b.duration, factor: b.factor, color: e.color });
  }
  shout(e, "TEMPS FIGÉ !", e.color, 20, 50);
}

/**
 * Retour arrière : une zone s'allume là où le joueur était il y a 3 s ; peu après il y est ramené
 * (sauf en plein dash ou sous bouclier), puis elle explose. Il faut en ressortir au plus vite.
 */
function rewind(e) {
  const r = C.rewind;
  const past = e.history[0] ?? { x: player.worldX, y: player.worldY };
  const at = clampToZone(past.x, past.y, 30);
  e.rewindTo = at;
  e.rewindIn = r.warn;
  const blast = () =>
    addCircle(at.x, at.y, r.radius, e.damage * r.damage, { delay: r.warn + r.blast, color: GOLD });
  blast();
  echo(e, () => addCircle(at.x, at.y, r.radius, e.damage * r.damage, { delay: r.blast, color: GOLD }));
  addFloatingText(player.worldX, player.worldY - 60, "RETOUR ARRIÈRE !", GOLD, 22, 60);
}

/** Le joueur est ramené à sa position passée (le dash ou le bouclier l'en protègent). */
function snapBack(e) {
  if (isProtected()) {
    addFloatingText(player.worldX, player.worldY - 40, "ESQUIVÉ !", "#00ffff", 16, 40);
    return;
  }
  createParticles(player.worldX, player.worldY, GOLD, 12);
  player.worldX = e.rewindTo.x;
  player.worldY = e.rewindTo.y;
  createParticles(player.worldX, player.worldY, GOLD, 12);
  addScreenShake(6);
}

/** Pendule : un grand laser qui se balance de part et d'autre du joueur. */
function pendulum(e) {
  const p = C.pendulum;
  const play = (x, y, angle) =>
    addBeam(x, y, angle, e.damage * p.damage, {
      length: p.length,
      width: p.width,
      delay: p.delay,
      active: p.active,
      color: GOLD,
      swing: { amp: p.amp, speed: p.speed },
    });
  const x = e.x;
  const y = e.y;
  const angle = aim(e);
  play(x, y, angle);
  echo(e, () => play(x, y, angle + Math.PI));
  e.rooted = p.delay + p.active;
  shout(e, "PENDULE !", GOLD);
}
