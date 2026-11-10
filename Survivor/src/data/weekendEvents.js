// Événements du week-end : chaque samedi et dimanche (heure locale), un bonus de récompenses tourne d'une
// semaine à l'autre (le même pour tous : tirage sur le numéro de la semaine). Les bonus ne touchent que les
// récompenses du compte (or, XP de compte, XP de saison), jamais le score : les classements restent justes.
// Nouvel événement = une entrée de plus ici (champs `gold`, `accountXp`, `seasonXp` : multiplicateurs).

/**
 * @typedef {{ id: string, name: string, desc: string, icon: string, color: string,
 *   gold?: number, accountXp?: number, seasonXp?: number }} WeekendEvent
 */

/** @type {WeekendEvent[]} */
export const WEEKEND_EVENTS = [
  {
    id: "goldRush",
    name: "Ruée vers l'or",
    desc: "Or des parties ×1,5",
    icon: "coin",
    color: "#ffd700",
    gold: 1.5,
  },
  {
    id: "training",
    name: "Week-end d'entraînement",
    desc: "XP de compte ×1,5",
    icon: "chartUp",
    color: "#00ff88",
    accountXp: 1.5,
  },
  {
    id: "seasonRush",
    name: "Week-end de saison",
    desc: "XP de saison ×2",
    icon: "season",
    color: "#aa66ff",
    seasonXp: 2,
  },
  {
    id: "jackpot",
    name: "Grand week-end",
    desc: "Or ×1,25 · XP de compte ×1,25 · XP de saison ×1,5",
    icon: "star",
    color: "#00e5ff",
    gold: 1.25,
    accountXp: 1.25,
    seasonXp: 1.5,
  },
];

export const WEEKEND = {
  days: [6, 0], // samedi, dimanche (Date.getDay)
};
