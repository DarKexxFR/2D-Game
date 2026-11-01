// Effets néon activés ? Réglage du joueur (Options > Effets visuels) ET qualité qui les permet
// (la qualité basse, le « mode économie », les coupe tous).

import { gfx } from "../core/gfx.js";
import { settings } from "../services/settings.js";

/** @param {"fxGrid" | "fxBloom" | "fxCrt" | "fxChroma"} key */
export function fxEnabled(key) {
  if (key === "fxCrt") return settings.fxCrt !== false; // calque CSS : aucun coût, garde en qualité basse
  return gfx.fx && settings[key] !== false;
}
