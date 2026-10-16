// Série de connexion : une récompense en or par jour de connexion d'affilée (jour local du joueur).
// `account.loginStreak` = { day: dernier jour récupéré (AAAA-MM-JJ), count: jours d'affilée }.
// Le cycle de récompenses fait 7 jours puis recommence ; un jour manqué remet la série à 1.

import { LOGIN_STREAK } from "../config.js";
import { recordBest } from "./achievements.js";
import { account, saveAccount } from "./storage.js";

const CYCLE = LOGIN_STREAK.rewards.length;

/** Jour local au format AAAA-MM-JJ (la série suit les minuits du joueur, comme les quêtes). */
export function localDayKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Nombre de jours entre deux clés AAAA-MM-JJ. */
function daysBetween(a, b) {
  const t = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(b) - t(a)) / 86400000);
}

/**
 * État de la série aujourd'hui : `claimable` (récompense du jour pas encore prise), `count`
 * (jours d'affilée en la prenant), `slot` (case 1 à 7 du cycle), `reward` (or), `rewards` (le cycle).
 */
export function getLoginStreak(now = new Date()) {
  const today = localDayKey(now);
  const { day, count } = account.loginStreak;
  const claimed = day === today;
  const next = claimed ? count : day && daysBetween(day, today) === 1 ? count + 1 : 1;
  const slot = ((Math.max(1, next) - 1) % CYCLE) + 1;
  return {
    claimable: !claimed,
    count: next,
    slot,
    reward: LOGIN_STREAK.rewards[slot - 1],
    rewards: LOGIN_STREAK.rewards,
    broken: !claimed && count > 0 && next === 1, // série interrompue (un jour manqué)
  };
}

/** Récupère l'or du jour. Renvoie l'or gagné (0 si déjà récupéré aujourd'hui). */
export function claimLoginStreak(now = new Date()) {
  const s = getLoginStreak(now);
  if (!s.claimable) return 0;
  account.loginStreak = { day: localDayKey(now), count: s.count };
  account.gold += s.reward;
  saveAccount();
  recordBest("bestStreak", s.count);
  return s.reward;
}
