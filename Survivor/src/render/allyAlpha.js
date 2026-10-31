// Filtre d'opacité des tirs alliés (Options > « Tirs alliés ») : en fin de partie, les armes fusionnées
// remplissent l'écran de néon. Ce facteur multiplie l'alpha de ce que le joueur tire (projectiles, armes
// d'appoint, éclairs, compétences) ; les tirs ennemis et les attaques de boss restent toujours à 100 %.

import { SHOT_OPACITY } from "../config.js";
import { settings } from "../services/settings.js";

/** Facteur d'opacité des tirs du joueur, borné entre `SHOT_OPACITY.min` et 1. */
export function allyAlpha() {
  const v = Number(settings.shotOpacity);
  if (!(v > 0)) return 1;
  return Math.min(1, Math.max(SHOT_OPACITY.min, v));
}
