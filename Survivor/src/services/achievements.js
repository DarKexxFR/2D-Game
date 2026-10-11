// Progression et déblocage des succès, conservés avec la sauvegarde du compte.
// Chaque succès suit une statistique (`metric`) ; le débloquer rapporte de l'or.

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

const statValue = (metric) => stats()[metric] ?? 0;

function checkAchievements() {
  const currentUnlocked = unlocked();
  let changed = false;

  for (const achievement of ACHIEVEMENTS) {
    if (currentUnlocked.includes(achievement.id)) continue;
    if (statValue(achievement.metric) < achievement.target) continue;
    currentUnlocked.push(achievement.id);
    account.gold += achievement.reward || 0;
    emit("achievementUnlocked", achievement);
    changed = true;
  }

  if (changed) saveAccount();
}

/** Ajoute `n` à une statistique cumulée (coffres ouverts, boss vaincus...). */
export function addStat(metric, n = 1) {
  stats()[metric] = statValue(metric) + n;
  checkAchievements();
}

/** Retient le meilleur score d'une statistique (vague, niveau, combo...). */
export function recordBest(metric, value) {
  if (value <= statValue(metric)) return;
  stats()[metric] = value;
  checkAchievements();
}

/** Élimination : total, boss, et boss par type (« kill_hydra »...). */
export function recordKill(type, isBoss = false) {
  const s = stats();
  s.kills = statValue("kills") + 1;
  if (isBoss) s.bosses = statValue("bosses") + 1;
  if (isBoss || type === "goblin") s[`kill_${type}`] = statValue(`kill_${type}`) + 1;
  checkAchievements();
}

export function recordWave(wave) {
  recordBest("bestWave", wave);
}

export function recordPlayerLevel(level) {
  recordBest("bestLevel", level);
}

export function recordCompletedRun() {
  stats().runs = statValue("runs") + 1;
  checkAchievements();
  saveAccount();
}

export function getAchievementProgress() {
  const currentUnlocked = unlocked();
  return ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    progress: Math.min(statValue(achievement.metric), achievement.target),
    unlocked: currentUnlocked.includes(achievement.id),
  }));
}
