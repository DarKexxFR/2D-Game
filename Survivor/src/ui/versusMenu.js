// Duel : panneau de l'adversaire en ligne, boutons tactiles de l'écran scindé, écran du vainqueur.

import { VERSUS } from "../config.js";
import { bindingsOf, keyLabel } from "../core/input.js";
import { game, player } from "../core/state.js";
import { fighterName, versus, withRun } from "../systems/versus.js";
import { SPELLS, attackProgress, spellProgress } from "../systems/duelAttacks.js";
import { rival } from "../systems/versusOnline.js";
import { $, el, setClass, setText, setVisible, setWidth } from "./dom.js";
import { drawDuelRecap } from "./duelRecap.js";
import { rankBadge } from "./duelRank.js";
import { showScreen } from "./screens.js";
import { isTouchDevice, showTouchControls } from "./touchControls.js";
import { showVersusTouch } from "./versusTouch.js";

export function initVersusMenu({ onReplay, onMenu }) {
  $("btnVersusReplay").addEventListener("click", onReplay);
  $("btnVersusMenu").addEventListener("click", onMenu);
}

/** Écran scindé : commandes à deux (moitiés d'écran) ; en ligne : panneau de l'adversaire. */
export function showVersusHud(visible) {
  const split = visible && versus.split;
  document.body.classList.toggle("versus", split); // masque l'aide des touches du mode survie
  document.body.classList.toggle("duel-live", visible && !!versus.online); // aperçu de l'adversaire en haut à droite
  showVersusTouch(split);
  if (split) showTouchControls(false);
  setVisible("duelRival", visible && !!versus.online);
  if (isTouchDevice) setVisible("btnTouchSpell", visible && !!versus.online);
}

/** À chaque image : panneau de l'adversaire (en ligne) ou boutons de compétence (écran scindé). */
export function updateVersusHud() {
  if (versus.split) {
    if (isTouchDevice)
      for (const i of [0, 1])
        withRun(i, () => {
          setClass(`vsSkill${i + 1}`, "ready", player.isUltReady);
          setClass(`vsSpell${i + 1}`, "ready", !!game.spellReady);
        });
    return;
  }
  setWidth("duelAttack", attackProgress());
  setWidth("duelSpell", spellProgress());
  const key = isTouchDevice ? "BOUTON SORT" : keyLabel(bindingsOf("spell")[0]);
  setText("duelSpellLabel", game.spellReady ? `SORT PRÊT : ${SPELLS[game.spellReady]} (${key})` : "TON SORT");
  setClass("btnTouchSpell", "ready", !!game.spellReady);
  const s = rival.stats;
  setText("rivalName", fighterName(1));
  showRivalRank(rival.rating);
  if (!s) return setText("rivalInfo", "En route…");
  setText("rivalInfo", `VAGUE ${s.w} · NIV. ${s.l} · ${s.k} ÉLIM.`);
  setWidth("rivalHealth", s.h / s.m);
}

let rivalShown;

/** Emblème du rang de l'adversaire en ligne, redessiné seulement quand son ELO change. */
function showRivalRank(rating) {
  if (rating === rivalShown) return;
  rivalShown = rating;
  $("rivalRank").replaceChildren(...(rating === null ? [] : [rankBadge(rating)]));
}

const ROWS = [
  ["Vague", "w"],
  ["Niveau", "l"],
  ["Éliminations", "k"],
  ["Score", "s"],
  ["XP", "x"],
  ["Or", "g"],
  ["Attaques envoyées", "a"],
  ["Sorts lancés", "p"],
];

/**
 * Fin du duel : `runs` = bilans des deux parties (0 = J1, ou soi-même en ligne).
 * `prize` = { xp, gold } empochés par le gagnant.
 */
export function showVersusOver({ winner, runs, logs }, prize) {
  showVersusHud(false);
  const title = versus.online
    ? winner === 0
      ? "TU GAGNES !"
      : `${fighterName(1)} GAGNE !`
    : `${fighterName(winner)} GAGNE !`;
  setText("versusWinner", title);
  $("versusWinner").style.color = VERSUS.colors[winner];

  const table = $("versusTable");
  table.replaceChildren();
  const head = el("tr");
  head.append(el("th"));
  for (const i of [0, 1]) {
    const th = el("th", i === winner ? "winner" : "", fighterName(i));
    th.style.color = VERSUS.colors[i];
    head.append(th);
  }
  table.append(head);
  for (const [label, key] of ROWS) {
    const tr = el("tr");
    tr.append(el("td", "", label));
    for (const i of [0, 1]) tr.append(el("td", "", String(runs[i][key] ?? 0)));
    table.append(tr);
  }

  const gains = `+${prize.xp} XP · +${prize.gold} or`;
  let text = `${fighterName(winner)} empoche les deux parties : ${gains}`;
  if (versus.online) {
    text = winner === 0 ? `Tu empoches les deux parties : ${gains}` : `${fighterName(1)} empoche tes gains.`;
    if (rival.left) text = `${fighterName(1)} a quitté le duel. ${text}`;
  }
  setText("versusScore", text);
  setVisible("btnVersusReplay", !rival.left || !versus.online);
  showScreen("versusOver");
  setVisible("versusChart", !!logs);
  if (logs) drawDuelRecap($("versusChart"), logs); // une fois l'écran visible (taille connue)
}

/** Duel en ligne : ligne du classement ELO sur l'écran de fin (vide = rien à afficher, efface aussi le rang). */
export function showDuelElo(text) {
  setText("versusElo", text);
  if (!text) showDuelRankChange("");
}

/** Écran de fin : changement de rang (promotion en or et néon, rétrogradation en gris). */
export function showDuelRankChange(text, up = true) {
  setText("versusRankUp", text);
  setClass("versusRankUp", "down", !up);
}

/** En ligne : l'invité a demandé la revanche, l'hôte doit la lancer. */
export function showRematchWaiting() {
  setText("versusScore", "Revanche demandée. En attente de l'adversaire…");
}

/** En ligne, sur l'écran de fin : l'adversaire est parti, plus de revanche possible. */
export function showRivalGone() {
  setText("versusScore", `${fighterName(1)} a quitté le duel.`);
  setVisible("btnVersusReplay", false);
}
