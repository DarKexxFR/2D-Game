// Icônes du jeu : dessinées à la main dans Figma (fichier « Last Pulse — Icônes »), exportées en SVG dans
// design/icons/ puis converties par `npm run icons` en tracés (data/iconPaths.js, fichier généré).
// Grille 24 × 24 ; `s` = tracé au trait (épaisseur ICON_STROKE, bouts ronds), `f` = parties pleines.
// Utilisées dans les menus (ui/icons.js) et sur le canvas (render/icons.js).

import { ICON_PATHS } from "./iconPaths.js";

/** Tracés des icônes par nom (nom = nom du fichier SVG). */
export const ICONS = ICON_PATHS;

/** Côté de la grille des icônes (viewBox 0 0 24 24). */
export const ICON_GRID = 24;
/** Épaisseur du trait, en unités de la grille. */
export const ICON_STROKE = 2;

/** Nom d'icône existant (sinon « unknown »). */
export function iconName(name) {
  return ICONS[name] ? name : "unknown";
}
