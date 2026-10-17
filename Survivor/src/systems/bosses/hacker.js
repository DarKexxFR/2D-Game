// Hacker : il pirate le joueur. « GLITCH » inverse ses commandes, le pare-feu l'enferme dans une
// case avant de la purger (il faut traverser un mur au dash), les zones de brouillage coupent son
// tir, les paquets de données arrivent en lignes. En furie, il se cache parmi des clones
// holographiques identiques (`hacker_clone`, parties du boss) et échange régulièrement sa place
// avec eux : seul le vrai porte la vie du boss.

import { player } from "../../core/state.js";
import { HACKER as H } from "../../data/bosses.js";
import { addFloatingText, addScreenShake, createParticles } from "../effects.js";
import { addBeam, addCircle } from "../hazards.js";
import { clampToZone } from "../arena.js";
import { isProtected } from "../player.js";
import {
  aim,
  enrage,
  fireEnemyProjectile,
  nextAttack,
  orphaned,
  pruneParts,
  shout,
  spawnPart,
} from "./kit.js";

const CODE = "#39ff8e";
const ALERT = "#ff2a6d";

export function updateHacker(e) {
  e.clones ??= [];
  if (enrage(e, "#b6ff3d", 1.15, "INTRUSION TOTALE !")) spawnClones(e);
  if (e.enraged) manageClones(e);
  if (e.glitchIn > 0 && --e.glitchIn === 0) glitchPlayer();
  if (e.jumpIn > 0) return jumpCountdown(e);
  if (--e.attackTimer > 0) return;
  e.attackTimer = H.attackEvery * (e.enraged ? 0.8 : 1);
  const attack = nextAttack(e, H.cycle);
  if (attack === "packets") packets(e, e.damage);
  else if (attack === "glitch") glitch(e);
  else if (attack === "firewall") firewall(e);
  else if (attack === "jam") jam(e);
  else teleport(e);
}

/** Clone holographique : même allure que le Hacker, il le suit dans la mort et tire quelques paquets. */
export function updateHackerClone(e) {
  if (orphaned(e)) return;
  e.fireTimer = (e.fireTimer ?? H.clones.fireEvery * Math.random()) - 1;
  if (e.fireTimer > 0) return;
  e.fireTimer = H.clones.fireEvery;
  packets(e, e.owner.damage * 0.5, 1);
}

/** Paquets de données : des lignes de petits carrés lancées vers le joueur. */
function packets(e, damage, streams = H.packets.streams) {
  const p = H.packets;
  const base = aim(e);
  for (let s = 0; s < streams; s++) {
    const angle = base + (s - (streams - 1) / 2) * p.spread;
    for (let k = 0; k < p.bullets; k++) {
      fireEnemyProjectile(e.x, e.y, angle, p.speed + k * p.step, {
        size: 9,
        damage: damage * p.damage,
        color: CODE,
        bit: true,
        life: 200,
      });
    }
  }
}

/** Glitch : annoncé au-dessus du joueur, puis ses commandes s'inversent quelques secondes. */
function glitch(e) {
  e.glitchIn = H.glitch.warn;
  player.buffs.glitchWarn = H.glitch.warn;
  addFloatingText(player.worldX, player.worldY - 60, "GLITCH !", ALERT, 22, 50);
  shout(e, "PIRATAGE...", CODE);
}

/** Fin de l'alerte : commandes inversées (le dash ou le bouclier au bon moment protègent). */
function glitchPlayer() {
  if (isProtected()) {
    addFloatingText(player.worldX, player.worldY - 40, "PARE-FEU PERSO !", "#00ffff", 16, 40);
    return;
  }
  player.buffs.glitch = H.glitch.duration;
  addFloatingText(player.worldX, player.worldY - 40, "COMMANDES INVERSÉES !", ALERT, 18, 70);
  addScreenShake(6);
}

/**
 * Pare-feu : quatre murs en « # » enferment le joueur dans une case, puis la case est purgée.
 * Il faut traverser un mur (au dash, sinon il blesse) avant la purge.
 */
function firewall(e) {
  const f = H.firewall;
  const { x, y } = clampToZone(player.worldX, player.worldY, f.gap + 40);
  const half = f.length / 2;
  const wall = (wx, wy, angle) =>
    addBeam(wx, wy, angle, e.damage * f.damage, {
      length: f.length,
      width: f.width,
      delay: f.delay,
      active: f.active,
      color: CODE,
    });
  for (const s of [-1, 1]) {
    wall(x - half, y + s * f.gap, 0);
    wall(x + s * f.gap, y - half, Math.PI / 2);
  }
  addCircle(x, y, f.purge, e.damage, { delay: f.delay + Math.round(f.active * 0.55), color: ALERT });
  shout(e, "PARE-FEU !", CODE, 20, 50);
}

/** Brouillage : zones au sol qui coupent le tir du joueur tant qu'il s'y tient. */
function jam(e) {
  const j = H.jam;
  const offset = Math.random() * Math.PI * 2;
  for (let k = 0; k < j.zones; k++) {
    const r = k === 0 ? 0 : j.spread;
    const a = offset + (Math.PI * 2 * k) / (j.zones - 1);
    const at = clampToZone(player.worldX + Math.cos(a) * r, player.worldY + Math.sin(a) * r, j.radius);
    addCircle(at.x, at.y, j.radius, e.damage * j.damage, {
      delay: j.delay,
      color: "#3dff8e",
      pool: j.pool,
      jam: 10,
    });
  }
  shout(e, "BROUILLAGE !", CODE, 20, 50);
}

/** Saut réseau : point d'arrivée annoncé loin du joueur, puis il s'y téléporte en laissant une salve. */
function teleport(e) {
  const t = H.teleport;
  const a = Math.random() * Math.PI * 2;
  e.jumpTo = clampToZone(
    player.worldX + Math.cos(a) * t.distance,
    player.worldY + Math.sin(a) * t.distance,
    e.size,
  );
  e.jumpIn = t.warn;
  e.rooted = t.warn;
  shout(e, "SAUT RÉSEAU !", CODE);
}

function jumpCountdown(e) {
  if (e.jumpIn % 5 === 0) createParticles(e.jumpTo.x, e.jumpTo.y, CODE, 3);
  if (--e.jumpIn > 0) return;
  const t = H.teleport;
  for (let k = 0; k < t.burst; k++) {
    fireEnemyProjectile(e.x, e.y, (Math.PI * 2 * k) / t.burst, 4.5, {
      size: 9,
      damage: e.damage * 0.4,
      color: CODE,
      bit: true,
    });
  }
  createParticles(e.x, e.y, CODE, 15);
  e.x = e.jumpTo.x;
  e.y = e.jumpTo.y;
  createParticles(e.x, e.y, CODE, 15);
}

/** Furie : des clones identiques apparaissent autour de lui (même taille, même couleur, même halo). */
function spawnClones(e) {
  const c = H.clones;
  for (let k = 0; k < c.count; k++) {
    const a = (Math.PI * 2 * k) / c.count;
    const clone = spawnPart(e, "hacker_clone", e.x + Math.cos(a) * 140, e.y + Math.sin(a) * 140);
    clone.health = clone.maxHealth = e.maxHealth * c.health;
    clone.damage = e.damage * 0.5;
    clone.size = e.size;
    clone.speed = clone.baseSpeed = e.speed;
    clone.color = e.color;
    clone.enraged = true; // même halo que le vrai
    clone.mimic = e; // barre de vie : celle du vrai Hacker (voir render/entities.js)
    e.clones.push(clone);
  }
  e.shuffleTimer = c.shuffleEvery;
  addFloatingText(e.x, e.y - e.size - 40, "QUI EST LE VRAI ?", CODE, 22, 70);
  shuffle(e);
}

/** Clones tombés, échanges de place réguliers et nouveaux clones quand tous sont détruits. */
function manageClones(e) {
  if (pruneParts(e.clones) > 0) addFloatingText(e.x, e.y - e.size - 30, "LEURRE DÉTRUIT", "#bfffd8", 14, 40);
  if (e.clones.length === 0) {
    e.respawnIn = (e.respawnIn ?? H.clones.respawn) - 1;
    if (e.respawnIn > 0) return;
    e.respawnIn = undefined;
    spawnClones(e);
    return;
  }
  if (--e.shuffleTimer > 0) return;
  e.shuffleTimer = H.clones.shuffleEvery;
  shuffle(e);
}

/** Le Hacker et ses clones échangent leurs places (dans un éclair de code). */
function shuffle(e) {
  const group = [e, ...e.clones];
  const spots = group.map((g) => ({ x: g.x, y: g.y }));
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  group.forEach((g, i) => {
    createParticles(g.x, g.y, CODE, 6);
    g.x = spots[i].x;
    g.y = spots[i].y;
  });
}
