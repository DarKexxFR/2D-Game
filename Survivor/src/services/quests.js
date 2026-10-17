// Quêtes hebdomadaires : renouvelées chaque lundi à 0 h (heure locale du joueur), conservées avec la
// sauvegarde du compte (donc synchronisées avec le compte en ligne). La progression vient des mêmes
// statistiques que les succès (services/achievements.js appelle trackQuest / trackQuestBest).

import { WEEKLY } from "../config.js";
import { emit } from "../core/events.js";
import { QUESTS } from "../data/quests.js";
import { account, saveAccount } from "./storage.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, "0");

/** Lundi (00 h, heure locale) de la semaine de `date`. */
function weekStart(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Semaine au format AAAA-MM-JJ (date de son lundi). */
export function weekKey(date = new Date()) {
  const d = weekStart(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Millisecondes avant les quêtes de la semaine suivante. */
export function timeUntilNextWeek(now = new Date()) {
  const next = weekStart(now);
  next.setDate(next.getDate() + 7);
  return next.getTime() - now.getTime();
}

/** Quêtes de la semaine : tirées avec une graine tirée de la date, les mêmes pour tout le monde. */
export function questsForWeek(key) {
  let seed = [...key].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool = [...QUESTS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, WEEKLY.questsPerWeek);
}

// La semaine en cours n'est recalculée qu'au changement de semaine (trackQuest est appelé à chaque kill)
let checkedFor = null;
let checkedUntil = 0;

function weekly() {
  if (account.weekly === checkedFor && Date.now() < checkedUntil) return account.weekly;
  const key = weekKey();
  if (account.weekly?.week !== key || !Array.isArray(account.weekly.quests)) {
    account.weekly = {
      week: key,
      quests: questsForWeek(key).map((quest) => ({ id: quest.id, progress: 0, claimed: false })),
      bonusClaimed: false,
    };
  }
  checkedFor = account.weekly;
  checkedUntil = Date.now() + Math.min(timeUntilNextWeek(), DAY_MS);
  return account.weekly;
}

const definition = (id) => QUESTS.find((quest) => quest.id === id);

function progressQuests(metric, update) {
  let completed = false;
  for (const state of weekly().quests) {
    const quest = definition(state.id);
    if (quest?.metric !== metric || state.progress >= quest.target) continue;
    state.progress = Math.min(quest.target, update(state.progress, quest));
    if (state.progress >= quest.target) {
      emit("questCompleted", quest);
      completed = true;
    }
  }
  if (completed) saveAccount();
}

/** Ajoute `n` à la progression des quêtes qui cumulent `metric`. */
export function trackQuest(metric, n = 1) {
  progressQuests(metric, (progress, quest) => (quest.best ? progress : progress + n));
}

/** Meilleur score de la semaine pour les quêtes « atteindre » (vague, combo, niveau). */
export function trackQuestBest(metric, value) {
  progressQuests(metric, (progress, quest) => (quest.best ? Math.max(progress, value) : progress));
}

/** Quêtes de la semaine avec leur progression, pour l'écran des quêtes et l'accueil. */
export function getWeeklyQuests() {
  const state = weekly();
  const quests = state.quests
    .map((s) => ({ ...definition(s.id), progress: s.progress, claimed: s.claimed }))
    .filter((quest) => quest.id);
  return {
    quests: quests.map((quest) => ({ ...quest, done: quest.progress >= quest.target })),
    bonus: WEEKLY.bonusGold,
    bonusClaimed: state.bonusClaimed,
    resetIn: timeUntilNextWeek(),
  };
}

/** Nombre de récompenses prêtes à être récupérées. */
export function claimableQuests() {
  return getWeeklyQuests().quests.filter((quest) => quest.done && !quest.claimed).length;
}

/** Récupère l'or d'une quête accomplie (et le bonus si c'était la dernière). Renvoie l'or gagné. */
export function claimQuest(id) {
  const state = weekly();
  const entry = state.quests.find((s) => s.id === id);
  const quest = definition(id);
  if (!entry || !quest || entry.claimed || entry.progress < quest.target) return 0;
  entry.claimed = true;
  let gold = quest.reward;
  if (!state.bonusClaimed && state.quests.every((s) => s.claimed)) {
    state.bonusClaimed = true;
    gold += WEEKLY.bonusGold;
  }
  account.gold += gold;
  saveAccount();
  emit("questClaimed", { allDone: gold > quest.reward }); // XP de saison (services/season.js)
  return gold;
}
