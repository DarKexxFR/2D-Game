// Boss rangés chacun dans leur fichier : type d'ennemi → comportement par tick. Fusionné dans
// BOSS_BEHAVIORS (systems/enemies.js). Nouveau boss = son fichier ici + son entrée dans ENEMY_TYPES
// (toujours en fin de liste), ses réglages dans data/bosses.js et son sprite (render/bossShapes.js).

import { updateChronophage } from "./chronophage.js";
import { updateHacker, updateHackerClone } from "./hacker.js";
import { updateHiveFlower, updateHiveQueen } from "./hive.js";
import { updatePulseCore } from "./pulseCore.js";
import { updateSandworm, updateSandwormSegment } from "./sandworm.js";

export const BOSS_MODULES = {
  sandworm: updateSandworm,
  sandworm_segment: updateSandwormSegment,
  hive_queen: updateHiveQueen,
  hive_flower: updateHiveFlower,
  chronophage: updateChronophage,
  hacker: updateHacker,
  hacker_clone: updateHackerClone,
  pulse_core: updatePulseCore,
};
