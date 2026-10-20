// Consultation des succès (par catégorie) et notification de leur déblocage.

import { on } from "../core/events.js";
import { ACHIEVEMENT_GROUPS } from "../data/achievements.js";
import { BESTIARY_TYPES } from "../data/bestiary.js";
import { ENEMY_NAMES } from "../data/enemies.js";
import { bestiaryProgress } from "../services/bestiary.js";
import { getAchievementProgress } from "../services/achievements.js";
import { $, el, setWidth } from "./dom.js";
import { icon, setLabel } from "./icons.js";
import { showScreen } from "./screens.js";

let toastTimer = null;
const toastQueue = [];

export function openAchievements() {
  renderAchievements();
  showScreen("achievementMenu");
}

export function initAchievementMenu({ onBack }) {
  $("btnAchievements").addEventListener("click", openAchievements);
  $("btnAchievementsBack").addEventListener("click", onBack);
  on("achievementUnlocked", showAchievementToast);
  on("bestiaryUnlocked", ({ type, found }) =>
    showToast(`Bestiaire : ${ENEMY_NAMES[type]} · fiche ${found}/${BESTIARY_TYPES.length}`, "book"),
  );
}

function renderAchievements() {
  const achievements = getAchievementProgress();
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  $("achievementCount").textContent = `${unlockedCount} / ${achievements.length} débloqués`;
  setWidth("achievementTotalBar", unlockedCount / achievements.length);
  const { found, total } = bestiaryProgress();
  $("bestiaryCount").textContent = `${found}/${total} fiches`;

  const sections = [];
  for (const group of ACHIEVEMENT_GROUPS) {
    const list = achievements.filter((a) => a.group === group.id);
    const done = list.filter((a) => a.unlocked).length;
    const title = el("h3", "shop-section ach-group-title");
    title.append(el("span", "", group.name), el("small", "", `${done}/${list.length}`));
    title.style.setProperty("--group", group.color);
    const grid = el("div", "ach-grid");
    grid.append(...list.map((a) => achievementCard(a, group.color)));
    sections.push(title, grid);
  }
  $("achievementList").replaceChildren(...sections);
}

function achievementCard(achievement, color) {
  const item = el("article", `achievement-item${achievement.unlocked ? " unlocked" : ""}`);
  item.style.setProperty("--group", color);
  const badge = el("span", "achievement-icon");
  badge.append(achievement.unlocked ? icon(achievement.icon, color) : icon("lock", "#555"));
  const details = el("div", "achievement-details");
  const head = el("div", "achievement-head");
  head.append(el("h3", "", achievement.name));
  if (achievement.reward) {
    head.append(setLabel(el("span", "ach-reward"), `${achievement.reward} `, "coin", { color: "#ffd700" }));
  }
  const progress = el(
    "div",
    "achievement-progress-text",
    achievement.unlocked ? "DÉBLOQUÉ" : `${achievement.progress} / ${achievement.target}`,
  );
  const track = el("div", "achievement-progress-track");
  const bar = el("div", "achievement-progress-bar");
  bar.style.width = `${(achievement.progress / achievement.target) * 100}%`;
  track.append(bar);
  details.append(head, el("p", "", achievement.description), progress, track);
  item.append(badge, details);
  return item;
}

function showAchievementToast(achievement) {
  const reward = achievement.reward ? ` · +${achievement.reward} or` : "";
  showToast(`Succès débloqué : ${achievement.name}${reward}`, achievement.icon);
}

/** Notification en haut de l'écran (succès, quête accomplie...) : à la suite si plusieurs arrivent. */
export function showToast(text, iconName) {
  toastQueue.push({ text, iconName });
  if (!toastTimer) nextToast();
}

function nextToast() {
  const toast = $("achievementToast");
  const next = toastQueue.shift();
  if (!next) {
    toastTimer = null;
    toast.classList.remove("visible");
    return;
  }
  setLabel(toast, ` ${next.text}`, next.iconName, { before: true });
  toast.classList.add("visible");
  toastTimer = setTimeout(nextToast, toastQueue.length ? 1800 : 3500);
}
