// Marchand Noir : apparaît parfois à la place d'un sanctuaire maudit (BLACK_MARKET.chance). Il attend
// dans l'arène ; s'en approcher ouvre son échange (ui/blackMarket.js, par la file des choix de
// ui/upgradeMenu.js) : une carte déjà prise ou une part des PV max contre une carte légendaire ou
// corrompue garantie. Une seule affaire, puis il disparaît. Il s'en va si un boss arrive ou au bout de
// `idleLife`. Jamais en Boss Rush ni en duel. État dans `world.merchants` (propre à chaque partie).

import { BLACK_MARKET as M, CURSED_SHRINE } from "../config.js";
import { emit } from "../core/events.js";
import { game, player, world } from "../core/state.js";
import { dist, removeWhere } from "../utils/math.js";
import { addFloatingText, createParticles, createShockwave } from "./effects.js";
import { arenaPointNear } from "./pickups.js";
import { bossFight } from "./spawner.js";
import { versus } from "./versus.js";

/** Le prochain sanctuaire est-il remplacé par le marchand ? */
export function merchantReplacesShrine() {
  return !versus.active && !game.rush && game.wave >= M.fromWave && Math.random() < M.chance;
}

/** Pose le marchand à la distance d'un sanctuaire (ramené dans la zone de combat). */
export function spawnMerchant() {
  const a = Math.random() * Math.PI * 2;
  const d = CURSED_SHRINE.distance;
  const pos = arenaPointNear(player.worldX + Math.cos(a) * d, player.worldY + Math.sin(a) * d, 0);
  world.merchants.push({ ...pos, life: M.idleLife });
  createShockwave(pos.x, pos.y, M.radius * 2, M.color);
  addFloatingText(player.worldX, player.worldY - 60, "MARCHAND NOIR !", M.color, 18, 90);
}

export function updateBlackMarket() {
  const list = world.merchants;
  if (list.length === 0) return;
  if (game.rush || bossFight() || versus.active) {
    for (const m of list) leave(m, "LE MARCHAND S'ÉCLIPSE");
  }
  for (const m of list) {
    if (m.done) continue;
    if (dist(player.worldX, player.worldY, m.x, m.y) < M.radius) {
      m.done = true;
      createParticles(m.x, m.y, M.color, 20);
      emit("blackMarket");
    } else if (--m.life <= 0) leave(m, "LE MARCHAND EST PARTI");
  }
  removeWhere(list, (m) => m.done);
}

function leave(m, text) {
  m.done = true;
  createParticles(m.x, m.y, M.color, 16);
  addFloatingText(m.x, m.y - 60, text, "#9a86c0", 16, 80);
}
