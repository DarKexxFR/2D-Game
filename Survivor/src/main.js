// Point d'entrée : initialise l'UI, gère le cycle de vie d'une partie
// et fait tourner la boucle principale (logique à pas fixe + rendu).

// En premier : le journal de diagnostic écoute les erreurs dès le chargement des autres modules
import { logEvent, logThrottled, markFrame, setDiagnosticContext, watch } from "./services/diagnostics.js";
import { DIFFICULTIES, LIMITS, LOADING, NET, TICK_MS, VERSUS } from "./config.js";
import { view } from "./core/canvas.js";
import { on } from "./core/events.js";
import { onAction } from "./core/input.js";
import {
  camera,
  game,
  mysteryBox,
  player,
  resetGame,
  resetMysteryBox,
  resetPlayer,
  world,
} from "./core/state.js";
import { settings } from "./services/settings.js";
import { render, renderMenuBackground } from "./render/renderer.js";
import { playRandomMusic, stopMusic } from "./services/audio.js";
import { SUBMIT_MESSAGES, isOnlineEnabled, submitScore } from "./services/onlineLeaderboard.js";
import { initCloudSave } from "./services/cloudSave.js";
import { initAds } from "./services/ads.js";
import { dailyChallenge, restoreRandom, saveDailyBest, useSeed } from "./services/daily.js";
import { applyTalents } from "./data/talents.js";
import { difficultyModifier, selectedDifficulty } from "./services/difficulty.js";
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
import { addFloatingText, updateEffects } from "./systems/effects.js";
import { activateSkill, updateSkills } from "./systems/skills.js";
import { updateEnemies } from "./systems/enemies.js";
import { updateHazards } from "./systems/hazards.js";
import { updateMysteryBox } from "./systems/mysteryBox.js";
import { applyEquipment } from "./systems/equipment.js";
import { updatePerks } from "./systems/perks.js";
import { updatePet } from "./systems/pet.js";
import { updatePickups } from "./systems/pickups.js";
import { reviveFromAd, updatePlayer } from "./systems/player.js";
import { resetTrail, updateTrail } from "./systems/trail.js";
import { spawnWave, updateSpawning } from "./systems/spawner.js";
import { updateArena } from "./systems/arena.js";
import { updateMapEvents } from "./systems/mapEvents.js";
import { updateCursedShrines } from "./systems/cursedShrines.js";
import { $ } from "./ui/dom.js";
import { initKillCamButton, setOnlineStatus, showGameOver } from "./ui/gameOverScreen.js";
import { initShareMenu } from "./ui/shareMenu.js";
import { drawKillCam, killCamActive, stopKillCam } from "./render/killCam.js";
import { recordKillCam } from "./systems/killCam.js";
import { showBiomeBanner, showBossWarning, showGoblinWarning, showHud, updateHud } from "./ui/hud.js";
import { commitPseudo, getPseudo, initMainMenu, refreshAccountUI, showMainMenu } from "./ui/mainMenu.js";
import { canTogglePause, togglePause } from "./ui/pauseMenu.js";
import { currentScreen, hideScreens, showScreen } from "./ui/screens.js";
import { initRouter } from "./ui/router.js";
import { initTouchControls, showTouchControls } from "./ui/touchControls.js";
import { hydrateIcons } from "./ui/icons.js";
import { initKeyBindings } from "./ui/keyBindings.js";
import { closeOptions, initOptionsMenu, openOptions } from "./ui/optionsMenu.js";
import { closeLogin, initAccount, openLogin, resumeAccountCheck } from "./ui/accountMenu.js";
import { failLoading, finishLoading, runLoadingSteps, setLoading } from "./ui/loadingScreen.js";
import { loadFonts, loadImages, settleWithin } from "./services/preload.js";
import {
  holdUpgrades,
  initUpgradeMenu,
  resetUpgradeMenu,
  resumeUpgrades,
  setAutoPick,
  showBossChest,
  showShrineReward,
  showUpgradeMenu,
} from "./ui/upgradeMenu.js";
import { initAchievementMenu, openAchievements, showToast } from "./ui/achievementMenu.js";
import { initDailyMenu, openDaily } from "./ui/dailyMenu.js";
import { initQuestMenu, openQuests } from "./ui/questMenu.js";
import { announceRolledOver, initSeasonMenu, openSeason } from "./ui/seasonMenu.js";
import { addRunSeasonXp } from "./services/season.js";
import { initAnalytics, trackRun } from "./services/analytics.js";
import { initErrorReports } from "./services/errorReports.js";
import { currentUser } from "./services/auth.js";
import { initStreakMenu, offerLoginStreak } from "./ui/streakMenu.js";
import { initBossRushMenu, openBossRush } from "./ui/bossRushMenu.js";
import { initTalentMenu, openTalents } from "./ui/talentMenu.js";
import { initSkinMenu, openSkins } from "./ui/skinMenu.js";
import { openInventory } from "./ui/inventoryMenu.js";
import { openLeaderboard } from "./ui/leaderboardMenu.js";
import { canOfferRevive, initReviveMenu, showReviveOffer } from "./ui/reviveMenu.js";
import { castSpell, chargeAttack, updateHex } from "./systems/duelAttacks.js";
import {
  VERSUS_KEYS,
  fighterName,
  splitBanner,
  splitDeath,
  startOnlineVersus,
  startSplitVersus,
  stopVersus,
  updateSplit,
  useSkill,
  useSpell,
  versus,
} from "./systems/versus.js";
import {
  netTick,
  onNetMessage,
  onOwnDeath,
  onRivalLeft,
  resetOnline,
  rival,
} from "./systems/versusOnline.js";
import { leaveRoom, net, sendGame, setNetHandlers } from "./services/netplay.js";
import { canRank, reportDuel } from "./services/duelRanking.js";
import {
  initVersusMenu,
  showDuelElo,
  showRematchWaiting,
  showRivalGone,
  showVersusHud,
  showVersusOver,
  updateVersusHud,
} from "./ui/versusMenu.js";
import { initVersusTouch } from "./ui/versusTouch.js";
import { initDuelMenu, joinFriendDuel, openDuel, setDuelStatus } from "./ui/duelMenu.js";
import { friendsRunStarted, initFriendsMenu, openFriends, stopChallenge } from "./ui/friendsMenu.js";
import { initTutorial, startTutorial, stopTutorial, updateTutorial } from "./ui/tutorial.js";
import { initDuelPicks, requestDuelPick, resetDuelPicks, tickDuelPick } from "./ui/duelPicks.js";
import { claimInstallReward, initPwa } from "./services/pwa.js";
import { initNotifications } from "./services/notifications.js";
import { closeInstall, initAppMenu, maybeAskPush, openInstall, renderApp } from "./ui/appMenu.js";

// --- CYCLE DE VIE D'UNE PARTIE ---

let lastMode = "normal"; // « REJOUER » relance le même mode
let runReported = false; // partie déjà comptée dans les statistiques (fin, victoire ou abandon)
let ticking = false; // un tick de la partie est en cours (voir update)
let deathPending = false; // mort pendant un tick : traitée une fois le tick fini

/** Statistiques anonymes (services/analytics.js) : résumé de la partie chargée. */
function reportRun(mode, killer) {
  runReported = true;
  trackRun({
    mode,
    difficulty: game.difficulty,
    wave: game.rush ? game.rush.defeated : game.wave,
    pulse: game.endless?.depth || 0,
    level: player.level,
    kills: game.kills,
    seconds: game.time / 1000,
    hero: player.hero?.id || "",
    weapon: player.weapon?.id || "",
    killer,
    victory: !!game.endless, // boss final vaincu
  });
}

/**
 * Lance une partie ; mode "daily" = défi du jour (équipement, modificateur et graine imposés),
 * "rush" = Boss Rush (les boss à la suite, avec l'équipement et les talents du joueur).
 */
function startGame(mode = "normal") {
  lastMode = mode;
  runReported = false;
  deathPending = false;
  stopKillCam();
  stopVersus();
  showVersusHud(false);
  commitPseudo();
  playRandomMusic();
  restoreRandom();
  resetUpgradeMenu();
  setAutoPick(false);
  setupRun(mode, mode === "normal" ? selectedDifficulty() : "normal");
  logEvent("partie", `début ${mode} · ${game.difficulty}`);
  game.endlessAllowed = mode === "normal"; // victoire puis Endless Pulse : survie normale seulement
  if (mode === "normal") startTutorial();
  else stopTutorial();
  hideScreens();
  showHud(true);
}

/** Prépare une partie (aussi celle de chaque joueur en duel, toujours en Normal). */
function setupRun(mode, difficulty = "normal") {
  friendsRunStarted();
  resetGame();
  resetTrail();
  game.difficulty = difficulty;
  if (difficulty !== "normal") game.modifier = difficultyModifier(difficulty);
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
  camera.x = player.worldX - view.width / 2;
  camera.y = player.worldY - view.height / 2;
  if (player.synergy) {
    const s = player.synergy;
    addFloatingText(
      player.worldX,
      player.worldY - 70,
      `SYNERGIE : ${s.name.toUpperCase()}`,
      s.color,
      18,
      120,
    );
  }
  spawnWave();
}

/**
 * Duel (voir systems/versus.js) : chaque joueur joue sa partie de survie, le dernier en vie
 * empoche l'XP et l'or des deux. `online` = { role } en ligne (pseudos `names`, soi-même en premier),
 * sinon écran scindé sur cet appareil.
 */
function startDuel(online = null, names = []) {
  logEvent("partie", `début duel ${online ? `en ligne (${online.role})` : "sur un écran"}`);
  commitPseudo();
  playRandomMusic();
  restoreRandom();
  resetUpgradeMenu();
  resetDuelPicks();
  resetOnline();
  stopTutorial();
  eloRequest++;
  showDuelElo("");
  prizeGiven = false;
  runReported = false;
  if (online) {
    startOnlineVersus(online, names);
    setAutoPick(true); // l'adversaire continue pendant qu'on choisit
    setupRun("normal");
  } else {
    setAutoPick(false);
    startSplitVersus(() => {
      setupRun("normal");
      mysteryBox.active = false; // à deux sur un clavier, pas de touche libre pour l'ouvrir
    });
  }
  /** @type {HTMLElement} */ (document.activeElement)?.blur?.(); // ESPACE / ENTRÉE (dash) ne doivent pas recliquer un bouton
  hideScreens();
  showHud(!!online); // écran scindé : chaque moitié a son propre bandeau
  showVersusHud(true);
}

/** Hôte en ligne : (re)lance le duel chez les deux joueurs. */
function startOnlineDuel() {
  const names = [getPseudo(), net.peerName || "ADVERSAIRE"];
  const match = crypto.randomUUID(); // identifiant du duel, déclaré par les deux joueurs (classement ELO)
  sendGame({ t: "start", names, match, ranked: canRank() });
  startDuel({ role: "host", match }, names);
}

function replayDuel() {
  if (!versus.online) return startDuel();
  if (versus.online.role === "host") return startOnlineDuel();
  sendGame({ t: "rematch" });
  showRematchWaiting();
}

/** Messages du jeu reçus de l'adversaire (voir services/netplay.js). */
function onNetGame(msg) {
  if (net.role === "guest" && msg.t === "start") {
    startDuel({ role: "guest", match: msg.match }, [msg.names[1], msg.names[0]]);
    rival.ranked = !!msg.ranked;
    sendGame({ t: "ranked", on: canRank() });
    return;
  }
  if (net.role === "host" && msg.t === "rematch" && currentScreen() === "versusOver")
    return startOnlineDuel();
  onNetMessage(msg);
}

function onNetLost() {
  if (versus.online && game.started) {
    onRivalLeft();
    if (currentScreen() === "versusOver") showRivalGone();
  } else if (currentScreen() === "duelMenu") {
    setDuelStatus("L'adversaire s'est déconnecté.");
  }
}

// --- DUEL CLASSÉ (ELO, voir services/duelRanking.js) ---

let eloRequest = 0;

const isRankedDuel = () => !!versus.online?.match && canRank() && rival.ranked;

/** Déclare le résultat du duel en ligne et affiche le nouvel ELO une fois les deux déclarations reçues. */
function reportRanked(won) {
  const id = ++eloRequest;
  if (!canRank()) return showDuelElo("Duel non classé : connecte-toi pour gagner des points ELO.");
  if (!rival.ranked) return showDuelElo("Duel non classé : ton adversaire n'est pas connecté.");
  const { match } = versus.online;
  showDuelElo("Duel classé : calcul de l'ELO…");
  const attempt = async (tries) => {
    let res = null;
    try {
      res = await reportDuel(match, won, getPseudo());
    } catch (err) {
      console.warn("Résultat du duel non déclaré :", err);
    }
    if (id !== eloRequest) return;
    if (res?.status === "settled") {
      const delta = res.delta ? ` (${res.delta > 0 ? "+" : ""}${res.delta})` : " (duel non compté)";
      return showDuelElo(`ELO : ${res.rating}${delta}`);
    }
    if (tries > 0) return setTimeout(() => attempt(tries - 1), NET.eloRetryMs);
    showDuelElo(res ? "Duel classé : en attente de l'adversaire." : "Classement ELO indisponible.");
  };
  attempt(NET.eloRetries);
}

let prizeGiven = false; // un duel en ligne peut s'inverser une fois : la récompense n'est donnée qu'une fois
let overTimer = null;

/** Fin du duel : le gagnant empoche l'XP et l'or des deux parties. */
function onVersusOver(result) {
  const [a, b] = result.runs;
  const prize = { xp: a.x + b.x, gold: a.g + b.g };
  // Écran scindé : les deux joueurs partagent le compte de cet appareil ; en ligne, seul le gagnant gagne
  if (versus.online) reportRanked(result.winner === 0);
  if (!runReported) reportRun(versus.online ? "duel" : "duel-local", result.winner === 0 ? "" : "duel perdu");
  if ((!versus.online || result.winner === 0) && !prizeGiven) {
    prizeGiven = true;
    addAccountRewards(prize.xp, prize.gold);
    refreshAccountUI();
  }
  showTouchControls(false);
  clearTimeout(overTimer);
  const show = () => versus.active && showVersusOver(result, prize);
  if (currentScreen() === "versusOver") show();
  else overTimer = setTimeout(show, VERSUS.endDelayMs);
}

function applyModifierToPlayer(mod) {
  player.maxHealth *= mod.playerHealth || 1;
  player.health = player.maxHealth;
  player.attack *= mod.playerAttack || 1;
}

function returnToMenu() {
  if (game.started) logEvent("partie", "quittée");
  if (game.started && !runReported) reportRun(versus.active ? "duel" : lastMode, "abandon");
  stopKillCam();
  restoreRandom();
  saveAccount(); // garde la progression des succès (kills...) même en quittant une partie
  game.started = false;
  game.running = false;
  game.paused = false;
  stopTutorial();
  // Quitter un duel classé en cours = défaite (l'adversaire déclare sa victoire par abandon)
  if (isRankedDuel() && versus.winner === null)
    reportDuel(versus.online.match, false, getPseudo()).catch(() => {});
  eloRequest++;
  if (versus.online) leaveRoom();
  clearTimeout(overTimer);
  stopVersus();
  resetDuelPicks();
  showVersusHud(false);
  stopMusic();
  showHud(false);
  showMainMenu();
  maybeAskPush(); // retour d'une partie : proposé aux joueurs habitués seulement (voir PUSH.askMinRuns)
  resumeAccountCheck(); // réponse du compte arrivée pendant la partie : traitée maintenant
}

/**
 * Fin de partie. L'écran de fin s'affiche quoi qu'il arrive : une erreur dans le bilan (sauvegarde,
 * saison, classement...) laissait la partie arrêtée sans aucun écran, le jeu paraissait figé.
 */
function endGame() {
  try {
    settleRun();
  } catch (err) {
    reportLater(err);
    if (currentScreen() !== "gameOver") showScreen("gameOver");
  }
}

/** Erreur signalée (console, et test en échec) sans interrompre ce qui suit. */
function reportLater(err) {
  setTimeout(() => {
    throw err;
  });
}

/** Bilan de la partie terminée (récompenses, records, classement) puis écran de fin. */
function settleRun() {
  logEvent("partie", `fin · vague ${game.wave} · ${game.over ? "mort" : "victoire"}`);
  restoreRandom();
  stopTutorial();
  showTouchControls(false);
  addAccountRewards(Math.floor(game.totalRunXp), game.runGold);
  recordBest("bestCombo", game.stats.bestCombo);
  if (game.daily) addStat("dailyRuns");
  recordCompletedRun();
  reportRun(lastMode, game.over ? game.killCam.killer?.name || "" : "");
  const rush = game.rush;
  const season = addRunSeasonXp({
    wave: rush ? 0 : game.wave,
    bosses: game.stats.bosses,
    kills: game.kills,
    difficulty: game.difficulty,
    pulse: game.endless?.depth || 0,
  });
  refreshAccountUI();
  const pseudo = getPseudo();
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
    showSeasonGain(season);
    setOnlineStatus("");
    return;
  }
  // Facile : hors classements (local et mondial) ; Cauchemar : classement mondial à part
  const easy = game.difficulty === "easy";
  const nightmare = game.difficulty === "nightmare";
  const isNewRecord = !easy && saveToLeaderboard(pseudo, game.wave, game.totalRunXp, player.level);
  const labels = ["Vague"];
  if (game.difficulty !== "normal") labels.push(DIFFICULTIES[game.difficulty].name);
  if (game.endless) labels.push(`Pulse ${game.endless.depth}`);
  showGameOver({
    pseudo,
    level: player.level,
    wave: game.wave,
    waveLabel: labels.join(" · "),
    xp: game.totalRunXp,
    gold: game.runGold,
    isNewRecord,
  });
  showSeasonGain(season);

  const day = game.daily?.day;
  if (day) saveDailyBest(day, game.wave, game.totalRunXp);
  if (easy) {
    setOnlineStatus(isOnlineEnabled() ? "Mode Facile : hors classement mondial" : "");
    return;
  }
  setOnlineStatus(isOnlineEnabled() ? "Envoi du score au classement mondial..." : "");
  if (isOnlineEnabled()) {
    const pulse = game.endless?.depth || 0;
    const score = {
      name: pseudo,
      wave: game.wave,
      xp: game.totalRunXp,
      lvl: player.level,
      day,
      nightmare,
      pulse,
    };
    const prefix = day ? "Défi du jour : " : nightmare ? "Cauchemar : " : "";
    submitScore(score).then((status) =>
      setOnlineStatus((status === "sent" ? prefix : "") + SUBMIT_MESSAGES[status]),
    );
  }
}

/** Écran de fin : XP de saison gagnée par la partie (voir services/season.js). */
function showSeasonGain({ xp, firstOfDay }) {
  const bonus = firstOfDay ? " · bonus 1re partie du jour" : "";
  $("runSeasonGain").textContent = xp > 0 ? `+${xp} XP de saison${bonus}` : "";
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
  questMenu: openQuests,
  seasonMenu: openSeason,
  bossRushMenu: openBossRush,
  duelMenu: openDuel,
  friendsMenu: () => openFriends(),
  talentMenu: openTalents,
  skinMenu: openSkins,
  loginMenu: () => (isOnlineEnabled() ? openLogin("mainMenu") : showMainMenu()),
  installMenu: () => openInstall("mainMenu"),
};

/** Retour / avancer du navigateur : ferme l'écran ouvert. En partie, ne quitte jamais la partie. */
function navigate(id) {
  const screen = currentScreen();
  if (!game.started) {
    if (screen === "friendsMenu") stopChallenge();
    if (MENUS[id]) MENUS[id]();
    else if (screen === "loginMenu")
      closeLogin(); // ouverte depuis les options : retour aux options
    else if (screen === "chestReveal") showScreen("shopMenu");
    else if (screen === "installMenu")
      closeInstall(); // ouvert depuis les options : retour aux options
    else showMainMenu();
    return;
  }
  if (screen === null) {
    // En ligne, pas de pause (l'adversaire continue) : le retour arrière ne fait rien
    if (!versus.online && canTogglePause()) togglePause();
  } else if (screen === "pauseMenu") togglePause();
  else if (screen === "optionsMenu") closeOptions();
  else if (screen === "loginMenu") closeLogin();
  else if (screen === "installMenu") closeInstall();
  else if (screen === "shareMenu") showScreen("gameOver");
  else if (screen === "gameOver" || screen === "versusOver") returnToMenu();
  // amélioration et revivre : le choix reste à faire, l'adresse est simplement remise
}

// --- MISE À JOUR (un tick = 1/60 s) ---

function update() {
  if (versus.split) return updateSplit(simulate, tickDuelPick);
  if (!game.running || game.paused) return;
  game.time += TICK_MS;
  ticking = true;
  try {
    simulate();
    if (!versus.active) recordKillCam();
    updateTutorial();
  } finally {
    ticking = false;
    if (deathPending) onDeath(); // même si le tick a échoué : jamais de partie arrêtée sans écran
  }
}

/** Mort du joueur (hors duel) : proposition de revivre avec une pub, sinon fin de partie. */
function onDeath() {
  deathPending = false;
  if (canOfferRevive()) showReviveOffer();
  else endGame();
}

/** Un tick de la partie chargée. */
function simulate() {
  updateHex();
  updateSpawning();
  updateArena();
  updateMapEvents();
  updateCursedShrines();
  updatePlayer();
  updateTrail();
  rebuildEnemyGrid();
  updateAura();
  updatePerks();
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
  // Image suivante demandée d'abord : une erreur dans cette image ne doit jamais arrêter la boucle
  // (avant, la moindre exception figeait le jeu pour de bon, écran compris).
  requestAnimationFrame(frame);
  const start = performance.now();
  try {
    runFrame(now);
  } finally {
    markFrame(start); // journal de diagnostic : images lentes, boucle arrêtée
  }
}

function runFrame(now) {
  const elapsed = Math.min(now - lastFrame, 250); // borne : évite la « spirale » après un onglet en arrière-plan
  lastFrame = now;
  if (game.started) {
    // Ralenti à la mort d'un boss (écran scindé : géré partie par partie)
    const timeScale = game.slowMo > 0 && !versus.split ? 0.3 : 1;
    accumulator += elapsed * timeScale;
    // Au plus LIMITS.ticksPerFrame ticks par image : un appareil qui n'arrive plus à suivre fait
    // ralentir la partie au lieu d'enchaîner des images de plus en plus lourdes (gel).
    for (let n = 0; accumulator >= TICK_MS; n++) {
      if (n >= LIMITS.ticksPerFrame) {
        logThrottled("lag", "lenteur", "l'appareil ne suit plus : partie ralentie");
        accumulator = 0;
        break;
      }
      update();
      accumulator -= TICK_MS;
    }
    if (versus.online) netTick(now);
    if (killCamActive()) drawKillCam(now);
    else render();
    if (!versus.split) updateHud();
    if (versus.active) updateVersusHud();
  } else {
    accumulator = 0;
    renderMenuBackground();
  }
}

// --- INITIALISATION ---

/** Journal de diagnostic (services/diagnostics.js) : état du jeu joint aux rapports, valeurs suivies. */
function initDiagnostics() {
  const mode = () =>
    !game.started ? "accueil" : versus.active ? (versus.online ? "duel en ligne" : "duel") : lastMode;
  const bosses = () =>
    world.enemies
      .filter((e) => e.isBoss)
      .map((e) => e.name || e.type)
      .join(", ");
  setDiagnosticContext(() => ({
    screen: currentScreen() || "jeu",
    mode: mode(),
    difficulty: game.started ? game.difficulty : undefined,
    running: game.running,
    paused: game.paused,
    over: game.over,
    wave: game.started ? game.wave : undefined,
    pulse: game.endless?.depth,
    rush: game.rush?.stage,
    seconds: game.started ? Math.round(game.time / 1000) : undefined,
    level: game.started ? player.level : undefined,
    health: game.started ? `${Math.ceil(player.health)}/${Math.round(player.maxHealth)}` : undefined,
    hero: game.started ? player.hero?.id : undefined,
    weapon: game.started ? player.weapon?.id : undefined,
    bosses: game.started ? bosses() : undefined,
    enemies: game.started ? world.enemies.length : undefined,
    shots: game.started ? world.projectiles.length + world.enemyProjectiles.length : undefined,
    event: game.mapEvent?.type,
    quality: settings.quality,
  }));
  watch("écran", () => currentScreen() || "jeu");
  watch("mode", mode);
  watch("vague", () => (game.started ? game.wave : "—"));
  watch("boss", () => (game.started && bosses()) || "aucun");
  watch("pause", () => (game.started && game.paused ? "oui" : "non"));
}

/**
 * Branche les menus et les commandes. Renvoie la vérification du compte connecté (en cours),
 * que l'écran de chargement attend avant d'ouvrir l'accueil.
 */
function init() {
  hydrateIcons();
  loadAccount();
  initPwa();
  initAnalytics({
    playing: () => game.started && game.running && !game.paused,
    loggedIn: () => !!currentUser(),
  });
  initErrorReports();
  initDiagnostics();
  initCloudSave();
  initAds();
  ensureStarterItems();
  initMainMenu({ onPlay: () => startGame("normal") });
  initDailyMenu({ onPlay: () => startGame("daily"), onBack: showMainMenu });
  initBossRushMenu({ onPlay: () => startGame("rush"), onBack: showMainMenu });
  initTalentMenu({ onBack: showMainMenu, onChange: refreshAccountUI });
  initSkinMenu({ onBack: showMainMenu, onChange: refreshAccountUI });
  initUpgradeMenu();
  initDuelPicks();
  initAchievementMenu({ onBack: showMainMenu });
  initQuestMenu({ onBack: showMainMenu, onChange: refreshAccountUI });
  initSeasonMenu({ onBack: showMainMenu, onChange: refreshAccountUI });
  initStreakMenu({
    onClose: () => {
      showMainMenu();
      maybeAskPush(); // juste après la série du jour : le bon moment pour proposer un rappel
    },
  });

  $("btnResume").addEventListener("click", togglePause);
  $("btnQuit").addEventListener("click", returnToMenu);
  $("btnReplay").addEventListener("click", () => startGame(lastMode));
  $("btnGameOverMenu").addEventListener("click", returnToMenu);
  initKillCamButton();
  initShareMenu();
  $("btnOptions").addEventListener("click", () => openOptions("mainMenu"));
  $("btnPauseOptions").addEventListener("click", () => openOptions("pauseMenu"));
  initOptionsMenu();
  initKeyBindings();
  initTutorial();
  initAppMenu();
  initNotifications();
  // Connexion facultative : vérifie la progression du compte (attendue par l'écran de chargement)
  const accountCheck = initAccount({
    onConflictFound: () => openLogin("mainMenu"),
    playing: () => game.started,
  });

  // L'audio ne peut démarrer qu'après une interaction ; petit « clic » sur chaque bouton.
  document.addEventListener("pointerdown", unlockAudio);
  document.addEventListener("keydown", unlockAudio);
  document.addEventListener("click", (e) => {
    if (/** @type {Element} */ (e.target).closest("button:not(.touch-btn)")) playSfx("click");
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
    if (game.running && !game.paused && !versus.split) activateSkill();
  });
  onAction("autoShoot", () => {
    if (game.started && !versus.split) player.autoShoot = !player.autoShoot;
  });

  initTouchControls({
    onUltimate: () => game.running && !game.paused && activateSkill(),
    onPause: pause,
  });

  on("levelUp", () => (versus.split ? requestDuelPick(versus.current, "level") : showUpgradeMenu()));
  on("bossChest", () => (versus.split ? requestDuelPick(versus.current, "chest") : showBossChest()));
  on("cursedReward", () => (versus.split ? requestDuelPick(versus.current, "shrine") : showShrineReward()));
  on("goblin", () => {
    if (versus.split) splitBanner("VOLEUR DORÉ !", "#ffd700");
    else showGoblinWarning();
    playSfx("combo");
  });
  initReviveMenu({
    onRevive: () => {
      reviveFromAd();
      resumeUpgrades(); // montée de niveau gagnée à la mort : proposée maintenant
    },
    onGiveUp: endGame,
  });
  on("endlessStart", () => {
    showBossWarning("CŒUR DU PULSE VAINCU · ENDLESS PULSE", false, "#ff00aa");
    playSfx("boss");
  });
  on("pulseWave", ({ depth, mutators }) => {
    const names = mutators.map((m) => m.name).join(" · ");
    showBossWarning(`PULSE ${depth}${names ? " · " + names : ""}`, false, "#ff00aa");
    playSfx("boss");
  });

  $("btnVersus").addEventListener("click", openDuel);
  $("btnFriends").addEventListener("click", () => openFriends());
  $("btnVersusPause").addEventListener("click", pause);
  initDuelMenu({ onLocal: () => startDuel(), onBack: showMainMenu, onFriends: openFriends });
  initFriendsMenu({
    // « menu » : libre pour un défi ; une partie de duel en préparation compte comme occupé
    getStatus: () => (game.started ? (versus.active ? "duel" : "jeu") : net.role ? "duel" : "menu"),
    onBack: (from) => (from === "duel" ? openDuel() : showMainMenu()),
    onLogin: () => openLogin("friendsMenu"),
    onAccept: joinFriendDuel,
  });
  initVersusMenu({ onReplay: replayDuel, onMenu: returnToMenu });
  initVersusTouch();
  setNetHandlers({
    onReady: () => net.role === "host" && startOnlineDuel(),
    onGame: onNetGame,
    onLost: onNetLost,
  });
  on("versusOver", onVersusOver);
  on("kill", chargeAttack);
  on("attackReceived", ({ count, elite, from }) => {
    const text = `ATTAQUE DE ${fighterName(from)} ! +${count} ${elite ? "ÉLITES" : "ENNEMIS"}`;
    if (versus.split) splitBanner(text, "#aa66ff");
    else showBossWarning(text);
    vibrate(80);
  });
  on("spellReceived", ({ name, from }) => {
    const text = `${name} ! (SORT DE ${fighterName(from)})`;
    if (versus.split) splitBanner(text, "#00ff88");
    else showBossWarning(text);
    vibrate([60, 40, 60]);
  });
  onAction("spell", () => versus.online && game.running && !game.paused && castSpell());
  $("btnTouchSpell").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (versus.online && game.running && !game.paused) castSpell();
  });
  // Écran scindé : compétence de chaque joueur (J1 E / R, J2 MAJ / 1)
  document.addEventListener("keydown", (e) => {
    if (!versus.split || e.repeat) return;
    const key = e.key.toLowerCase();
    VERSUS_KEYS.forEach((keys, i) => {
      if (keys.skill.includes(key)) useSkill(i);
      if (keys.spell.includes(key)) useSpell(i);
    });
  });
  on("playerDied", () => {
    if (versus.split) return splitDeath(versus.current);
    holdUpgrades(); // choix ouvert plus tôt dans ce tick : mis de côté, l'écran de fin passe devant
    if (versus.online) return onOwnDeath();
    // Pendant un tick, écran « revivre » ou fin de partie une fois le tick terminé : le reste du tick
    // (gemmes, coffres...) tourne encore, et le bilan ne doit pas s'exécuter au milieu de la boucle des ennemis.
    if (ticking) deathPending = true;
    else onDeath();
  });
  on("biomeChange", (biome) =>
    versus.split ? splitBanner(biome.name, biome.color) : showBiomeBanner(biome),
  );
  on("mapEvent", ({ name, color }) => {
    if (versus.split) splitBanner(name, color);
    else showBossWarning(name, false, color);
    playSfx("meteor");
  });
  on("bossWarning", (text) => {
    if (versus.split) splitBanner(text, "#ff2a6d");
    else showBossWarning(text);
    playSfx("boss");
    vibrate([100, 50, 100]);
  });
  return accountCheck;
}

/** Fin du chargement : l'accueil (ou le menu demandé par l'adresse) apparaît, la boucle démarre. */
function enterHome() {
  showMainMenu();
  // Première ouverture depuis l'icône de l'écran d'accueil : cadeau de bienvenue (une fois par compte)
  const installGold = claimInstallReward();
  if (installGold) {
    showToast(`Merci d'avoir installé Last Pulse : +${installGold} or`, "coin");
    refreshAccountUI();
    renderApp();
  }
  initRouter({ navigate, getCurrent: currentScreen, deepLinks: Object.keys(MENUS) });
  announceRolledOver(); // nouveau mois : récompenses de la saison passée données d'office
  // Série de connexion : proposée à l'arrivée (pas à un tout nouveau joueur, qui commence par le tutoriel)
  if (currentScreen() === "mainMenu" && account.achievementStats.runs > 0) offerLoginStreak();
  requestAnimationFrame(frame);
  finishLoading();
}

/**
 * Démarrage derrière l'écran de chargement (voir src/boot.js) : l'accueil n'apparaît, et JOUER ne
 * répond, qu'une fois tout prêt. Avant, un clic pendant le téléchargement des modules était perdu
 * et l'accueil montrait un compte vide ; une progression récupérée du compte rechargeait la page
 * en pleine partie.
 */
async function boot() {
  try {
    setLoading(0.7, "Préparation du jeu...");
    const accountCheck = init();
    await runLoadingSteps([
      { label: "Polices...", run: loadFonts },
      { label: "Images...", run: () => loadImages() },
      // Au-delà du délai, le jeu s'ouvre : une réponse tardive est traitée sans gêner une partie
      { label: "Compte en ligne...", run: () => settleWithin(accountCheck, LOADING.accountTimeoutMs) },
    ]);
    enterHome();
  } catch (err) {
    console.error(err);
    failLoading("Le jeu n'a pas pu démarrer.");
  }
}

// Sur l'ancienne adresse, transfer.js emmène le joueur vers last-pulse.com : inutile de démarrer.
if (!window.__lastPulseLeaving) boot();
