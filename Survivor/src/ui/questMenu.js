// Écran des quêtes hebdomadaires : progression, récupération de l'or et notification d'une quête accomplie.

import { on } from "../core/events.js";
import { claimQuest, getWeeklyQuests } from "../services/quests.js";
import { account } from "../services/storage.js";
import { showToast } from "./achievementMenu.js";
import { $, el, setText } from "./dom.js";
import { icon, setLabel } from "./icons.js";
import { showScreen } from "./screens.js";

let onAccountChange = () => {};

export function initQuestMenu({ onBack, onChange }) {
  onAccountChange = onChange;
  $("btnQuests").addEventListener("click", openQuests);
  $("btnQuestsBack").addEventListener("click", onBack);
  on("questCompleted", (quest) => showToast(`Quête accomplie : ${quest.description}`, "quest"));
}

export function openQuests() {
  renderQuests();
  showScreen("questMenu");
}

/** « 3j 4h », « 5h 07m » : temps avant les quêtes de la semaine suivante. */
export function formatDelay(ms) {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}j ${hours}h`;
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function renderQuests() {
  const { quests, bonus, bonusClaimed, resetIn } = getWeeklyQuests();
  setText("questReset", `Nouvelles quêtes dans ${formatDelay(resetIn)}`);
  setText("questGoldDisplay", account.gold);
  $("questList").replaceChildren(...quests.map(questCard));
  const claimed = quests.filter((q) => q.claimed).length;
  setLabel(
    $("questBonus"),
    bonusClaimed
      ? ` Bonus de la semaine récupéré (+${bonus})`
      : ` Bonus : +${bonus} en récupérant les ${quests.length} quêtes (${claimed}/${quests.length})`,
    "coin",
    { before: true, color: "#ffd700" },
  );
  $("questBonus").classList.toggle("done", bonusClaimed);
}

function questCard(quest) {
  const card = el("article", `quest-card${quest.done ? " done" : ""}${quest.claimed ? " claimed" : ""}`);
  const badge = el("span", "quest-icon");
  badge.append(icon(quest.icon));
  const details = el("div", "quest-details");
  const track = el("div", "quest-track");
  const bar = el("div", "quest-bar");
  bar.style.width = `${(quest.progress / quest.target) * 100}%`;
  track.append(bar);
  details.append(
    el("h3", "", quest.description),
    el("div", "quest-progress", `${quest.progress} / ${quest.target}`),
    track,
  );

  const button = el("button", "quest-claim");
  if (quest.claimed) {
    button.textContent = "RÉCUPÉRÉ";
    button.disabled = true;
  } else {
    setLabel(button, ` ${quest.reward}`, "coin", { before: true, color: "#ffd700" });
    button.disabled = !quest.done;
    button.addEventListener("click", () => {
      const gold = claimQuest(quest.id);
      if (!gold) return;
      showToast(`+${gold} or`, "coin");
      onAccountChange();
      renderQuests();
    });
  }
  card.append(badge, details, button);
  return card;
}
