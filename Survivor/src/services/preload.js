// Ressources attendues avant d'afficher l'accueil (voir ui/loadingScreen.js). Rien ne bloque
// indéfiniment : chaque attente a un plafond (LOADING dans config.js) et une erreur ne fait que passer.

import { LOADING } from "../config.js";

/** Attend une promesse au plus `ms` millisecondes ; renvoie false si le délai est dépassé ou si elle échoue. */
export function settleWithin(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    Promise.resolve(promise)
      .then(() => resolve(true))
      .catch(() => resolve(false))
      .finally(() => clearTimeout(timer));
  });
}

/**
 * Polices du jeu : sans elles, les textes changeraient de forme sous les yeux du joueur et les
 * sprites qui contiennent du texte (dessinés une fois, en cache) garderaient la police de secours.
 */
export function loadFonts() {
  if (!document.fonts?.load) return Promise.resolve(true);
  return settleWithin(
    Promise.all(LOADING.fonts.map((font) => document.fonts.load(font))),
    LOADING.fontTimeoutMs,
  );
}

/** Images déjà dans la page (logo, icônes de l'accueil…) : décodées avant d'être montrées. */
export function loadImages(root = document) {
  const images = [...root.querySelectorAll("img")].filter((img) => img.loading !== "lazy");
  const ready = images.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => {})));
  return settleWithin(Promise.all(ready), LOADING.imageTimeoutMs);
}
