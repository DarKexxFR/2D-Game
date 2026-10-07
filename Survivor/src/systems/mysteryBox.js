// Boîte mystère : coûte de l'or, donne une récompense aléatoire,
// puis finit par s'envoler (« NOUNOURS ! ») après un nombre d'usages aléatoire.

import { MYSTERY_BOX } from "../config.js";
import { consumeKey, keys } from "../core/input.js";
import { game, mysteryBox as box, player } from "../core/state.js";
import { dist, weightedPick } from "../utils/math.js";
import { killAllEnemies } from "./combat.js";
import {
  addFloatingText,
  addScreenShake,
  createAoEEffect,
  createHealEffect,
  createSpawnEffect,
} from "./effects.js";
import { gainXp } from "./player.js";

const REWARDS = [
  { weight: 0.4, label: "JACKPOT XP!", color: "#ffff00", apply: () => gainXp(500) },
  {
    weight: 0.3,
    label: "SOIN MAX",
    color: "#00ff00",
    apply: () => {
      player.health = player.maxHealth;
      createHealEffect(player.worldX, player.worldY);
    },
  },
  {
    weight: 0.2,
    label: "SURCHARGE (10s)",
    color: "#ff6600",
    apply: () => (player.buffs.overcharge = MYSTERY_BOX.overchargeDuration),
  },
  {
    weight: 0.08,
    label: "» NUKE «",
    color: "#ff0000",
    apply: () => {
      killAllEnemies();
      addScreenShake(20);
      createAoEEffect(player.worldX, player.worldY, 1000);
    },
  },
  {
    weight: 0.02,
    label: "» RAY GUN «",
    color: "#00ffff",
    apply: () => {
      player.hasRayGun = true;
      player.attack += 20;
    },
  },
];

export function isPlayerNearBox() {
  return box.active && dist(box.x, box.y, player.worldX, player.worldY) < MYSTERY_BOX.interactRadius;
}

export function updateMysteryBox() {
  if (!box.active) return;
  if (box.state === "OPENING") updateOpening();
  else if (box.state === "BROKEN") updateBroken();
  else if (keys["e"] && isPlayerNearBox()) tryOpen();
}

function tryOpen() {
  consumeKey("e");
  if (game.runGold < box.cost) {
    addFloatingText(box.x, box.y - 50, "PAS ASSEZ D'OR", "#ff0000", 16);
    return;
  }
  game.runGold -= box.cost;
  box.state = "OPENING";
  box.timer = MYSTERY_BOX.openDuration;
  addFloatingText(box.x, box.y - 50, `-${box.cost} OR`, "#ffff00", 20);
}

function updateOpening() {
  box.timer--;
  if (box.timer % 5 === 0) box.colorIdx = (box.colorIdx + 1) % MYSTERY_BOX.colors.length;
  if (box.timer > 0) return;

  box.uses++;
  if (box.uses >= box.maxUses) {
    box.state = "BROKEN";
    box.timer = 120;
    addFloatingText(box.x, box.y - 100, "NOUNOURS!", "#ff0000", 30, 120);
  } else {
    box.state = "IDLE";
    const reward = weightedPick(REWARDS, (r) => r.weight);
    reward.apply();
    addFloatingText(box.x, box.y - 100, reward.label, reward.color, 30, 150);
    createSpawnEffect(box.x, box.y, reward.color);
  }
}

function updateBroken() {
  box.y -= 3;
  if (--box.timer <= 0) box.active = false;
}
