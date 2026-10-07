// Progression et déblocage des succès, conservés avec la sauvegarde du compte.

import { emit } from "../core/events.js";
import { ACHIEVEMENTS } from "../data/achievements.js";
import { account, saveAccount } from "./storage.js";

const DEFAULT_STATS = { kills: 0, bosses: 0, runs: 0, bestWave: 1, bestLevel: 1 };

function stats() {
  account.achievementStats ??= { ...DEFAULT_STATS };
  return account.achievementStats;
}

function unlocked() {
  account.achievements ??= [];
  return account.achievements;
}

function checkAchievements() {
  const currentStats = stats();
  const currentUnlocked = unlocked();
  let changed = false;

  for (const achievement of ACHIEVEMENTS) {
    if (currentUnlocked.includes(achievement.id)) continue;
    if (currentStats[achievement.metric] < achievement.target) continue;
    currentUnlocked.push(achievement.id);
    emit("achievementUnlocked", achievement);
    changed = true;
  }

  if (changed) saveAccount();
}

export function recordKill(isBoss = false) {
  const currentStats = stats();
  currentStats.kills++;
  if (isBoss) currentStats.bosses++;
  checkAchievements();
}

export function recordWave(wave) {
  stats().bestWave = Math.max(stats().bestWave, wave);
  checkAchievements();
}

export function recordPlayerLevel(level) {
  stats().bestLevel = Math.max(stats().bestLevel, level);
  checkAchievements();
}

export function recordCompletedRun() {
  stats().runs++;
  checkAchievements();
  saveAccount();
}

export function getAchievementProgress() {
  const currentStats = stats();
  const currentUnlocked = unlocked();
  return ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    progress: Math.min(currentStats[achievement.metric], achievement.target),
    unlocked: currentUnlocked.includes(achievement.id),
  }));
}
