// Point d'entrée : initialise l'UI, gère le cycle de vie d'une partie
// et fait tourner la boucle principale (logique à pas fixe + rendu).

import { TICK_MS } from "./config.js";
import { on } from "./core/events.js";
import { onKeyPress } from "./core/input.js";
import { game, player, resetGame, resetMysteryBox, resetPet, resetPlayer } from "./core/state.js";
import { render, renderMenuBackground } from "./render/renderer.js";
import { playRandomMusic, stopMusic } from "./services/audio.js";
import { isOnlineEnabled, submitScore } from "./services/onlineLeaderboard.js";
import { account, addAccountRewards, loadAccount, saveToLeaderboard } from "./services/storage.js";
import {
  activateUltimate,
  rebuildEnemyGrid,
  shoot,
  updateAura,
  updateOrbitals,
  updateProjectiles,
} from "./systems/combat.js";
import { updateEffects } from "./systems/effects.js";
import { updateEnemies } from "./systems/enemies.js";
import { updateMysteryBox } from "./systems/mysteryBox.js";
import { updatePet } from "./systems/pet.js";
import { updatePickups } from "./systems/pickups.js";
import { updatePlayer } from "./systems/player.js";
import { spawnWave, updateSpawning } from "./systems/spawner.js";
import { $ } from "./ui/dom.js";
import { setOnlineStatus, showGameOver } from "./ui/gameOverScreen.js";
import { showBossWarning, showHud, updateHud } from "./ui/hud.js";
import { commitPseudo, getPseudo, initMainMenu, refreshAccountUI, showMainMenu } from "./ui/mainMenu.js";
import { canTogglePause, togglePause } from "./ui/pauseMenu.js";
import { hideScreens } from "./ui/screens.js";
import { showUpgradeMenu } from "./ui/upgradeMenu.js";

// --- CYCLE DE VIE D'UNE PARTIE ---

function startGame() {
  commitPseudo();
  playRandomMusic();
  resetGame();
  resetPlayer(account.level);
  resetPet(account.petLevels.drone || 0);
  resetMysteryBox();
  hideScreens();
  showHud(true);
  spawnWave();
}

function returnToMenu() {
  game.started = false;
  game.running = false;
  game.paused = false;
  stopMusic();
  showHud(false);
  showMainMenu();
}

function endGame() {
  addAccountRewards(Math.floor(game.totalRunXp), game.runGold);
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
    submitScore({ name: pseudo, wave: game.wave, xp: game.totalRunXp, lvl: player.level }).then((ok) =>
      setOnlineStatus(ok ? "🌍 Score envoyé au classement mondial" : "⚠️ Classement mondial indisponible"),
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
  loadAccount();
  initMainMenu({ onPlay: startGame });

  $("btnResume").addEventListener("click", togglePause);
  $("btnQuit").addEventListener("click", returnToMenu);
  $("btnReplay").addEventListener("click", startGame);
  $("btnGameOverMenu").addEventListener("click", returnToMenu);

  const pause = () => canTogglePause() && togglePause();
  onKeyPress("p", pause);
  onKeyPress("escape", pause);
  onKeyPress("r", () => {
    if (game.running && !game.paused) activateUltimate();
  });
  onKeyPress("a", () => {
    if (game.started) player.autoShoot = !player.autoShoot;
  });

  on("levelUp", showUpgradeMenu);
  on("playerDied", endGame);
  on("bossWarning", showBossWarning);

  showMainMenu();
  requestAnimationFrame(frame);
}

init();
