// Musique : les pistes du menu (fichiers de `MUSIC.tracks`, enchaînées au hasard) et, en partie, les
// musiques synthétisées de data/music.js choisies selon le moment (biome, boss, boss final, Endless Pulse).
// Le changement se fait en fondu, calé sur le temps de la musique précédente.

import { ENDLESS, MUSIC } from "../config.js";
import { game, world } from "../core/state.js";
import { biomeForWave } from "../data/biomes.js";
import { SONGS } from "../data/music.js";
import { randomItem } from "../utils/math.js";
import { getAudio, onAudioUnlock } from "./audioContext.js";
import { createMusicBus, MusicSequencer } from "./musicSequencer.js";
import { onSettingsChange, settings } from "./settings.js";

/**
 * Musique à jouer pour l'état de partie `g` (null = silence : partie finie ou arrêtée).
 * @param {any} g état `game`
 * @param {any[]} enemies
 * @returns {string | null} clé de `SONGS`
 */
export function musicThemeFor(g, enemies) {
  if (!g.started || !g.running || g.over) return null;
  let boss = g.pendingBosses?.[0]?.type || null; // boss annoncé : la musique change dès l'alerte
  for (const e of enemies) {
    if (e.dead || !e.template?.isBoss) continue;
    boss = e.type;
    if (boss === ENDLESS.finalBoss) break;
  }
  if (boss === ENDLESS.finalBoss) return "final";
  if (boss || g.rush) return "boss";
  if (g.endless) return "endless";
  return biomeForWave(g.wave).id;
}

const menuTrack = new Audio();
menuTrack.addEventListener("ended", () => {
  menuTrack.removeAttribute("src"); // piste suivante tirée au hasard
  playMenuTrack();
});

/** @type {"menu" | "game" | null} */
let scene = null;
let adPause = false;
let lastCheck = -Infinity;
/** @type {GainNode | null} volume de la musique synthétisée */
let bus = null;
/** @type {{ theme: string, seq: MusicSequencer } | null} */
let current = null;
/** @type {MusicSequencer[]} musiques en train de s'effacer */
const fading = [];
let timer = 0;

function playMenuTrack() {
  if (scene !== "menu" || adPause || settings.musicVolume <= 0 || MUSIC.tracks.length === 0) return;
  if (!menuTrack.getAttribute("src")) menuTrack.src = MUSIC.dir + randomItem(MUSIC.tracks);
  // Le navigateur peut bloquer la lecture tant qu'il n'y a pas eu d'interaction (relancée au déblocage).
  menuTrack.play().catch(() => {});
}

/** Accueil et menus : pistes du menu. */
export function playMenuMusic() {
  scene = "menu";
  stopSong();
  playMenuTrack();
}

/** Début d'une partie : la musique suit ensuite la partie (`updateMusic` à chaque image). */
export function startRunMusic() {
  scene = "game";
  menuTrack.pause();
  lastCheck = -Infinity;
  updateMusic();
}

export function stopMusic() {
  scene = null;
  menuTrack.pause();
  stopSong();
}

/** À chaque image en partie : change de musique quand le moment change (vérifié toutes les `checkMs`). */
export function updateMusic(now = performance.now()) {
  if (scene !== "game" || now - lastCheck < MUSIC.checkMs) return;
  lastCheck = now;
  const theme = settings.musicVolume > 0 ? musicThemeFor(game, world.enemies) : null;
  if (theme !== (current?.theme ?? null)) playSong(theme);
  applyVolume();
}

/** Musique en cours (tests, journal de diagnostic). */
export function currentMusic() {
  return scene === "menu" ? "menu" : current?.theme || null;
}

function playSong(theme) {
  const ctx = getAudio();
  if (!ctx) return; // pas encore d'interaction : réessayé à la vérification suivante
  if (!theme) return stopSong();
  if (!bus) {
    bus = createMusicBus(ctx, ctx.destination);
    bus.gain.value = 0;
  }
  const start = Math.max(current ? current.seq.nextBeat() : 0, ctx.currentTime + 0.05);
  const fadeIn = current ? MUSIC.crossfade : MUSIC.fadeIn;
  stopSong(start);
  const seq = new MusicSequencer(ctx, bus, SONGS[theme], { light: settings.quality === "low" });
  seq.start(start, fadeIn);
  current = { theme, seq };
  applyVolume();
  if (!timer) timer = window.setInterval(tick, MUSIC.timerMs);
  tick();
}

/** Efface la musique synthétisée en cours (à `time`, sinon tout de suite). */
function stopSong(time) {
  if (!current) return;
  const ctx = current.seq.ctx;
  current.seq.stop(time ?? ctx.currentTime, MUSIC.fadeOut);
  fading.push(current.seq);
  current = null;
}

/** Programme les notes un peu à l'avance ; débranche les musiques éteintes. */
function tick() {
  const ctx = getAudio();
  if (!ctx) return;
  const until = ctx.currentTime + MUSIC.lookahead;
  current?.seq.schedule(until);
  for (let i = fading.length - 1; i >= 0; i--) {
    const seq = fading[i];
    if (seq.finished) {
      seq.disconnect();
      fading.splice(i, 1);
    } else seq.schedule(until);
  }
  if (!current && fading.length === 0) {
    clearInterval(timer);
    timer = 0;
  }
}

/** Volume : réglage du joueur, baissé en pause, coupé pendant une pub. */
function applyVolume() {
  menuTrack.volume = settings.musicVolume;
  if (!bus) return;
  const duck = game.paused ? MUSIC.pauseDuck : 1;
  const level = adPause ? 0 : settings.musicVolume * MUSIC.synthVolume * duck;
  bus.gain.setTargetAtTime(level, bus.context.currentTime, 0.08);
}

onSettingsChange((s) => {
  applyVolume();
  if (s.musicVolume <= 0) menuTrack.pause();
  else if (menuTrack.paused) playMenuTrack();
  lastCheck = -Infinity; // en partie : la musique s'arrête ou reprend à l'image suivante
});

// Première interaction : la musique du menu peut enfin démarrer (celle de la partie suit à l'image suivante).
onAudioUnlock(() => {
  if (menuTrack.paused) playMenuTrack();
  lastCheck = -Infinity;
});

/** Coupe la musique le temps d'une publicité, puis la relance si elle jouait. */
export function pauseMusicForAd() {
  adPause = true;
  menuTrack.pause();
  applyVolume();
}

export function resumeMusicAfterAd() {
  adPause = false;
  playMenuTrack();
  applyVolume();
}
