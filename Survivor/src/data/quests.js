// Quêtes hebdomadaires : chaque semaine, quelques objectifs tirés de cette liste (les mêmes pour
// tous les joueurs), récompensés en or. `metric` = statistique suivie (voir services/achievements.js) ;
// `best: true` = meilleur score de la semaine (vague, combo...), sinon total cumulé dans la semaine.

const q = (id, icon, metric, target, reward, description, best = false) => ({
  id,
  icon,
  metric,
  target,
  reward,
  description,
  best,
});

export const QUESTS = [
  q("kills", "skull", "kills", 2000, 300, "Éliminer 2 000 ennemis"),
  q("bosses", "crown", "bosses", 6, 400, "Vaincre 6 boss"),
  q("runs", "repeat", "runs", 8, 250, "Terminer 8 parties"),
  q("wave", "wave", "bestWave", 15, 350, "Atteindre la vague 15", true),
  q("combo", "bolt", "bestCombo", 150, 300, "Atteindre un combo de ×150", true),
  q("level", "chartUp", "bestLevel", 25, 300, "Atteindre le niveau 25 en partie", true),
  q("chests", "chest", "chests", 5, 250, "Ouvrir 5 coffres"),
  q("bossChests", "gift", "bossChests", 4, 300, "Ouvrir 4 coffres de boss"),
  q("daily", "target", "dailyRuns", 3, 350, "Relever 3 défis du jour"),
  q("evolutions", "sparkle", "evolutions", 2, 350, "Obtenir 2 évolutions d'arme"),
  q("goblins", "coin", "kill_goblin", 2, 400, "Attraper 2 Voleurs dorés"),
];
