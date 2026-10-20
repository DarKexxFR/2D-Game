// Petit bus d'événements : permet aux systèmes de jeu de prévenir l'UI
// (montée de niveau, mort, alerte boss...) sans dépendre directement d'elle.

const listeners = new Map();
/** @type {((event: string, payload: any) => void)[]} */
const taps = [];

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event).push(fn);
}

/** Écoute tous les événements (journal de diagnostic), appelé avant les écouteurs de l'événement. */
export function onAny(fn) {
  taps.push(fn);
}

export function emit(event, payload) {
  for (const tap of taps) tap(event, payload);
  const fns = listeners.get(event);
  if (fns) for (const fn of fns) fn(payload);
}
