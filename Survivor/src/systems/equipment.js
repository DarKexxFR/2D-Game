// Applique le héros, l'arme, l'armure et le familier équipés au joueur en début de partie.

import { PLAYER_DEFAULTS } from "../config.js";
import { player, resetPet } from "../core/state.js";
import { armorStats, heroStats, moduleStats, petStats, weaponStats } from "../data/items.js";
import { MYTHIC_AFFIXES } from "../data/pulseShards.js";
import { UPGRADES, applyUpgrade } from "../data/upgrades.js";
import { getEquipped } from "../services/inventory.js";
import { applyPerks } from "./perks.js";

/** Équipement du joueur (héros, arme, armure, familier, module), chacun { id, level, prestige } ou null. */
export function equippedLoadout() {
  return {
    weapon: getEquipped("weapon"),
    armor: getEquipped("armor"),
    hero: getEquipped("hero"),
    pet: getEquipped("pet"),
    module: getEquipped("module"),
  };
}

/**
 * Applique un équipement (par défaut celui du joueur ; le défi quotidien impose le sien).
 * @param {Partial<ReturnType<typeof equippedLoadout>>} [loadout]
 */
export function applyEquipment(loadout = equippedLoadout()) {
  const w = loadout.weapon || { id: "blaster", level: 1, prestige: 1 };
  player.weapon = weaponStats(w.id, w.level, w.prestige);
  player.attackSpeed = PLAYER_DEFAULTS.attackSpeed * player.weapon.cooldown;

  const a = loadout.armor;
  player.armor = a ? armorStats(a.id, a.level, a.prestige) : null;
  if (player.armor) applyStats(player.armor.stats);

  const h = loadout.hero || { id: "pilot", level: 1, prestige: 1 };
  player.hero = heroStats(h.id, h.level, h.prestige);
  applyHero(player.hero);

  const p = loadout.pet;
  const pet = p ? petStats(p.id, p.level, p.prestige) : null;
  resetPet(pet);
  if (pet?.id === "collector") {
    player.magnetRadius += pet.power.magnet;
    player.goldBonus += pet.power.gold;
  }
  if (pet?.revive) {
    player.revives++; // Phénix : une résurrection de plus
    player.phoenixRevive = true; // consommée en premier, avec l'animation du phénix
  }

  const m = loadout.module;
  player.module = m ? moduleStats(m.id, m.level, m.prestige) : null;
  if (player.module) applyStats(player.module.stats);

  applyAffixes(loadout);
  applyPerks({ ...loadout, weapon: w, hero: h });
  player.health = player.maxHealth;
}

/** Attributs de Pulse des objets mythiques équipés (relancés à la Forge, data/pulseShards.js). */
function applyAffixes(loadout) {
  for (const it of Object.values(loadout)) {
    for (const id of it?.affixes || []) if (MYTHIC_AFFIXES[id]) applyStats(MYTHIC_AFFIXES[id].stats);
  }
}

/** Bonus communs aux armures, aux héros, aux modules et aux attributs de Pulse. */
function applyStats(s) {
  player.maxHealth = Math.max(1, player.maxHealth + (s.health || 0));
  player.defense += s.defense || 0;
  player.baseSpeed *= 1 + (s.speed || 0);
  player.speed = player.baseSpeed;
  player.dashCooldown = Math.round(player.dashCooldown * (1 - (s.dashCooldown || 0)));
  player.regen += s.regen || 0;
  player.magnetRadius += s.magnet || 0;
  player.thorns += s.thorns || 0;
  player.critChance += s.crit || 0;
  player.goldBonus += s.gold || 0;
  player.attackSpeed /= 1 + (s.fireRate || 0);
  player.attack *= 1 + (s.damage || 0);
  player.xpBonus += s.xp || 0;
  player.bossDamage += s.boss || 0;
}

function applyHero(hero) {
  applyStats(hero.stats);
  if (hero.size) player.size = hero.size;
  for (const name of hero.startUpgrades || []) {
    applyUpgrade(
      UPGRADES.find((u) => u.name === name),
      player,
    );
  }
  player.auraDamage += hero.stats.auraDamage || 0;
}
