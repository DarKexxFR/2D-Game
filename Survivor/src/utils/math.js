export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export const angleTo = (fromX, fromY, toX, toY) => Math.atan2(toY - fromY, toX - fromX);

export const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Tire un élément selon son poids. `weightOf(item)` renvoie un nombre >= 0. */
export function weightedPick(items, weightOf) {
  let total = 0;
  for (const it of items) total += weightOf(it);
  let roll = Math.random() * total;
  for (const it of items) {
    roll -= weightOf(it);
    if (roll <= 0) return it;
  }
  return items[items.length - 1];
}

/** Supprime en place les éléments pour lesquels `pred` est vrai (O(n), sans allocation). */
export function removeWhere(arr, pred) {
  let w = 0;
  for (let r = 0; r < arr.length; r++) {
    const item = arr[r];
    if (!pred(item)) arr[w++] = item;
  }
  arr.length = w;
}
