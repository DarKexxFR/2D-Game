// Icônes néon dans le DOM : <span class="ico"><svg>…</svg></span>, taille = font-size,
// couleur = color (la lueur suit la couleur).

import { ICONS } from "../data/icons.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Crée une icône ; `color` facultatif (sinon couleur du texte parent). */
export function icon(name, color) {
  const span = document.createElement("span");
  span.className = "ico";
  if (color) span.style.color = color;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", ICONS[name] || ICONS.unknown);
  svg.append(path);
  span.append(svg);
  return span;
}

/** Remplit un élément avec du texte suivi (ou précédé) d'une icône. */
export function setLabel(node, text, name, { before = false, color } = {}) {
  const parts = [document.createTextNode(text), icon(name, color)];
  if (before) parts.reverse();
  node.replaceChildren(...parts);
  return node;
}

/** Remplace chaque <i data-icon="nom"> statique de la page par l'icône correspondante. */
export function hydrateIcons(root = document) {
  for (const i of root.querySelectorAll("i[data-icon]")) {
    const ico = icon(i.dataset.icon, i.dataset.color);
    i.replaceWith(ico);
  }
}
