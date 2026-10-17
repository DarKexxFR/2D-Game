// Interface en jeu (panneau de stats, barres d'XP / dash / ultime).

import { DIFFICULTIES, STAT_CAPS, WAVE_DURATION } from "../config.js";
import { game, mysteryBox, player, world } from "../core/state.js";
import { ENEMY_NAMES } from "../data/enemies.js";
import { isPlayerNearBox } from "../systems/mysteryBox.js";
import { healFactor } from "../systems/player.js";
import { heroSkill } from "../systems/skills.js";
import { $, setClass, setText, setVisible, setWidth } from "./dom.js";
import { isTouchDevice, showTouchControls } from "./touchControls.js";

const HUD_ELEMENTS = ["ui", "xpContainer", "levelIndicator"];

export function showHud(visible) {
  for (const id of HUD_ELEMENTS) setVisible(id, visible);
  if (!visible) {
    setVisible("boxIndicator", false);
    setVisible("bossBar", false);
  }
  showTouchControls(visible);
}

/** Pourcentage de soins perdus à cause de la corruption (0 avant la vague SURVIVAL.healFatigueFrom). */
export function corruptionPercent() {
  return Math.round((1 - healFactor()) * 100);
}

/** Cœur fissuré à côté de la barre de vie, avec la réduction des soins au survol. */
function updateCorruption() {
  const pct = corruptionPercent();
  setVisible("healCorruption", pct > 0);
  const node = $("healCorruption");
  if (pct > 0 && node.dataset.pct !== String(pct)) {
    node.dataset.pct = pct;
    node.dataset.tip = `Corruption : soins −${pct} %`;
  }
}

export function updateHud() {
  // Boss Rush : numéro du boss au lieu de la vague, et pas de minuteur
  setText("waveLabel", game.rush ? "BOSS" : game.endless ? `PULSE ${game.endless.depth} · VAGUE` : "VAGUE");
  // Facile / Cauchemar : numéro de vague à la couleur du niveau (la place manque pour son nom)
  const diff = game.difficulty !== "normal" && !game.rush ? game.difficulty : "";
  if ($("wave").dataset.diff !== diff) {
    $("wave").dataset.diff = diff;
    $("wave").style.color = diff ? DIFFICULTIES[diff].color : "";
  }
  setText("wave", game.rush ? game.rush.stage : game.wave);
  setVisible("timerContainer", !game.rush);
  setText("kills", game.kills);
  setText("healthText", `${Math.round(Math.max(0, player.health))}/${Math.round(player.maxHealth)}`);
  setWidth("playerHealth", player.health / player.maxHealth);
  updateCorruption();
  setWidth("timerBar", game.waveTimer / WAVE_DURATION);
  setWidth("dashBar", player.noDash ? 0 : 1 - player.dashCooldownTimer / player.dashCooldown);
  setWidth("xpBar", player.xp / player.xpToNextLevel);
  setText("lvlVal", player.level);
  updateCombo();
  updateBossBar();

  setText("statAtk", Math.round(player.attack));
  setText("statDef", Math.round(player.defense));
  setText("statSpd", Math.min(player.baseSpeed, STAT_CAPS.speed).toFixed(1));
  setText("statMagnet", Math.round(player.magnetRadius));
  setText("statCrit", Math.round(player.critChance * 100) + "%");
  setText("statCdmg", Math.round(player.critMultiplier * 100) + "%");
  setText("uiRunGold", game.runGold);
  setVisible("autoShootOff", !player.autoShoot);

  setWidth("ultBar", player.ultCharge / player.maxUltCharge);
  setText("ultName", heroSkill().name.toUpperCase());
  setVisible("ultReadyText", player.isUltReady);
  setVisible("boxIndicator", mysteryBox.active && player.worldY > -400);

  if (isTouchDevice) {
    setVisible("btnTouchBox", mysteryBox.state === "IDLE" && isPlayerNearBox());
    setClass("btnTouchUlt", "ready", player.isUltReady);
    setClass("btnTouchDash", "cooldown", player.noDash || player.dashCooldownTimer > 0);
  }
}

let bossWarningTimeout = null;
let biomeTimeout;

/** Bandeau « NOUVEAU BIOME » affiché quelques secondes, dans la couleur du biome. */
export function showBiomeBanner(biome) {
  const banner = document.getElementById("biomeBanner");
  banner.textContent = biome.name;
  banner.style.color = biome.color;
  banner.classList.remove("show");
  void banner.offsetWidth; // relance l'animation
  banner.classList.add("show");
  clearTimeout(biomeTimeout);
  biomeTimeout = setTimeout(() => banner.classList.remove("show"), 3500);
}

const COMBO_SHOWN_FROM = 5;

/** Compteur de combo : grossit à chaque élimination, s'efface quand le combo retombe. */
function updateCombo() {
  const shown = game.combo >= COMBO_SHOWN_FROM ? game.combo : 0;
  setText("comboDisplay", shown ? `×${shown} COMBO` : "");
  setClass("comboDisplay", "hot", shown >= 25);
}

/** Barre de vie du boss le plus imposant encore en vie, en haut de l'écran. */
function updateBossBar() {
  let boss = null;
  for (const e of world.enemies) {
    if (!e.dead && e.template.isBoss && (!boss || e.maxHealth > boss.maxHealth)) boss = e;
  }
  setVisible("bossBar", !!boss);
  if (!boss) return;
  setText("bossBarName", (ENEMY_NAMES[boss.type] || "Boss") + bossTag(boss));
  setWidth("bossBarFill", boss.health / boss.maxHealth);
  setClass("bossBar", "enraged", !!boss.enraged);
}

/** Précision après le nom du boss : sous l'eau / sous terre, état propre au boss (`barTag`), furie. */
function bossTag(boss) {
  if (boss.submerged) return boss.type === "kraken" ? " · SOUS L'EAU" : " · SOUS TERRE";
  const tags = [boss.barTag, boss.enraged ? "FURIE" : ""].filter(Boolean);
  return tags.length ? " · " + tags.join(" · ") : "";
}

/** Annonce du Voleur doré (même bandeau que les boss, en or). */
export function showGoblinWarning() {
  showBossWarning("VOLEUR DORÉ !", true);
}

/** Bandeau d'annonce (boss, Voleur doré, événement de carte : `color` = couleur de l'événement). */
export function showBossWarning(text, gold = false, color = "") {
  setClass("bossWarning", "gold", gold);
  setClass("bossWarning", "event", !!color);
  document.getElementById("bossWarning").style.color = color;
  setText("bossWarning", text);
  setVisible("bossWarning", true);
  clearTimeout(bossWarningTimeout);
  bossWarningTimeout = setTimeout(() => setVisible("bossWarning", false), 3000);
}
