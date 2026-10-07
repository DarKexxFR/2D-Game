// Effets sonores synthétisés avec la Web Audio API (aucun fichier à charger).
// Chaque son a un intervalle minimum pour éviter la cacophonie quand tout explose.

import { settings } from "./settings.js";

let audio = null;
let master = null;
const lastPlayed = {};

/** À appeler lors d'une interaction (clic, toucher) : les navigateurs l'exigent. */
export function unlockAudio() {
  if (!audio) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio = new Ctx();
    master = audio.createGain();
    master.connect(audio.destination);
  }
  if (audio.state === "suspended") audio.resume();
}

function tone({ type = "square", from, to = from, duration, volume = 0.3, delay = 0 }) {
  const t = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + duration);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + duration);
}

function noise({ duration, volume = 0.3, filter = 1200 }) {
  const t = audio.currentTime;
  const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * duration), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const lp = audio.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = filter;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  src.connect(lp).connect(gain).connect(master);
  src.start(t);
}

const SOUNDS = {
  shoot: { gap: 70, play: () => tone({ from: 880, to: 440, duration: 0.06, volume: 0.06 }) },
  hit: { gap: 40, play: () => tone({ type: "triangle", from: 300, to: 200, duration: 0.05, volume: 0.08 }) },
  kill: { gap: 50, play: () => tone({ type: "triangle", from: 520, to: 120, duration: 0.12, volume: 0.12 }) },
  explosion: { gap: 90, play: () => noise({ duration: 0.35, volume: 0.35, filter: 900 }) },
  hurt: { gap: 150, play: () => tone({ type: "sawtooth", from: 180, to: 60, duration: 0.2, volume: 0.25 }) },
  pickup: { gap: 45, play: () => tone({ type: "sine", from: 1200, to: 1800, duration: 0.05, volume: 0.05 }) },
  dash: { gap: 100, play: () => noise({ duration: 0.15, volume: 0.15, filter: 3000 }) },
  levelUp: {
    gap: 300,
    play: () =>
      [523, 659, 784, 1047].forEach((f, i) =>
        tone({ type: "square", from: f, duration: 0.12, volume: 0.12, delay: i * 0.07 }),
      ),
  },
  ultimate: {
    gap: 300,
    play: () => {
      noise({ duration: 0.6, volume: 0.45, filter: 600 });
      tone({ type: "sawtooth", from: 120, to: 40, duration: 0.6, volume: 0.3 });
    },
  },
  boss: { gap: 1000, play: () => tone({ type: "sawtooth", from: 90, to: 70, duration: 1.2, volume: 0.3 }) },
  chest: {
    gap: 200,
    play: () =>
      [784, 988, 1175, 1568].forEach((f, i) =>
        tone({ type: "triangle", from: f, duration: 0.18, volume: 0.15, delay: i * 0.09 }),
      ),
  },
  death: { gap: 1000, play: () => tone({ type: "sawtooth", from: 400, to: 40, duration: 1, volume: 0.3 }) },
  click: { gap: 30, play: () => tone({ type: "sine", from: 660, duration: 0.04, volume: 0.08 }) },

  // --- Boss vaincu, combos ---
  bossDown: {
    gap: 800,
    play: () => {
      noise({ duration: 1.1, volume: 0.5, filter: 500 });
      [392, 523, 659, 784].forEach((f, i) =>
        tone({ type: "square", from: f, duration: 0.25, volume: 0.12, delay: 0.25 + i * 0.1 }),
      );
    },
  },
  combo: {
    gap: 250,
    play: () =>
      [880, 1175].forEach((f, i) =>
        tone({ type: "square", from: f, duration: 0.08, volume: 0.1, delay: i * 0.06 }),
      ),
  },

  // --- Compétences des héros ---
  skillNinja: {
    gap: 300,
    play: () => {
      noise({ duration: 0.25, volume: 0.2, filter: 5000 });
      tone({ type: "sine", from: 1800, to: 600, duration: 0.25, volume: 0.12 });
    },
  },
  skillTitan: {
    gap: 300,
    play: () => {
      noise({ duration: 0.9, volume: 0.55, filter: 300 });
      tone({ type: "sine", from: 70, to: 30, duration: 0.9, volume: 0.45 });
    },
  },
  skillMage: {
    gap: 300,
    play: () =>
      [1047, 1319, 1568, 2093].forEach((f, i) =>
        tone({ type: "sine", from: f, to: f / 2, duration: 0.3, volume: 0.1, delay: i * 0.05 }),
      ),
  },
  meteor: { gap: 80, play: () => noise({ duration: 0.3, volume: 0.3, filter: 700 }) },
  skillPirate: {
    gap: 300,
    play: () => {
      noise({ duration: 0.5, volume: 0.6, filter: 1500 });
      tone({ type: "triangle", from: 150, to: 50, duration: 0.4, volume: 0.35 });
    },
  },

  // --- Familiers ---
  petLaser: {
    gap: 120,
    play: () => tone({ type: "sine", from: 1500, to: 2200, duration: 0.05, volume: 0.04 }),
  },
  petHeal: {
    gap: 500,
    play: () =>
      [660, 880].forEach((f, i) =>
        tone({ type: "sine", from: f, duration: 0.12, volume: 0.08, delay: i * 0.08 }),
      ),
  },
  petSlash: { gap: 90, play: () => noise({ duration: 0.08, volume: 0.1, filter: 6000 }) },
};

export function playSfx(name) {
  if (!audio || settings.sfxVolume <= 0) return;
  const sound = SOUNDS[name];
  const now = performance.now();
  if (now - (lastPlayed[name] || 0) < sound.gap) return;
  lastPlayed[name] = now;
  master.gain.value = settings.sfxVolume;
  sound.play();
}

/** Vibration courte sur mobile (si activée et supportée). */
export function vibrate(pattern) {
  if (settings.vibration && navigator.vibrate) navigator.vibrate(pattern);
}

export const canVibrate = "vibrate" in navigator;
