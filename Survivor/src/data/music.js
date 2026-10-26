// Musiques du jeu, composées en données et jouées par le séquenceur (services/musicSequencer.js) :
// une piste par biome, une pour les boss, une pour le Cœur du Pulse et une pour l'Endless Pulse.
// Ajouter une musique = une entrée de `SONGS` (et, pour un nouveau moment du jeu, une règle dans
// `musicThemeFor` de services/audio.js). Rien à télécharger : tout est synthétisé en direct.
//
// Écriture des motifs : une mesure = 16 caractères (doubles croches), « . » = silence,
// « - » = prolonge la note précédente. Un motif peut être une liste de mesures, jouées à tour de rôle.
// - kick / snare / hat / tom / fill : « x » = coup, « X » = coup accentué (`fill` remplace la caisse
//   claire sur la dernière mesure de chaque passage).
// - bass : « x » = fondamentale de l'accord, « o » = octave, « 5 » = quinte.
// - arp : rang dans l'accord (0 à 3, puis 4 à 7 = une octave au-dessus).
// - lead (mélodie) : degré de la gamme en base 36 (0 = tonique, 7 = tonique une octave plus haut...).
// Accords (`chords`, un par mesure) : demi-tons au-dessus de la tonique + qualité (m, M, m7, M7, dim, sus).
// `form` : couches jouées à chaque passage de la grille d'accords, en boucle (« all » = toutes).

export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};

/** Notes de chaque qualité d'accord (4 notes : les arpèges vont chercher la 4e). */
export const CHORD_TONES = {
  m: [0, 3, 7, 12],
  M: [0, 4, 7, 12],
  m7: [0, 3, 7, 10],
  M7: [0, 4, 7, 11],
  dim: [0, 3, 6, 12],
  sus: [0, 5, 7, 12],
};

/** Couches qu'un séquenceur sait jouer (ordre sans importance). */
export const LAYERS = ["kick", "snare", "hat", "tom", "bass", "arp", "lead", "pad"];

/**
 * Sons par défaut ; chaque musique peut en changer une partie (`sound`). `octave` = décalage en octaves
 * depuis la tonique (`key`, numéro MIDI de la basse).
 */
export const DEFAULT_SOUND = {
  drums: { volume: 0.9, kick: 1, snare: 1, hat: 1, tom: 1 }, // volume général, puis par pièce
  bass: { wave: "sawtooth", volume: 0.2, cutoff: 700, cutoffEnd: 260, resonance: 4, octave: 0, gate: 0.8 },
  arp: { wave: "square", volume: 0.06, cutoff: 2400, octave: 2, gate: 0.6, echo: 0.35 },
  lead: { wave: "sawtooth", volume: 0.09, cutoff: 3200, detune: 8, attack: 0.02, octave: 2, echo: 0.3 },
  pad: { wave: "sawtooth", volume: 0.045, cutoff: 1100, detune: 12, attack: 0.4, release: 0.6, octave: 1 },
};

/**
 * @typedef {object} Song
 * @property {string} name
 * @property {number} bpm
 * @property {number} key tonique (numéro MIDI, octave de la basse)
 * @property {number[]} scale
 * @property {string} chords un accord par mesure, séparés par des espaces
 * @property {string[]} form
 * @property {boolean} [pump] nappe et basse « respirent » sur la grosse caisse (effet synthwave)
 * @property {Record<string, string | string[]>} patterns
 * @property {Record<string, object>} [sound]
 */

/** @type {Record<string, Song>} */
export const SONGS = {
  // Synthwave classique : la mineur, grosse caisse régulière, basse en octaves.
  neon: {
    name: "Cité néon",
    bpm: 112,
    key: 45,
    scale: SCALES.minor,
    chords: "0m7 8M7 3M 10M 0m7 8M7 3M 10M",
    form: ["pad arp bass kick", "all", "all", "pad arp bass hat lead"],
    pump: true,
    patterns: {
      kick: "x...x...x...x...",
      snare: "....x.......x...",
      fill: "....x.......x.xx",
      hat: "..x...x...x...x.",
      bass: "x.xox.xox.xox.xo",
      arp: "0124012401240124",
      lead: [
        "b-..9-..7-..9.b.",
        "c-..b-..9-..7...",
        "9-..b-..d-..b.9.",
        "a---8-..6-......",
        "b-..9-..7-..9.b.",
        "c-..e-..c-..b...",
        "d-..b-..9-..b.d.",
        "d---a---8-------",
      ],
    },
  },
  // Désert rouge : gamme orientale (phrygien dominant), rythme lourd et chaloupé.
  desert: {
    name: "Désert rouge",
    bpm: 100,
    key: 38,
    scale: SCALES.phrygianDominant,
    chords: "0M 1M 0M 10m 0M 1M 5m 0M",
    form: ["pad bass kick hat arp", "all", "all", "pad bass hat lead"],
    patterns: {
      kick: "x.....x...x.....",
      snare: "....x.......x...",
      fill: "....x.......x.xx",
      hat: "x.x.x.x.x.x.x.x.",
      tom: "...........x..x.",
      bass: "x..x..x.x..x..x.",
      arp: "0.2.4.2.0.2.4.2.",
      lead: [
        "7.8.9.8.7---4...",
        "8---7.5.4---....",
        "4.5.4.2.0---....",
        "6.5.4.5.6---....",
        "7.8.9.a.9.8.7...",
        "8---8.7.5---....",
        "a---9.8.7.5.3...",
        "7-------........",
      ],
    },
    sound: {
      arp: { wave: "triangle", volume: 0.08, octave: 2 },
      lead: { wave: "square", volume: 0.07, detune: 6, cutoff: 2200 },
    },
  },
  // Toundra : lent et aérien, cloches aiguës, batterie en demi-temps.
  ice: {
    name: "Toundra de glace",
    bpm: 88,
    key: 40,
    scale: SCALES.minor,
    chords: "0m 8M7 3M 10M 5m 8M7 3M 10M",
    form: ["pad arp", "pad arp bass kick hat", "all", "all"],
    patterns: {
      kick: "x.........x.....",
      snare: "........x.......",
      fill: "........x...x.x.",
      hat: "..x...x...x...x.",
      bass: "x-------x---o---",
      arp: "0.2.4.2.5.2.4.2.",
      lead: [
        "b-------9---7---",
        "9-------b---7---",
        "9---b---d-------",
        "a-------8-------",
        "c-------a---7---",
        "b-------9-------",
        "9---a---b-------",
        "a---------------",
      ],
    },
    sound: {
      bass: { wave: "triangle", volume: 0.26, cutoff: 500, cutoffEnd: 400, resonance: 1, gate: 1 },
      arp: { wave: "triangle", volume: 0.09, octave: 3, gate: 0.4, echo: 0.45 },
      lead: { wave: "sine", volume: 0.13, detune: 0, attack: 0.05, octave: 2, echo: 0.45 },
      pad: { wave: "triangle", volume: 0.08, cutoff: 1800, attack: 0.8, release: 1.2 },
    },
  },
  // Jungle toxique : tribal, toms et basse « acide » (filtre résonant qui se referme).
  jungle: {
    name: "Jungle toxique",
    bpm: 124,
    key: 43,
    scale: SCALES.dorian,
    chords: "0m 0m 5M 5M 0m 0m 3M 5M",
    form: ["kick tom hat bass", "kick tom hat bass snare arp pad", "all", "all"],
    patterns: {
      kick: "x..x..x...x..x..",
      snare: "....x..x....x...",
      fill: "....x..x....xxxx",
      hat: "x.xxx.xxx.xxx.xx",
      tom: "..x..x....x..x.x",
      bass: "x.xx.x.ox.x.xo.x",
      arp: "0.24.20.4.20.42.",
      lead: [
        "7.9.7...b.9.7...",
        "b.a.9.7.....4.6.",
        "a.c.a...e.c.a...",
        "e.c.a.c.e---....",
        "7.9.7...b.9.7...",
        "b.a.9.7.....4.6.",
        "9.b.9...d.b.9...",
        "a.c.e---c.a.....",
      ],
    },
    sound: {
      drums: { volume: 0.75, kick: 1, snare: 1, hat: 1, tom: 0.7 },
      bass: { cutoff: 1800, cutoffEnd: 180, resonance: 7, gate: 0.5, volume: 0.12 },
      arp: { wave: "sawtooth", volume: 0.05, cutoff: 1600 },
      lead: { wave: "square", volume: 0.07, detune: 0, cutoff: 2000 },
    },
  },
  // Station orbitale : lumineux et spatial (lydien), arpèges rapides, beaucoup d'écho.
  station: {
    name: "Station orbitale",
    bpm: 116,
    key: 38,
    scale: SCALES.lydian,
    chords: "0M7 2M 9m 4m 0M7 2M 9m 2M",
    form: ["pad arp", "pad arp bass kick hat", "all", "all"],
    pump: true,
    patterns: {
      kick: "x...x...x...x...",
      snare: "....x.......x...",
      fill: "....x.......x.xx",
      hat: "xxXxxxXxxxXxxxXx",
      bass: "x...x.o.x...x.o.",
      arp: "0124214201242142",
      lead: [
        "9-..b-..d---b...",
        "a-..8-..c---a...",
        "c---9---7---9---",
        "9-..b-..d---b---",
        "9-..b-..d---b...",
        "a-..8-..c---a...",
        "c-..e-..g---e...",
        "f-------a-------",
      ],
    },
    sound: {
      arp: { wave: "square", volume: 0.05, cutoff: 3000, octave: 2, gate: 0.4, echo: 0.5 },
      lead: { wave: "triangle", volume: 0.12, detune: 5, octave: 2, echo: 0.45 },
      drums: { volume: 0.9, kick: 1, snare: 1, hat: 0.6, tom: 1 },
    },
  },
  // Boss : rapide et agressif (phrygien), basse en doubles croches.
  boss: {
    name: "Combat de boss",
    bpm: 140,
    key: 36,
    scale: SCALES.phrygian,
    chords: "0m 1M 0m 8M 0m 1M 8M 10m",
    form: ["kick bass hat snare pad", "all", "all", "kick bass hat snare arp pad"],
    patterns: {
      kick: "x...x...x...x...",
      snare: "....x.......x...",
      fill: "....x...x.x.xxxx",
      hat: "..x...x...x...X.",
      bass: "xxxoxxxoxxxoxxxo",
      arp: "0240240240240242",
      lead: [
        "7.7.9.7.b-..9.7.",
        "8-..a-..8.7.5...",
        "7.7.9.7.b-..c.b.",
        "c---b---9---7---",
        "e.e.c.b.e-..c.b.",
        "f---e---c---a---",
        "c-b-9-7-5-7-9-b-",
        "d-------a-------",
      ],
    },
    sound: {
      bass: { cutoff: 1100, cutoffEnd: 300, resonance: 5, gate: 0.55, volume: 0.17 },
      lead: { volume: 0.08, cutoff: 2600, detune: 14 },
      pad: { volume: 0.04, cutoff: 900 },
    },
  },
  // Cœur du Pulse (boss final) : grosse caisse en battements de cœur, mineur harmonique épique.
  final: {
    name: "Cœur du Pulse",
    bpm: 150,
    key: 38,
    scale: SCALES.harmonicMinor,
    chords: "0m 8M 5m 7M 0m 3M 8M 7M",
    form: ["kick pad bass", "all", "all", "kick pad bass arp hat"],
    patterns: {
      kick: "x.x.....x.x.....",
      snare: "....x.......x...",
      fill: "....x.......xxxx",
      hat: "xxxxxxxxxxxxxxxx",
      tom: "..............x.",
      bass: "x.x.x.x.x.x.x.x.",
      arp: "0124012401240124",
      lead: [
        "7---9---b---9---",
        "c---b---9---7---",
        "a---c---e---c---",
        "d-------b---8---",
        "e---c---b---9-b-",
        "9---b---9---7---",
        "c---e---c---9---",
        "d---------------",
      ],
    },
    sound: {
      lead: { volume: 0.1, cutoff: 2800, detune: 12, attack: 0.03 },
      arp: { volume: 0.045 },
      pad: { volume: 0.05, cutoff: 1400 },
      drums: { volume: 0.9, kick: 1, snare: 1, hat: 0.45, tom: 1 },
    },
  },
  // Endless Pulse : hypnotique, quatre temps et arpège continu qui respire avec la grosse caisse.
  endless: {
    name: "Endless Pulse",
    bpm: 128,
    key: 40,
    scale: SCALES.minor,
    chords: "0m 0m 8M 10M 0m 0m 8M 10M",
    form: ["pad arp kick bass", "all", "all", "pad arp bass hat"],
    pump: true,
    patterns: {
      kick: "x...x...x...x...",
      snare: "....x.......x...",
      fill: "....x.......x.xx",
      hat: "..x...x...x...x.",
      bass: ".xx..xx..xx..xx.",
      arp: "0247024702470247",
      lead: [
        "7.......9-......",
        "b-......9-......",
        "9.......b-......",
        "a-......8-......",
        "7.......9-......",
        "b-......c-......",
        "e-......b-......",
        "a---------------",
      ],
    },
    sound: {
      lead: { wave: "square", volume: 0.07, detune: 6, echo: 0.5 },
    },
  },
};
