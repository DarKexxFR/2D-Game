// Menu pause : où en est la partie et le build complet (voir ui/buildView.js).

import { game, player } from "../core/state.js";
import { activeMutators } from "../systems/endless.js";
import { fighterName, versus, withRun } from "../systems/versus.js";
import { buildView } from "./buildView.js";
import { $, el, isVisible } from "./dom.js";
import { corruptionPercent } from "./hud.js";
import { icon } from "./icons.js";
import { formatDuration } from "./runStats.js";
import { hideScreens, showScreen } from "./screens.js";

export function canTogglePause() {
  // Écran scindé : pause commune, même quand l'un des joueurs choisit une amélioration
  if (versus.split) return game.started && versus.winner === null;
  return game.started && game.running && !isVisible("upgradeMenu");
}

export function togglePause() {
  const paused = versus.split ? (versus.paused = !versus.paused) : (game.paused = !game.paused);
  if (!paused) {
    hideScreens();
    return;
  }
  renderMeta();
  renderCorruption();
  renderInventory();
  showScreen("pauseMenu");
}

/** Rappel de la corruption des soins (vague 12+), aussi pour les écrans tactiles sans survol. */
function renderCorruption() {
  const box = $("pauseCorruption");
  box.replaceChildren();
  const add = (prefix = "") => {
    const pct = corruptionPercent();
    if (pct <= 0) return;
    const row = el("div", "corruption-row");
    row.append(icon("heartCrack", "#aa66ff"), el("span", "", `${prefix}Corruption : soins −${pct} %`));
    box.append(row);
  };
  if (versus.split) for (const i of [0, 1]) withRun(i, () => add(fighterName(i) + " · "));
  else add();
  if (game.endless) renderPulse(box);
}

/** Endless Pulse : pulsation atteinte et mutations cumulées des ennemis. */
function renderPulse(box) {
  const head = el("div", "pulse-row");
  head.append(icon("infinity", "#ff00aa"), el("b", "", `ENDLESS PULSE · PULSATION ${game.endless.depth}`));
  box.append(head);
  for (const m of activeMutators()) {
    const row = el("div", "pulse-row");
    row.append(icon(m.icon, m.color), el("span", "", `${m.name} ×${m.count} · ${m.desc}`));
    box.append(row);
  }
}

/** Build de la partie (armes, évolutions, améliorations) ; en duel sur un écran, celui des deux joueurs. */
function renderInventory() {
  const list = $("pauseInventory");
  if (versus.split) {
    const views = [];
    for (const i of [0, 1]) withRun(i, () => views.push(buildView(player, { title: fighterName(i) })));
    list.replaceChildren(...views);
    return;
  }
  list.replaceChildren(buildView(player));
}

/** Sous le titre : vague, niveau et durée de la partie. */
function renderMeta() {
  const label = game.rush ? `Boss ${game.rush.stage}` : `Vague ${game.wave}`;
  const parts = versus.split ? [label] : [label, `Niveau ${player.level}`, formatDuration(game.time)];
  $("pauseMeta").textContent = parts.join(" · ");
}
