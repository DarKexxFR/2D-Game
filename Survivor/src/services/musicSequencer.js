// Séquenceur : joue une musique de data/music.js sur un contexte audio. Il programme les notes un peu
// à l'avance (`schedule(jusqu'à)`, appelé par de petites minuteries dans services/audio.js) pour que
// le rythme reste exact même quand une image du jeu prend du retard.

import { CHORD_TONES, DEFAULT_SOUND, LAYERS } from "../data/music.js";
import { hat, kick, snare, tom, voice } from "./synth.js";

const STEPS = 16; // doubles croches par mesure

/** @typedef {import("../data/music.js").Song} Song */
/** @typedef {{ value: string, length: number } | null} Cell */

/** Une mesure écrite (« x.x-... ») devient 16 cases : la note et sa durée en pas, ou null. */
function parseBar(text) {
  /** @type {Cell[]} */
  const cells = [];
  for (let i = 0; i < STEPS; i++) {
    const ch = text[i] || ".";
    if (ch === "." || ch === "-") {
      cells.push(null);
      continue;
    }
    let length = 1;
    while (text[i + length] === "-") length++;
    cells.push({ value: ch, length });
  }
  return cells;
}

/** Musique prête à jouer : accords, motifs et sons décodés une fois pour toutes. */
export function compileSong(song) {
  const chords = song.chords.split(/\s+/).map((token) => {
    const [, root, quality] = /^(\d+)(.+)$/.exec(token) || [];
    const tones = CHORD_TONES[quality];
    if (!tones) throw new Error(`Accord inconnu « ${token} » (${song.name})`);
    return { root: Number(root), tones };
  });
  /** @type {Record<string, Cell[][]>} */
  const patterns = {};
  for (const [layer, bars] of Object.entries(song.patterns)) {
    patterns[layer] = (Array.isArray(bars) ? bars : [bars]).map(parseBar);
  }
  const form = song.form.map((text) => new Set(text === "all" ? LAYERS : text.split(/\s+/)));
  /** @type {Record<string, any>} */
  const sound = {};
  for (const [part, base] of Object.entries(DEFAULT_SOUND)) sound[part] = { ...base, ...song.sound?.[part] };
  return { song, chords, patterns, form, sound, stepTime: 60 / song.bpm / 4, bars: chords.length };
}

/**
 * Entrée commune des musiques : un volume, puis un compresseur qui évite toute saturation quand
 * plusieurs couches se superposent.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} destination
 */
export function createMusicBus(ctx, destination) {
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.connect(destination);
  const bus = ctx.createGain();
  bus.connect(limiter);
  return bus;
}

export class MusicSequencer {
  /**
   * @param {BaseAudioContext} ctx
   * @param {AudioNode} destination
   * @param {Song} song
   * @param {{ light?: boolean }} [options] light = appareil modeste : un oscillateur par note, sans écho
   */
  constructor(ctx, destination, song, { light = false } = {}) {
    this.ctx = ctx;
    this.c = compileSong(song);
    this.light = light;
    this.step = 0;
    this.next = 0;
    /** @type {number | null} */
    this.stopAt = null;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(destination);
    // Nappe et basse passent par `pumped`, qui s'efface à chaque grosse caisse si la musique « respire ».
    this.pumped = ctx.createGain();
    this.pumped.connect(this.out);
    this.buses = { drums: this.out, bass: this.pumped, pad: this.pumped, arp: this.out, lead: this.out };
    if (!light) this.addEcho();
  }

  /** Écho réglé sur le tempo (croche pointée), partagé par l'arpège et la mélodie. */
  addEcho() {
    const { ctx, c } = this;
    const delay = ctx.createDelay(2);
    delay.delayTime.value = c.stepTime * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.35;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2500;
    delay.connect(tone).connect(feedback).connect(delay);
    tone.connect(this.out);
    for (const part of ["arp", "lead"]) {
      const bus = ctx.createGain();
      bus.connect(this.out);
      const send = ctx.createGain();
      send.gain.value = c.sound[part].echo || 0;
      bus.connect(send).connect(delay);
      this.buses[part] = bus;
    }
  }

  /** Démarre à `time` (début d'un temps), avec une montée du volume. */
  start(time, fadeIn = 0.05) {
    this.next = time;
    this.out.gain.setValueAtTime(0, time);
    this.out.gain.linearRampToValueAtTime(1, time + fadeIn);
  }

  /** S'efface à partir de `time`, puis se débranche. */
  stop(time, fadeOut = 1) {
    if (this.stopAt !== null) return;
    this.stopAt = time + fadeOut;
    const gain = this.out.gain;
    gain.cancelScheduledValues(time);
    gain.setValueAtTime(gain.value, time);
    gain.linearRampToValueAtTime(0, time + fadeOut);
  }

  get finished() {
    return this.stopAt !== null && this.ctx.currentTime > this.stopAt + 0.5;
  }

  disconnect() {
    this.out.disconnect();
  }

  /** Début du prochain temps (pour enchaîner une autre musique sans casser le rythme). */
  nextBeat() {
    const left = (4 - (this.step % 4)) % 4;
    return this.next + left * this.c.stepTime;
  }

  /**
   * Programme les notes jusqu'à `until`. Si la minuterie a pris trop de retard (onglet ralenti, gros
   * blocage), les pas manqués sont sautés plutôt que joués tous d'un coup.
   */
  schedule(until) {
    const { stepTime } = this.c;
    const now = this.ctx.currentTime;
    if (this.next < now) {
      const missed = Math.ceil((now - this.next) / stepTime);
      this.step += missed;
      this.next += missed * stepTime;
    }
    const end = this.stopAt ?? Infinity;
    while (this.next < until && this.next < end) {
      this.playStep(this.step, this.next);
      this.step++;
      this.next += stepTime;
    }
  }

  /** Joue le pas n° `n` (compté depuis le début) à l'instant `t`. */
  playStep(n, t) {
    const { c, ctx, buses } = this;
    const { sound, stepTime } = c;
    const bar = Math.floor(n / STEPS);
    const s = n % STEPS;
    const barInPass = bar % c.bars;
    const layers = c.form[Math.floor(bar / c.bars) % c.form.length];
    const chord = c.chords[barInPass];
    const key = c.song.key;
    const cell = (layer) => {
      const bars = c.patterns[layer];
      return layers.has(layer) && bars ? bars[barInPass % bars.length][s] : null;
    };

    const drums = sound.drums;
    const level = (hit, piece) => drums.volume * drums[piece] * (hit.value === "X" ? 1.3 : 1);
    const k = cell("kick");
    if (k) {
      kick(ctx, buses.drums, t, level(k, "kick"));
      if (c.song.pump) this.pump(t);
    }
    const lastBar = barInPass === c.bars - 1 && c.patterns.fill;
    const sn = lastBar ? (layers.has("snare") ? c.patterns.fill[0][s] : null) : cell("snare");
    if (sn) snare(ctx, buses.drums, t, level(sn, "snare"));
    const h = cell("hat");
    if (h) hat(ctx, buses.drums, t, level(h, "hat"));
    const tm = cell("tom");
    if (tm) tom(ctx, buses.drums, t, level(tm, "tom"), s < 8 ? 1 : 0.8);

    const b = cell("bass");
    if (b) {
      const offset = b.value === "o" ? 12 : b.value === "5" ? 7 : 0;
      const note = key + sound.bass.octave * 12 + chord.root + offset;
      this.play(buses.bass, t, note, b.length * stepTime * sound.bass.gate, sound.bass);
    }
    const a = cell("arp");
    if (a) {
      const i = Number(a.value);
      const note = key + sound.arp.octave * 12 + chord.root + chord.tones[i % 4] + 12 * Math.floor(i / 4);
      this.play(buses.arp, t, note, a.length * stepTime * sound.arp.gate, sound.arp);
    }
    const l = cell("lead");
    if (l) {
      const degree = parseInt(l.value, 36);
      const scale = c.song.scale;
      const note =
        key + sound.lead.octave * 12 + scale[degree % scale.length] + 12 * Math.floor(degree / scale.length);
      this.play(buses.lead, t, note, l.length * stepTime * 0.95, sound.lead);
    }
    if (s === 0 && layers.has("pad")) {
      const tones = this.light ? chord.tones.slice(0, 3) : chord.tones;
      const base = key + sound.pad.octave * 12 + chord.root;
      for (const tone of tones) this.play(buses.pad, t, base + tone, STEPS * stepTime, sound.pad);
    }
  }

  play(bus, t, note, duration, options) {
    voice(this.ctx, bus, t, note, duration, this.light ? { ...options, detune: 0 } : options);
  }

  /** « Respiration » synthwave : nappe et basse s'effacent sur la grosse caisse puis reviennent. */
  pump(t) {
    const gain = this.pumped.gain;
    gain.setValueAtTime(0.35, t);
    gain.linearRampToValueAtTime(1, t + this.c.stepTime * 3);
  }
}
