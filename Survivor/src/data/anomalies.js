// Anomalies de biome : une particularité physique du terrain, active pendant toutes les vagues d'un
// biome (6 vagues, puis à chaque retour du biome en Endless Pulse). Une entrée par anomalie, rattachée
// à son biome par `biome` ; son comportement vit dans systems/anomalies/<id>.js et son dessin dans
// render/anomalies.js. Biome sans entrée = terrain neutre.
// Nouvelle anomalie = une entrée ici + un module dans systems/anomalies/ (déclaré dans index.js)
// + une fonction de dessin dans render/anomalies.js.

/**
 * @typedef {object} AnomalyDef
 * @property {string} id identifiant (= nom du module dans systems/anomalies/)
 * @property {string} biome id du biome (data/biomes.js)
 * @property {string} name nom annoncé
 * @property {string} desc phrase courte annoncée sous le nom
 * @property {string} color
 */

export const ANOMALIES = {
  // Toundra de glace : plaques de verglas. Dessus, le vaisseau va 30 % plus vite mais glisse.
  ice: {
    id: "ice",
    biome: "ice",
    name: "PLAQUES DE VERGLAS",
    desc: "Vitesse +30 % mais le vaisseau glisse",
    color: "#bff4ff",
    plates: 10, // nombre de plaques sur la carte entière (moins dans une arène de boss)
    platesInArena: 4,
    size: [120, 210], // rayon des plaques (px)
    speed: 1.3, // vitesse ×1,3 sur la glace
    grip: 0.05, // part de la vitesse voulue reprise à chaque tick (petit = glisse longtemps)
    dashGrip: 0.3, // en dash, le vaisseau reprend la main plus vite
  },
  // Station orbitale : tourelles neutres. Rester 3 s à côté les pirate : elles tirent sur les ennemis.
  turrets: {
    id: "turrets",
    biome: "station",
    name: "TOURELLES PIRATABLES",
    desc: "Reste 3 s près d'une tourelle pour la pirater",
    color: "#c58bff",
    hackedColor: "#00ff88",
    count: 6, // sur la carte entière
    countInArena: 3,
    radius: 110, // rayon de piratage autour de la tourelle
    hack: 180, // 3 s à côté
    decay: 2, // la jauge redescend 2× plus vite qu'elle ne monte quand on s'éloigne
    duration: 900, // 15 s piratée
    cooldown: 600, // 10 s avant de pouvoir la pirater à nouveau
    range: 650,
    fireMs: 260, // une salve toutes les 260 ms de jeu
    damage: 0.9, // × attaque du joueur
    speed: 15,
  },
  // Faille quantique : 4 portails aux coins de la zone de combat, chacun envoie au coin opposé.
  portals: {
    id: "portals",
    biome: "rift",
    name: "PORTAILS QUANTIQUES",
    desc: "Un portail dans chaque coin mène au coin opposé",
    color: "#ff3bf0",
    exitColor: "#00ffe6",
    inset: 170, // distance des murs
    radius: 46,
    rearm: 1.6, // il faut sortir de ce rayon (× radius) du portail d'arrivée pour réutiliser un portail
    cooldown: 45, // ticks minimum entre deux passages
  },
};

/** @param {string} biomeId @returns {AnomalyDef & Record<string, any> | null} */
export function anomalyForBiome(biomeId) {
  return Object.values(ANOMALIES).find((a) => a.biome === biomeId) ?? null;
}
