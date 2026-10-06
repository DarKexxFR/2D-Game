// Applique l'arme et l'armure équipées aux statistiques du joueur en début de partie.

import { PLAYER_DEFAULTS } from "../config.js";
import { player } from "../core/state.js";
import { armorStats, weaponStats } from "../data/items.js";
import { getEquipped } from "../services/inventory.js";

export function applyEquipment() {
  const w = getEquipped("weapon") || { id: "blaster", level: 1, prestige: 1 };
  player.weapon = weaponStats(w.id, w.level, w.prestige);
  player.attackSpeed = PLAYER_DEFAULTS.attackSpeed * player.weapon.cooldown;

  const a = getEquipped("armor");
  player.armor = a ? armorStats(a.id, a.level, a.prestige) : null;
  if (!player.armor) return;

  const s = player.armor.stats;
  player.maxHealth += s.health || 0;
  player.health = player.maxHealth;
  player.defense += s.defense || 0;
  player.baseSpeed *= 1 + (s.speed || 0);
  player.speed = player.baseSpeed;
  player.dashCooldown = Math.round(player.dashCooldown * (1 - (s.dashCooldown || 0)));
  player.regen += s.regen || 0;
}
