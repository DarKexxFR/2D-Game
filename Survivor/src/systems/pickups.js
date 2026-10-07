// Objets ramassables : gemmes d'XP, trousses de soin et sanctuaires (buffs).

import { BUFF_DURATIONS, LIMITS, MAP_BOUNDS } from "../config.js";
import { player, world } from "../core/state.js";
import { playSfx } from "../services/sfx.js";
import { clamp, dist, removeWhere } from "../utils/math.js";
import { addFloatingText, createHealEffect, createSpawnEffect } from "./effects.js";
import { gainXp, heal } from "./player.js";

const LOOTBOX_HEAL = 25;
const MAX_LOOTBOXES = 5; // soins au sol en même temps
const LOOTBOX_SPACING = 160; // distance minimale entre deux soins
const PICKUP_MARGIN = 40; // les objets restent à l'intérieur de la zone de combat

function insideArena(v, axis) {
  const [min, max] = axis === "x" ? [MAP_BOUNDS.minX, MAP_BOUNDS.maxX] : [MAP_BOUNDS.minY, MAP_BOUNDS.maxY];
  return clamp(v, min + PICKUP_MARGIN, max - PICKUP_MARGIN);
}

export function createGem(x, y, xp) {
  if (world.gems.length > LIMITS.gems) world.gems.shift();
  const color = xp > 50 ? "#3333ff" : xp > 10 ? "#33ff33" : "#ff3333";
  world.gems.push({
    x: clamp(x, MAP_BOUNDS.minX + 20, MAP_BOUNDS.maxX - 20),
    y: clamp(y, MAP_BOUNDS.minY + 20, MAP_BOUNDS.maxY - 20),
    xp,
    color,
    collected: false,
  });
}

/** Pose une trousse de soin, sauf s'il y en a déjà trop au sol ou une autre trop proche. */
export function dropLootBox(x, y) {
  const boxes = world.lootBoxes;
  if (boxes.length >= MAX_LOOTBOXES) return false;
  x = insideArena(x, "x");
  y = insideArena(y, "y");
  if (boxes.some((b) => dist(b.x, b.y, x, y) < LOOTBOX_SPACING)) return false;
  boxes.push({ x, y, size: 15, collected: false });
  return true;
}

/** Position aléatoire autour d'un point, ramenée à l'intérieur de la zone de combat. */
export function arenaPointNear(x, y, spread) {
  return {
    x: insideArena(x + (Math.random() - 0.5) * spread, "x"),
    y: insideArena(y + (Math.random() - 0.5) * spread, "y"),
  };
}

export function updatePickups() {
  updateGems();
  collect(world.lootBoxes, (box) => {
    heal(LOOTBOX_HEAL);
    createHealEffect(player.worldX, player.worldY);
    addFloatingText(box.x, box.y, `+${LOOTBOX_HEAL} HP`, "#00ff00", 16);
  });
  collect(world.shrines, (s) => {
    addFloatingText(player.worldX, player.worldY - 50, `${s.name} ACTIVÉ !`, s.color, 20);
    createSpawnEffect(player.worldX, player.worldY, s.color);
    player.buffs[s.type] = BUFF_DURATIONS[s.type];
  });
}

function updateGems() {
  const px = player.worldX;
  const py = player.worldY;
  const magnetR = player.buffs.magnet > 0 ? 3000 : player.magnetRadius;
  for (const g of world.gems) {
    const d = dist(g.x, g.y, px, py);
    if (d < magnetR && d > 0) {
      const speed = 10 + (magnetR - d) / 10;
      g.x += ((px - g.x) / d) * speed;
      g.y += ((py - g.y) / d) * speed;
    }
    if (d < player.size + 10) {
      g.collected = true;
      playSfx("pickup");
      gainXp(g.xp);
    }
  }
  removeWhere(world.gems, (g) => g.collected);
}

function collect(list, onPickup) {
  for (const item of list) {
    if (dist(player.worldX, player.worldY, item.x, item.y) < player.size + item.size) {
      item.collected = true;
      onPickup(item);
    }
  }
  removeWhere(list, (item) => item.collected);
}
