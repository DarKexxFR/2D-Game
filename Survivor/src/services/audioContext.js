// Contexte audio partagé par les effets sonores (services/sfx.js) et la musique (services/audio.js).
// Les navigateurs ne le laissent démarrer qu'après une interaction : `unlockAudio` est appelé au
// premier clic / toucher / touche, puis prévient les modules qui attendaient le son.

/** @type {AudioContext | null} */
let audio = null;
/** @type {Array<(ctx: AudioContext) => void>} */
const listeners = [];

/** Contexte audio, ou null tant qu'aucune interaction ne l'a débloqué (ou si le navigateur n'en a pas). */
export function getAudio() {
  return audio;
}

/** À appeler lors d'une interaction (clic, toucher, touche) : les navigateurs l'exigent. */
export function unlockAudio() {
  if (!audio) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio = new Ctx();
  }
  if (audio.state === "suspended" && !document.hidden) audio.resume();
  for (const fn of listeners) fn(audio);
}

/** Appelé à chaque déblocage (une interaction) : la musique du menu peut alors démarrer. */
export function onAudioUnlock(fn) {
  listeners.push(fn);
}

// Onglet caché : tout le son est suspendu (la musique est programmée à l'avance par de petites
// minuteries, que le navigateur ralentit en arrière-plan), puis repris au retour.
document.addEventListener("visibilitychange", () => {
  if (!audio) return;
  if (document.hidden) audio.suspend().catch(() => {});
  else audio.resume().catch(() => {});
});
