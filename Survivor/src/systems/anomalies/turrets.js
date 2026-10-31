// Station orbitale : tourelles neutres. Rester `hack` ticks dans leur cercle les pirate : pendant
// `duration` ticks elles tirent sur l'ennemi le plus proche (dégâts × attaque du joueur, source
// "station" dans les stats de fin), puis redeviennent neutres et se rechargent (`cooldown`).
// S'éloigner avant la fin fait redescendre la jauge.

import { game, player } from "../../core/state.js";
import { playSfx } from "../../services/sfx.js";
import { angleTo, dist } from "../../utils/math.js";
import { getNearestEnemy, spawnProjectile } from "../combat.js";
import { addFloatingText, createParticles, createShockwave } from "../effects.js";
import { scatter } from "./scatter.js";

/** @param {any} a @param {any} def @param {boolean} arena @param {any} zone */
export function layout(a, def, arena, zone) {
  const count = arena ? def.countInArena : def.count;
  a.items = scatter(count, zone, { margin: 0.12, gap: arena ? 0.45 : 0.3, clear: def.radius + 150 }).map(
    (p) => ({
      ...p,
      x: 0,
      y: 0,
      state: "idle", // "idle" | "hacked" | "cooldown"
      progress: 0, // ticks passés à côté (jusqu'à `hack`)
      timer: 0, // ticks restants piratée ou en recharge
      angle: -Math.PI / 2,
      lastShot: -Infinity,
    }),
  );
}

/** @param {any} a @param {any} def */
export function update(a, def) {
  for (const t of a.items) {
    if (t.state === "hacked") fire(t, def);
    else if (t.state === "cooldown") {
      if (--t.timer <= 0) t.state = "idle";
    } else hack(t, def);
  }
}

function hack(t, def) {
  if (dist(player.worldX, player.worldY, t.x, t.y) < def.radius) {
    if (++t.progress >= def.hack) {
      Object.assign(t, { state: "hacked", timer: def.duration, progress: 0 });
      createShockwave(t.x, t.y, def.radius * 1.4, def.hackedColor);
      addFloatingText(t.x, t.y - 50, "TOURELLE PIRATÉE !", def.hackedColor, 18, 80);
      playSfx("levelUp");
    }
  } else t.progress = Math.max(0, t.progress - def.decay);
}

function fire(t, def) {
  if (--t.timer <= 0) {
    Object.assign(t, { state: "cooldown", timer: def.cooldown });
    createParticles(t.x, t.y, "#666", 10);
    return;
  }
  if (game.time - t.lastShot < def.fireMs) return;
  const target = getNearestEnemy(t.x, t.y, def.range);
  if (!target) return;
  t.lastShot = game.time;
  t.angle = angleTo(t.x, t.y, target.x, target.y);
  spawnProjectile({
    x: t.x + Math.cos(t.angle) * 22,
    y: t.y + Math.sin(t.angle) * 22,
    vx: Math.cos(t.angle) * def.speed,
    vy: Math.sin(t.angle) * def.speed,
    size: 6,
    damage: player.attack * def.damage,
    color: def.hackedColor,
    pierce: 1,
    source: "station",
  });
}
