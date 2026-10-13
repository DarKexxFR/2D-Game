// Point d'entrée : initialise l'UI, gère le cycle de vie d'une partie
// et fait tourner la boucle principale (logique à pas fixe + rendu).

import { TICK_MS, VERSUS } from "./config.js";
import { on } from "./core/events.js";
import { onAction } from "./core/input.js";
import { game, mysteryBox, player, resetGame, resetMysteryBox, resetPlayer } from "./core/state.js";
import { render, renderMenuBackground } from "./render/renderer.js";
import { playRandomMusic, stopMusic } from "./services/audio.js";
import { SUBMIT_MESSAGES, isOnlineEnabled, submitScore } from "./services/onlineLeaderboard.js";
import { initCloudSave } from "./services/cloudSave.js";
import { initAds } from "./services/ads.js";
import { dailyChallenge, restoreRandom, saveDailyBest, useSeed } from "./services/daily.js";
import { applyTalents } from "./data/talents.js";
import { ensureStarterItems } from "./services/inventory.js";
import { addStat, recordBest, recordCompletedRun } from "./services/achievements.js";
import { playSfx, unlockAudio, vibrate } from "./services/sfx.js";
import {
  account,
  addAccountRewards,
  loadAccount,
  saveAccount,
  saveToLeaderboard,
} from "./services/storage.js";
import {
  rebuildEnemyGrid,
  shoot,
  throwKunai,
  updateAura,
  updateOrbitals,
  updateProjectiles,
} from "./systems/combat.js";
import { updateEffects } from "./systems/effects.js";
import { activateSkill, updateSkills } from "./systems/skills.js";
import { updateEnemies } from "./systems/enemies.js";
import { updateHazards } from "./systems/hazards.js";
import { updateMysteryBox } from "./systems/mysteryBox.js";
import { applyEquipment } from "./systems/equipment.js";
import { updatePet } from "./systems/pet.js";
import { updatePickups } from "./systems/pickups.js";
import { reviveFromAd, updatePlayer } from "./systems/player.js";
import { spawnWave, updateSpawning } from "./systems/spawner.js";
import { $ } from "./ui/dom.js";
import { setOnlineStatus, showGameOver } from "./ui/gameOverScreen.js";
import { showBiomeBanner, showBossWarning, showGoblinWarning, showHud, updateHud } from "./ui/hud.js";
import { commitPseudo, getPseudo, initMainMenu, refreshAccountUI, showMainMenu } from "./ui/mainMenu.js";
import { canTogglePause, togglePause } from "./ui/pauseMenu.js";
import { hideScreens } from "./ui/screens.js";
import { initTouchControls, isTouchDevice, showTouchControls } from "./ui/touchControls.js";
import { hydrateIcons } from "./ui/icons.js";
import { initKeyBindings } from "./ui/keyBindings.js";
import { initOptionsMenu, openOptions } from "./ui/optionsMenu.js";
import { initAccount } from "./ui/accountMenu.js";
import { initUpgradeMenu, resetUpgradeMenu, showBossChest, showUpgradeMenu } from "./ui/upgradeMenu.js";
import { initAchievementMenu } from "./ui/achievementMenu.js";
import { initDailyMenu } from "./ui/dailyMenu.js";
import { initTalentMenu } from "./ui/talentMenu.js";
import { canOfferRevive, initReviveMenu, showReviveOffer } from "./ui/reviveMenu.js";
import { fighterName, startVersus, stopVersus, updateVersus, versus } from "./systems/versus.js";
import { initVersusMenu, showVersusHud, showVersusOver, updateVersusHud } from "./ui/versusMenu.js";
import { initVersusTouch } from "./ui/versusTouch.js";
import { showVersusUpgrades } from "./ui/upgradeMenu.js";

// --- CYCLE DE VIE D'UNE PARTIE ---

let lastMode = "normal"; // « REJOUER » relance le même mode

/** Lance une partie ; mode "daily" = défi du jour (équipement, modificateur et graine imposés). */
function startGame(mode = "normal") {
  lastMode = mode;
  stopVersus();
  showVersusHud(false);
  commitPseudo();
  playRandomMusic();
  restoreRandom();
  resetGame();
  resetUpgradeMenu();
  if (mode === "daily") {
    const daily = dailyChallenge();
    game.daily = daily;
    game.modifier = daily.modifier;
    useSeed(daily.seed);
    resetPlayer(1); // même base pour tout le monde : ni niveau de compte ni talents
    const base = { level: 1, prestige: 1 };
    applyEquipment({ hero: { id: daily.hero, ...base }, weapon: { id: daily.weapon, ...base } });
  } else {
    resetPlayer(account.level);
    applyEquipment();
    applyTalents(player, account.talents);
  }
  applyModifierToPlayer(game.modifier);
  resetMysteryBox();
  if (game.modifier.noMysteryBox) mysteryBox.active = false;
  player.autoShoot = isTouchDevice; // pas de souris pour viser sur mobile
  hideScreens();
  showHud(true);
  spawnWave();
}

/** Duel 1 contre 1 sur le même écran (voir systems/versus.js) : pas d'XP ni d'or pour le compte. */
function startDuel() {
  playRandomMusic();
  restoreRandom();
  resetGame();
  resetUpgradeMenu();
  resetMysteryBox();
  mysteryBox.active = false;
  startVersus();
  document.activeElement?.blur?.(); // ESPACE / ENTRÉE (dash) ne doivent pas recliquer un bouton
  hideScreens();
  showHud(false);
  showVersusHud(true);
}

function applyModifierToPlayer(mod) {
  player.maxHealth *= mod.playerHealth || 1;
  player.health = player.maxHealth;
  player.attack *= mod.playerAttack || 1;
}

function returnToMenu() {
  restoreRandom();
  saveAccount(); // garde la progression des succès (kills...) même en quittant une partie
  game.started = false;
  game.running = false;
  game.paused = false;
  stopVersus();
  showVersusHud(false);
  stopMusic();
  showHud(false);
  showMainMenu();
}

function endGame() {
  restoreRandom();
  showTouchControls(false);
  addAccountRewards(Math.floor(game.totalRunXp), game.runGold);
  recordBest("bestCombo", game.stats.bestCombo);
  if (game.daily) addStat("dailyRuns");
  recordCompletedRun();
  refreshAccountUI();
  const pseudo = getPseudo();
  const isNewRecord = saveToLeaderboard(pseudo, game.wave, game.totalRunXp, player.level);
  showGameOver({
    pseudo,
    level: player.level,
    wave: game.wave,
    xp: game.totalRunXp,
    gold: game.runGold,
    isNewRecord,
  });

  const day = game.daily?.day;
  if (day) saveDailyBest(day, game.wave, game.totalRunXp);
  setOnlineStatus(isOnlineEnabled() ? "Envoi du score au classement mondial..." : "");
  if (isOnlineEnabled()) {
    const score = { name: pseudo, wave: game.wave, xp: game.totalRunXp, lvl: player.level, day };
    submitScore(score).then((status) =>
      setOnlineStatus((day && status === "sent" ? "Défi du jour : " : "") + SUBMIT_MESSAGES[status]),
    );
  }
}

// --- MISE À JOUR (un tick = 1/60 s) ---

function update() {
  if (!game.running || game.paused) return;
  game.time += TICK_MS;
  if (versus.active) {
    updateVersus();
    updateEffects();
    return;
  }

  updateSpawning();
  updatePlayer();
  rebuildEnemyGrid();
  updateAura();
  updateMysteryBox();
  shoot();
  throwKunai();
  updatePet();
  updatePickups();
  updateProjectiles();
  updateOrbitals();
  updateSkills();
  updateEnemies();
  updateHazards();
  updateEffects();
}

// --- BOUCLE PRINCIPALE ---

let lastFrame = performance.now();
let accumulator = 0;

function frame(now) {
  if (game.started) {
    const timeScale = game.slowMo > 0 ? 0.3 : 1; // ralenti à la mort d'un boss
    accumulator += Math.min(now - lastFrame, 250) * timeScale; // borne : évite la « spirale » après un onglet en arrière-plan
    while (accumulator >= TICK_MS) {
      update();
      accumulator -= TICK_MS;
    }
    render();
    if (versus.active) updateVersusHud();
    else updateHud();
  } else {
    accumulator = 0;
    renderMenuBackground();
  }
  lastFrame = now;
  requestAnimationFrame(frame);
}

// --- INITIALISATION ---

function init() {
  hydrateIcons();
  loadAccount();
  initCloudSave();
  initAds();
  ensureStarterItems();
  initMainMenu({ onPlay: () => startGame("normal") });
  initDailyMenu({ onPlay: () => startGame("daily"), onBack: showMainMenu });
  initTalentMenu({ onBack: showMainMenu, onChange: refreshAccountUI });
  initUpgradeMenu();
  initAchievementMenu({ onBack: showMainMenu });

  $("btnResume").addEventListener("click", togglePause);
  $("btnQuit").addEventListener("click", returnToMenu);
  $("btnReplay").addEventListener("click", () => startGame(lastMode));
  $("btnGameOverMenu").addEventListener("click", returnToMenu);
  $("btnOptions").addEventListener("click", () => openOptions("mainMenu"));
  $("btnPauseOptions").addEventListener("click", () => openOptions("pauseMenu"));
  initOptionsMenu();
  initKeyBindings();
  // Connexion facultative : vérifie la progression du compte sans bloquer le démarrage
  initAccount({ onConflictFound: () => !game.started && openOptions("mainMenu") });

  // L'audio ne peut démarrer qu'après une interaction ; petit « clic » sur chaque bouton.
  document.addEventListener("pointerdown", unlockAudio);
  document.addEventListener("keydown", unlockAudio);
  document.addEventListener("click", (e) => {
    if (e.target.closest("button:not(.touch-btn)")) playSfx("click");
  });

  const pause = () => canTogglePause() && togglePause();
  onAction("pause", pause);
  onAction("skill", () => {
    if (game.running && !game.paused && !versus.active) activateSkill();
  });
  onAction("autoShoot", () => {
    if (game.started && !versus.active) player.autoShoot = !player.autoShoot;
  });

  initTouchControls({
    onUltimate: () => game.running && !game.paused && activateSkill(),
    onPause: pause,
  });

  on("levelUp", showUpgradeMenu);
  on("bossChest", showBossChest);
  on("goblin", () => {
    showGoblinWarning();
    playSfx("combo");
  });
  initReviveMenu({ onRevive: reviveFromAd, onGiveUp: endGame });

  $("btnVersus").addEventListener("click", startDuel);
  $("btnVersusPause").addEventListener("click", pause);
  initVersusMenu({ onReplay: startDuel, onMenu: returnToMenu });
  initVersusTouch();
  on("versusUpgrades", (f) => showVersusUpgrades(f, VERSUS.upgradesPerDeath, fighterName(f.index)));
  on("versusOver", showVersusOver);
  on("playerDied", () => (canOfferRevive() ? showReviveOffer() : endGame()));
  on("biomeChange", showBiomeBanner);
  on("bossWarning", (text) => {
    showBossWarning(text);
    playSfx("boss");
    vibrate([100, 50, 100]);
  });

  showMainMenu();
  requestAnimationFrame(frame);
}

// Sur l'ancienne adresse, transfer.js emmène le joueur vers last-pulse.com : inutile de démarrer.
if (!window.__lastPulseLeaving) init();
