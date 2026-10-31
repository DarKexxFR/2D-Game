// Anomalies de biome : chef d'orchestre. Chaque biome qui en a une (data/anomalies.js) change le
// terrain pendant toutes ses vagues. Un module par anomalie dans ce dossier, avec la même forme :
//   layout(a, def, arena, zone)  pose les objets (coordonnées relatives u, v entre 0 et 1, ou propres au module)
//   place?(a, def, zone)   calcule x, y de chaque objet dans la zone de combat (par défaut : u, v → zone)
//   update(a, def, zone)   un tick
//   steer?(a, def, vx, vy) modifie le déplacement voulu du joueur (glace)
// État dans `game.anomaly` (données simples : la partie reste sauvegardable et propre à chaque partie
// d'un duel). Les objets suivent les murs de l'arène d'un boss, et sont reposés quand elle se ferme
// ou se rouvre (moins d'objets dans l'arène).

import { emit } from "../../core/events.js";
import { game } from "../../core/state.js";
import { ANOMALIES, anomalyForBiome } from "../../data/anomalies.js";
import { biomeForWave } from "../../data/biomes.js";
import { combatZone } from "../arena.js";
import * as ice from "./ice.js";
import * as portals from "./portals.js";
import * as turrets from "./turrets.js";

/** @type {Record<string, { layout: Function, update: Function, place?: Function, steer?: Function }>} */
const MODULES = { ice, turrets, portals };

export function updateAnomaly() {
  const def = anomalyForBiome(biomeForWave(game.wave).id);
  if ((game.anomaly?.id ?? null) !== (def?.id ?? null)) startAnomaly(def);
  const a = game.anomaly;
  if (!a) return;
  const mod = MODULES[a.id];
  const arena = !!game.arena;
  const zone = combatZone();
  if (a.arena !== arena) {
    a.arena = arena;
    a.items = [];
    mod.layout(a, def, arena, zone);
  }
  (mod.place ?? placeRelative)(a, def, zone);
  mod.update(a, def, zone);
}

/** Active l'anomalie `def` (null = terrain neutre) et l'annonce. */
export function startAnomaly(def) {
  if (!def) {
    game.anomaly = null;
    return;
  }
  game.anomaly = { id: def.id, arena: null, items: [] };
  emit("anomaly", def);
}

/** Déplacement voulu du joueur (vx, vy en px par tick), modifié par le terrain s'il le faut. */
export function steerOnTerrain(vx, vy) {
  const a = game.anomaly;
  const steer = a && MODULES[a.id]?.steer;
  return steer ? steer(a, ANOMALIES[a.id], vx, vy) : { x: vx, y: vy };
}

/** Position de chaque objet : (u, v) relatifs à la zone de combat actuelle. */
function placeRelative(a, _def, zone) {
  const w = zone.maxX - zone.minX;
  const h = zone.maxY - zone.minY;
  for (const it of a.items) {
    it.x = zone.minX + it.u * w;
    it.y = zone.minY + it.v * h;
  }
}
