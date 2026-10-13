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
import { addStat, getStat, recordBest, recordCompletedRun } from "./services/achievements.js";
import { BOSS_RUSH } from "./data/enemies.js";
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
import { currentScreen, hideScreens, showScreen } from "./ui/screens.js";
import { initRouter } from "./ui/router.js";
import { initTouchControls, showTouchControls } from "./ui/touchControls.js";
import { hydrateIcons } from "./ui/icons.js";
import { initKeyBindings } from "./ui/keyBindings.js";
import { closeOptions, initOptionsMenu, openOptions } from "./ui/optionsMenu.js";
import { closeLogin, initAccount, openLogin } from "./ui/accountMenu.js";
import { initUpgradeMenu, resetUpgradeMenu, showBossChest, showUpgradeMenu } from "./ui/upgradeMenu.js";
import { initAchievementMenu, openAchievements } from "./ui/achievementMenu.js";
import { initDailyMenu, openDaily } from "./ui/dailyMenu.js";
import { initBossRushMenu, openBossRush } from "./ui/bossRushMenu.js";
import { initTalentMenu, openTalents } from "./ui/talentMenu.js";
import { openInventory } from "./ui/inventoryMenu.js";
import { openLeaderboard } from "./ui/leaderboardMenu.js";
import { canOfferRevive, initReviveMenu, showReviveOffer } from "./ui/reviveMenu.js";
import {
  fighterName,
  isLocalFighter,
  startVersus,
  stopVersus,
  updateVersus,
  versus,
} from "./systems/versus.js";
import {
  netTick,
  onNetMessage,
  resetOnline,
  startRemotePicks,
  updateVersusGuest,
} from "./systems/versusOnline.js";
import { leaveRoom, net, sendGame, setNetHandlers } from "./services/netplay.js";
import {
  initVersusMenu,
  showRematchWaiting,
  showVersusHud,
  showVersusOver,
  updateVersusHud,
} from "./ui/versusMenu.js";
import { initVersusTouch } from "./ui/versusTouch.js";
import { initDuelMenu, openDuel, setDuelStatus } from "./ui/duelMenu.js";
import { drawVersusChoices, showRemoteChoices, showVersusUpgrades } from "./ui/upgradeMenu.js";

// --- CYCLE DE VIE D'UNE PARTIE ---

let lastMode = "normal"; // « REJOUER » relance le même mode

/**
 * Lance une partie ; mode "daily" = défi du jour (équipement, modificateur et graine imposés),
 * "rush" = Boss Rush (les boss à la suite, avec l'équipement et les talents du joueur).
 */
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
  if (mode === "rush") {
    game.rush = { stage: 0, defeated: 0, bestBefore: getStat("bestBossRush") };
    game.modifier = BOSS_RUSH.modifier;
  }
  applyModifierToPlayer(game.modifier);
  resetMysteryBox();
  if (game.modifier.noMysteryBox) mysteryBox.active = false;
  player.autoShoot = true; // tir automatique par défaut (la touche T le coupe pour viser à la souris)
  hideScreens();
  showHud(true);
  spawnWave();
}

/**
 * Duel 1 contre 1 (voir systems/versus.js) : pas d'XP ni d'or pour le compte.
 * `online` = { role, local } pour un duel en ligne, avec les pseudos `names`.
 */
function startDuel(online = null, names = []) {
  commitPseudo();
  playRandomMusic();
  restoreRandom();
  resetGame();
  resetUpgradeMenu();
  resetMysteryBox();
  mysteryBox.active = false;
  startVersus(online, names);
  resetOnline();
  document.activeElement?.blur?.(); // ESPACE / ENTRÉE (dash) ne doivent pas recliquer un bouton
  hideScreens();
  showHud(false);
  showVersusHud(true);
}

/** Hôte en ligne : (re)lance le duel chez les deux joueurs. */
function startOnlineDuel() {
  const names = [getPseudo(), net.peerName || "ADVERSAIRE"];
  sendGame({ t: "start", names });
  startDuel({ role: "host", local: 0 }, names);
}

function replayDuel() {
  if (!versus.online) return startDuel();
  if (versus.online.role === "host") return startOnlineDuel();
  sendGame({ t: "rematch" });
  showRematchWaiting();
}

/** Messages du jeu reçus de l'adversaire (voir services/netplay.js). */
function onNetGame(msg) {
  if (net.role === "guest" && msg.t === "start") return startDuel({ role: "guest", local: 1 }, msg.names);
  if (net.role === "guest" && msg.t === "over" && versus.online) {
    versus.lives = msg.lives;
    game.running = false;
    return showVersusOver(msg.winner);
  }
  if (net.role === "host" && msg.t === "rematch" && currentScreen() === "versusOver")
    return startOnlineDuel();
  onNetMessage(msg);
}

function onNetLost() {
  if (versus.online && game.started) {
    game.running = false;
    showVersusOver(null);
  } else if (currentScreen() === "duelMenu") {
    setDuelStatus("L'adversaire s'est déconnecté.");
  }
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
  if (versus.online) leaveRoom();
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
  const rush = game.rush;
  if (rush) {
    // Boss Rush : record de boss vaincus, hors classements (les vagues n'y sont pas comparables)
    showGameOver({
      pseudo,
      level: player.level,
      wave: rush.defeated,
      waveLabel: "Boss vaincus",
      xp: game.totalRunXp,
      gold: game.runGold,
      isNewRecord: rush.defeated > rush.bestBefore,
    });
    setOnlineStatus("");
    return;
  }
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

// --- ADRESSE DE LA PAGE (#modal=option...) ---

/** Menus de l'accueil qu'un lien peut ouvrir directement. */
const MENUS = {
  optionsMenu: () => openOptions("mainMenu"),
  shopMenu: () => showScreen("shopMenu"),
  inventoryMenu: openInventory,
  leaderboardMenu: openLeaderboard,
  achievementMenu: openAchievements,
  dailyMenu: openDaily,
  bossRushMenu: openBossRush,
  duelMenu: openDuel,
  talentMenu: openTalents,
  loginMenu: () => (isOnlineEnabled() ? openLogin("mainMenu") : showMainMenu()),
};

/** Retour / avancer du navigateur : ferme l'écran ouvert. En partie, ne quitte jamais la partie. */
function navigate(id) {
  const screen = currentScreen();
  if (!game.started) {
    if (MENUS[id]) MENUS[id]();
    else if (screen === "loginMenu")
      closeLogin(); // ouverte depuis les options : retour aux options
    else if (screen === "chestReveal") showScreen("shopMenu");
    else showMainMenu();
    return;
  }
  if (screen === null) {
    // En ligne, pas de pause (l'adversaire continue) : le retour arrière ne fait rien
    if (!versus.online && canTogglePause()) togglePause();
  } else if (screen === "pauseMenu") togglePause();
  else if (screen === "optionsMenu") closeOptions();
  else if (screen === "loginMenu") closeLogin();
  else if (screen === "gameOver" || screen === "versusOver") returnToMenu();
  // amélioration et revivre : le choix reste à faire, l'adresse est simplement remise
}

// --- MISE À JOUR (un tick = 1/60 s) ---

function update() {
  if (!game.running || game.paused) return;
  game.time += TICK_MS;
  if (versus.active) {
    if (versus.online?.role === "guest") updateVersusGuest();
    else updateVersus();
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
    if (versus.online) netTick(now);
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
  initBossRushMenu({ onPlay: () => startGame("rush"), onBack: showMainMenu });
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
  initAccount({ onConflictFound: () => !game.started && openLogin("mainMenu") });

  // L'audio ne peut démarrer qu'après une interaction ; petit « clic » sur chaque bouton.
  document.addEventListener("pointerdown", unlockAudio);
  document.addEventListener("keydown", unlockAudio);
  document.addEventListener("click", (e) => {
    if (e.target.closest("button:not(.touch-btn)")) playSfx("click");
  });

  const pause = () => {
    // En ligne, la partie ne s'arrête pas pour l'adversaire : on propose seulement de quitter
    if (versus.online) {
      if (game.running && confirm("Quitter le duel en ligne ?")) returnToMenu();
      return;
    }
    if (canTogglePause()) togglePause();
  };
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

  $("btnVersus").addEventListener("click", openDuel);
  $("btnVersusPause").addEventListener("click", pause);
  initDuelMenu({ onLocal: () => startDuel(), onBack: showMainMenu });
  initVersusMenu({ onReplay: replayDuel, onMenu: returnToMenu });
  initVersusTouch();
  setNetHandlers({
    onReady: () => net.role === "host" && startOnlineDuel(),
    onGame: onNetGame,
    onLost: onNetLost,
  });
  on("versusUpgrades", (f) => {
    const count = VERSUS.upgradesPerDeath;
    if (isLocalFighter(f)) showVersusUpgrades(f, count, fighterName(f.index));
    else startRemotePicks(f, count, drawVersusChoices);
  });
  on("versusRemoteChoices", ({ picks, n, count }) =>
    showRemoteChoices(picks, {
      title: fighterName(versus.online.local),
      subtitle: `Amélioration ${n}/${count}`,
      target: versus.fighters[versus.online.local],
      onPick: (u) => sendGame({ t: "choose", name: u.name }),
    }),
  );
  on("versusOver", (winner) => {
    if (versus.online) sendGame({ t: "over", winner, lives: versus.lives });
    showVersusOver(winner);
  });
  on("playerDied", () => (canOfferRevive() ? showReviveOffer() : endGame()));
  on("biomeChange", showBiomeBanner);
  on("bossWarning", (text) => {
    showBossWarning(text);
    playSfx("boss");
    vibrate([100, 50, 100]);
  });

  showMainMenu();
  initRouter({ navigate, getCurrent: currentScreen, deepLinks: Object.keys(MENUS) });
  requestAnimationFrame(frame);
}

// Sur l'ancienne adresse, transfer.js emmène le joueur vers last-pulse.com : inutile de démarrer.
if (!window.__lastPulseLeaving) init();
