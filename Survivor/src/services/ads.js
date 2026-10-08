// Publicités récompensées : le joueur choisit de regarder une vidéo pour obtenir un bonus
// (revivre, coffre en plus). La récompense n'est donnée que si la pub va jusqu'au bout.
// Pour brancher une vraie régie, ajouter son adaptateur dans PROVIDERS : une fonction
// async qui joue la pub et renvoie true si elle a été regardée en entier.

import { ADS } from "../config.js";
import { pauseMusicForAd, resumeMusicAfterAd } from "./audio.js";

const PROVIDERS = {
  none: async () => false,
  demo: playDemoAd,
};

let playing = false;

export function adsEnabled() {
  return ADS.provider !== "none" && !!PROVIDERS[ADS.provider];
}

/** Joue une pub récompensée ; renvoie true si la récompense est méritée. */
export async function showRewardedAd(placement) {
  if (playing || !adsEnabled()) return false;
  playing = true;
  pauseMusicForAd();
  try {
    return await PROVIDERS[ADS.provider](placement);
  } catch (err) {
    console.warn("Publicité indisponible :", err);
    return false;
  } finally {
    playing = false;
    resumeMusicAfterAd();
  }
}

/** Fausse pub plein écran (compte à rebours), fermable avant la fin sans récompense. */
function playDemoAd() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "adOverlay";
    overlay.innerHTML = `
      <div class="ad-box">
        <span class="ad-tag">PUBLICITÉ · DÉMO</span>
        <p class="ad-title">Votre pub ici</p>
        <p class="ad-text">Emplacement de démonstration : une vraie régie publicitaire le remplacera.</p>
        <div class="ad-bar"><div class="ad-bar-fill"></div></div>
        <p class="ad-timer"></p>
        <button class="secondary ad-close">FERMER (sans récompense)</button>
      </div>`;
    document.body.append(overlay);
    const fill = overlay.querySelector(".ad-bar-fill");
    const timer = overlay.querySelector(".ad-timer");
    const start = performance.now();
    let frame;

    const finish = (rewarded) => {
      cancelAnimationFrame(frame);
      overlay.remove();
      resolve(rewarded);
    };
    const tick = () => {
      const elapsed = performance.now() - start;
      const left = Math.max(0, ADS.demoDurationMs - elapsed);
      fill.style.width = `${Math.min(100, (elapsed / ADS.demoDurationMs) * 100)}%`;
      timer.textContent = `Récompense dans ${Math.ceil(left / 1000)} s`;
      if (left <= 0) finish(true);
      else frame = requestAnimationFrame(tick);
    };
    overlay.querySelector(".ad-close").addEventListener("click", () => finish(false));
    tick();
  });
}
