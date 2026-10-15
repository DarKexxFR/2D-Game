// Biomes : le décor change toutes les `BIOME_LENGTH` vagues (en boucle) et chacun ajoute ses ennemis.

export const BIOME_LENGTH = 6; // vagues par biome : les 5 biomes défilent avant la vague 30

export const BIOMES = [
  {
    id: "neon",
    name: "CITÉ NÉON",
    color: "#00ffff",
    tint: "rgba(10, 0, 25, 0.35)",
    grid: "rgba(157, 0, 255, 0.12)",
    gridMajor: "rgba(0, 220, 255, 0.16)",
    enemies: [],
  },
  {
    id: "desert",
    name: "DÉSERT ROUGE",
    color: "#ff7a00",
    tint: "rgba(60, 12, 0, 0.55)",
    grid: "rgba(255, 80, 0, 0.12)",
    gridMajor: "rgba(255, 170, 0, 0.2)",
    enemies: [{ type: "scorpion", weight: 0.25 }],
  },
  {
    id: "ice",
    name: "TOUNDRA DE GLACE",
    color: "#9fe8ff",
    tint: "rgba(0, 25, 50, 0.55)",
    grid: "rgba(0, 160, 255, 0.13)",
    gridMajor: "rgba(190, 240, 255, 0.22)",
    enemies: [{ type: "golem", weight: 0.2 }],
  },
  {
    id: "jungle",
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
];

export function biomeForWave(wave) {
  return BIOMES[Math.floor((wave - 1) / BIOME_LENGTH) % BIOMES.length];
}
