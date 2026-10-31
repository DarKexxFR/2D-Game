// Synergies familier + arme (données dans data/perks.js SYNERGIES).
// Une entrée de `BEHAVIORS` par synergie : chaque comportement ne réagit qu'aux événements dont il a
// besoin (start, shot, hit, kill, gem, petAct). Les appels viennent de combat.js, pickups.js, pet.js et
// perks.js via `synergyHook`. L'état vit sur `player.synergyState`, en données simples (duel sur un écran,
// sauvegarde de la partie interrompue).

import { game, pet, player } from "../core/state.js";
import { dist } from "../utils/math.js";
import {
  chainLightning,
  damageEnemy,
  enemyGrid,
  explode,
  getNearestEnemy,
  spawnProjectile,
} from "./combat.js";
import { addFloatingText, createParticles } from "./effects.js";
import { ignite } from "./perks.js";

/** État neuf des synergies (remis à chaque partie). */
export function freshSynergyState() {
  return { stacks: 0, until: 0, last: -1e9, tick: -1, bursts: 0 };
}

/**
 * Prévient la synergie active d'un événement.
 * @param {"start" | "shot" | "hit" | "kill" | "gem" | "petAct"} event
 * @param {...any} args
 */
export function synergyHook(event, ...args) {
  const s = player.synergy;
  if (!s) return;
  BEHAVIORS[s.id]?.[event]?.(s, ...args);
}

/** Bonus de la Faucheuse (Moissonneuse d'âmes) : { orbit (px), damage (multiplicateur) }. */
export function reaperBonus() {
  const s = player.synergy;
  if (s?.id !== "soulHarvest") return { orbit: 0, damage: 1 };
  const n = soulStacks();
  return { orbit: n * s.orbit, damage: 1 + n * s.damage };
}

/** Cumuls d'âmes encore valables (retombent à zéro après `keep` ms sans élimination). */
function soulStacks() {
  const st = player.synergyState;
  if (game.time > st.until) st.stacks = 0;
  return st.stacks;
}

/** @type {Record<string, Partial<Record<string, (s: any, ...args: any[]) => void>>>} */
const BEHAVIORS = {
  // Cristal de givre + Railgun : l'ennemi gelé touché éclate en éclats de glace (une fois par gel)
  iceShatter: {
    hit(s, proj, enemy, damage) {
      if (!(enemy.frozenUntil > game.time)) return;
      enemy.frozenUntil = 0;
      createParticles(enemy.x, enemy.y, s.color, 10);
      const offset = Math.random() * Math.PI;
      for (let i = 0; i < s.shards; i++) {
        const a = offset + (Math.PI * 2 * i) / s.shards;
        spawnProjectile({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(a) * s.speed,
          vy: Math.sin(a) * s.speed,
          size: 4,
          damage: damage * s.damage,
          color: s.color,
          pierce: 1,
          life: s.life,
          hits: new Set([enemy]),
          source: "synergy",
        });
      }
    },
  },

  // Dragonnet + Lance-flammes : aura et portée plus grandes
  dragonFire: {
    start(s) {
      player.auraMult *= 1 + s.aura;
      player.rangeMult *= 1 + s.range;
    },
  },

  // Faucheuse + Couronne de lames : chaque élimination écarte les lames et l'orbite de la Faucheuse
  soulHarvest: {
    kill(s) {
      const st = player.synergyState;
      st.stacks = Math.min(s.maxStacks, soulStacks() + 1);
      st.until = game.time + s.keep;
    },
    shot(s, proj) {
      const n = soulStacks();
      if (n > 0) proj.life *= 1 + n * s.range;
    },
  },

  // Drone de combat + Mitrailleur : le drone copie chaque tir (cartes Multi-Tir / Ricochet comprises)
  barrage: {
    shot(s, proj) {
      if (!pet.active || pet.kind !== "drone") return;
      spawnProjectile({
        ...proj,
        x: pet.x,
        y: pet.y,
        damage: proj.damage * s.damage,
        size: proj.size * 0.8,
        color: s.color,
        source: "synergy",
      });
    },
  },

  // Collecteur + Lance-étoiles / Lance-roquettes : chaque gemme ramassée fait une micro-explosion
  fatalPull: {
    gem(s) {
      const st = player.synergyState;
      if (game.time - st.last < s.cooldown) return;
      st.last = game.time;
      createParticles(player.worldX, player.worldY, s.color, 4);
      explode(player.worldX, player.worldY, s.radius, player.attack * s.damage, null, "synergy");
    },
  },

  // Médic + Arc Tesla / Canon plasma : chaque intervention du Médic lance un arc électrique
  vitalCurrent: {
    petAct(s) {
      const target = getNearestEnemy(pet.x, pet.y, s.range);
      if (!target) return;
      damageEnemy(target, player.attack * s.damage, "synergy");
      chainLightning(target, player.attack * s.damage, s.jumps, s.color, "synergy");
    },
  },

  // Gardien + Fusil à pompe : sous le bouclier, plombs renforcés et perforants
  bulwark: {
    shot(s, proj) {
      if (!(player.buffs.shield > 0)) return;
      proj.damage *= 1 + s.damage;
      proj.pierce += s.pierce;
    },
  },

  // Phénix + Disque laser / Blaster : les tirs enflamment, un ennemi qui meurt en brûlant explose
  cinders: {
    hit(s, proj, enemy) {
      if (!enemy.dead && Math.random() < s.chance) ignite(enemy, s.burn);
    },
    kill(s, enemy) {
      if (!enemy.burn || enemy.burn.until < game.time) return;
      const st = player.synergyState;
      if (st.tick !== game.time) {
        st.tick = game.time;
        st.bursts = 0;
      }
      if (++st.bursts > s.perTick) return; // chaîne plafonnée : jamais d'avalanche d'explosions
      for (const e of enemyGrid.query(enemy.x, enemy.y, s.radius)) {
        if (!e.dead && dist(e.x, e.y, enemy.x, enemy.y) < s.radius + e.size) ignite(e, s.burn);
      }
      explode(enemy.x, enemy.y, s.radius, player.attack * s.damage, enemy, "synergy");
      if (st.bursts === 1) addFloatingText(enemy.x, enemy.y - 20, "CENDRES", s.color, 12, 25);
    },
  },
};

/** Identifiants des synergies qui ont un comportement (vérifié par les tests). */
export const SYNERGY_BEHAVIORS = Object.keys(BEHAVIORS);
