// Applique le héros, l'arme, l'armure et le familier équipés au joueur en début de partie.

import { PLAYER_DEFAULTS } from "../config.js";
import { player, resetPet } from "../core/state.js";
import { armorStats, heroStats, petStats, weaponStats } from "../data/items.js";
import { UPGRADES, applyUpgrade } from "../data/upgrades.js";
import { getEquipped } from "../services/inventory.js";

/** Équipement du joueur (héros, arme, armure, familier), chacun { id, level, prestige } ou null. */
export function equippedLoadout() {
  return {
    weapon: getEquipped("weapon"),
    armor: getEquipped("armor"),
    hero: getEquipped("hero"),
    pet: getEquipped("pet"),
  };
}

/** Applique un équipement (par défaut celui du joueur ; le défi quotidien impose le sien). */
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
  player.health = player.maxHealth;
}

/** Bonus communs aux armures et aux héros. */
function applyStats(s) {
  player.maxHealth = Math.max(1, player.maxHealth + (s.health || 0));
  player.defense += s.defense || 0;
  player.baseSpeed *= 1 + (s.speed || 0);
  player.speed = player.baseSpeed;
  player.dashCooldown = Math.round(player.dashCooldown * (1 - (s.dashCooldown || 0)));
  player.regen += s.regen || 0;
}

function applyHero(hero) {
  applyStats(hero.stats);
  if (hero.size) player.size = hero.size;
  player.critChance += hero.stats.crit || 0;
  player.goldBonus += hero.stats.gold || 0;
  for (const name of hero.startUpgrades || []) {
    applyUpgrade(
      UPGRADES.find((u) => u.name === name),
      player,
    );
  }
  player.auraDamage += hero.stats.auraDamage || 0;
}
