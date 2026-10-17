// Écran du passe de saison : progression, 30 paliers et récupération des récompenses. Annonce aussi un
// palier atteint (pendant une partie) et les récompenses données d'office au changement de saison.

import { on } from "../core/events.js";
import { CHESTS, HEROES } from "../data/items.js";
import { HULL_TIER, TRAIL_TIER } from "../data/season.js";
import { SKIN_HULLS, SKIN_TRAILS } from "../data/skins.js";
import { drawShip } from "../render/entities.js";
import { getEquipped } from "../services/inventory.js";
import { claimAllTiers, claimTier, getSeason, takeRolledOver } from "../services/season.js";
import { playSfx } from "../services/sfx.js";
import { account } from "../services/storage.js";
import { showToast } from "./achievementMenu.js";
import { $, el, setClass, setText, setWidth } from "./dom.js";
import { icon, setLabel } from "./icons.js";
import { formatDelay } from "./questMenu.js";
import { showScreen } from "./screens.js";

let onAccountChange = () => {};

export function initSeasonMenu({ onBack, onChange }) {
  onAccountChange = onChange;
  $("btnSeason").addEventListener("click", openSeason);
  $("btnSeasonBack").addEventListener("click", onBack);
  $("btnSeasonClaimAll").addEventListener("click", () => showClaimed(claimAllTiers()));
  on("seasonTier", (tier) => showToast(`Saison : palier ${tier} atteint !`, "season"));
}

export function openSeason() {
  setText("seasonClaimMsg", "");
  renderSeason();
  showScreen("seasonMenu");
}

/** Bouton de l'accueil : saison, palier et barre de progression. */
export function refreshSeasonTile() {
  const s = getSeason();
  setText("homeSeasonName", `SAISON ${s.number} · ${s.theme.name.toUpperCase()}`);
  setText(
    "homeSeasonTier",
    s.claimable ? "Récompense à récupérer !" : `Palier ${s.tier} / ${s.tiers.length}`,
  );
  setWidth("homeSeasonFill", s.maxed ? 1 : (s.tier + s.xpInTier / s.tierXp) / s.tiers.length);
  setClass("btnSeason", "has-new", s.claimable > 0);
  $("btnSeason").style.setProperty("--season", s.theme.color);
}

/** Changement de mois : récompenses atteintes et oubliées, données d'office. */
export function announceRolledOver() {
  const out = takeRolledOver();
  if (!out) return;
  showToast(`Saison ${out.number} terminée : ${out.rewards.length} récompense(s) ajoutée(s)`, "season");
  onAccountChange();
}

function renderSeason() {
  const s = getSeason();
  const menu = $("seasonMenu");
  menu.style.setProperty("--season", s.theme.color);
  setText("seasonTitle", `SAISON ${s.number} · ${s.theme.name.toUpperCase()}`);
  setText("seasonSub", `Passe gratuit · fin dans ${formatDelay(s.timeLeft)}`);
  setText("seasonGoldDisplay", account.gold);
  setText("seasonTier", s.tier);
  setWidth("seasonBar", s.xpInTier / s.tierXp);
  setText(
    "seasonXpText",
    s.maxed ? "Passe terminé : bravo !" : `${s.xpInTier} / ${s.tierXp} XP vers le palier ${s.tier + 1}`,
  );
  $("seasonTrack").replaceChildren(...s.tiers.map((t) => tierCard(t, s)));
  $("btnSeasonClaimAll").disabled = s.claimable === 0;
  refreshSeasonTile();
}

function tierCard(t, s) {
  const special = t.tier === TRAIL_TIER || t.tier === HULL_TIER;
  const state = t.claimed ? " claimed" : t.reached ? " ready" : "";
  const card = el("div", `season-tier${state}${special ? " special" : ""}`);
  card.append(
    el("b", "season-tier-num", t.tier),
    rewardVisual(t.reward, s.theme),
    rewardLabel(t.reward, s.theme),
  );
  if (t.claimed) card.append(el("span", "season-tier-state", "✓"));
  else if (t.reached) {
    const btn = el("button", "season-claim", "PRENDRE");
    btn.addEventListener("click", () => showClaimed([claimTier(t.tier)].filter(Boolean)));
    card.append(btn);
  } else card.append(icon("lock", "#666"));
  return card;
}

function rewardVisual(reward, theme) {
  const box = el("span", "season-reward-icon");
  if (reward.type === "gold") box.append(icon("coin", "#ffd700"));
  else if (reward.type === "chest") {
    const chest = CHESTS.find((c) => c.id === reward.chest);
    box.append(icon(chest?.icon || "chest", chest?.color));
  } else if (reward.part === "hull") box.append(hullPreview(theme.hull, theme.color));
  else box.append(icon("sparkle", theme.color));
  return box;
}

function hullPreview(hull, color) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const hero = HEROES[getEquipped("hero")?.id] || HEROES.pilot;
  drawShip(32, 34, 17, -Math.PI / 2, color || hero.color, false, 0, hull, c.getContext("2d"));
  return c;
}

const skinName = (part, theme) =>
  part === "hull"
    ? SKIN_HULLS.find((h) => h.id === theme.hull)?.name
    : SKIN_TRAILS.find((h) => h.id === theme.trail)?.name;

function rewardText(reward, theme) {
  if (reward.type === "gold") return `${reward.amount} or`;
  if (reward.type === "chest") return CHESTS.find((c) => c.id === reward.chest)?.name || "Coffre";
  return `${reward.part === "hull" ? "Coque" : "Traînée"} ${skinName(reward.part, theme)}`;
}

function rewardLabel(reward, theme) {
  return el("small", "season-reward-name", rewardText(reward, theme));
}

/** Ce qui vient d'être récupéré, en clair sous la liste. */
function showClaimed(results) {
  if (results.length === 0) return;
  playSfx("chest");
  const theme = getSeason().theme;
  const lines = results.map((r) => {
    if (r.type === "gold") return r.duplicate ? `${r.amount} or (skin déjà possédé)` : `${r.amount} or`;
    if (r.type === "chest") {
      const name = CHESTS.find((c) => c.id === r.chest)?.name;
      const tag = r.result === "new" ? "nouveau" : r.result === "gold" ? "converti en or" : "doublon";
      return r.item ? `${name} : ${r.item.name} (${tag})` : name;
    }
    return `${r.part === "hull" ? "Coque" : "Traînée"} ${skinName(r.part, theme)} débloquée (écran Skins)`;
  });
  onAccountChange();
  renderSeason();
  setLabel($("seasonClaimMsg"), ` ${lines.join(" · ")}`, "gift", { before: true, color: "#00ff88" });
}
