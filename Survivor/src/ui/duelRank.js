// Rangs du duel classé (Bronze → Prédateur, data/duelRanks.js) : emblème réutilisable, badge de l'accueil,
// carte « Ton rang » de l'écran Duel, annonce de promotion sur l'écran de fin.

import { on } from "../core/events.js";
import { duelRankOf, myDuelRating } from "../services/duelRanking.js";
import { $, el, setText, setWidth } from "./dom.js";
import { icon } from "./icons.js";

/**
 * Emblème d'un rang : icône à la couleur du palier, nom en option.
 * @param {number} rating
 * @param {{ label?: boolean }} [opts]
 */
export function rankBadge(rating, { label = false } = {}) {
  const { rank } = duelRankOf(rating);
  const badge = el("span", `rank-badge rank-${rank.id}`);
  badge.style.color = rank.color;
  badge.title = `${rank.name} · ${rating} ELO`;
  badge.append(icon(rank.icon));
  if (label) badge.append(el("b", "", rank.name.toUpperCase()));
  return badge;
}

/** Affiche son rang : badge de l'accueil et carte de l'écran Duel (rien tant qu'aucun duel n'est compté). */
export function renderMyRank() {
  const rating = myDuelRating();
  const ranked = rating !== null;
  for (const id of ["homeRank", "duelRankCard"]) $(id).classList.toggle("rank-off", !ranked);
  if (!ranked) return;
  const { rank, next, progress } = duelRankOf(rating);
  for (const id of ["homeRank", "duelRankCard"]) $(id).style.color = rank.color;
  $("homeRankIcon").replaceChildren(icon(rank.icon));
  setText("homeRankName", rank.name.toUpperCase());
  $("homeRank").title = `Rang de duel : ${rank.name} · ${rating} ELO`;
  $("duelRankIcon").replaceChildren(icon(rank.icon));
  setText("duelRankName", rank.name.toUpperCase());
  setText("duelRankElo", `${rating} ELO`);
  setWidth("duelRankFill", progress);
  setText(
    "duelRankNext",
    next ? `Encore ${next.min - rating} ELO pour ${next.name}` : "Rang maximal atteint",
  );
}

/** Fin d'un duel classé : nouveau rang annoncé s'il a changé (`before` = ELO avant le duel). */
export function rankChangeText(before, after) {
  if (before === null || before === undefined) return "";
  const a = duelRankOf(before).index;
  const b = duelRankOf(after);
  if (b.index > a) return `PROMU ${b.rank.name.toUpperCase()} !`;
  if (b.index < a) return `Retour en ${b.rank.name}`;
  return "";
}

export function initDuelRank() {
  on("duelRating", renderMyRank);
  renderMyRank();
}
