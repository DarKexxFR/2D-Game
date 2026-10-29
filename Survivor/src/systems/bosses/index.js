// Boss rangés chacun dans leur fichier : type d'ennemi → comportement par tick. Fusionné dans
// BOSS_BEHAVIORS (systems/enemies.js). Nouveau boss = son fichier ici + son entrée dans ENEMY_TYPES
// (toujours en fin de liste), ses réglages dans data/bosses.js et son sprite (render/bossShapes.js).

import { updateArchitect } from "./architect.js";
import { updateChronophage } from "./chronophage.js";
import { updateForge, updateForgePart } from "./forge.js";
import { updateHacker, updateHackerClone } from "./hacker.js";
import { updateHiveFlower, updateHiveQueen } from "./hive.js";
import { updatePulseCore } from "./pulseCore.js";
import { updateMirror, updateMirrorEcho } from "./mirror.js";
import { updateSandworm, updateSandwormSegment } from "./sandworm.js";
import { updateWeaver, updateWeaverAnchor } from "./weaver.js";

export const BOSS_MODULES = {
  sandworm: updateSandworm,
  sandworm_segment: updateSandwormSegment,
  hive_queen: updateHiveQueen,
  hive_flower: updateHiveFlower,
  chronophage: updateChronophage,
  hacker: updateHacker,
  hacker_clone: updateHackerClone,
  pulse_core: updatePulseCore,
  forge: updateForge,
  forge_drone: updateForgePart,
  forge_golem: updateForgePart,
  mirror: updateMirror,
  mirror_echo: updateMirrorEcho,
  weaver: updateWeaver,
  weaver_anchor: updateWeaverAnchor,
  architect: updateArchitect,
};
