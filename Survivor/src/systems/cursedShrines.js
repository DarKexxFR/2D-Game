// Sanctuaires maudits : un totem rouge apparaît sur la carte. Le joueur l'active en entrant dans son
// cercle, puis doit y rester 5 s pendant qu'une mini-horde d'élites arrive (en deux salves). Réussi :
// une carte rare / épique au choix ou un gros tas d'or. Jamais pendant un boss ni en Boss Rush.
// Parfois, c'est le Marchand Noir qui apparaît à la place (systems/blackMarket.js).
// Réglages : CURSED_SHRINE (config.js). État dans `world.cursedShrines` (échangé en duel sur un écran).

import { CURSED_SHRINE as C } from "../config.js";
import { emit } from "../core/events.js";
import { game, player, world } from "../core/state.js";
import { dist, removeWhere } from "../utils/math.js";
import {
  addFloatingText,
  addScreenShake,
  createParticles,
  createShockwave,
  createSpawnEffect,
} from "./effects.js";
import { arenaPointNear } from "./pickups.js";
import { shrineHold } from "./cyberCore.js";
import { bossFight, pickEnemyType, spawnEnemy } from "./spawner.js";
import { playSfx } from "../services/sfx.js";
import { merchantReplacesShrine, spawnMerchant } from "./blackMarket.js";

const CURSED_COLOR = C.color;

export function updateCursedShrines() {
  const list = world.cursedShrines;
  if (game.rush || bossFight()) {
    // Le boss arrive : le totem s'éteint (les élites déjà là disparaissent avec les petits ennemis)
    for (const s of list) createParticles(s.x, s.y, CURSED_COLOR, 12);
    list.length = 0;
    return;
  }
  if (list.length === 0) {
    // Un seul totem (ou marchand) à la fois ; le Marchand Noir prend parfois sa place
    if (world.merchants.length > 0 || game.wave < C.fromWave || Math.random() >= C.chance) return;
    if (merchantReplacesShrine()) spawnMerchant();
    else spawnCursedShrine();
    return;
  }
  for (const s of list) updateShrine(s);
  removeWhere(list, (s) => s.done);
}

/** Pose un totem à `C.distance` du joueur (ramené dans la zone de combat). */
export function spawnCursedShrine() {
  const a = Math.random() * Math.PI * 2;
  const pos = arenaPointNear(
    player.worldX + Math.cos(a) * C.distance,
    player.worldY + Math.sin(a) * C.distance,
    0,
  );
  world.cursedShrines.push({ ...pos, state: "idle", life: C.idleLife, progress: 0, out: 0, salvo: 0 });
  addFloatingText(player.worldX, player.worldY - 60, "SANCTUAIRE MAUDIT !", CURSED_COLOR, 18, 90);
}

function updateShrine(s) {
  const inside = dist(player.worldX, player.worldY, s.x, s.y) < C.radius;
  if (s.state === "idle") {
    if (inside) activate(s);
    else if (--s.life <= 0) s.done = true;
    return;
  }
  if (inside) {
    s.progress++;
    s.out = 0;
  } else if (++s.out > C.grace) {
    return fail(s);
  }
  const hold = shrineHold(C.hold); // Rituel express (Cœur Cybernétique) : plus court
  if (s.salvo === 1 && s.progress >= hold / 2) summonHorde(s);
  if (s.progress >= hold) succeed(s);
}

function activate(s) {
  s.state = "active";
  createShockwave(s.x, s.y, C.radius * 1.6, CURSED_COLOR);
  addScreenShake(6);
  playSfx("boss");
  addFloatingText(s.x, s.y - 70, "TENEZ 5 SECONDES !", CURSED_COLOR, 20, 90);
  summonHorde(s);
}

/** Une salve d'élites autour du totem (la moitié de la horde à chaque fois). */
function summonHorde(s) {
  s.salvo++;
  const total = Math.min(C.maxElites, Math.round(C.elites + game.wave * C.elitesPerWave));
  const count = Math.ceil(total / 2);
  const offset = Math.random() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const a = offset + (Math.PI * 2 * i) / count;
    const x = s.x + Math.cos(a) * C.hordeDistance;
    const y = s.y + Math.sin(a) * C.hordeDistance;
    spawnEnemy(pickEnemyType(), x, y, true);
    createSpawnEffect(x, y, CURSED_COLOR);
  }
}

function fail(s) {
  s.done = true;
  createParticles(s.x, s.y, "#555", 16);
  addFloatingText(s.x, s.y - 60, "SANCTUAIRE PERDU", "#888", 18, 80);
}

function succeed(s) {
  s.done = true;
  createShockwave(s.x, s.y, C.radius * 2, "#ffd700");
  createParticles(s.x, s.y, CURSED_COLOR, 24);
  playSfx("levelUp");
  if (Math.random() < C.cardChance) {
    addFloatingText(s.x, s.y - 70, "DÉFI RELEVÉ !", "#ffd700", 22, 90);
    emit("cursedReward");
  } else {
    const gold = C.gold + game.wave * C.goldPerWave;
    game.runGold += gold;
    addFloatingText(s.x, s.y - 70, `DÉFI RELEVÉ ! +${gold} OR`, "#ffd700", 22, 110);
  }
}
