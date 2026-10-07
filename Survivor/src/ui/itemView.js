// Éléments d'affichage partagés pour l'équipement (étoiles, statistiques, badge de rareté).

import { RARITIES } from "../config.js";
import { MAX_PRESTIGE, armorStats, heroStats, petStats, weaponStats } from "../data/items.js";
import { el } from "./dom.js";
import { icon } from "./icons.js";

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
  if (item.slot === "pet") return petText(petStats(item.id, level, prestige).power);
  const s = (item.slot === "hero" ? heroStats : armorStats)(item.id, level, prestige).stats;
  const parts = [];
  if (s.health) parts.push(`${s.health > 0 ? "+" : ""}${Math.round(s.health)} PV`);
  if (s.defense) parts.push(`+${s.defense.toFixed(1)} DEF`);
  if (s.speed) parts.push(`${pct(s.speed)} VIT`);
  if (s.dashCooldown) parts.push(`${pct(-s.dashCooldown)} recharge dash`);
  if (s.regen) parts.push(`+${s.regen.toFixed(1)} PV/s`);
  if (s.crit) parts.push(`${pct(s.crit)} CRIT`);
  if (s.gold) parts.push(`${pct(s.gold)} OR`);
  if (s.auraDamage) parts.push(`+${s.auraDamage.toFixed(1)} dégâts d'aura`);
  return parts.join(" · ") || "Aucun bonus";
}

function petText(p) {
  const parts = [];
  if (p.damage) parts.push(`${p.damage.toFixed(1)} dégâts`);
  if (p.heal) parts.push(`+${p.heal.toFixed(1)} PV / ${p.cooldown / 1000}s`);
  if (p.magnet) parts.push(`+${Math.round(p.magnet)} aimant`);
  if (p.gold) parts.push(`${pct(p.gold)} OR`);
  return parts.join(" · ");
}

/** Icône d'un objet dans sa couleur, enveloppée dans un conteneur stylé. */
export function itemIcon(item, className) {
  const box = el("span", className);
  box.append(icon(item.icon, item.color));
  return box;
}

export function rarityTag(rarity) {
  const tag = el("span", "item-rarity", RARITY_LABELS[rarity]);
  tag.style.color = rarityColor(rarity);
  return tag;
}
