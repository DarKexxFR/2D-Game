// Point d'entrée : initialise l'UI, gère le cycle de vie d'une partie
// et fait tourner la boucle principale (logique à pas fixe + rendu).

import { TICK_MS } from "./config.js";
import { on } from "./core/events.js";
import { onKeyPress } from "./core/input.js";
import { game, player, resetGame, resetMysteryBox, resetPlayer } from "./core/state.js";
import { render, renderMenuBackground } from "./render/renderer.js";
import { playRandomMusic, stopMusic } from "./services/audio.js";
import { SUBMIT_MESSAGES, isOnlineEnabled, submitScore } from "./services/onlineLeaderboard.js";
import { initCloudSave } from "./services/cloudSave.js";
import { ensureStarterItems } from "./services/inventory.js";
import { recordCompletedRun } from "./services/achievements.js";
import { playSfx, unlockAudio, vibrate } from "./services/sfx.js";
import {
  account,
  addAccountRewards,
  loadAccount,
  saveAccount,
  saveToLeaderboard,
} from "./services/storage.js";
import {
  activateUltimate,
  rebuildEnemyGrid,
  shoot,
  throwKunai,
  updateAura,
  updateOrbitals,
  updateProjectiles,
} from "./systems/combat.js";
import { updateEffects } from "./systems/effects.js";
import { updateEnemies } from "./systems/enemies.js";
import { updateMysteryBox } from "./systems/mysteryBox.js";
import { applyEquipment } from "./systems/equipment.js";
import { updatePet } from "./systems/pet.js";
import { updatePickups } from "./systems/pickups.js";
import { updatePlayer } from "./systems/player.js";
import { spawnWave, updateSpawning } from "./systems/spawner.js";
import { $ } from "./ui/dom.js";
import { setOnlineStatus, showGameOver } from "./ui/gameOverScreen.js";
import { showBiomeBanner, showBossWarning, showHud, updateHud } from "./ui/hud.js";
import { commitPseudo, getPseudo, initMainMenu, refreshAccountUI, showMainMenu } from "./ui/mainMenu.js";
import { canTogglePause, togglePause } from "./ui/pauseMenu.js";
import { hideScreens } from "./ui/screens.js";
import { initTouchControls, isTouchDevice, showTouchControls } from "./ui/touchControls.js";
import { hydrateIcons } from "./ui/icons.js";
import { initOptionsMenu, openOptions } from "./ui/optionsMenu.js";
import { showUpgradeMenu } from "./ui/upgradeMenu.js";
import { initAchievementMenu } from "./ui/achievementMenu.js";

// --- CYCLE DE VIE D'UNE PARTIE ---

function startGame() {
  commitPseudo();
  playRandomMusic();
  resetGame();
  resetPlayer(account.level);
  applyEquipment();
  resetMysteryBox();
  player.autoShoot = isTouchDevice; // pas de souris pour viser sur mobile
  hideScreens();
  showHud(true);
  spawnWave();
}

function returnToMenu() {
  saveAccount(); // garde la progression des succès (kills...) même en quittant une partie
  game.started = false;
  game.running = false;
  game.paused = false;
  stopMusic();
  showHud(false);
  showMainMenu();
}

function endGame() {
  showTouchControls(false);
  addAccountRewards(Math.floor(game.totalRunXp), game.runGold);
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

  setOnlineStatus(isOnlineEnabled() ? "Envoi du score au classement mondial..." : "");
  if (isOnlineEnabled()) {
    submitScore({ name: pseudo, wave: game.wave, xp: game.totalRunXp, lvl: player.level }).then((status) =>
      setOnlineStatus(SUBMIT_MESSAGES[status]),
    );
  }
}

// --- MISE À JOUR (un tick = 1/60 s) ---

function update() {
  if (!game.running || game.paused) return;
  game.time += TICK_MS;

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
  updateEnemies();
  updateEffects();
}

// --- BOUCLE PRINCIPALE ---

let lastFrame = performance.now();
let accumulator = 0;

function frame(now) {
  if (game.started) {
    accumulator += Math.min(now - lastFrame, 250); // évite la « spirale » après un onglet en arrière-plan
    while (accumulator >= TICK_MS) {
      update();
      accumulator -= TICK_MS;
    }
    render();
    updateHud();
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
  ensureStarterItems();
  initMainMenu({ onPlay: startGame });
  initAchievementMenu({ onBack: showMainMenu });

  $("btnResume").addEventListener("click", togglePause);
  $("btnQuit").addEventListener("click", returnToMenu);
  $("btnReplay").addEventListener("click", startGame);
  $("btnGameOverMenu").addEventListener("click", returnToMenu);
  $("btnOptions").addEventListener("click", () => openOptions("mainMenu"));
  $("btnPauseOptions").addEventListener("click", () => openOptions("pauseMenu"));
  initOptionsMenu();

  // L'audio ne peut démarrer qu'après une interaction ; petit « clic » sur chaque bouton.
  document.addEventListener("pointerdown", unlockAudio);
  document.addEventListener("keydown", unlockAudio);
  document.addEventListener("click", (e) => {
    if (e.target.closest("button:not(.touch-btn)")) playSfx("click");
  });

  const pause = () => canTogglePause() && togglePause();
  onKeyPress("p", pause);
  onKeyPress("escape", pause);
  onKeyPress("r", () => {
    if (game.running && !game.paused) activateUltimate();
  });
  onKeyPress("a", () => {
    if (game.started) player.autoShoot = !player.autoShoot;
  });

  initTouchControls({
    onUltimate: () => game.running && !game.paused && activateUltimate(),
    onPause: pause,
  });

  on("levelUp", showUpgradeMenu);
  on("playerDied", endGame);
  on("biomeChange", showBiomeBanner);
  on("bossWarning", (text) => {
    showBossWarning(text);
    playSfx("boss");
    vibrate([100, 50, 100]);
  });

  showMainMenu();
  requestAnimationFrame(frame);
}

init();
