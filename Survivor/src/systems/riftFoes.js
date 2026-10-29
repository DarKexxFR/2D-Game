// Ennemis de la fin de l'aventure (vagues 31 à 40, data/biomes.js) : Faille quantique (Déphaseur,
// Réplicateur) et Noyau stellaire (Fusionneur, Nova). Réglages dans BIOME_FOES (data/enemies.js), en ticks.
// Tout leur état vit sur l'ennemi lui-même (donc propre à chaque partie d'un duel).

import { world } from "../core/state.js";
import { BIOME_FOES } from "../data/enemies.js";
import { angleTo, dist } from "../utils/math.js";
import { enemyGrid } from "./combat.js";
import { addFloatingText, createParticles } from "./effects.js";
import { addCircle } from "./hazards.js";
import { aim } from "./bosses/kit.js";
import { spawnEnemy } from "./spawner.js";

/**
 * Déphaseur : solide un moment, il scintille (`e.phaseWarn`) puis passe hors phase : intouchable,
 * absent de la grille et sans contact (`e.submerged`, comme le Kraken sous l'eau), et plus rapide.
 */
export function updatePhaser(e) {
  const p = BIOME_FOES.phase;
  e.phaseTimer = (e.phaseTimer ?? p.solid * Math.random()) + 1;
  if (!e.submerged) {
    e.phaseWarn = e.phaseTimer > p.solid ? e.phaseTimer - p.solid : 0;
    if (e.phaseTimer < p.solid + p.warn) return;
    e.submerged = true;
    e.phaseWarn = 0;
    e.phaseTimer = 0;
    e.speed = e.baseSpeed * p.speed;
    createParticles(e.x, e.y, e.color, 6);
  } else if (e.phaseTimer >= p.phased) {
    e.submerged = false;
    e.phaseTimer = 0;
    e.speed = e.baseSpeed;
    createParticles(e.x, e.y, e.color, 6);
  }
}

/** Réplicateur : s'il vit assez longtemps, il annonce sa copie (`e.replicateWarn`) puis se dédouble. */
export function updateReplicator(e) {
  const r = BIOME_FOES.replicate;
  if ((e.generation ?? 0) >= r.generations) return;
  e.replicateTimer = (e.replicateTimer ?? r.every * (0.5 + Math.random() * 0.5)) - 1;
  e.replicateWarn = e.replicateTimer <= r.warn ? r.warn - e.replicateTimer : 0;
  if (e.replicateTimer > 0) return;
  e.replicateTimer = r.every;
  e.replicateWarn = 0;
  if (world.enemies.filter((o) => !o.dead && o.type === "replicator").length >= r.max) return;
  const a = Math.random() * Math.PI * 2;
  spawnEnemy("replicator", e.x + Math.cos(a) * e.size * 2, e.y + Math.sin(a) * e.size * 2);
  const copy = world.enemies[world.enemies.length - 1];
  copy.generation = (e.generation ?? 0) + 1;
  copy.xp *= r.copyRewards;
  copy.gold *= r.copyRewards;
  createParticles(copy.x, copy.y, e.color, 10);
  addFloatingText(e.x, e.y - e.size - 12, "COPIE !", e.color, 13, 35);
}

/**
 * Fusionneur : attiré par un autre fusionneur proche ; quand deux se touchent, le plus abîmé est
 * absorbé (sans récompense) et le survivant grossit, cumule leurs PV et frappe plus fort.
 */
export function updateFuser(e) {
  const f = BIOME_FOES.fuse;
  if ((e.fuseLevel ?? 0) >= f.maxLevel) return;
  let mate = null;
  let best = f.seek;
  for (const o of enemyGrid.query(e.x, e.y, f.seek)) {
    if (o === e || o.dead || o.type !== "fuser" || (o.fuseLevel ?? 0) >= f.maxLevel) continue;
    const d = dist(e.x, e.y, o.x, o.y);
    if (d < best) {
      best = d;
      mate = o;
    }
  }
  if (!mate) return;
  if (best > e.size + mate.size) {
    const a = angleTo(e.x, e.y, mate.x, mate.y);
    e.x += Math.cos(a) * f.pull;
    e.y += Math.sin(a) * f.pull;
    return;
  }
  const [keep, gone] = e.health / e.maxHealth >= mate.health / mate.maxHealth ? [e, mate] : [mate, e];
  gone.dead = true; // absorbé : pas de récompense, la sienne passe dans le survivant
  keep.fuseLevel = Math.max(keep.fuseLevel ?? 0, gone.fuseLevel ?? 0) + 1;
  keep.maxHealth = (keep.maxHealth + gone.maxHealth) * f.health;
  keep.health = Math.min(keep.maxHealth, (keep.health + gone.health) * f.health);
  keep.damage *= f.damage;
  keep.size *= f.size;
  keep.xp += gone.xp;
  keep.gold += gone.gold;
  createParticles(keep.x, keep.y, keep.color, 14);
  addFloatingText(keep.x, keep.y - keep.size - 12, "FUSION !", keep.color, 15, 40);
}

/** Nova : à portée, elle fonce droit devant, s'arrête et explose (zone annoncée), sans récompense. */
export function updateNova(e, distToPlayer) {
  const n = BIOME_FOES.nova;
  if (e.armed > 0) {
    e.rooted = 1;
    if (--e.armed === 0) {
      e.dead = true; // elle s'est sacrifiée : rien à ramasser
      createParticles(e.x, e.y, e.color, 18);
    }
    return;
  }
  if (e.charging > 0) {
    if (--e.charging > 0) return;
    e.speed = e.baseSpeed;
    e.armed = n.delay;
    addCircle(e.x, e.y, n.radius, e.damage * n.damage, { delay: n.delay, color: e.color });
    return;
  }
  if (distToPlayer > n.range) return;
  e.charging = n.charge;
  e.chargeAngle = aim(e);
  e.speed = e.baseSpeed * n.speed;
}
