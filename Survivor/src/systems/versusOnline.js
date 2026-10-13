// Duel en ligne : synchronisation entre l'hôte et l'invité (voir services/netplay.js pour la connexion).
//
// L'hôte fait tourner la partie (tirs, dégâts, vies) et envoie un instantané ~20 fois par seconde.
// L'invité déplace son propre vaisseau chez lui (aucun délai ressenti) et envoie sa position ;
// le reste (adversaire, balles, PV) vient des instantanés, lissés pour rester fluides.

import { NET } from "../config.js";
import { emit } from "../core/events.js";
import { game, world } from "../core/state.js";
import { EVOLUTIONS, UPGRADES, applyUpgrade } from "../data/upgrades.js";
import { checkConnection, net, sendGame } from "../services/netplay.js";
import { playSfx } from "../services/sfx.js";
import { addFloatingText, createSpawnEffect } from "./effects.js";
import { fighterName, killEffects, updateMovement, updateTrails, versus } from "./versus.js";

const SMOOTHING = 0.35; // part du chemin vers la dernière position reçue, par tick
const ALL_CARDS = [...UPGRADES, ...EVOLUTIONS];

let lastSend = 0;
let picking = null; // hôte : améliorations en cours de choix chez l'invité { f, n, count, picks, draw }
let paused = false; // invité : l'hôte a mis la partie en pause (choix d'améliorations)
let targets = []; // invité : positions reçues des vaisseaux { x, y }

const sendInterval = (perSecond) => 1000 / (net.relay ? NET.relayPerSecond : perSecond);

export function resetOnline() {
  lastSend = 0;
  picking = null;
  paused = false;
  targets = [];
}

/** À chaque image : envoie l'instantané (hôte) ou la position (invité), surveille la connexion. */
export function netTick(now) {
  if (!versus.online) return;
  checkConnection(now);
  if (!versus.online) return; // connexion perdue pendant la vérification
  const host = versus.online.role === "host";
  if (host) versus.wait = waitMessage();
  if (now - lastSend < sendInterval(host ? NET.snapshotsPerSecond : NET.inputsPerSecond)) return;
  lastSend = now;
  sendGame(host ? snapshot() : input());
}

/** Message reçu de l'adversaire. */
export function onNetMessage(msg) {
  if (!msg || !versus.online) return;
  if (versus.online.role === "host") {
    if (msg.t === "in") versus.remote = msg;
    else if (msg.t === "choose") chooseRemote(msg.name);
  } else if (msg.t === "s") applySnapshot(msg);
  else if (msg.t === "pick") {
    const picks = msg.names.map((name) => ALL_CARDS.find((u) => u.name === name)).filter(Boolean);
    emit("versusRemoteChoices", { picks, n: msg.n, count: msg.count });
  }
}

// --- HÔTE ---

function waitMessage() {
  if (picking) return `${fighterName(picking.f.index)} choisit ses améliorations…`;
  if (!game.running && !game.over) return `${fighterName(0)} choisit ses améliorations…`;
  return null;
}

const round = (v) => Math.round(v * 10) / 10;

function snapshot() {
  const fx = versus.fx.splice(0);
  return {
    t: "s",
    lives: versus.lives,
    paused: !game.running && !game.over,
    wait: waitMessage(),
    f: versus.fighters.map((f) => ({
      x: round(f.worldX),
      y: round(f.worldY),
      a: round(f.aimAngle),
      h: round(f.health),
      m: round(f.maxHealth),
      al: f.alive,
      sh: f.buffs.shield,
      fr: f.buffs.frenzy,
      d: f.isDashing,
      sp: f.spawnSeq,
      o: f.orbitals,
      oa: round(f.orbitalAngle),
      ar: f.auraRadius,
      ev: f.evolutions,
      inv: f.inventory,
      st: [f.baseSpeed, f.dashSpeed, f.dashDuration, f.dashCooldown, f.size],
    })),
    p: world.projectiles.map((p) => [
      round(p.x),
      round(p.y),
      round(p.vx),
      round(p.vy),
      p.size,
      p.owner,
      p.kind === "kunai" ? 1 : 0,
    ]),
    fx,
  };
}

/** L'invité est mort : il choisit ses améliorations chez lui, la partie attend (pour les deux). */
export function startRemotePicks(f, count, draw) {
  picking = { f, n: 0, count, draw };
  game.running = false;
  game.paused = true;
  sendPick();
}

function sendPick() {
  const p = picking;
  p.picks = p.draw(p.f);
  if (p.picks.length === 0) {
    p.f.health = Math.min(p.f.maxHealth, p.f.health + 50); // plus rien à proposer : soin de secours
    return endPicks();
  }
  sendGame({ t: "pick", n: p.n + 1, count: p.count, names: p.picks.map((u) => u.name) });
}

function chooseRemote(name) {
  const p = picking;
  const u = p?.picks.find((c) => c.name === name);
  if (!u) return;
  applyUpgrade(u, p.f);
  if (++p.n < p.count) sendPick();
  else endPicks();
}

function endPicks() {
  picking = null;
  game.running = true;
  game.paused = false;
}

// --- INVITÉ ---

function input() {
  const f = versus.fighters[versus.online.local];
  return { t: "in", x: round(f.worldX), y: round(f.worldY), dash: f.isDashing, spawn: f.spawnSeq };
}

function applySnapshot(s) {
  versus.lives = s.lives;
  versus.wait = s.wait;
  paused = s.paused;
  s.f.forEach((d, i) => {
    const f = versus.fighters[i];
    const own = i === versus.online.local;
    const respawned = d.sp !== f.spawnSeq;
    Object.assign(f, {
      aimAngle: d.a,
      health: d.h,
      maxHealth: d.m,
      alive: d.al,
      spawnSeq: d.sp,
      orbitals: d.o,
      orbitalAngle: d.oa,
      auraRadius: d.ar,
      evolutions: d.ev,
      inventory: d.inv,
    });
    [f.baseSpeed, f.dashSpeed, f.dashDuration, f.dashCooldown, f.size] = d.st;
    f.buffs.shield = d.sh;
    f.buffs.frenzy = d.fr;
    if (!own) f.isDashing = d.d;
    targets[i] = { x: d.x, y: d.y };
    // Son propre vaisseau reste piloté ici, sauf à son retour en jeu (replacé au point de départ) ;
    // celui de l'adversaire glisse vers `targets`, sauf à son retour (pas de traversée de l'arène)
    if (respawned || (own && !f.alive)) {
      f.worldX = d.x;
      f.worldY = d.y;
    }
  });
  world.projectiles.length = 0;
  for (const [x, y, vx, vy, size, owner, kunai] of s.p) {
    const color = kunai ? "#ff55cc" : versus.fighters[owner].weapon.color;
    world.projectiles.push({ x, y, vx, vy, size, owner, color, type: kunai ? "kunai" : undefined });
  }
  for (const e of s.fx) playEffect(e);
}

/** Rejoue chez l'invité un effet survenu chez l'hôte. */
function playEffect(e) {
  const f = versus.fighters[e.i];
  if (e.t === "hit") {
    f.hitTime = game.time;
    playSfx("hit");
    addFloatingText(f.worldX, f.worldY - 20, e.d + (e.c ? "!" : ""), e.c ? "#d000ff" : "#fff", e.c ? 20 : 15);
  } else if (e.t === "kill") {
    f.worldX = e.x;
    f.worldY = e.y;
    killEffects(f);
    addFloatingText(e.x, e.y - 40, "-1 VIE", f.hero.color, 26, 80);
  } else if (e.t === "spawn") {
    createSpawnEffect(f.worldX, f.worldY, f.hero.color);
  }
}

/** Tick de l'invité : son vaisseau bouge ici, le reste glisse vers les positions reçues. */
export function updateVersusGuest() {
  const local = versus.online.local;
  versus.fighters.forEach((f, i) => {
    if (i === local) {
      if (f.alive && !paused) updateMovement(f);
      return;
    }
    const t = targets[i];
    if (!t) return;
    f.worldX += (t.x - f.worldX) * SMOOTHING;
    f.worldY += (t.y - f.worldY) * SMOOTHING;
  });
  if (!paused) {
    for (const p of world.projectiles) {
      p.x += p.vx;
      p.y += p.vy;
    }
  }
  updateTrails();
}
