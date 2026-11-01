// Coop : de 2 à 4 vaisseaux dans la même partie de survie.
//
// Le moteur n'a qu'un joueur global (`player`, `pet`, `camera`, traînée) que tous les systèmes lisent. En
// coop, chaque membre de l'équipe a ses propres objets, rangés dans `members[k].store` ; le membre « chargé »
// (`party.current`) occupe les objets globaux. `withMember(k, fn)` charge le membre k le temps de `fn`
// (déplacement, tirs, ramassage, coups reçus...), puis remet le précédent. Hors de tout `withMember`, le
// membre chargé est celui de cet appareil (`party.local`) : HUD, caméra et rendu le lisent sans rien changer.
//
// Le monde (`game`, `world`) est commun. Les tirs et objets d'un joueur (`OWNED_LISTS`) portent `owner` :
// ils avancent pendant le passage de leur propriétaire, avec ses statistiques (critique, vol de vie...).
// Chaque ennemi poursuit le membre vivant le plus proche (`e.aggro`) ; il avance pendant le passage de ce
// membre, ses attaques le visent donc lui. Les zones et tirs ennemis touchent tous les membres (`partyHit`).
//
// Sur l'hôte (ou dans les tests, sans réseau), la partie tourne ici ; un invité ne fait que dessiner l'état
// reçu (voir systems/coopSync.js).

import { BOSS_ZONE, COOP, MAP_BOUNDS } from "../config.js";
import { view } from "../core/canvas.js";
import { emit } from "../core/events.js";
import { useInputProfile } from "../core/input.js";
import { camera, game, pet, player, world } from "../core/state.js";
import { trailState } from "./trail.js";

/**
 * @typedef {{ keys: Record<string, string[]>, virtual: Record<string, boolean>, stick: { x: number, y: number }, aim: number | null }} InputProfile
 * @typedef {{
 *   name: string, color: string, gone: boolean,
 *   store: { player: any, pet: any, camera: any, trail: any },
 *   profile: InputProfile | null, viewW: number, viewH: number, peerId?: string | null,
 * }} Member  peerId : identifiant réseau de l'invité qui le joue (hôte)
 */

export const party = {
  active: false,
  role: /** @type {"host" | "guest" | "local" | null} */ (null), // "local" : équipe simulée sur cet appareil (tests)
  local: 0, // membre joué sur cet appareil
  current: 0, // membre chargé dans les objets globaux
  focus: 0, // membre autour duquel naissent les ennemis et les événements de carte
  /** @type {Member[]} */
  members: [],
};

const LIVE = { player, pet, camera, trail: trailState };

/** Commandes d'un joueur distant : remplies par le réseau (voir systems/coopSync.js). */
export function remoteProfile() {
  return /** @type {InputProfile} */ ({ keys: {}, virtual: {}, stick: { x: 0, y: 0 }, aim: null });
}

/**
 * Commence une équipe. `names[k]` : pseudo du membre k ; `local` : index de ce joueur. Les objets de
 * chaque membre sont vides : l'appelant les remplit (setupMember, ou état reçu de l'hôte).
 * @param {{ role: "host" | "guest" | "local", local: number, names: string[] }} opts
 */
export function startParty({ role, local, names }) {
  stopParty();
  party.active = true;
  party.role = role;
  party.local = local;
  party.current = local;
  party.focus = 0;
  party.members = names.map((name, k) => ({
    name,
    color: COOP.colors[k % COOP.colors.length],
    gone: false,
    store: { player: {}, pet: {}, camera: {}, trail: {} },
    profile: k === local ? null : remoteProfile(),
    viewW: 0,
    viewH: 0,
    peerId: null,
  }));
}

export function stopParty() {
  if (party.active && party.current !== party.local) load(party.local);
  useInputProfile(null);
  Object.assign(party, { active: false, role: null, local: 0, current: 0, focus: 0, members: [] });
}

export const inParty = () => party.active;
export const partySize = () => (party.active ? party.members.length : 1);

/** Le membre chargé est-il celui de cet appareil ? (sons, vibrations, écrans : seulement pour lui) */
export const isLocalMember = () => !party.active || party.current === party.local;

/** Objet `name` (player, pet, camera, trail) du membre k, où qu'il soit rangé. */
export function memberObj(k, name = "player") {
  if (!party.active || k === party.current) return LIVE[name];
  return party.members[k]?.store[name];
}

/** Index du membre dont `p` est le vaisseau (objet global ou rangé), -1 sinon. */
export function memberIndexOf(p) {
  if (!party.active) return 0;
  if (p === player) return party.current;
  return party.members.findIndex((m) => m.store.player === p);
}

/** Membre présent et debout (ni à terre ni parti). */
export function isUp(k) {
  const m = party.members[k];
  if (!m || m.gone) return false;
  const p = memberObj(k);
  return !p.downed && p.health > 0;
}

/** Membres encore là (un joueur qui a quitté la partie n'y est plus). */
export function presentMembers() {
  const list = [];
  for (let k = 0; k < party.members.length; k++) if (!party.members[k].gone) list.push(k);
  return list;
}

export function upMembers() {
  return presentMembers().filter(isUp);
}

/** Déplace le contenu de `src` dans `dst` (vidé d'abord) et vide `src`. */
function moveInto(dst, src) {
  for (const k of Object.keys(dst)) delete dst[k];
  Object.assign(dst, src);
  for (const k of Object.keys(src)) delete src[k];
}

/** Charge le membre k dans les objets globaux (le membre chargé retourne dans son rangement). */
function load(k) {
  const from = party.members[party.current].store;
  const to = party.members[k].store;
  for (const [name, live] of Object.entries(LIVE)) {
    moveInto(from[name], live);
    moveInto(live, to[name]);
  }
  party.current = k;
}

/** Exécute `fn` avec le membre k chargé (ses objets, ses commandes, la taille de son écran). */
export function withMember(k, fn) {
  if (!party.active || k === party.current || !party.members[k]) return fn();
  const prev = party.current;
  const saved = { w: view.width, h: view.height };
  load(k);
  const m = party.members[k];
  useInputProfile(m.profile);
  if (m.viewW > 0) {
    view.width = m.viewW;
    view.height = m.viewH;
  }
  try {
    return fn();
  } finally {
    load(prev);
    view.width = saved.w;
    view.height = saved.h;
    useInputProfile(party.members[prev].profile);
  }
}

/** `fn(k)` pour chaque membre debout (ou présent, `{ down: true }`), chacun chargé à son tour. */
export function forEachMember(fn, { down = false } = {}) {
  if (!party.active) return fn(party.local);
  for (const k of down ? presentMembers() : upMembers()) withMember(k, () => fn(k));
}

/** Tous les autres membres présents que celui chargé (XP partagée...). */
export function forOtherMembers(fn) {
  if (!party.active) return;
  const self = party.current;
  for (const k of presentMembers()) if (k !== self) withMember(k, () => fn(k));
}

/**
 * Coup qui peut toucher n'importe quel membre debout : `test(p)` (p = son vaisseau) dit s'il est touché,
 * `apply()` s'exécute alors avec ce membre chargé (takeDamage, ralentissement...). Hors coop : le joueur.
 * @param {(p: any) => boolean} test
 * @param {() => void} apply
 */
export function partyHit(test, apply) {
  if (!party.active) {
    if (test(player)) apply();
    return;
  }
  for (const k of upMembers()) {
    if (test(memberObj(k))) withMember(k, apply);
  }
}

/** Vaisseau du membre debout le plus proche de (x, y) (hors coop : le joueur). */
export function nearestMember(x, y) {
  if (!party.active) return player;
  let best = null;
  let bestD = Infinity;
  for (const k of upMembers()) {
    const p = memberObj(k);
    const d = (p.worldX - x) ** 2 + (p.worldY - y) ** 2;
    if (d < bestD) [best, bestD] = [p, d];
  }
  return best ?? player;
}

function nearestIndex(x, y) {
  let best = -1;
  let bestD = Infinity;
  for (const k of upMembers()) {
    const p = memberObj(k);
    const d = (p.worldX - x) ** 2 + (p.worldY - y) ** 2;
    if (d < bestD) [best, bestD] = [k, d];
  }
  return best;
}

/**
 * Cible de chaque ennemi : le membre debout le plus proche. Un boss garde la sienne quelques secondes
 * (`COOP.bossRetargetTicks`) pour que ses attaques annoncées ne sautent pas d'un joueur à l'autre.
 */
export function assignAggro(count = world.enemies.length) {
  for (let i = 0; i < count; i++) {
    const e = world.enemies[i];
    if (e.dead) continue;
    const keep = e.template?.isBoss && isUp(e.aggro ?? -1) && game.time < (e.aggroUntil ?? 0);
    if (keep) continue;
    e.aggro = nearestIndex(e.x, e.y);
    if (e.template?.isBoss) e.aggroUntil = game.time + COOP.bossRetargetTicks * (1000 / 60);
  }
}

/** Les apparitions et événements de carte tournent autour de chaque membre debout, à tour de rôle. */
export function updateFocus() {
  const up = upMembers();
  if (up.length === 0) return party.focus;
  const slot = Math.floor(game.time / ((COOP.focusTicks * 1000) / 60)) % up.length;
  party.focus = up[slot];
  return party.focus;
}

/** Centre de l'équipe debout (arène d'un boss) ; hors coop, le joueur. */
export function teamCenter() {
  const up = party.active ? upMembers() : [];
  if (up.length === 0) return { x: player.worldX, y: player.worldY };
  let x = 0;
  let y = 0;
  for (const k of up) {
    x += memberObj(k).worldX;
    y += memberObj(k).worldY;
  }
  return { x: x / up.length, y: y / up.length };
}

/**
 * Partie à `size` joueurs : carte et arène des boss plus grandes, ennemis plus nombreux, plus fréquents et
 * plus résistants (`COOP.scaling`, × (1 + valeur × joueurs en plus)). À appeler après resetGame.
 */
export function applyPartyScaling(size) {
  const extra = Math.max(0, size - 1);
  const k = (name) => 1 + COOP.scaling[name] * extra;
  const half = (v) => v * k("map");
  game.map = {
    minX: half(MAP_BOUNDS.minX),
    maxX: half(MAP_BOUNDS.maxX),
    minY: half(MAP_BOUNDS.minY),
    maxY: half(MAP_BOUNDS.maxY),
  };
  Object.assign(game.bounds, game.map);
  game.arenaSize = BOSS_ZONE.size * k("arena");
  const mod = (game.modifier = { ...game.modifier });
  mod.enemyHealth = (mod.enemyHealth || 1) * k("enemyHealth");
  mod.mobCount = (mod.mobCount || 1) * k("mobCount");
  mod.spawnRate = (mod.spawnRate || 1) * k("spawnRate");
  game.coopSize = size;
}

// --- TIRS ET OBJETS DE CHAQUE JOUEUR ---

/** Listes du monde dont chaque élément appartient à un joueur (`owner`). */
export const OWNED_LISTS = ["projectiles", "mines", "slashes", "clones", "meteors", "turrets"];

/**
 * Exécute `fn` avec, dans `world`, seulement les tirs et objets du membre k (ceux qu'il crée lui sont
 * attribués). Un objet né hors des passages des joueurs (tourelle piratée...) revient au membre `focus`.
 */
export function withOwned(k, fn) {
  if (!party.active) return fn();
  const others = {};
  for (const name of OWNED_LISTS) {
    const all = world[name];
    const mine = [];
    const rest = [];
    for (const o of all) {
      o.owner ??= party.focus;
      (o.owner === k ? mine : rest).push(o);
    }
    others[name] = rest;
    world[name] = mine;
  }
  try {
    return fn();
  } finally {
    for (const name of OWNED_LISTS) {
      for (const o of world[name]) o.owner ??= k;
      world[name] = others[name].concat(world[name]);
    }
  }
}

// --- À TERRE ET RÉANIMATION ---

/**
 * Le membre chargé vient de tomber à 0 PV (après les résurrections de ses talents). Renvoie true si
 * l'équipe continue (il reste quelqu'un debout), false si c'était le dernier : fin de partie.
 */
export function downMember() {
  if (!party.active) return false;
  Object.assign(player, { downed: true, health: 0, isDashing: false, reviveProgress: 0 });
  const k = party.current;
  const left = upMembers().length;
  emit("memberDown", { k, name: party.members[k].name, last: left === 0 });
  return left > 0;
}

/** Relève le membre chargé (PV partiels, bouclier). */
function reviveCurrent() {
  player.downed = false;
  player.reviveProgress = 0;
  player.health = player.maxHealth * COOP.reviveHealth;
  player.buffs.shield = Math.max(player.buffs.shield, COOP.reviveShield);
  const k = party.current;
  world.visualEffects.push({
    type: "shockwave",
    x: player.worldX,
    y: player.worldY,
    radius: 0,
    max: 90,
    life: 20,
    color: party.members[k].color,
  });
  emit("memberRevived", { k, name: party.members[k].name });
}

/** Un tick : un membre à terre se relève quand un coéquipier reste à côté de lui assez longtemps. */
export function updateRevives() {
  if (!party.active) return;
  for (const k of presentMembers()) {
    const p = memberObj(k);
    if (!p.downed) continue;
    const helped = upMembers().some((j) => {
      const q = memberObj(j);
      return (q.worldX - p.worldX) ** 2 + (q.worldY - p.worldY) ** 2 < COOP.reviveRadius ** 2;
    });
    p.reviveProgress = helped
      ? (p.reviveProgress || 0) + 1
      : Math.max(0, (p.reviveProgress || 0) - COOP.reviveDecay);
    if (p.reviveProgress >= COOP.reviveTicks) withMember(k, reviveCurrent);
  }
}

/** Un membre quitte la partie (déconnexion) : son vaisseau disparaît, ses ennemis changent de cible. */
export function memberLeft(k) {
  const m = party.members[k];
  if (!m || m.gone) return;
  m.gone = true;
  emit("memberLeft", { k, name: m.name });
}

/** Membre que suit la caméra de cet appareil : soi-même, ou un coéquipier debout quand on est à terre. */
export function spectated() {
  if (!party.active || isUp(party.local)) return party.local;
  const up = upMembers();
  return up.length > 0 ? up[0] : party.local;
}

/** Caméra de cet appareil, centrée sur le membre suivi. */
export function followCamera() {
  const p = memberObj(spectated());
  camera.x = p.worldX - view.width / 2;
  camera.y = p.worldY - view.height / 2;
}
