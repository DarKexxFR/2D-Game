// Accès au DOM : cache des éléments + écritures uniquement si la valeur change
// (le HUD est mis à jour à chaque frame, on évite ainsi les reflows inutiles).

const cache = new Map();

export function $(id) {
  let el = cache.get(id);
  if (!el) {
    el = document.getElementById(id);
    cache.set(id, el);
  }
  return el;
}

export function setText(id, value) {
  const el = $(id);
  const text = String(value);
  if (el._text !== text) {
    el._text = text;
    el.textContent = text;
  }
}

export function setWidth(id, ratio) {
  const el = $(id);
  const width = (Math.max(0, Math.min(1, ratio)) * 100).toFixed(1) + "%";
  if (el._width !== width) {
    el._width = width;
    el.style.width = width;
  }
}

export function setVisible(id, visible) {
  const el = $(id);
  if (el._visible !== visible) {
    el._visible = visible;
    el.style.display = visible ? "block" : "none";
  }
}

export function isVisible(id) {
  return $(id).style.display === "block";
}

/** Crée un élément avec des classes et un contenu texte (sans innerHTML). */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
