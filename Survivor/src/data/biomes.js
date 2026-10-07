// Biomes : le décor change toutes les 10 vagues (en boucle) et chacun ajoute son ennemi.

export const BIOME_LENGTH = 10; // vagues par biome

export const BIOMES = [
  {
    id: "neon",
    name: "CITÉ NÉON",
    color: "#00ffff",
    tint: "rgba(10, 0, 25, 0.35)",
    grid: "rgba(157, 0, 255, 0.12)",
    gridMajor: "rgba(0, 220, 255, 0.16)",
    enemy: null,
  },
  {
    id: "desert",
    name: "DÉSERT ROUGE",
    color: "#ff7a00",
    tint: "rgba(60, 12, 0, 0.55)",
    grid: "rgba(255, 80, 0, 0.12)",
    gridMajor: "rgba(255, 170, 0, 0.2)",
    enemy: { type: "scorpion", weight: 0.25 },
  },
  {
    id: "ice",
    name: "TOUNDRA DE GLACE",
    color: "#9fe8ff",
    tint: "rgba(0, 25, 50, 0.55)",
    grid: "rgba(0, 160, 255, 0.13)",
    gridMajor: "rgba(190, 240, 255, 0.22)",
    enemy: { type: "golem", weight: 0.2 },
  },
];

export function biomeForWave(wave) {
  return BIOMES[Math.floor((wave - 1) / BIOME_LENGTH) % BIOMES.length];
}
