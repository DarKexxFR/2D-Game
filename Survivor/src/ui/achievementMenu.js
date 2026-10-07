// Consultation des succès et notification de leur déblocage.

import { on } from "../core/events.js";
import { getAchievementProgress } from "../services/achievements.js";
import { $, el } from "./dom.js";
import { icon, setLabel } from "./icons.js";
import { showScreen } from "./screens.js";

let toastTimer;

export function openAchievements() {
  renderAchievements();
  showScreen("achievementMenu");
}

export function initAchievementMenu({ onBack }) {
  $("btnAchievements").addEventListener("click", openAchievements);
  $("btnAchievementsBack").addEventListener("click", onBack);
  on("achievementUnlocked", showAchievementToast);
}

function renderAchievements() {
  const achievements = getAchievementProgress();
  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;
  $("achievementCount").textContent = `${unlockedCount} / ${achievements.length} débloqués`;

  const list = $("achievementList");
  list.replaceChildren();
  for (const achievement of achievements) {
    const item = el("article", `achievement-item${achievement.unlocked ? " unlocked" : ""}`);
    const badge = el("span", "achievement-icon");
    badge.append(achievement.unlocked ? icon(achievement.icon, "#ffd700") : icon("lock", "#666"));
    const details = el("div", "achievement-details");
    const title = el("h3", "", achievement.name);
    const description = el("p", "", achievement.description);
    const progress = el(
      "div",
      "achievement-progress-text",
      achievement.unlocked ? "DÉBLOQUÉ" : `${achievement.progress} / ${achievement.target}`,
    );
    const track = el("div", "achievement-progress-track");
    const bar = el("div", "achievement-progress-bar");
    bar.style.width = `${(achievement.progress / achievement.target) * 100}%`;
    track.append(bar);
    details.append(title, description, progress, track);
    item.append(badge, details);
    list.append(item);
  }
}

function showAchievementToast(achievement) {
  const toast = $("achievementToast");
  setLabel(toast, ` Succès débloqué : ${achievement.name}`, achievement.icon, { before: true });
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3500);
}
