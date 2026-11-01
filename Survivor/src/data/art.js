// Illustrations des menus (assets/art/, WebP à fond transparent, sans texte) : grandes et fixes, elles
// habillent les fiches d'équipement et du bestiaire. Jamais en jeu : là, tout est dessiné en code
// (recoloration, flash d'impact, skins, 0 octet à charger ; choix du propriétaire).

/** Objets de l'équipement (id de data/items.js) → illustration. */
export const ITEM_ART = {
  pilot: "hero-pilot",
  ninja: "hero-ninja",
  titan: "hero-titan",
  seraph: "hero-seraph",
  plasma: "weapon-plasma",
  tesla: "weapon-tesla",
  frost: "item-frost-crystal",
  phoenix: "pet-phoenix",
};

/** Ennemis (type de data/enemies.js) → illustration de leur fiche du bestiaire. */
export const ENEMY_ART = {
  miniboss: "boss-crab",
  boss: "boss-eye",
  pulse_core: "boss-pulse-core",
};

/**
 * Image d'une illustration (chargée seulement à l'affichage), ou null s'il n'y en a pas.
 * @param {string | undefined} name
 * @param {string} className
 */
export function artImage(name, className) {
  if (!name) return null;
  const img = document.createElement("img");
  img.className = className;
  img.src = `assets/art/${name}.webp`;
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  return img;
}
