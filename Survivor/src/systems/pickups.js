// Objets ramassables : gemmes d'XP, trousses de soin et sanctuaires (buffs).

import { BUFF_DURATIONS, LIMITS } from "../config.js";
import { emit } from "../core/events.js";
import { game, player, world } from "../core/state.js";
import { addStat } from "../services/achievements.js";
import { playSfx } from "../services/sfx.js";
import { clamp, dist, removeWhere } from "../utils/math.js";
import { addFloatingText, createHealEffect, createSpawnEffect } from "./effects.js";
import { gainXp, heal } from "./player.js";

const LOOTBOX_HEAL = 25;
const MAX_LOOTBOXES = 5; // soins au sol en même temps
const LOOTBOX_SPACING = 160; // distance minimale entre deux soins
const PICKUP_MARGIN = 40; // les objets restent à l'intérieur de la zone de combat

function insideArena(v, axis) {
  const [min, max] =
    axis === "x" ? [game.bounds.minX, game.bounds.maxX] : [game.bounds.minY, game.bounds.maxY];
  return clamp(v, min + PICKUP_MARGIN, max - PICKUP_MARGIN);
}

export function createGem(x, y, xp) {
  if (world.gems.length > LIMITS.gems) world.gems.shift();
  const color = xp > 50 ? "#3333ff" : xp > 10 ? "#33ff33" : "#ff3333";
  world.gems.push({
    x: clamp(x, game.bounds.minX + 20, game.bounds.maxX - 20),
    y: clamp(y, game.bounds.minY + 20, game.bounds.maxY - 20),
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

/** Coffre d'augmentation lâché par un boss : s'ouvre quand on marche dessus. */
export function dropBossChest(x, y) {
  world.bossChests.push({ x: insideArena(x, "x"), y: insideArena(y, "y"), size: 24, collected: false });
  addFloatingText(x, y - 40, "COFFRE !", "#ffd700", 22, 80);
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
  collect(world.bossChests, (chest) => {
    game.stats.bossChests++;
    addStat("bossChests");
    createSpawnEffect(chest.x, chest.y, "#ffd700");
    playSfx("levelUp");
    emit("bossChest");
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
