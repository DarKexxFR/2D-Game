// Niveaux de qualité graphique (menu Options). Les ombres lumineuses (shadowBlur)
// sont de loin le plus coûteux : elles sont coupées en qualité basse.
// Module à part (sans canvas ni DOM) : les sprites s'en servent aussi hors du jeu (bestiaire.html).

// `fx` : effets néon réglables (grille élastique, halo, aberration), tous coupés en qualité basse (mode économie).
export const QUALITY = {
  low: { shadows: false, particles: 0.3, maxPixelRatio: 1, damageNumbers: false, fx: false },
  medium: { shadows: true, particles: 0.6, maxPixelRatio: 1, damageNumbers: true, fx: true },
  high: { shadows: true, particles: 1, maxPixelRatio: 1.5, damageNumbers: true, fx: true },
};
export const gfx = { ...QUALITY.high };
