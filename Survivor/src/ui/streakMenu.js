// Fenêtre de la série de connexion : 7 cases d'or, celle du jour à récupérer.

import { claimLoginStreak, getLoginStreak } from "../services/loginStreak.js";
import { showToast } from "./achievementMenu.js";
import { $, el, setText } from "./dom.js";
import { icon } from "./icons.js";
import { showScreen } from "./screens.js";

let onDone = () => {};

export function initStreakMenu({ onClose }) {
  onDone = onClose;
  $("btnStreakClaim").addEventListener("click", () => {
    const gold = claimLoginStreak();
    if (gold) showToast(`Série de connexion : +${gold} or`, "coin");
    onDone();
  });
}

/** Ouvre la fenêtre si la récompense du jour n'a pas encore été prise. Renvoie true si ouverte. */
export function offerLoginStreak() {
  const s = getLoginStreak();
  if (!s.claimable) return false;
  setText("streakSub", s.broken ? "Série interrompue : elle repart de zéro !" : `Jour ${s.count} d'affilée`);
  $("streakDays").replaceChildren(
    ...s.rewards.map((gold, i) => {
      const day = i + 1;
      const state = day < s.slot ? "past" : day === s.slot ? "today" : "";
      const card = el("div", `streak-day ${state}`);
      card.append(
        el("small", "", `JOUR ${day}`),
        icon(day < s.slot ? "sparkle" : day === s.rewards.length ? "gift" : "coin", "#ffd700"),
        el("b", "", gold),
      );
      return card;
    }),
  );
  setText("btnStreakClaim", `RÉCUPÉRER +${s.reward} OR`);
  showScreen("streakMenu");
  return true;
}
