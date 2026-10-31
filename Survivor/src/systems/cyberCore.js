// Effets en partie des nœuds actifs du Cœur Cybernétique (données dans data/cyberCore.js).
// `applyCyberCore` les applique au joueur en début de partie (après l'équipement et les talents) et
// range les effets lus pendant la partie dans `player.core` (données simples : duel, partie interrompue).

import { player } from "../core/state.js";
import { CORE_NODE } from "../data/cyberCore.js";
import { SIDE_WEAPON_CARDS, applyUpgrade } from "../data/upgrades.js";

/** Effets cumulés de plusieurs nœuds (les parts s'additionnent). */
export function coreEffects(ids) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const id of ids) {
    for (const [k, v] of Object.entries(CORE_NODE[id]?.effects || {})) {
      if (typeof v === "number") out[k] = (out[k] || 0) + v;
      else out[k] = v;
    }
  }
  return out;
}

/**
 * Applique les nœuds actifs au joueur. Sans nœud, `player.core` reste null.
 * @param {string[]} ids
 */
export function applyCyberCore(ids) {
  if (ids.length === 0) return;
  const e = coreEffects(ids);
  player.core = { nodes: [...ids], ...e };
  player.attack *= 1 + (e.damage || 0);
  player.attackSpeed /= Math.max(0.1, 1 + (e.fireRate || 0));
  player.xpBonus += e.xp || 0;
  player.goldBonus += e.gold || 0;
  player.critChance += e.crit || 0;
  player.defense += e.defense || 0;
  player.regen += e.regen || 0;
  player.maxHealth = Math.max(1, Math.round(player.maxHealth * (1 + (e.healthPct || 0))));
  player.baseSpeed *= 1 + (e.speed || 0);
  player.speed = player.baseSpeed;
  player.dashCooldown = Math.round(player.dashCooldown * (1 - (e.dashCooldown || 0)));
  if (e.ultCharge) player.maxUltCharge = Math.max(1, Math.round(player.maxUltCharge * (1 - e.ultCharge)));
  for (let i = 0; i < (e.sideWeapons || 0); i++) grantRandomSideWeapon();
  player.health = player.maxHealth;
}

/** Arme d'appoint au hasard parmi celles que le joueur n'a pas (s'il reste un emplacement libre). */
function grantRandomSideWeapon() {
  const pool = SIDE_WEAPON_CARDS.filter(
    (c) => !player.sideWeapons.some((w) => w.id === c.sideWeapon) && c.canApply(player),
  );
  if (pool.length === 0) return;
  applyUpgrade(pool[Math.floor(Math.random() * pool.length)], player);
}

/**
 * Multiplicateur de dégâts du Cœur sur un tir de l'arme : tir manuel (Viseur manuel).
 * @param {boolean} manual tir visé à la souris (tir auto coupé)
 */
export function coreShotMult(manual) {
  const c = player.core;
  return c?.manualDamage && manual ? 1 + c.manualDamage : 1;
}

/** Multiplicateur de dégâts du Cœur sur un coup du joueur : sous peu de PV (Dernier carré). */
export function coreHitMult() {
  const low = player.core?.lowHealth;
  return low && player.health < player.maxHealth * low.below ? 1 + low.damage : 1;
}

/** Ticks à tenir dans un sanctuaire maudit (Rituel express), sinon la valeur par défaut. */
export function shrineHold(base) {
  return player.core?.shrineHold || base;
}
