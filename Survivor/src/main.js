// Point d'entrée : initialise l'UI, gère le cycle de vie d'une partie
// et fait tourner la boucle principale (logique à pas fixe + rendu).

// En premier : le journal de diagnostic écoute les erreurs dès le chargement des autres modules
import {
  captureError,
  logEvent,
  logThrottled,
  markFrame,
  setDiagnosticContext,
  watch,
} from "./services/diagnostics.js";
import { COOP, DIFFICULTIES, LIMITS, LOADING, NET, RUN_SAVE, TICK_MS, VERSUS } from "./config.js";
import { view } from "./core/canvas.js";
import { on } from "./core/events.js";
import { onAction } from "./core/input.js";
import {
  isAutoQuality,
  onAutoQualityChange,
  qualityLevel,
  resetFrameProbe,
  sampleFrame,
} from "./core/quality.js";
import {
  camera,
  game,
  mysteryBox,
  pet,
  player,
  resetGame,
  resetMysteryBox,
  resetPet,
  resetPlayer,
  world,
} from "./core/state.js";
import { settings } from "./services/settings.js";
import { render, renderMenuBackground } from "./render/renderer.js";
import { playMenuMusic, startRunMusic, updateMusic } from "./services/audio.js";
import { SUBMIT_MESSAGES, isOnlineEnabled, submitScore } from "./services/onlineLeaderboard.js";
import { initCloudSave } from "./services/cloudSave.js";
import { initAds } from "./services/ads.js";
import { dailyChallenge, restoreRandom, saveDailyBest, useSeed } from "./services/daily.js";
import { applyTalents } from "./data/talents.js";
import { CYBER_CORE } from "./data/cyberCore.js";
import { applyCyberCore } from "./systems/cyberCore.js";
import { activeNodes } from "./services/cyberCore.js";
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
import { updateSideWeapons } from "./systems/sideWeapons.js";
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
import { ageTrail, resetTrail, seedTrail, updateTrail } from "./systems/trail.js";
import {
  applyPartyScaling,
  followCamera,
  forEachMember,
  inParty,
  isLocalMember,
  memberLeft,
  memberObj,
  party,
  startParty,
  stopParty,
  upMembers,
  updateFocus,
  updateRevives,
  withMember,
  withOwned,
} from "./systems/party.js";
import {
  guestFrame,
  guestTick,
  hostFrame,
  hostTickEnd,
  hostTickStart,
  onGuestMessage,
  onHostMessage,
  onRemotePick,
  remotePickers,
  remotePicksPending,
  requestRemotePick,
  requestSkill,
  sendPick,
  sendSnapshot,
  startGuestSync,
  startHostSync,
  stopSync,
  toggleAuto,
} from "./systems/coopSync.js";
import { coopRoundOver, initCoopMenu, leaveCoopRoom, openCoop } from "./ui/coopMenu.js";
import { showCoopHud, updateCoopHud } from "./ui/coopHud.js";
import { broadcast as coopBroadcast } from "./services/coopNet.js";
import { decodeSnapshot, encodeSnapshot } from "./utils/snapshot.js";
import { currentSkin } from "./services/skins.js";
import { spawnWave, updateSpawning } from "./systems/spawner.js";
import { updateArena } from "./systems/arena.js";
import { updateMapEvents } from "./systems/mapEvents.js";
import { updateCursedShrines } from "./systems/cursedShrines.js";
import { updateAnomaly } from "./systems/anomalies/index.js";
import { updateBlackMarket } from "./systems/blackMarket.js";
import { initBlackMarket } from "./ui/blackMarket.js";
import { $, setVisible } from "./ui/dom.js";
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
import { initGamepadControls, updateGamepads } from "./ui/gamepadControls.js";
import { initPadNav } from "./ui/padNav.js";
import { hydrateIcons } from "./ui/icons.js";
import { initKeyBindings } from "./ui/keyBindings.js";
import { initGamepadOptions } from "./ui/gamepadOptions.js";
import { closeOptions, initOptionsMenu, openOptions } from "./ui/optionsMenu.js";
import { closeLogin, initAccount, openLogin, resumeAccountCheck } from "./ui/accountMenu.js";
import { failLoading, finishLoading, runLoadingSteps, setLoading } from "./ui/loadingScreen.js";
import { loadFonts, loadImages, settleWithin } from "./services/preload.js";
import {
  holdUpgrades,
  initUpgradeMenu,
  pendingChoices,
  resetUpgradeMenu,
  restoreChoices,
  resumeUpgrades,
  setAutoPick,
  showBossChest,
  showShrineReward,
  showBlackMarket,
  showRemoteChoice,
  showUpgradeMenu,
} from "./ui/upgradeMenu.js";
import { initAchievementMenu, openAchievements, showToast } from "./ui/achievementMenu.js";
import { initDailyMenu, openDaily } from "./ui/dailyMenu.js";
import { currentChallenge, initChallengeMenu, openChallenges, scoreText, share } from "./ui/challengeMenu.js";
import { challengeRules, recordChallengeRun, takeChallengeLink } from "./services/friendChallenge.js";
import { initQuestMenu, openQuests } from "./ui/questMenu.js";
import { announceRolledOver, initSeasonMenu, openSeason } from "./ui/seasonMenu.js";
import { addRunSeasonXp } from "./services/season.js";
import { weekendBonus } from "./services/weekendEvent.js";
import { canSaveRun, clearRun, restoreRunState, saveRun, savedRun } from "./services/runSave.js";
import { confirmDropRun, initResumeRun } from "./ui/resumeRun.js";
import { initAnalytics, trackRun } from "./services/analytics.js";
import { initErrorReports } from "./services/errorReports.js";
import { currentUser } from "./services/auth.js";
import { initStreakMenu, offerLoginStreak } from "./ui/streakMenu.js";
import { closeNews, initNewsMenu, offerNews } from "./ui/newsMenu.js";
import { initBossRushMenu, openBossRush } from "./ui/bossRushMenu.js";
import { initTalentMenu, openTalents } from "./ui/talentMenu.js";
import { initCyberCoreMenu, openCyberCore } from "./ui/cyberCoreMenu.js";
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
  ratingOf,
  resetOnline,
  rival,
} from "./systems/versusOnline.js";
import { leaveRoom, net, sendGame, setNetHandlers } from "./services/netplay.js";
import {
  canRank,
  duelRankOf,
  initDuelRanking,
  myDuelRating,
  reportDuel,
  setMyDuelRating,
} from "./services/duelRanking.js";
import { initDuelRank, rankChangeText } from "./ui/duelRank.js";
import {
  initVersusMenu,
  showDuelElo,
  showDuelRankChange,
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
let lastChallenge = ""; // code du défi entre amis joué (REJOUER relance le même)
let runReported = false; // partie déjà comptée dans les statistiques (fin, victoire ou abandon)
let ticking = false; // un tick de la partie est en cours (voir update)
let deathPending = false; // mort pendant un tick : traitée une fois le tick fini
let coopEnding = false; // coop : toute l'équipe à terre pendant un tick, fin traitée une fois le tick fini
let coopSettled = false; // coop : bilan de la partie déjà fait

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

// --- PARTIE INTERROMPUE (services/runSave.js, bouton REPRENDRE de l'accueil) ---

let nextSaveAt = 0; // game.time de la prochaine sauvegarde automatique

/**
 * Sauvegarde la partie en cours (hors duel, jamais une partie perdue) avec ses choix d'amélioration
 * en attente. Appelée en quittant, en masquant l'onglet et régulièrement en jouant.
 */
function persistRun() {
  if (deathPending || currentScreen() === "reviveMenu" || !canSaveRun(versus.active || inParty()))
    return false;
  nextSaveAt = game.time + RUN_SAVE.everySeconds * 1000;
  return saveRun(lastMode, { choices: pendingChoices() });
}

/** REPRENDRE : recharge la partie sauvegardée, en pause (ou sur le choix d'amélioration en attente). */
function resumeRun() {
  const saved = savedRun();
  if (!saved) return showMainMenu();
  lastMode = saved.meta.mode;
  runReported = false;
  deathPending = false;
  stopKillCam();
  stopVersus();
  showVersusHud(false);
  commitPseudo();
  restoreRandom();
  resetUpgradeMenu();
  setAutoPick(false);
  stopTutorial();
  try {
    restoreRunState(saved);
  } catch (err) {
    captureError(err);
    clearRun();
    game.started = game.running = false;
    showToast("Cette partie n'a pas pu être reprise.", "warning");
    return showMainMenu();
  }
  // Défi du jour, défi entre amis : nouvelle graine (la suite tirée avant l'interruption n'est pas sauvegardée)
  const seeded = game.daily || game.challenge;
  if (seeded) useSeed((seeded.seed ^ Math.floor(game.time)) >>> 0);
  if (game.challenge) lastChallenge = game.challenge.code;
  Object.assign(game, { started: true, running: true, paused: false, over: false });
  nextSaveAt = game.time + RUN_SAVE.everySeconds * 1000;
  logEvent("partie", `reprise ${lastMode} · vague ${game.wave}`);
  startRunMusic();
  hideScreens();
  showHud(true);
  // Le joueur reprend la main quand il est prêt : pause, sauf si une amélioration attend son choix
  if (!restoreChoices(saved.extra?.choices)) togglePause();
}

/** Partie sauvegardée abandonnée depuis l'accueil : comptée comme un abandon, puis oubliée. */
function abandonSavedRun() {
  const saved = savedRun();
  clearRun();
  if (!saved) return;
  const { meta } = saved;
  logEvent("partie", `abandon de la partie sauvegardée · vague ${meta.wave}`);
  trackRun({
    mode: meta.mode,
    difficulty: meta.difficulty,
    wave: meta.wave,
    pulse: meta.pulse,
    level: meta.level,
    kills: meta.kills,
    seconds: meta.seconds,
    hero: meta.hero,
    weapon: meta.weapon,
    killer: "abandon",
    victory: meta.pulse > 0,
  });
}

/** QUITTER (pause) : la partie est sauvegardée et reprend plus tard depuis l'accueil. */
function quitRun() {
  if (!versus.active && persistRun()) {
    logEvent("partie", `sauvegardée · vague ${game.wave}`);
    runReported = true; // comptée dans les statistiques quand elle finira vraiment
  }
  returnToMenu();
}

/** ABANDONNER (pause) : la partie est perdue (comme QUITTER avant la sauvegarde des parties). */
function abandonRun() {
  if (!confirm("Abandonner la partie ? Elle ne pourra pas être reprise.")) return;
  clearRun();
  returnToMenu();
}

/**
 * Lance une partie ; mode "daily" = défi du jour (équipement, modificateur et graine imposés),
 * "rush" = Boss Rush (les boss à la suite, avec l'équipement et les talents du joueur).
 */
function startGame(mode = "normal") {
  if (!confirmDropRun()) return;
  if (savedRun()) abandonSavedRun(); // une nouvelle partie remplace la partie interrompue
  lastMode = mode;
  runReported = false;
  deathPending = false;
  stopKillCam();
  stopVersus();
  showVersusHud(false);
  commitPseudo();
  startRunMusic();
  restoreRandom();
  resetUpgradeMenu();
  setAutoPick(false);
  setupRun(mode, mode === "normal" ? selectedDifficulty() : "normal");
  logEvent("partie", `début ${mode} · ${game.difficulty}`);
  nextSaveAt = RUN_SAVE.everySeconds * 1000;
  game.endlessAllowed = mode === "normal"; // victoire puis Endless Pulse : survie normale seulement
  if (mode === "normal") startTutorial();
  else stopTutorial();
  hideScreens();
  showHud(true);
}

/**
 * Prépare une partie (aussi celle de chaque joueur en duel, toujours en Normal). `prepare` : réglages
 * de la partie à appliquer avant la première vague (coop : carte et ennemis selon le nombre de joueurs).
 */
function setupRun(mode, difficulty = "normal", prepare = null) {
  friendsRunStarted();
  resetGame();
  resetTrail();
  game.difficulty = difficulty;
  if (difficulty !== "normal") game.modifier = difficultyModifier(difficulty);
  if (mode === "daily" || mode === "challenge") {
    // Défi du jour ou défi entre amis : règles et hasard tirés d'une graine, les mêmes pour tous
    const rules = mode === "daily" ? dailyChallenge() : challengeRules(lastChallenge);
    if (mode === "daily") game.daily = rules;
    else game.challenge = { code: lastChallenge, seed: rules.seed };
    game.modifier = rules.modifier;
    useSeed(rules.seed);
    resetPlayer(1); // même base pour tout le monde : ni niveau de compte ni talents
    const base = { level: 1, prestige: 1 };
    applyEquipment({ hero: { id: rules.hero, ...base }, weapon: { id: rules.weapon, ...base } });
  } else {
    resetPlayer(account.level);
    applyEquipment();
    applyTalents(player, account.talents);
    if (CYBER_CORE.modes.includes(mode)) applyCyberCore(activeNodes()); // nœuds actifs (Cœur Cybernétique)
  }
  if (mode === "rush") {
    game.rush = { stage: 0, defeated: 0, bestBefore: getStat("bestBossRush") };
    game.modifier = BOSS_RUSH.modifier;
  }
  prepare?.();
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
  startRunMusic();
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

// --- COOP EN LIGNE (2 à 4 joueurs : systems/party.js, systems/coopSync.js, ui/coopMenu.js) ---

/** Début commun d'une partie coop (hôte ou invité). */
function beginCoop(role) {
  logEvent("partie", `début coop (${role})`);
  lastMode = "coop";
  runReported = false;
  deathPending = false;
  coopEnding = false;
  coopSettled = false;
  clearTimeout(overTimer);
  stopKillCam();
  stopVersus();
  stopSync();
  stopParty();
  showVersusHud(false);
  commitPseudo();
  startRunMusic();
  restoreRandom();
  resetUpgradeMenu();
  setAutoPick(true, COOP.pickSeconds); // personne ne bloque l'équipe trop longtemps
  stopTutorial();
}

function finishCoopStart() {
  mysteryBox.active = false; // une seule boîte pour tous : pas en coop
  /** @type {HTMLElement} */ (document.activeElement)?.blur?.();
  hideScreens();
  showHud(true);
  showCoopHud(true);
}

/** Vaisseau de ce joueur pour la partie coop (équipement, talents, Cœur Cybernétique, skin). */
function buildCoopShip() {
  resetPlayer(account.level);
  applyEquipment();
  applyTalents(player, account.talents);
  if (CYBER_CORE.modes.includes("normal")) applyCyberCore(activeNodes());
  player.autoShoot = true;
  player.skin = { ...currentSkin(), resolved: true }; // dessiné tel quel chez les coéquipiers
  return encodeSnapshot({ player, pet });
}

/** Hôte : la partie commence avec les joueurs du salon (`seats[0]` = soi ; vaisseaux des invités reçus). */
function startCoopHost(seats) {
  beginCoop("host");
  const names = seats.map((s) => s.name);
  setupRun("normal", "normal", () => applyPartyScaling(names.length));
  player.skin = { ...currentSkin(), resolved: true };
  game.endlessAllowed = true;
  const template = { ...player };
  startParty({ role: "host", local: 0, names });
  seats.forEach((seat, k) => {
    const m = party.members[k];
    m.peerId = seat.id;
    if (k === 0) return;
    try {
      decodeSnapshot(seat.data, { player: m.store.player, pet: m.store.pet });
    } catch (err) {
      captureError(err);
      m.gone = true;
      return;
    }
    // Champ inconnu de l'autre appareil (version différente) : valeur de départ
    for (const key of Object.keys(template))
      if (!(key in m.store.player)) m.store.player[key] = template[key];
    if (!Number.isFinite(m.store.player.maxHealth)) m.gone = true;
  });
  placeTeam(names.length);
  startHostSync();
  finishCoopStart();
}

/** Équipe placée en cercle au centre de la carte, chacun avec sa caméra et sa traînée. */
function placeTeam(n) {
  for (let k = 0; k < n; k++) {
    withMember(k, () => {
      const a = (Math.PI * 2 * k) / n - Math.PI / 2;
      player.worldX = Math.cos(a) * 90;
      player.worldY = Math.sin(a) * 90;
      player.health = player.maxHealth;
      if (pet.active) {
        pet.x = player.worldX;
        pet.y = player.worldY;
      }
      resetTrail();
      camera.x = player.worldX - view.width / 2;
      camera.y = player.worldY - view.height / 2;
    });
  }
  followCamera();
}

/** Invité : la partie de l'hôte commence ; son état arrive par systems/coopSync.js. */
function startCoopGuest({ slot, names }) {
  beginCoop("guest");
  friendsRunStarted();
  resetGame();
  resetTrail();
  resetMysteryBox();
  game.coopSize = names.length;
  startParty({ role: "guest", local: slot, names });
  startGuestSync();
  finishCoopStart();
}

/** Hôte : un tick de la partie commune (chaque vaisseau à son tour, puis les ennemis). */
function simulateCoop() {
  hostTickStart();
  const focus = updateFocus();
  // Apparitions, arène, événements de carte, anomalies : autour d'un joueur à tour de rôle
  withMember(focus, () => {
    updateSpawning();
    updateArena();
    updateMapEvents();
    updateAnomaly();
  });
  rebuildEnemyGrid();
  ageTrail(world.trail);
  forEachMember(
    (k) =>
      withOwned(k, () => {
        if (player.downed) return updateProjectiles(); // ses tirs déjà partis continuent leur route
        updatePlayer();
        seedTrail();
        updateAura();
        updatePerks();
        shoot();
        throwKunai();
        updateSideWeapons();
        updatePet();
        updatePickups();
        updateProjectiles();
        updateOrbitals();
        updateSkills();
      }),
    { down: true },
  );
  hostTickEnd();
  updateRevives();
  updateEnemies();
  updateHazards();
  updateEffects();
  followCamera();
}

/** Hôte : qui l'équipe attend (choix d'amélioration en cours), affiché chez tout le monde. */
function coopWaiting() {
  const names = remotePickers().map((k) => party.members[k].name);
  if (currentScreen() === "upgradeMenu") names.unshift(party.members[party.local].name);
  return names;
}

/** Hôte : toute l'équipe est à terre (ou plus personne) : fin pour tout le monde. */
function endCoop(reason = "") {
  coopEnding = false;
  if (party.role === "host") {
    sendSnapshot();
    coopBroadcast({ t: "over", reason });
  }
  settleCoop(reason);
}

/** Bilan de la partie coop sur cet appareil : chacun empoche l'XP et l'or de la partie. Hors classements. */
function settleCoop(reason = "") {
  if (!inParty() || coopSettled) return;
  coopSettled = true;
  logEvent("partie", `fin coop · vague ${game.wave}`);
  game.running = false;
  game.over = true;
  holdUpgrades();
  resetUpgradeMenu();
  showTouchControls(false);
  showCoopHud(false);
  const weekend = payRunRewards();
  recordBest("bestCombo", game.stats.bestCombo);
  recordCompletedRun();
  reportRun("coop", reason || "équipe à terre");
  const season = addRunSeasonXp({
    wave: game.wave,
    bosses: game.stats.bosses,
    kills: game.kills,
    difficulty: "normal",
    pulse: game.endless?.depth || 0,
    bonus: weekend.seasonMult,
  });
  refreshAccountUI();
  showGameOver({
    pseudo: getPseudo(),
    level: player.level,
    wave: game.wave,
    waveLabel: `Vague · Coop ${party.members.length} joueurs`,
    xp: game.totalRunXp,
    gold: game.runGold,
    isNewRecord: false,
  });
  showSeasonGain(season, weekend);
  setOnlineStatus(reason || "Coop : partie hors classement mondial");
  coopRoundOver();
}

/** Fin de la partie coop sur cet appareil (accueil, ou retour au salon). */
function closeCoopRun() {
  stopSync();
  stopParty();
  showCoopHud(false);
  coopSettled = false;
}

/** REJOUER après une partie coop : retour au salon (le même groupe peut relancer). */
function backToCoopLobby() {
  if (game.started && !runReported) reportRun("coop", "abandon");
  game.started = game.running = false;
  closeCoopRun();
  showHud(false);
  playMenuMusic();
  openCoop();
}

/** Hôte : un invité a quitté la partie. */
function onCoopPeerLost(id) {
  const k = party.members.findIndex((m) => m.peerId === id);
  if (k < 0 || !inParty() || coopSettled) return;
  memberLeft(k);
  if (upMembers().length === 0 && game.started && !game.over) endCoop();
}

/** Hôte : (re)lance le duel chez les deux joueurs. */
function startOnlineDuel() {
  const names = [getPseudo(), net.peerName || "ADVERSAIRE"];
  const match = crypto.randomUUID(); // identifiant du duel, déclaré par les deux joueurs (classement ELO)
  sendGame({ t: "start", names, match, ranked: canRank(), rating: myDuelRating() });
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
    rival.rating = ratingOf(msg.rating);
    sendGame({ t: "ranked", on: canRank(), rating: myDuelRating() });
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
  const before = myDuelRating();
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
      setMyDuelRating(res.rating);
      showDuelRankChange(rankChangeText(before, res.rating), res.delta > 0);
      return showDuelElo(`${duelRankOf(res.rating).rank.name.toUpperCase()} · ${res.rating} ELO${delta}`);
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
  leaveCoopRoom(); // coop : quitter la partie (ou le salon) prévient les coéquipiers
  closeCoopRun();
  clearTimeout(overTimer);
  stopVersus();
  resetDuelPicks();
  showVersusHud(false);
  playMenuMusic();
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
  clearRun(); // partie finie : plus rien à reprendre
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
  const weekend = payRunRewards();
  recordBest("bestCombo", game.stats.bestCombo);
  if (game.daily) addStat("dailyRuns");
  recordCompletedRun();
  reportRun(lastMode, game.over ? game.killCam.killer?.name || "" : "");
  const rush = game.rush;
  showChallengeResult();
  const season = addRunSeasonXp({
    wave: rush ? 0 : game.wave,
    bosses: game.stats.bosses,
    kills: game.kills,
    difficulty: game.difficulty,
    pulse: game.endless?.depth || 0,
    bonus: weekend.seasonMult,
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
    showSeasonGain(season, weekend);
    setOnlineStatus("");
    return;
  }
  if (game.challenge) {
    // Défi entre amis : comparé au score de l'ami, hors classements (graine choisie par les joueurs)
    showGameOver({
      pseudo,
      level: player.level,
      wave: game.wave,
      waveLabel: "Vague · Défi entre amis",
      xp: game.totalRunXp,
      gold: game.runGold,
      isNewRecord: false,
    });
    showSeasonGain(season, weekend);
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
  showSeasonGain(season, weekend);

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

/** Écran de fin d'un défi entre amis : record, score de l'ami battu ou non, bouton pour le défier. */
function showChallengeResult() {
  const result = $("challengeResult");
  result.className = "challenge-result";
  result.textContent = "";
  setVisible("btnChallengeSend", !!game.challenge);
  if (!game.challenge) return;
  const { entry, isRecord, beat } = recordChallengeRun(game.challenge.code, {
    wave: game.wave,
    xp: game.totalRunXp,
  });
  if (beat) addStat("challengeWins");
  if (entry.target) {
    result.classList.add(beat ? "won" : "lost");
    result.textContent = beat
      ? `DÉFI RELEVÉ ! Tu bats ${entry.from || "ton ami"} (${scoreText(entry.target)})`
      : `Raté : ${entry.from || "ton ami"} reste devant (${scoreText(entry.target)})`;
  } else result.textContent = isRecord ? "Nouveau record du défi : envoie-le à un ami !" : "";
}

/**
 * Récompenses du compte pour la partie finie, bonus de l'événement du week-end compris
 * (services/weekendEvent.js : or et XP de compte en plus, multiplicateur de l'XP de saison).
 */
function payRunRewards() {
  const xp = Math.floor(game.totalRunXp);
  const bonus = weekendBonus({ xp, gold: game.runGold });
  addAccountRewards(xp + bonus.xp, game.runGold + bonus.gold);
  return bonus;
}

/** Écran de fin : XP de saison gagnée par la partie (voir services/season.js) et bonus du week-end. */
function showSeasonGain({ xp, firstOfDay }, weekend) {
  const bonus = firstOfDay ? " · bonus 1re partie du jour" : "";
  $("runSeasonGain").textContent = xp > 0 ? `+${xp} XP de saison${bonus}` : "";
  const ev = weekend?.event;
  const parts = [];
  if (weekend?.gold > 0) parts.push(`+${weekend.gold} or`);
  if (weekend?.xp > 0) parts.push(`+${weekend.xp} XP`);
  if (weekend?.seasonMult > 1) parts.push(`XP de saison ×${String(weekend.seasonMult).replace(".", ",")}`);
  const line = $("runWeekendGain");
  line.textContent = ev && parts.length ? `${ev.name} : ${parts.join(" · ")}` : "";
  line.style.color = ev?.color || "";
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
  challengeMenu: () => openChallenges(),
  questMenu: openQuests,
  seasonMenu: openSeason,
  bossRushMenu: openBossRush,
  duelMenu: openDuel,
  coopMenu: openCoop,
  friendsMenu: () => openFriends(),
  talentMenu: openTalents,
  cyberCoreMenu: openCyberCore,
  skinMenu: openSkins,
  loginMenu: () => (isOnlineEnabled() ? openLogin("mainMenu") : showMainMenu()),
  installMenu: () => openInstall("mainMenu"),
};

/** Retour / avancer du navigateur : ferme l'écran ouvert. En partie, ne quitte jamais la partie. */
function navigate(id) {
  const screen = currentScreen();
  if (!game.started) {
    if (screen === "friendsMenu") stopChallenge();
    if (screen === "coopMenu" && id !== "coopMenu") leaveCoopRoom();
    if (MENUS[id]) MENUS[id]();
    else if (screen === "loginMenu")
      closeLogin(); // ouverte depuis les options : retour aux options
    else if (screen === "chestReveal") showScreen("shopMenu");
    else if (screen === "installMenu")
      closeInstall(); // ouvert depuis les options : retour aux options
    else if (screen === "newsMenu") closeNews();
    else showMainMenu();
    return;
  }
  if (screen === null) {
    // En ligne, pas de pause (l'adversaire continue) : le retour arrière ne fait rien
    if (!versus.online && !inParty() && canTogglePause()) togglePause();
  } else if (screen === "pauseMenu") togglePause();
  else if (screen === "optionsMenu") closeOptions();
  else if (screen === "loginMenu") closeLogin();
  else if (screen === "installMenu") closeInstall();
  else if (screen === "newsMenu") closeNews();
  else if (screen === "shareMenu") showScreen("gameOver");
  else if (screen === "gameOver" || screen === "versusOver") returnToMenu();
  // amélioration et revivre : le choix reste à faire, l'adresse est simplement remise
}

// --- MISE À JOUR (un tick = 1/60 s) ---

function update() {
  if (versus.split) return updateSplit(simulate, tickDuelPick);
  if (party.role === "guest") return guestTick(); // coop, invité : l'hôte fait tourner la partie
  if (!game.running || game.paused) return;
  if (inParty() && remotePicksPending() > 0) return; // un coéquipier choisit une amélioration
  game.time += TICK_MS;
  ticking = true;
  try {
    if (inParty()) simulateCoop();
    else simulate();
    if (!versus.active && !inParty()) recordKillCam();
    updateTutorial();
    if (game.time >= nextSaveAt && game.running) persistRun();
  } finally {
    ticking = false;
    if (deathPending) onDeath(); // même si le tick a échoué : jamais de partie arrêtée sans écran
    if (coopEnding) endCoop();
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
  updateBlackMarket();
  updateAnomaly();
  updatePlayer();
  updateTrail();
  rebuildEnemyGrid();
  updateAura();
  updatePerks();
  updateMysteryBox();
  shoot();
  throwKunai();
  updateSideWeapons();
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
  updateGamepads(now); // manettes : lues avant les ticks de l'image (déplacement, dash...)
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
    if (party.role === "host") {
      if (!game.over) game.coopWaiting = coopWaiting();
      hostFrame(now);
    } else if (party.role === "guest") guestFrame(now);
    if (killCamActive()) drawKillCam(now);
    else render();
    // Qualité AUTO : seules les images où la partie tourne vraiment comptent (pas la pause ni un choix)
    if (game.running && !game.paused && !game.over) sampleFrame(now);
    else resetFrameProbe();
    if (!versus.split) updateHud();
    if (inParty()) updateCoopHud(now);
    if (versus.active) updateVersusHud();
    updateMusic(now);
  } else {
    accumulator = 0;
    resetFrameProbe();
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
    quality: isAutoQuality() ? `auto (${qualityLevel()})` : settings.quality,
  }));
  onAutoQualityChange((to, from, why) => logEvent("qualité", `auto : ${from} → ${to} (${why})`));
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
  initChallengeMenu({
    onPlay: () => {
      lastChallenge = currentChallenge();
      startGame("challenge");
    },
    onBack: (screen) => (screen === "dailyMenu" ? openDaily() : showMainMenu()),
  });
  $("btnChallengeSend").addEventListener("click", () => share(lastChallenge, "onlineStatus"));
  initBossRushMenu({ onPlay: () => startGame("rush"), onBack: showMainMenu });
  initTalentMenu({ onBack: showMainMenu, onChange: refreshAccountUI });
  initCyberCoreMenu({ onBack: openTalents, onChange: refreshAccountUI });
  initSkinMenu({ onBack: showMainMenu, onChange: refreshAccountUI });
  initUpgradeMenu();
  initBlackMarket();
  initDuelPicks();
  initAchievementMenu({ onBack: showMainMenu });
  initQuestMenu({ onBack: showMainMenu, onChange: refreshAccountUI });
  initSeasonMenu({ onBack: showMainMenu, onChange: refreshAccountUI });
  initNewsMenu();
  initStreakMenu({
    onClose: () => {
      showMainMenu();
      maybeAskPush(); // juste après la série du jour : le bon moment pour proposer un rappel
    },
  });

  $("btnResume").addEventListener("click", togglePause);
  $("btnQuit").addEventListener("click", quitRun);
  $("btnAbandon").addEventListener("click", abandonRun);
  initResumeRun({ onResume: resumeRun, onAbandon: abandonSavedRun });
  // Onglet masqué ou fermé (téléphone mis en veille, application quittée) : la partie est sauvegardée
  document.addEventListener("visibilitychange", () => document.hidden && persistRun());
  window.addEventListener("pagehide", persistRun);
  $("btnReplay").addEventListener("click", () =>
    lastMode === "coop" ? backToCoopLobby() : startGame(lastMode),
  );
  $("btnGameOverMenu").addEventListener("click", returnToMenu);
  initKillCamButton(() => startGame(lastMode)); // REJOUER directement depuis le ralenti
  initShareMenu();
  $("btnOptions").addEventListener("click", () => openOptions("mainMenu"));
  $("btnPauseOptions").addEventListener("click", () => openOptions("pauseMenu"));
  initOptionsMenu();
  initKeyBindings();
  initGamepadOptions();
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
    // Coop : la partie est commune, pas de pause ; on propose seulement de quitter
    if (inParty()) {
      if (!game.over && confirm("Quitter la partie coop ?")) returnToMenu();
      return;
    }
    if (canTogglePause()) togglePause();
  };
  onAction("pause", pause);
  const useSkillHere = () => {
    if (party.role === "guest") return game.running && !game.paused && requestSkill(); // l'hôte l'applique
    if (!game.running || game.paused || versus.split) return;
    if (inParty())
      withOwned(party.local, activateSkill); // coop : ce qu'elle crée appartient à ce joueur
    else activateSkill();
  };
  onAction("skill", useSkillHere);
  onAction("autoShoot", () => {
    if (party.role === "guest") player.autoShoot = toggleAuto();
    else if (game.started && !versus.split) player.autoShoot = !player.autoShoot;
  });

  initGamepadControls({
    useSkill,
    useSpell,
    // Manette débranchée en pleine partie : pause (sauf en ligne, où l'adversaire continue)
    onPadLost: () => {
      if (versus.online || currentScreen() !== null || !canTogglePause()) return;
      if (versus.split ? !versus.paused : !game.paused) togglePause();
    },
  });
  // B dans un menu = retour du navigateur (rien sur l'accueil)
  initPadNav({ onBack: () => currentScreen() !== "mainMenu" && navigate(null) });

  initTouchControls({
    onUltimate: useSkillHere,
    onPause: pause,
  });

  on("levelUp", () => {
    if (versus.split) return requestDuelPick(versus.current, "level");
    if (inParty() && !isLocalMember()) return requestRemotePick("level"); // coop : choix chez l'invité
    showUpgradeMenu();
  });
  on("bossChest", () => {
    if (versus.split) return requestDuelPick(versus.current, "chest");
    // Coop : chaque joueur choisit une augmentation dans le coffre du boss
    if (inParty()) {
      return forEachMember((k) => (k === party.local ? showBossChest() : requestRemotePick("chest")), {
        down: true,
      });
    }
    showBossChest();
  });
  on("blackMarket", showBlackMarket);
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
  $("btnCoop").addEventListener("click", openCoop);
  initCoopMenu({
    buildShip: buildCoopShip,
    startHost: startCoopHost,
    startGuest: startCoopGuest,
    onHostMessage: (msg) => (msg.t === "over" ? settleCoop(msg.reason || "") : onHostMessage(msg)),
    onGuestMessage,
    onPeerLost: onCoopPeerLost,
    onLost: () => {
      if (inParty() && !coopSettled) settleCoop("L'hôte a quitté la partie.");
    },
    inGame: () => game.started,
    onBack: showMainMenu,
  });
  onRemotePick((msg) => showRemoteChoice(msg, (name) => sendPick(msg.id, name)));
  on("memberDown", ({ k, name, last }) => {
    if (last) return;
    showBossWarning(k === party.local ? "À TERRE ! UN COÉQUIPIER PEUT TE RELEVER" : `${name} EST À TERRE !`);
  });
  on("memberRevived", ({ k, name }) => {
    showBossWarning(k === party.local ? "TU ES RELEVÉ !" : `${name} EST RELEVÉ !`, false, "#00ff88");
  });
  on("memberLeft", ({ name }) => showBossWarning(`${name} A QUITTÉ LA PARTIE`, false, "#aa66ff"));
  $("btnFriends").addEventListener("click", () => openFriends());
  $("btnVersusPause").addEventListener("click", pause);
  initDuelMenu({ onLocal: () => startDuel(), onBack: showMainMenu, onFriends: openFriends });
  initDuelRanking();
  initDuelRank();
  $("homeRank").addEventListener("click", () => openLeaderboard("duel"));
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
    if (inParty()) {
      holdUpgrades();
      if (ticking) coopEnding = true;
      else endCoop();
      return;
    }
    if (!versus.active) clearRun(); // mort : fermer l'onglet ne doit pas permettre de revenir en arrière
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
  on("anomaly", ({ name, desc, color }) => {
    if (versus.split) splitBanner(name, color);
    else showBossWarning(`ANOMALIE · ${name}`, false, color);
    addFloatingText(player.worldX, player.worldY - 90, desc, color, 16, 150);
  });
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
/** Série de connexion du jour à l'arrivée (sinon retour à l'accueil, après les nouveautés). */
function offerArrivalStreak() {
  if (account.achievementStats.runs > 0 && offerLoginStreak()) return true;
  if (currentScreen() !== "mainMenu") showMainMenu();
  return false;
}

function enterHome() {
  showMainMenu();
  playMenuMusic(); // démarre à la première interaction (exigence des navigateurs)
  // Première ouverture depuis l'icône de l'écran d'accueil : cadeau de bienvenue (une fois par compte)
  const installGold = claimInstallReward();
  if (installGold) {
    showToast(`Merci d'avoir installé Last Pulse : +${installGold} or`, "coin");
    refreshAccountUI();
    renderApp();
  }
  const challengeLink = takeChallengeLink(); // lien « #defi=... » d'un ami : lu avant que le routeur n'efface l'adresse
  initRouter({ navigate, getCurrent: currentScreen, deepLinks: Object.keys(MENUS) });
  if (challengeLink) {
    openChallenges({ link: challengeLink });
    requestAnimationFrame(frame);
    finishLoading();
    return;
  }
  announceRolledOver(); // nouveau mois : récompenses de la saison passée données d'office
  // Nouveautés d'une mise à jour, puis série de connexion (pas à un tout nouveau joueur, qui commence par
  // le tutoriel) : proposées à l'arrivée sur l'accueil, l'une après l'autre
  if (currentScreen() === "mainMenu") offerNews(offerArrivalStreak) || offerArrivalStreak();
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
