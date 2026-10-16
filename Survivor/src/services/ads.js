// Publicités récompensées : le joueur choisit de regarder une vidéo pour obtenir un bonus
// (revivre, coffre en plus). La récompense n'est donnée que si la pub va jusqu'au bout.
// Pour brancher une vraie régie, ajouter son adaptateur dans PROVIDERS : une fonction
// async qui joue la pub et renvoie true si elle a été regardée en entier.

import { ADS } from "../config.js";
import { pauseMusicForAd, resumeMusicAfterAd } from "./audio.js";

const PROVIDERS = {
  none: async () => false,
  demo: playDemoAd,
  adsense: playAdSenseAd,
};

let playing = false;

export function adsEnabled() {
  if (ADS.provider === "adsense" && !ADS.adsense.client) return false;
  return ADS.provider !== "none" && !!PROVIDERS[ADS.provider];
}

/** Au démarrage : charge la régie choisie pour que la première pub soit prête plus vite. */
export function initAds() {
  if (ADS.provider === "adsense" && adsEnabled()) loadAdSense().catch(() => {});
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
    const fill = /** @type {HTMLElement} */ (overlay.querySelector(".ad-bar-fill"));
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

// --- AdSense H5 Games Ads (Ad Placement API) ---
// Doc : https://developers.google.com/ad-placement — réservé aux comptes acceptés dans la bêta.

let adsenseReady = null;

/** Charge le script AdSense une seule fois et prépare adBreak / adConfig. */
function loadAdSense() {
  if (adsenseReady) return adsenseReady;
  window.adsbygoogle = window.adsbygoogle || [];
  window.adBreak = window.adConfig = (o) => window.adsbygoogle.push(o);
  adsenseReady = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS.adsense.client}`;
    if (ADS.adsense.testMode) script.dataset.adbreakTest = "on";
    script.onload = resolve;
    script.onerror = () => {
      adsenseReady = null; // nouvel essai à la prochaine pub (bloqueur, réseau)
      reject(new Error("script AdSense bloqué ou injoignable"));
    };
    document.head.append(script);
  });
  window.adConfig({ preloadAdBreaks: "on", sound: "on" });
  return adsenseReady;
}

/**
 * Pub récompensée AdSense. Le joueur a déjà choisi de la regarder (bouton du jeu) :
 * on la lance dès que Google la propose. Récompense seulement si adViewed est appelé.
 * Pas de pub disponible (notReady, frequencyCapped…) ou pas de réponse : pas de récompense.
 */
async function playAdSenseAd(placement) {
  await loadAdSense();
  return new Promise((resolve) => {
    let rewarded = false;
    let started = false;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      resolve(rewarded);
    };
    // Si la régie ne propose rien (bloqueur), on n'attend pas indéfiniment
    const timeout = setTimeout(() => {
      if (!started) finish();
    }, ADS.adsense.loadTimeoutMs);
    window.adBreak({
      type: "reward",
      name: placement,
      beforeReward: (showAdFn) => {
        started = true;
        showAdFn();
      },
      adViewed: () => (rewarded = true),
      adDismissed: () => (rewarded = false),
      adBreakDone: finish,
    });
  });
}
