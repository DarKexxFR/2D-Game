// Biomes : chacun couvre une plage de vagues (`from` à `to`) et ajoute ses ennemis. Après le dernier
// (vague 40, fin de l'aventure), les biomes reviennent en boucle tous les `BIOME_LOOP` vagues.
// Nouveau biome = une entrée de plus (plages qui se suivent, sans trou).

export const BIOME_LOOP = 5; // Endless Pulse : vagues par biome une fois l'aventure finie

export const BIOMES = [
  {
    id: "neon",
    from: 1,
    to: 6,
    name: "CITÉ NÉON",
    color: "#00ffff",
    tint: "rgba(10, 0, 25, 0.35)",
    grid: "rgba(157, 0, 255, 0.12)",
    gridMajor: "rgba(0, 220, 255, 0.16)",
    enemies: [
      { type: "shield", weight: 0.12 }, // bloque les tirs de face
      { type: "swarm", weight: 0.1 }, // arrive en nuée de petits drones
    ],
  },
  {
    id: "desert",
    from: 7,
    to: 12,
    name: "DÉSERT ROUGE",
    color: "#ff7a00",
    tint: "rgba(60, 12, 0, 0.55)",
    grid: "rgba(255, 80, 0, 0.12)",
    gridMajor: "rgba(255, 170, 0, 0.2)",
    enemies: [{ type: "scorpion", weight: 0.25 }],
  },
  {
    id: "ice",
    from: 13,
    to: 18,
    name: "TOUNDRA DE GLACE",
    color: "#9fe8ff",
    tint: "rgba(0, 25, 50, 0.55)",
    grid: "rgba(0, 160, 255, 0.13)",
    gridMajor: "rgba(190, 240, 255, 0.22)",
    enemies: [{ type: "golem", weight: 0.2 }],
  },
  {
    id: "jungle",
    from: 19,
    to: 24,
    name: "JUNGLE TOXIQUE",
    color: "#7dff3a",
    tint: "rgba(10, 40, 0, 0.55)",
    grid: "rgba(90, 255, 40, 0.11)",
    gridMajor: "rgba(200, 255, 60, 0.18)",
    enemies: [
      { type: "spore", weight: 0.2 }, // se divise en sporelets
      { type: "bomber", weight: 0.12 }, // pose des mines
    ],
  },
  {
    id: "station",
    from: 25,
    to: 30,
    name: "STATION ORBITALE",
    color: "#c58bff",
    tint: "rgba(20, 5, 45, 0.55)",
    grid: "rgba(170, 102, 255, 0.13)",
    gridMajor: "rgba(255, 120, 230, 0.2)",
    enemies: [
      { type: "blinker", weight: 0.18 }, // se téléporte près du joueur
      { type: "laser_drone", weight: 0.12 }, // tire un laser annoncé
    ],
  },
  {
    id: "rift",
    from: 31,
    to: 35,
    name: "FAILLE QUANTIQUE",
    color: "#ff3bf0",
    tint: "rgba(40, 0, 45, 0.55)",
    grid: "rgba(255, 59, 240, 0.12)",
    gridMajor: "rgba(0, 255, 230, 0.2)",
    enemies: [
      { type: "phaser", weight: 0.18 }, // devient intouchable par moments
      { type: "replicator", weight: 0.12 }, // se copie s'il n'est pas tué à temps
    ],
  },
  {
    id: "core",
    from: 36,
    to: 40,
    name: "NOYAU STELLAIRE",
    color: "#ffd27a",
    tint: "rgba(55, 18, 0, 0.55)",
    grid: "rgba(255, 210, 122, 0.12)",
    gridMajor: "rgba(255, 70, 70, 0.2)",
    enemies: [
      { type: "fuser", weight: 0.16 }, // deux qui se touchent fusionnent
      { type: "nova", weight: 0.12 }, // fonce puis explose dans une zone annoncée
    ],
  },
];

/** Dernière vague de l'aventure (fin du dernier biome) : au-delà, les biomes reviennent en boucle. */
export const LAST_BIOME_WAVE = BIOMES[BIOMES.length - 1].to;

/** @param {number} wave */
export function biomeForWave(wave) {
  const biome = BIOMES.find((b) => wave >= b.from && wave <= b.to);
  if (biome) return biome;
  const loop = Math.floor((wave - LAST_BIOME_WAVE - 1) / BIOME_LOOP);
  return BIOMES[((loop % BIOMES.length) + BIOMES.length) % BIOMES.length];
}
