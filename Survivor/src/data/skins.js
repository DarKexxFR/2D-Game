// Personnalisation du vaisseau (écran « Skins ») : forme de la coque, couleurs du vaisseau, des tirs
// et de la traînée. Purement cosmétique, sans effet en duel (chaque joueur y garde sa couleur).
// Chaque option a un identifiant d'achat (`hull:manta`, `trail:sparks`...) ; prix 0 = offerte.
// `season: true` = exclusive du passe de saison : jamais en vente, gagnée à un palier (data/season.js).

/** Formes de coque (tracés dans render/entities.js, HULLS). "hero" = celle du héros équipé. */
export const SKIN_HULLS = [
  { id: "hero", name: "Du héros", price: 0 },
  { id: "arrow", name: "Flèche", price: 0 },
  { id: "dart", name: "Dard", price: 300 },
  { id: "heavy", name: "Bélier", price: 300 },
  { id: "orb", name: "Sphère", price: 300 },
  { id: "corsair", name: "Corsaire", price: 300 },
  { id: "engineer", name: "Atelier", price: 300 },
  { id: "spectre", name: "Spectre", price: 300 },
  { id: "manta", name: "Manta", price: 800 },
  { id: "needle", name: "Aiguille", price: 800 },
  { id: "trident", name: "Trident", price: 1200 },
  { id: "phoenix", name: "Phénix", price: 1500 },
  { id: "star", name: "Étoile", price: 2000 },
  // Exclusives du passe de saison (data/season.js) : ne s'achètent pas, se gagnent
  { id: "nova", name: "Nova", price: 0, season: true },
  { id: "blaze", name: "Brasier", price: 0, season: true },
  { id: "rift", name: "Faille", price: 0, season: true },
  { id: "thunder", name: "Foudre", price: 0, season: true },
];

/** Traînées laissées par le vaisseau quand il bouge (dessinées dans render/entities.js). */
export const SKIN_TRAILS = [
  { id: "none", name: "Aucune", price: 0 },
  { id: "ribbon", name: "Ruban", price: 0 },
  { id: "dots", name: "Particules", price: 300 },
  { id: "sparks", name: "Étincelles", price: 600 },
  { id: "rings", name: "Anneaux", price: 800 },
  { id: "flames", name: "Flammes", price: 1000 },
  { id: "pixels", name: "Pixels", price: 1200 },
  // Exclusives du passe de saison
  { id: "comet", name: "Comète", price: 0, season: true },
  { id: "embers", name: "Braises", price: 0, season: true },
  { id: "hex", name: "Hexagones", price: 0, season: true },
  { id: "bolt", name: "Éclairs", price: 0, season: true },
];

/** Couleurs offertes. `null` = couleur par défaut (héros, arme), "rainbow" = arc-en-ciel animé. */
export const SKIN_COLORS = [
  "#00ffff",
  "#00ccff",
  "#3d7bff",
  "#aa66ff",
  "#ff00ff",
  "#ff2a6d",
  "#ff3344",
  "#ff7a1a",
  "#ffd700",
  "#c6ff00",
  "#00ff88",
  "#ffffff",
];
export const RAINBOW = "rainbow";
/** Achat qui débloque la couleur arc-en-ciel pour toutes les pièces. */
export const RAINBOW_UNLOCK = { id: "rainbow", name: "Arc-en-ciel", price: 1500 };

/** Pièces personnalisables : forme, puis une couleur par élément. */
export const SKIN_PARTS = [
  { key: "hull", title: "Forme", kind: "hull" },
  { key: "ship", title: "Couleur du vaisseau", kind: "color", fallback: "Héros" },
  { key: "shot", title: "Couleur des tirs", kind: "color", fallback: "Arme" },
  { key: "trail", title: "Traînée", kind: "trail" },
  { key: "trailColor", title: "Couleur de la traînée", kind: "color", fallback: "Vaisseau" },
];

export const DEFAULT_SKIN = { hull: "hero", ship: null, shot: null, trail: "none", trailColor: null };

/** Réglages des traînées : durée de vie (ticks) et fréquence d'apparition. */
export const TRAIL = { life: 26, every: 2, max: 60 };
