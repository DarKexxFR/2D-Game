// Écran du Boss Rush : ordre des boss, record et lancement.

import { BOSS_RUSH, ENEMY_NAMES, ENEMY_TYPES } from "../data/enemies.js";
import { getStat } from "../services/achievements.js";
import { $, el, setText } from "./dom.js";
import { showScreen } from "./screens.js";

export function initBossRushMenu({ onPlay, onBack }) {
  $("btnBossRush").addEventListener("click", openBossRush);
  $("btnRushPlay").addEventListener("click", onPlay);
  $("btnRushBack").addEventListener("click", onBack);
  $("rushList").replaceChildren(
    ...BOSS_RUSH.order.map(({ type }, i) => {
      const item = el("li");
      const name = el("span", "", ENEMY_NAMES[type]);
      name.style.color = ENEMY_TYPES[type].color;
      item.append(el("b", "", i + 1), name);
      return item;
    }),
  );
}

export function openBossRush() {
  const best = getStat("bestBossRush");
  const total = BOSS_RUSH.order.length;
  setText(
    "rushBest",
    best
      ? `Ton record : ${best} boss vaincus${best >= total ? " · cycle bouclé !" : ""}`
      : "Pas encore tenté",
  );
  showScreen("bossRushMenu");
}
