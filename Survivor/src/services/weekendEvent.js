// Événement du week-end en cours (data/weekendEvents.js) : samedi et dimanche, heure locale. L'événement
// d'un week-end dépend du numéro de sa semaine, donc il est le même pour tous et change chaque semaine.

import { WEEKEND, WEEKEND_EVENTS } from "../data/weekendEvents.js";

const DAY_MS = 24 * 3600 * 1000;

/** Lundi 0 h (local) de la semaine d'une date. */
function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Numéro de semaine depuis le lundi 5 janvier 1970 (stable, sans dépendre du fuseau ni de l'heure d'été). */
function weekIndex(date) {
  const m = mondayOf(date);
  return Math.floor(Math.round(Date.UTC(m.getFullYear(), m.getMonth(), m.getDate()) / DAY_MS - 4) / 7);
}

/** Événement de la semaine d'une date (qu'on soit le week-end ou non). */
export function eventOfWeek(date = new Date()) {
  const n = WEEKEND_EVENTS.length;
  return WEEKEND_EVENTS[((weekIndex(date) % n) + n) % n];
}

/** Événement en cours, ou null en semaine. */
export function weekendEvent(date = new Date()) {
  return WEEKEND.days.includes(date.getDay()) ? eventOfWeek(date) : null;
}

/** Minutes avant la fin de l'événement en cours (lundi 0 h, heure locale). */
export function minutesLeft(date = new Date()) {
  const next = mondayOf(date);
  next.setDate(next.getDate() + 7);
  return Math.max(0, Math.ceil((next.getTime() - date.getTime()) / 60000));
}

/**
 * Bonus du week-end sur les récompenses d'une partie (en plus de la partie elle-même).
 * @param {{ xp: number, gold: number }} run
 */
export function weekendBonus(run, date = new Date()) {
  const ev = weekendEvent(date);
  if (!ev) return { event: null, xp: 0, gold: 0, seasonMult: 1 };
  return {
    event: ev,
    xp: Math.floor(run.xp * ((ev.accountXp ?? 1) - 1)),
    gold: Math.floor(run.gold * ((ev.gold ?? 1) - 1)),
    seasonMult: ev.seasonXp ?? 1,
  };
}
