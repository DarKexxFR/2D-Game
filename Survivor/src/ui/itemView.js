// Éléments d'affichage partagés pour l'équipement (étoiles, statistiques, badge de rareté).

import { RARITIES } from "../config.js";
import {
  ITEMS,
  MAX_PRESTIGE,
  armorStats,
  heroStats,
  moduleStats,
  petStats,
  weaponStats,
} from "../data/items.js";
import { PERKS, PERK_PRESTIGE, SYNERGIES, setOf } from "../data/perks.js";
import { el } from "./dom.js";
import { icon } from "./icons.js";

export const RARITY_LABELS = {
  common: "Commun",
  rare: "Rare",
  epic: "Épique",
  legendary: "Légendaire",
  mythic: "Mythique",
};

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
    if (w.projectiles > 1) parts.push(`${w.projectiles} projectiles${w.ring ? " en cercle" : ""}`);
    if (w.pierce && !w.returns) parts.push(`Perce ${w.pierce}`);
    if (w.returns) parts.push("Revient");
    if (w.chain) parts.push(`${w.chain} rebonds`);
    if (w.explosion) parts.push(`Explosion ${w.explosion}`);
    return parts.join(" · ");
  }
  if (item.slot === "pet") return petText(petStats(item.id, level, prestige).power);
  const s = bonusStats(item, level, prestige);
  const parts = [];
  if (s.health) parts.push(`${s.health > 0 ? "+" : ""}${Math.round(s.health)} PV`);
  if (s.defense) parts.push(`+${s.defense.toFixed(1)} DEF`);
  if (s.speed) parts.push(`${pct(s.speed)} VIT`);
  if (s.dashCooldown) parts.push(`${pct(-s.dashCooldown)} recharge dash`);
  if (s.regen) parts.push(`+${s.regen.toFixed(1)} PV/s`);
  if (s.crit) parts.push(`${pct(s.crit)} CRIT`);
  if (s.gold) parts.push(`${pct(s.gold)} OR`);
  if (s.magnet) parts.push(`+${Math.round(s.magnet)} aimant`);
  if (s.thorns) parts.push(`${pct(s.thorns)} épines`);
  if (s.auraDamage) parts.push(`+${s.auraDamage.toFixed(1)} dégâts d'aura`);
  if (s.damage) parts.push(`${pct(s.damage)} DGT`);
  if (s.fireRate) parts.push(`${pct(s.fireRate)} cadence`);
  if (s.xp) parts.push(`${pct(s.xp)} XP`);
  return parts.join(" · ") || "Aucun bonus";
}

const STAT_FNS = { armor: armorStats, hero: heroStats, module: moduleStats };

function bonusStats(item, level, prestige) {
  return STAT_FNS[item.slot](item.id, level, prestige).stats;
}

// --- Comparaison avec l'objet équipé ---

// [clé, libellé, en pourcentage ?, plus petit = mieux ?]
const WEAPON_KEYS = [
  ["damage", "DMG", false],
  ["rate", "cadence", false],
  ["projectiles", "projectiles", false],
  ["pierce", "perce", false],
  ["explosion", "explosion", false],
  ["chain", "rebonds", false],
];
const BONUS_KEYS = [
  ["health", "PV", false],
  ["defense", "DEF", false],
  ["speed", "VIT", true],
  ["dashCooldown", "recharge dash", true],
  ["regen", "PV/s", false],
  ["crit", "CRIT", true],
  ["damage", "DGT", true],
  ["fireRate", "cadence", true],
  ["xp", "XP", true],
  ["gold", "OR", true],
  ["magnet", "aimant", false],
  ["thorns", "épines", true],
  ["auraDamage", "dégâts d'aura", false],
];
const PET_KEYS = [
  ["damage", "dégâts", false],
  ["heal", "soin", false],
  ["magnet", "aimant", false],
  ["gold", "OR", true],
];

/** Valeurs comparables d'un objet (null = emplacement vide). */
function comparable(item, owned) {
  if (!item) return {};
  const { level, prestige } = owned;
  if (item.slot === "weapon") {
    const w = weaponStats(item.id, level, prestige);
    return {
      damage: w.damage,
      rate: 1 / w.cooldown,
      projectiles: w.projectiles,
      pierce: w.returns ? 0 : w.pierce,
      explosion: w.explosion || 0,
      chain: w.chain || 0,
    };
  }
  if (item.slot === "pet") return petStats(item.id, level, prestige).power;
  return bonusStats(item, level, prestige);
}

/**
 * Ce qui change si on équipe `item` à la place de l'objet équipé `current` (même emplacement) :
 * liste de { text, better }. Vide si rien ne change en chiffres.
 */
export function compareWith(item, owned, current, currentOwned) {
  const a = comparable(item, owned);
  const b = comparable(current, currentOwned);
  const keys = item.slot === "weapon" ? WEAPON_KEYS : item.slot === "pet" ? PET_KEYS : BONUS_KEYS;
  const out = [];
  for (const [k, label, isPct] of keys) {
    const delta = (a[k] || 0) - (b[k] || 0);
    if (Math.abs(delta) < 0.005) continue;
    const better = delta > 0; // toutes ces valeurs sont des bonus (la recharge du dash est une réduction)
    const value = isPct ? `${Math.round(Math.abs(delta) * 100)}%` : formatNumber(Math.abs(delta));
    out.push({ text: `${delta > 0 ? "+" : "−"}${value} ${label}`, better });
  }
  return out;
}

function formatNumber(v) {
  return v >= 10 || Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(2).replace(/0$/, "");
}

// --- Effet de prestige et panoplie ---

/** Effet ★3 de l'objet : { name, desc, unlocked } ou null. */
export function perkInfo(item, owned) {
  const p = PERKS[item.id];
  if (!p) return null;
  return { name: p.name, desc: p.desc, unlocked: (owned?.prestige || 0) >= PERK_PRESTIGE };
}

/** Panoplie de l'objet : { name, desc, partner, active } ou null. */
export function setInfo(item, equipped) {
  const s = setOf(item.id);
  if (!s) return null;
  const partner = ITEMS[item.slot === "weapon" ? s.armor : s.weapon];
  return {
    name: s.name,
    desc: s.desc,
    partner,
    active: equipped.weapon === s.weapon && equipped.armor === s.armor,
  };
}

/** Synergie familier + arme de l'objet : { name, desc, partner, active } ou null. */
export function synergyInfo(item, equipped) {
  const s = SYNERGIES.find((s) => s.pet === item.id || s.weapon === item.id);
  if (!s) return null;
  return {
    name: s.name,
    desc: s.desc,
    partner: ITEMS[item.slot === "pet" ? s.weapon : s.pet],
    active: equipped.pet === s.pet && equipped.weapon === s.weapon,
  };
}

function petText(p) {
  const parts = [];
  if (p.damage) parts.push(`${p.damage.toFixed(1)} dégâts`);
  if (p.heal) parts.push(`+${p.heal.toFixed(1)} PV / ${p.cooldown / 1000}s`);
  if (p.magnet) parts.push(`+${Math.round(p.magnet)} aimant`);
  if (p.gold) parts.push(`${pct(p.gold)} OR`);
  if (p.freeze) parts.push(`gel ${(p.freeze / 60).toFixed(1)}s`);
  if (p.shield) parts.push(`bouclier ${(p.shield / 60).toFixed(1)}s / ${p.cooldown / 1000}s`);
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
