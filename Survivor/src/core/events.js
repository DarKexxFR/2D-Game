// Petit bus d'événements : permet aux systèmes de jeu de prévenir l'UI
// (montée de niveau, mort, alerte boss...) sans dépendre directement d'elle.

const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event).push(fn);
}

export function emit(event, payload) {
  const fns = listeners.get(event);
  if (fns) for (const fn of fns) fn(payload);
}
