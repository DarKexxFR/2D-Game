// Coop en ligne : synchronisation de la partie entre l'hôte et ses invités (voir systems/party.js pour la
// partie à plusieurs, services/coopNet.js pour la connexion).
//
// L'hôte fait tout tourner. Plusieurs fois par seconde, il envoie aux invités l'état de la partie
// (`game`, listes de `world`, vaisseau et familier de chaque joueur) sous forme de différences : chaque
// objet a un numéro (`rid`) et seuls ses champs changés partent ; un objet tiré des données du jeu
// (type d'ennemi, arme, biome...) part sous la forme de son chemin (`$c`), un autre objet de la partie sous
// la forme de son numéro (`$r`). Les effets purement visuels (étincelles, textes...) ne partent qu'à leur
// naissance : l'invité les fait vieillir lui-même. Rien à tenir à jour quand un champ est ajouté au jeu.
//
// L'invité dessine cet état avec le rendu habituel. Les positions glissent d'un envoi à l'autre ; son propre
// vaisseau est prédit (ses commandes récentes, que l'hôte n'a pas encore vues, sont rejouées depuis la
// position reçue), ce qui le rend réactif malgré la latence. Il envoie ses commandes (direction, visée,
// dash, compétence) et choisit ses cartes d'amélioration ; l'hôte les applique.

import { COOP, TICK_MS } from "../config.js";
import * as CONFIG from "../config.js";
import { view } from "../core/canvas.js";
import { emit, onAny } from "../core/events.js";
import { aimAngle, isDown, touchMove } from "../core/input.js";
import { game, world } from "../core/state.js";
import * as ANOMALIES from "../data/anomalies.js";
import * as BIOMES from "../data/biomes.js";
import * as BOSSES from "../data/bosses.js";
import * as CARD_EFFECTS from "../data/cardEffects.js";
import * as CYBER_CORE from "../data/cyberCore.js";
import * as ENDLESS from "../data/endless.js";
import * as ENEMIES from "../data/enemies.js";
import * as ITEMS from "../data/items.js";
import * as PERKS from "../data/perks.js";
import * as SIDE_WEAPONS from "../data/sideWeapons.js";
import * as SKINS from "../data/skins.js";
import * as TALENTS from "../data/talents.js";
import * as UPGRADES from "../data/upgrades.js";
import { anyRelay, broadcast, coopPeers, sendTo } from "../services/coopNet.js";
import { onSfx, playSfx, vibrate } from "../services/sfx.js";
import { clamp } from "../utils/math.js";
import { addScreenShake, ageVisuals } from "./effects.js";
import { followCamera, inPlay, memberObj, party, withMember, withOwned } from "./party.js";
import { activateSkill } from "./skills.js";
import { ageTrail } from "./trail.js";
import { drawChoices, findCards, takeCard } from "../ui/upgradeMenu.js";

// --- CE QUI EST ENVOYÉ ---

/** Listes du monde envoyées objet par objet (avec leurs changements). */
const LISTS = [
  "enemies",
  "projectiles",
  "enemyProjectiles",
  "gems",
  "lootBoxes",
  "shrines",
  "cursedShrines",
  "merchants",
  "hazards",
  "bossChests",
  "mines",
  "slashes",
  "clones",
  "meteors",
  "turrets",
];
/** Effets visuels : envoyés à leur naissance seulement (l'invité les fait vieillir). */
const VISUALS = ["particles", "floatingTexts", "visualEffects", "ghosts", "bolts", "trail", "gridPulses"];
/** Champs de `game` propres à chaque appareil (secousses, ralenti de la mort, duel...). */
const LOCAL_GAME = new Set([
  "started",
  "killCam",
  "duelLog",
  "screenShake",
  "flash",
  "banner",
  "hex",
  "spellReady",
  "duelAttack",
  "duelSpell",
]);
/** Événements du jeu rejoués chez les invités (bandeaux, annonces). */
const RELAY_EVENTS = new Set([
  "biomeChange",
  "bossWarning",
  "anomaly",
  "mapEvent",
  "goblin",
  "endlessStart",
  "pulseWave",
  "memberDown",
  "memberRevived",
  "memberLeft",
]);
/** Sons propres à un joueur : chaque invité les joue lui-même (coups reçus, montée de niveau...). */
const OWN_SOUNDS = new Set(["hurt", "death", "levelUp", "pickup", "click"]);

// --- CONSTANTES (données du jeu, identiques sur tous les appareils) ---

const CONST = new Map(); // objet → chemin
const CONST_BY_PATH = new Map();

function registerConstants() {
  if (CONST.size > 0) return;
  const modules = {
    CONFIG,
    ANOMALIES,
    BIOMES,
    BOSSES,
    CARD_EFFECTS,
    CYBER_CORE,
    ENDLESS,
    ENEMIES,
    ITEMS,
    PERKS,
    SIDE_WEAPONS,
    SKINS,
    TALENTS,
    UPGRADES,
  };
  const walk = (obj, path, depth) => {
    if (!obj || typeof obj !== "object" || CONST.has(obj) || depth > 6) return;
    const proto = Object.getPrototypeOf(obj);
    if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) return;
    CONST.set(obj, path);
    CONST_BY_PATH.set(path, obj);
    for (const key of Object.keys(obj)) walk(obj[key], `${path}.${key}`, depth + 1);
  };
  for (const [name, mod] of Object.entries(modules)) {
    for (const key of Object.keys(mod).sort()) walk(mod[key], `${name}.${key}`, 0);
  }
}

// --- ENCODAGE (hôte) ---

/** Numéro de chaque objet de la partie envoyé (ennemi, tir, vaisseau...). */
let rids = new WeakMap();
let nextRid = 1;
const ridOf = (o) => {
  let r = rids.get(o);
  if (r === undefined) rids.set(o, (r = nextRid++));
  return r;
};

const stack = [];

/** Valeur encodée en JSON (undefined : champ à ne pas envoyer, comme une fonction). */
function enc(v, top = null) {
  if (v === null) return null;
  const type = typeof v;
  if (type === "number") return Number.isFinite(v) ? Math.round(v * 100) / 100 : { $n: String(v) };
  if (type === "string" || type === "boolean") return v;
  if (type !== "object") return undefined;
  const c = CONST.get(v);
  if (c !== undefined) return { $c: c };
  if (v !== top) {
    const r = rids.get(v);
    if (r !== undefined) return { $r: r };
  }
  if (stack.includes(v)) return null; // cycle
  stack.push(v);
  try {
    if (Array.isArray(v)) return v.map((x) => enc(x) ?? null);
    if (v instanceof Set) return [...v].map((x) => enc(x) ?? null);
    if (v instanceof Map) return null;
    const out = {};
    for (const key of Object.keys(v)) {
      if (key.startsWith("_")) continue; // marques internes (grille spatiale...)
      const e = enc(v[key]);
      if (e !== undefined) out[key] = e;
    }
    return out;
  } finally {
    stack.pop();
  }
}

/** Dernière version envoyée de chaque champ de chaque objet. @type {WeakMap<object, Map<string, any>>} */
let sent = new WeakMap();
let sentGame = new Map();
let sentVisual = new WeakSet();

const same = (a, b) => a === b || (typeof a === "object" && JSON.stringify(a) === JSON.stringify(b));

/**
 * Objet `o` : renvoie [entrée complète, entrée de différences]. Entrée = numéro seul (rien n'a changé) ou
 * [numéro, champs, champs supprimés].
 */
function entry(o) {
  const rid = ridOf(o);
  const prev = sent.get(o);
  const now = new Map();
  const all = {};
  const changed = {};
  let anyChange = !prev;
  for (const key of Object.keys(o)) {
    if (key.startsWith("_")) continue;
    const e = enc(o[key], o);
    if (e === undefined) continue;
    const s = typeof e === "object" && e !== null ? JSON.stringify(e) : e;
    now.set(key, s);
    all[key] = e;
    if (!prev || !same(prev.get(key), s)) {
      changed[key] = e;
      anyChange = true;
    }
  }
  const removed = prev ? [...prev.keys()].filter((k) => !now.has(k)) : [];
  sent.set(o, now);
  const full = [rid, all];
  if (!anyChange && removed.length === 0) return [full, rid];
  return [full, removed.length > 0 ? [rid, changed, removed] : [rid, changed]];
}

function gameEntries() {
  const all = {};
  const changed = {};
  for (const key of Object.keys(game)) {
    if (LOCAL_GAME.has(key)) continue;
    const e = enc(game[key]);
    if (e === undefined) continue;
    const s = typeof e === "object" && e !== null ? JSON.stringify(e) : e;
    all[key] = e;
    if (!same(sentGame.get(key), s)) changed[key] = e;
    sentGame.set(key, s);
  }
  return { all, changed };
}

// --- HÔTE ---

const host = {
  seq: 0,
  lastSent: 0,
  needFull: new Set(), // invités qui doivent recevoir l'état complet
  sfx: [],
  events: [],
  inputs: [], // par membre : dernières commandes reçues { n, d, s }
  dash: [], // par membre : dash demandé (appliqué au tick suivant)
  skill: [],
  picks: new Map(), // choix d'amélioration en attente chez un invité
  pickId: 0,
};

/** Hôte : début de partie (tous les invités reçoivent d'abord l'état complet). */
export function startHostSync() {
  registerConstants();
  rids = new WeakMap();
  sent = new WeakMap();
  sentGame = new Map();
  sentVisual = new WeakSet();
  for (const name of VISUALS) for (const o of world[name]) sentVisual.add(o);
  Object.assign(host, {
    seq: 0,
    lastSent: 0,
    sfx: [],
    events: [],
    inputs: [],
    dash: [],
    skill: [],
    pickId: 0,
  });
  host.picks.clear();
  host.needFull = new Set(coopPeers().map((p) => p.id));
  onSfx((name) => {
    if (!OWN_SOUNDS.has(name) && host.sfx.length < 8 && !host.sfx.includes(name)) host.sfx.push(name);
  });
}

export function stopSync() {
  onSfx(null);
  host.picks.clear();
  Object.assign(guest, { active: false });
}

/** Membre joué par l'invité `peerId`. */
const memberOfPeer = (peerId) => party.members.findIndex((m) => m.peerId === peerId);

/** Hôte : message d'un invité. */
export function onGuestMessage(peerId, msg) {
  const k = memberOfPeer(peerId);
  if (k < 0 || !msg) return;
  if (msg.t === "in") return applyInput(k, msg);
  if (msg.t === "picked") return resolvePick(msg.id, msg.name);
  if (msg.t === "kf") host.needFull.add(peerId);
}

function applyInput(k, msg) {
  const m = party.members[k];
  const prev = host.inputs[k] || { n: -1, d: 0, s: 0 };
  if (!(msg.n > prev.n)) return; // ancien message (relais)
  m.profile.stick.x = clamp(Number(msg.x) || 0, -1, 1);
  m.profile.stick.y = clamp(Number(msg.y) || 0, -1, 1);
  m.profile.aim = msg.auto || !Number.isFinite(msg.a) ? null : msg.a;
  memberObj(k).autoShoot = !!msg.auto;
  if (msg.d > prev.d) host.dash[k] = true;
  if (msg.s > prev.s) host.skill[k] = true;
  if (msg.w > 0 && msg.h > 0) {
    m.viewW = Math.min(4000, msg.w);
    m.viewH = Math.min(4000, msg.h);
  }
  host.inputs[k] = { n: msg.n, d: msg.d, s: msg.s };
}

/** Hôte, avant les vaisseaux : dash et compétence demandés par les invités depuis le tick précédent. */
export function hostTickStart() {
  for (const [k, m] of party.members.entries()) {
    if (!m.profile) continue;
    m.profile.virtual.dash = !!host.dash[k] && inPlay(k);
    host.dash[k] = false;
    if (host.skill[k]) {
      host.skill[k] = false;
      if (inPlay(k)) withMember(k, () => withOwned(k, activateSkill)); // ce qu'elle crée lui appartient
    }
  }
}

/** Hôte, après les vaisseaux : un dash ne dure qu'un appui. */
export function hostTickEnd() {
  for (const m of party.members) if (m.profile) m.profile.virtual.dash = false;
}

/** Hôte : à chaque image, envoie l'état de la partie quand c'est l'heure. */
export function hostFrame(now) {
  const rate = anyRelay() ? COOP.snapshotsPerSecondRelay : COOP.snapshotsPerSecond;
  if (now - host.lastSent < 1000 / rate) return;
  host.lastSent = now;
  sendSnapshot();
  checkPickTimeouts(now);
}

/** État de la partie : différences pour tous, complet pour ceux qui en ont besoin. */
export function sendSnapshot() {
  registerConstants();
  // Numéros d'abord : un objet qui en désigne un autre (cible d'un tir...) l'envoie par son numéro
  for (const name of LISTS) for (const o of world[name]) ridOf(o);
  const members = party.members.map((_, k) => [memberObj(k, "player"), memberObj(k, "pet")]);
  for (const [p, pt] of members) {
    ridOf(p);
    ridOf(pt);
  }
  const fullL = {};
  const deltaL = {};
  for (const name of LISTS) {
    const f = [];
    const d = [];
    for (const o of world[name]) {
      const [a, b] = entry(o);
      f.push(a);
      d.push(b);
    }
    fullL[name] = f;
    deltaL[name] = d;
  }
  const fullM = [];
  const deltaM = [];
  for (const [p, pt] of members) {
    const [pa, pb] = entry(p);
    const [ta, tb] = entry(pt);
    fullM.push([pa, ta]);
    deltaM.push([pb, tb]);
  }
  const { all: fullG, changed: deltaG } = gameEntries();
  const V = {};
  for (const name of VISUALS) {
    const fresh = [];
    for (const o of world[name]) {
      if (sentVisual.has(o)) continue;
      sentVisual.add(o);
      if (fresh.length < COOP.visualCaps[name]) fresh.push(enc(o));
    }
    if (fresh.length > 0) V[name] = fresh;
  }
  const base = {
    t: "s",
    n: ++host.seq,
    at: game.time,
    gone: party.members.map((m) => (m.gone ? 1 : 0)),
    ack: host.inputs.map((i) => i?.n ?? -1),
    V,
    sfx: host.sfx.splice(0),
    ev: host.events.splice(0),
  };
  const peers = coopPeers().filter((p) => p.connected);
  const full = peers.filter((p) => host.needFull.has(p.id)).map((p) => p.id);
  const delta = peers.filter((p) => !host.needFull.has(p.id)).map((p) => p.id);
  if (delta.length > 0) broadcast({ ...base, k: 0, G: deltaG, L: deltaL, M: deltaM }, delta);
  if (full.length > 0) {
    broadcast({ ...base, k: 1, G: fullG, L: fullL, M: fullM }, full);
    for (const id of full) host.needFull.delete(id);
  }
}

// Événements relayés (bandeaux du biome, du boss...) : notés pendant le tick, envoyés avec l'état
onAny((event, payload) => {
  if (party.role !== "host" || !RELAY_EVENTS.has(event)) return;
  host.events.push([event, enc(payload) ?? null]);
});

// --- CHOIX D'AMÉLIORATION D'UN INVITÉ (hôte) ---

/** Hôte : le membre chargé (un invité) monte de niveau ou ouvre un coffre : ses cartes lui sont envoyées. */
export function requestRemotePick(kind) {
  const k = party.current;
  const m = party.members[k];
  const names = drawChoices(kind, memberObj(k)).map((u) => u.name);
  const id = ++host.pickId;
  host.picks.set(id, { k, kind, names, until: performance.now() + (COOP.pickSeconds + 4) * 1000 });
  sendTo(m.peerId, { t: "pick", id, kind, names });
}

/** Choix d'amélioration encore attendus chez les invités (la partie attend). */
export const remotePicksPending = () => host.picks.size;

/** Membres dont la partie attend le choix. */
export const remotePickers = () => [...new Set([...host.picks.values()].map((p) => p.k))];

function resolvePick(id, name) {
  const pick = host.picks.get(id);
  if (!pick) return;
  host.picks.delete(id);
  if (party.members[pick.k]?.gone) return;
  withMember(pick.k, () => {
    const cards = findCards(pick.names, memberObj(pick.k)) || [];
    const card = cards.find((u) => u.name === name) ?? cards[0];
    if (card) takeCard(card, memberObj(pick.k));
  });
}

/** Un invité qui ne répond plus ne bloque pas la partie : sa première carte est prise. */
function checkPickTimeouts(now) {
  for (const [id, pick] of host.picks) {
    if (party.members[pick.k]?.gone) host.picks.delete(id);
    else if (now > pick.until) resolvePick(id, pick.names[0]);
  }
}

// --- INVITÉ ---

const guest = {
  active: false,
  seq: 0,
  objs: new Map(), // numéro → objet
  snapAt: 0,
  interval: 50,
  moving: [], // [objet, champ x, champ y, départ x, départ y, arrivée x, arrivée y]
  auth: { x: 0, y: 0 }, // position de son vaisseau chez l'hôte
  ack: -1,
  inputSeq: 0,
  history: [], // commandes récentes { n, dx, dy }
  lastSend: 0,
  lastKey: "",
  dash: 0,
  dashHeld: false,
  skill: 0,
  auto: true,
  aim: /** @type {number | null} */ (null), // dernière visée envoyée (manette sans stick droit incliné)
  health: null,
  started: false, // premier état reçu
};

/** Invité : début de partie. */
export function startGuestSync() {
  registerConstants();
  Object.assign(guest, {
    active: true,
    seq: 0,
    snapAt: 0,
    interval: 1000 / COOP.snapshotsPerSecond,
    moving: [],
    ack: -1,
    inputSeq: 0,
    aim: null,
    history: [],
    lastSend: 0,
    lastKey: "",
    dash: 0,
    dashHeld: false,
    skill: 0,
    auto: true,
    health: null,
    started: false,
  });
  guest.objs.clear();
}

/** L'invité a reçu au moins un état de la partie. */
export const guestReady = () => guest.started;

/** Invité : compétence (touche ou bouton). */
export function requestSkill() {
  guest.skill++;
  guest.lastKey = ""; // envoi immédiat
}

/** Invité : tir automatique activé / coupé (touche T). */
export function toggleAuto() {
  guest.auto = !guest.auto;
  guest.lastKey = "";
  return guest.auto;
}

let picksCallback = null;

/** Invité : `fn({ id, kind, names })` à chaque choix d'amélioration proposé par l'hôte. */
export function onRemotePick(fn) {
  picksCallback = fn;
}

/** Invité : carte choisie. */
export function sendPick(id, name) {
  sendTo(null, { t: "picked", id, name });
}

/** Invité : message de l'hôte (état de la partie, choix d'amélioration). */
export function onHostMessage(msg) {
  if (!guest.active || !msg) return;
  if (msg.t === "s") return applySnapshot(msg);
  if (msg.t === "pick") {
    playSfx("levelUp");
    picksCallback?.(msg);
  }
}

function dec(v, fix, holder, key) {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) {
    const arr = [];
    v.forEach((x, i) => (arr[i] = dec(x, fix, arr, i)));
    return arr;
  }
  if ("$c" in v) return CONST_BY_PATH.get(v.$c) ?? null;
  if ("$r" in v) {
    fix.push([holder, key, v.$r]);
    return null;
  }
  if ("$n" in v) return Number(v.$n);
  const out = {};
  for (const k of Object.keys(v)) out[k] = dec(v[k], fix, out, k);
  return out;
}

/** Champs reçus appliqués à `o` ; les positions glissent (sauf `snapKeys` : son propre vaisseau). */
function applyFields(o, fields, removed, fix, isNew, posKeys) {
  const [kx, ky] = posKeys;
  const hadPos = !isNew && typeof o[kx] === "number";
  const tx = fields[kx];
  const ty = fields[ky];
  for (const key of Object.keys(fields)) {
    if (key === kx || key === ky) continue;
    o[key] = dec(fields[key], fix, o, key);
  }
  for (const key of removed || []) delete o[key];
  if (tx === undefined && ty === undefined) return;
  const nx = typeof tx === "number" ? tx : o[kx];
  const ny = typeof ty === "number" ? ty : o[ky];
  if (!hadPos || Math.hypot(nx - o[kx], ny - o[ky]) > COOP.snapDistance) {
    o[kx] = nx;
    o[ky] = ny;
    return;
  }
  guest.moving.push([o, kx, ky, o[kx], o[ky], nx, ny]);
}

function applySnapshot(msg) {
  if (!msg.k && msg.n !== guest.seq + 1) {
    // Envoi perdu (relais) : on attend l'état complet
    if (guest.seq > 0) sendTo(null, { t: "kf" });
    return;
  }
  if (!msg.k && !guest.started) return;
  guest.seq = msg.n;
  const now = performance.now();
  if (guest.snapAt > 0) guest.interval = clamp(guest.interval * 0.8 + (now - guest.snapAt) * 0.2, 16, 400);
  guest.snapAt = now;
  // Les glissements en cours arrivent à destination avant les nouveaux
  for (const [o, kx, ky, , , x, y] of guest.moving) {
    o[kx] = x;
    o[ky] = y;
  }
  guest.moving = [];
  const fix = [];
  let missing = false;

  for (const [key, v] of Object.entries(msg.G || {})) game[key] = dec(v, fix, game, key);

  const seen = new Set();
  for (const [name, entries] of Object.entries(msg.L || {})) {
    const list = [];
    for (const e of entries) {
      const rid = typeof e === "number" ? e : e[0];
      let o = guest.objs.get(rid);
      const isNew = !o;
      if (typeof e === "number") {
        if (!o) {
          missing = true;
          continue;
        }
      } else {
        if (!o) guest.objs.set(rid, (o = {}));
        else if (msg.k) for (const key of Object.keys(o)) if (!(key in e[1])) delete o[key];
        applyFields(o, e[1], e[2], fix, isNew, ["x", "y"]);
      }
      seen.add(rid);
      list.push(o);
    }
    const target = world[name];
    target.length = 0;
    for (const o of list) target.push(o);
  }
  for (const rid of guest.objs.keys()) if (!seen.has(rid)) guest.objs.delete(rid);

  (msg.M || []).forEach(([pe, te], k) => {
    if (!party.members[k]) return;
    const p = memberObj(k, "player");
    if (Array.isArray(pe)) {
      const fields = pe[1];
      if (k === party.local) applyOwnShip(p, fields, pe[2], fix, msg.k);
      else applyFields(p, fields, pe[2], fix, msg.k === 1 || !("worldX" in p), ["worldX", "worldY"]);
    }
    if (Array.isArray(te)) applyFields(memberObj(k, "pet"), te[1], te[2], fix, msg.k === 1, ["x", "y"]);
  });
  (msg.gone || []).forEach((g, k) => party.members[k] && (party.members[k].gone = !!g));
  for (const [holder, key, rid] of fix) holder[key] = guest.objs.get(rid) ?? null;

  for (const [name, items] of Object.entries(msg.V || {})) {
    for (const v of items) world[name].push(dec(v, [], null, null));
  }
  guest.ack = msg.ack?.[party.local] ?? guest.ack;
  for (const name of msg.sfx || []) playSfx(name);
  for (const [event, payload] of msg.ev || []) emit(event, dec(payload, [], null, null));
  if (msg.k) guest.started = true;
  if (missing) sendTo(null, { t: "kf" });
}

/** Son propre vaisseau : tout sauf la position, qui sert de point de départ à la prédiction. */
function applyOwnShip(p, fields, removed, fix, full) {
  const { worldX, worldY, ...rest } = fields;
  for (const key of Object.keys(rest)) p[key] = dec(rest[key], fix, p, key);
  for (const key of removed || []) delete p[key];
  if (typeof worldX === "number") guest.auth.x = worldX;
  if (typeof worldY === "number") guest.auth.y = worldY;
  if (full || typeof p.worldX !== "number") {
    p.worldX = guest.auth.x;
    p.worldY = guest.auth.y;
  }
  // Retour sensible et sonore des coups reçus (l'hôte ne les joue que pour son propre vaisseau)
  if (guest.health !== null && p.health < guest.health - 0.5) {
    if (p.health <= 0) playSfx("death");
    else playSfx("hurt");
    vibrate(40);
    addScreenShake(5);
  }
  guest.health = p.health;
}

/** Direction voulue sur cet appareil (clavier ou joystick), comme `move` de systems/player.js. */
function inputDirection() {
  let dx = 0;
  let dy = 0;
  if (isDown("up")) dy -= 1;
  if (isDown("down")) dy += 1;
  if (isDown("left")) dx -= 1;
  if (isDown("right")) dx += 1;
  if (dx !== 0 && dy !== 0) {
    dx *= Math.SQRT1_2;
    dy *= Math.SQRT1_2;
  }
  if (dx === 0 && dy === 0) ({ x: dx, y: dy } = touchMove);
  return { dx: Math.round(dx * 100) / 100, dy: Math.round(dy * 100) / 100 };
}

/** Invité, un tick : effets visuels qui vieillissent, commandes notées pour la prédiction. */
export function guestTick() {
  ageVisuals();
  ageTrail(world.trail);
  const dash = isDown("dash");
  if (dash && !guest.dashHeld) guest.dash++;
  guest.dashHeld = dash;
  const { dx, dy } = inputDirection();
  guest.history.push({ n: ++guest.inputSeq, dx, dy });
  if (guest.history.length > 240) guest.history.shift();
}

/** Invité, à chaque image : commandes envoyées, positions qui glissent, vaisseau prédit, caméra. */
export function guestFrame(now) {
  sendInput(now);
  const a = clamp((now - guest.snapAt) / guest.interval, 0, 1);
  for (const [o, kx, ky, fx, fy, tx, ty] of guest.moving) {
    o[kx] = fx + (tx - fx) * a;
    o[ky] = fy + (ty - fy) * a;
  }
  predictOwnShip();
  followCamera();
}

function sendInput(now) {
  const last = guest.history[guest.history.length - 1] || { dx: 0, dy: 0 };
  const aim = guest.auto ? null : Math.round(aimAngle(guest.aim ?? 0) * 100) / 100; // souris ou stick droit
  if (aim !== null) guest.aim = aim;
  const key = `${last.dx},${last.dy},${aim},${guest.auto},${guest.dash},${guest.skill}`;
  const rate = anyRelay() ? COOP.inputsPerSecondRelay : COOP.inputsPerSecond;
  const due = now - guest.lastSend >= 1000 / rate;
  const changed = key !== guest.lastKey && now - guest.lastSend >= TICK_MS;
  if (!due && !changed) return;
  guest.lastSend = now;
  guest.lastKey = key;
  sendTo(null, {
    t: "in",
    n: guest.inputSeq,
    x: last.dx,
    y: last.dy,
    a: aim,
    auto: guest.auto,
    d: guest.dash,
    s: guest.skill,
    w: Math.round(view.width),
    h: Math.round(view.height),
  });
}

/** Position reçue + déplacements que l'hôte n'a pas encore appliqués, lissée pour cacher les corrections. */
function predictOwnShip() {
  const p = memberObj(party.local);
  if (typeof p.worldX !== "number") return;
  let x = guest.auth.x;
  let y = guest.auth.y;
  if (!p.downed && !p.picking && !(p.buffs?.stun > 0)) {
    const speed = p.speed || 0;
    for (const h of guest.history) {
      if (h.n <= guest.ack) continue;
      x += h.dx * speed;
      y += h.dy * speed;
    }
    const r = p.size || 0;
    const b = game.bounds;
    if (b) {
      x = clamp(x, b.minX + r, b.maxX - r);
      y = clamp(y, b.minY + r, b.maxY - r);
    }
  }
  if (Math.hypot(x - p.worldX, y - p.worldY) > COOP.snapDistance) {
    p.worldX = x;
    p.worldY = y;
  } else {
    p.worldX += (x - p.worldX) * 0.5;
    p.worldY += (y - p.worldY) * 0.5;
  }
}
