// Zone de combat : la carte entière, ou une arène plus petite pendant un combat de boss.
// `game.bounds` est la zone actuelle (tout ce qui bouge y est maintenu) ; ses murs glissent vers
// `game.arena` pendant un boss, puis reviennent aux bords de la carte.

import { BOSS_ZONE, MAP_BOUNDS } from "../config.js";
import { game, player } from "../core/state.js";
import { clamp } from "../utils/math.js";
import { addFloatingText } from "./effects.js";
import { bossFight } from "./spawner.js";

const SIDES = ["minX", "maxX", "minY", "maxY"];

export function updateArena() {
  const fight = !!game.rush || bossFight();
  if (fight && !game.arena) sealArena();
  else if (!fight && game.arena) {
    game.arena = null;
    addFloatingText(player.worldX, player.worldY - 70, "ARÈNE OUVERTE", "#00ff88", 18, 80);
  }
  const target = game.arena || MAP_BOUNDS;
  const b = game.bounds;
  for (const side of SIDES) {
    const d = target[side] - b[side];
    b[side] += clamp(d, -BOSS_ZONE.speed, BOSS_ZONE.speed);
  }
}

/** Le boss arrive : arène carrée autour du joueur (décalée pour rester dans la carte). */
function sealArena() {
  const half = BOSS_ZONE.size / 2;
  const cx = clamp(player.worldX, MAP_BOUNDS.minX + half, MAP_BOUNDS.maxX - half);
  const cy = clamp(player.worldY, MAP_BOUNDS.minY + half, MAP_BOUNDS.maxY - half);
  game.arena = { minX: cx - half, maxX: cx + half, minY: cy - half, maxY: cy + half };
  addFloatingText(player.worldX, player.worldY - 70, "ARÈNE SCELLÉE", "#ff2a6d", 18, 80);
}

/**
 * Zone où la partie va se jouer : la zone actuelle, réduite à l'arène si ses murs sont encore en
 * train de se refermer. À utiliser pour placer quelque chose (tentacule, saut, téléportation) :
 * `game.bounds` seul laisserait apparaître un objet là où le mur va passer.
 */
export function combatZone() {
  const b = game.bounds;
  const t = game.arena || MAP_BOUNDS;
  return {
    minX: Math.max(b.minX, t.minX),
    maxX: Math.min(b.maxX, t.maxX),
    minY: Math.max(b.minY, t.minY),
    maxY: Math.min(b.maxY, t.maxY),
  };
}

/** Ramène un point à l'intérieur de la zone de combat, à `margin` des murs. */
export function clampToZone(x, y, margin) {
  const z = combatZone();
  return { x: clamp(x, z.minX + margin, z.maxX - margin), y: clamp(y, z.minY + margin, z.maxY - margin) };
}

/** Vrai quand la zone de combat est plus petite que la carte (murs de l'arène à dessiner). */
export function arenaShrunk() {
  const b = game.bounds;
  return SIDES.some((side) => b[side] !== MAP_BOUNDS[side]);
}
