// Instruments de la musique synthétisée (Web Audio, aucun fichier). Chaque fonction programme UNE note
// à l'instant `t` sur n'importe quel contexte (le jeu, ou un OfflineAudioContext pour les tests et
// les aperçus) : quelques nœuds créés puis jetés par le navigateur à la fin de la note.

/** @typedef {BaseAudioContext} Ctx */

/** @type {WeakMap<Ctx, AudioBuffer>} */
const noiseBuffers = new WeakMap();

/** Bruit blanc de 1 s, créé une fois par contexte (les percussions en lisent un morceau). */
function noiseBuffer(ctx) {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

/** Fréquence d'une note MIDI (69 = la 440 Hz). */
export function midiToHz(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/** Grosse caisse : sinus dont la hauteur chute très vite. */
export function kick(ctx, out, t, volume = 1) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  gain.gain.setValueAtTime(0.9 * volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 0.34);
}

/** Tom : comme la grosse caisse, plus aigu (percussions de la jungle, battements du boss final). */
export function tom(ctx, out, t, volume = 1, pitch = 1) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(220 * pitch, t);
  osc.frequency.exponentialRampToValueAtTime(110 * pitch, t + 0.18);
  gain.gain.setValueAtTime(0.5 * volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 0.24);
}

/** Bruit filtré : caisse claire (passe-bande grave) ou charleston (passe-haut aigu, très court). */
function noiseHit(ctx, out, t, { duration, volume, type, frequency }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  src.connect(filter).connect(gain).connect(out);
  src.start(t, Math.random() * 0.5, duration + 0.02);
}

export function snare(ctx, out, t, volume = 1) {
  noiseHit(ctx, out, t, { duration: 0.18, volume: 0.45 * volume, type: "bandpass", frequency: 1800 });
  const body = ctx.createOscillator();
  const gain = ctx.createGain();
  body.type = "triangle";
  body.frequency.setValueAtTime(190, t);
  gain.gain.setValueAtTime(0.25 * volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  body.connect(gain).connect(out);
  body.start(t);
  body.stop(t + 0.12);
}

export function hat(ctx, out, t, volume = 1) {
  noiseHit(ctx, out, t, { duration: 0.05, volume: 0.16 * volume, type: "highpass", frequency: 7000 });
}

/**
 * @typedef {object} VoiceOptions
 * @property {OscillatorType} [wave]
 * @property {number} [volume]
 * @property {number} [attack] montée (s)
 * @property {number} [release] extinction après la durée de la note (s)
 * @property {number} [cutoff] filtre passe-bas (Hz) au début de la note
 * @property {number} [cutoffEnd] filtre à la fin de la note (balayage « acide »), sinon fixe
 * @property {number} [resonance] résonance du filtre (Q)
 * @property {number} [detune] deuxième oscillateur désaccordé de tant de cents (son plus large), 0 = un seul
 */

/**
 * Note mélodique (basse, arpège, mélodie, nappe) : un ou deux oscillateurs, un passe-bas, une enveloppe.
 * @param {Ctx} ctx
 * @param {AudioNode} out
 * @param {number} t
 * @param {number} note numéro MIDI
 * @param {number} duration
 * @param {VoiceOptions} o
 */
export function voice(ctx, out, t, note, duration, o) {
  const { wave = "sawtooth", volume = 0.2, attack = 0.005, release = 0.08, resonance = 1, detune = 0 } = o;
  const end = t + duration;
  const level = detune ? volume * 0.7 : volume; // deux oscillateurs : même volume perçu
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = resonance;
  filter.frequency.setValueAtTime(o.cutoff || 4000, t);
  if (o.cutoffEnd) filter.frequency.exponentialRampToValueAtTime(o.cutoffEnd, end);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(level, t + attack);
  gain.gain.setValueAtTime(level, Math.max(t + attack, end));
  gain.gain.exponentialRampToValueAtTime(0.0001, end + release);
  filter.connect(gain).connect(out);
  const hz = midiToHz(note);
  for (const cents of detune ? [-detune, detune] : [0]) {
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = hz;
    osc.detune.value = cents;
    osc.connect(filter);
    osc.start(t);
    osc.stop(end + release + 0.02);
  }
}
