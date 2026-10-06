// Éléments d'affichage partagés pour l'équipement (étoiles, statistiques, badge de rareté).

import { RARITIES } from "../config.js";
import { MAX_PRESTIGE, armorStats, weaponStats } from "../data/items.js";
import { el } from "./dom.js";

export const RARITY_LABELS = { common: "Commun", rare: "Rare", epic: "Épique", legendary: "Légendaire" };

export function rarityColor(rarity) {
  return RARITIES[rarity].color;
}

export function starsText(prestige) {
  return "★".repeat(prestige) + "☆".repeat(MAX_PRESTIGE - prestige);
}

const pct = (v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;

/** Résumé lisible des statistiques d'un objet au niveau / prestige donnés. */
export function statsText(item, level = 1, prestige = 1) {
  if (item.slot === "weapon") {
    const w = weaponStats(item.id, level, prestige);
    const parts = [`DMG ×${w.damage.toFixed(2)}`, `Cadence ×${(1 / w.cooldown).toFixed(1)}`];
    if (w.projectiles > 1) parts.push(`${w.projectiles} projectiles`);
    if (w.pierce) parts.push(`Perce ${w.pierce}`);
    if (w.explosion) parts.push(`Explosion ${w.explosion}`);
    return parts.join(" · ");
  }
  const s = armorStats(item.id, level, prestige).stats;
  const parts = [];
  if (s.health) parts.push(`+${Math.round(s.health)} PV`);
  if (s.defense) parts.push(`+${s.defense.toFixed(1)} DEF`);
  if (s.speed) parts.push(`${pct(s.speed)} VIT`);
  if (s.dashCooldown) parts.push(`${pct(-s.dashCooldown)} recharge dash`);
  if (s.regen) parts.push(`+${s.regen.toFixed(1)} PV/s`);
  return parts.join(" · ");
}

export function rarityTag(rarity) {
  const tag = el("span", "item-rarity", RARITY_LABELS[rarity]);
  tag.style.color = rarityColor(rarity);
  return tag;
}
