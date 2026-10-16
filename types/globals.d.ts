// Types des globales ajoutées par le jeu ou par des scripts tiers (vérification JSDoc + checkJs).
// Ce fichier n'est jamais chargé par le navigateur : il ne sert qu'à `npm run typecheck`.

interface Window {
  /** Posé par transfer.js quand le joueur part vers last-pulse.com (le jeu ne démarre pas). */
  __lastPulseLeaving?: boolean;
  /** AudioContext préfixé des anciens Safari. */
  webkitAudioContext?: typeof AudioContext;
  /** File d'attente du script AdSense (H5 Games Ads). */
  adsbygoogle?: unknown[];
  adBreak?: (o: object) => void;
  adConfig?: (o: object) => void;
}
