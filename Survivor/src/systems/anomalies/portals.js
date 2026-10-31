// Faille quantique : un portail dans chaque coin de la zone de combat (à `inset` des murs). Y entrer
// envoie le joueur au portail du coin opposé (diagonale). Pour ne pas rebondir, il faut d'abord
// s'éloigner du portail d'arrivée (`rearm` × rayon). Seul le joueur passe : les ennemis (et les boss,
// jamais déplacés par le décor) restent où ils sont.

import { player } from "../../core/state.js";
import { playSfx } from "../../services/sfx.js";
import { dist } from "../../utils/math.js";
import { addFloatingText, createParticles, createShockwave } from "../effects.js";

// Coins : haut-gauche, haut-droite, bas-gauche, bas-droite. Le coin opposé de i est 3 - i.
const CORNERS = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

/** @param {any} a */
export function layout(a) {
  a.items = CORNERS.map(([cx, cy]) => ({ cx, cy, x: 0, y: 0 }));
  a.lock = -1; // portail d'arrivée dont il faut d'abord sortir (-1 : aucun)
  a.cooldown = 0;
  a.uses = 0;
}

/** Les portails restent collés aux coins, même quand les murs de l'arène bougent. */
export function place(a, def, zone) {
  const inset = Math.min(def.inset, (zone.maxX - zone.minX) / 4, (zone.maxY - zone.minY) / 4);
  for (const p of a.items) {
    p.x = p.cx ? zone.maxX - inset : zone.minX + inset;
    p.y = p.cy ? zone.maxY - inset : zone.minY + inset;
  }
}

/** @param {any} a @param {any} def */
export function update(a, def) {
  if (a.cooldown > 0) a.cooldown--;
  const { worldX: x, worldY: y } = player;
  if (a.lock >= 0) {
    const exit = a.items[a.lock];
    if (dist(x, y, exit.x, exit.y) > def.radius * def.rearm) a.lock = -1;
    return;
  }
  if (a.cooldown > 0) return;
  const from = a.items.findIndex((p) => dist(x, y, p.x, p.y) < def.radius);
  if (from >= 0) teleport(a, def, from);
}

function teleport(a, def, from) {
  const to = a.items.length - 1 - from;
  const start = a.items[from];
  const exit = a.items[to];
  createParticles(player.worldX, player.worldY, def.color, 18);
  createShockwave(start.x, start.y, def.radius * 2.2, def.color);
  player.worldX = exit.x;
  player.worldY = exit.y;
  createShockwave(exit.x, exit.y, def.radius * 2.6, def.exitColor);
  createParticles(exit.x, exit.y, def.exitColor, 18);
  addFloatingText(exit.x, exit.y - 50, "TÉLÉPORTÉ", def.exitColor, 16, 50);
  playSfx("dash");
  a.lock = to;
  a.cooldown = def.cooldown;
  a.uses++;
}
