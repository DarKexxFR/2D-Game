// Objets ramassables : gemmes d'XP, trousses de soin et sanctuaires (buffs).

import { BUFF_DURATIONS, LIMITS, MAP_BOUNDS } from "../config.js";
import { player, world } from "../core/state.js";
import { clamp, dist, removeWhere } from "../utils/math.js";
import { addFloatingText, createHealEffect, createSpawnEffect } from "./effects.js";
import { gainXp, heal } from "./player.js";

const LOOTBOX_HEAL = 25;

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

export function dropLootBox(x, y) {
  world.lootBoxes.push({ x, y, size: 15, collected: false });
}

export function updatePickups() {
  updateGems();
  collect(world.lootBoxes, (box) => {
    heal(LOOTBOX_HEAL);
    createHealEffect(player.worldX, player.worldY);
    addFloatingText(box.x, box.y, `+${LOOTBOX_HEAL} HP`, "#00ff00", 16);
  });
  collect(world.shrines, (s) => {
    addFloatingText(player.worldX, player.worldY - 50, s.label + " ACTIVÉ!", s.color, 20);
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
