// Nouveaux ennemis : Porte-bouclier et Essaim (Cité néon), Soigneur (vague 10+) et Aimant (vague 12+).
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

test("porte-bouclier, essaim, soigneur et aimant", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await page.goto("/");
  await startGame(page);

  // Où ils apparaissent
  const spawns = await page.evaluate(async () => {
    const { biomeForWave } = await import("/src/data/biomes.js");
    const { SPAWN_TABLES } = await import("/src/data/enemies.js");
    const table = (w) => Object.keys(SPAWN_TABLES.find((t) => w < t.untilWave).weights);
    return {
      neon: biomeForWave(1).enemies.map((e) => e.type),
      wave9: table(9),
      wave10: table(10),
      wave12: table(12),
    };
  });
  expect(spawns.neon).toEqual(["shield", "swarm"]);
  expect(spawns.wave9).not.toContain("healer");
  expect(spawns.wave10).toContain("healer");
  expect(spawns.wave10).not.toContain("magnet");
  expect(spawns.wave12).toEqual(expect.arrayContaining(["healer", "magnet"]));

  // L'essaim arrive en nuée de 6
  const swarm = await game(page, ({ state, spawner }) => {
    state.world.enemies.length = 0;
    state.game.spawnTimer = 1e9;
    spawner.spawnEnemy("swarm");
    return state.world.enemies.filter((e) => e.type === "swarm").length;
  });
  expect(swarm).toBe(6);

  // Le bouclier bloque les tirs de face, pas ceux reçus de dos
  const shield = await game(page, ({ state, spawner, combat }) => {
    state.world.enemies.length = 0;
    state.world.projectiles.length = 0;
    spawner.spawnEnemy("shield", state.player.worldX + 150, state.player.worldY);
    const e = state.world.enemies[0];
    e.facing = Math.PI; // bouclier tourné vers le joueur (à gauche)
    const hit = (dx) => {
      const before = e.health;
      combat.spawnProjectile({ x: e.x + dx, y: e.y, vx: 0, vy: 0, size: 5, damage: 10, pierce: 5 });
      combat.rebuildEnemyGrid();
      combat.updateProjectiles();
      return before - e.health;
    };
    return { front: hit(-5), back: hit(5), left: state.world.projectiles.length };
  });
  expect(shield.front).toBeCloseTo(1.5);
  expect(shield.back).toBeCloseTo(10);
  expect(shield.left).toBe(1); // le tir bloqué s'arrête même s'il est perforant

  // Le soigneur rend des PV aux ennemis blessés autour de lui
  await game(page, ({ state, spawner }) => {
    state.world.enemies.length = 0;
    spawner.spawnEnemy("tank", state.player.worldX + 300, state.player.worldY);
    spawner.spawnEnemy("healer", state.player.worldX + 340, state.player.worldY);
    const [tank, healer] = state.world.enemies;
    tank.health = tank.maxHealth / 2;
    healer.healTimer = 1;
  });
  await expect
    .poll(() =>
      game(page, ({ state }) => {
        const tank = state.world.enemies.find((e) => e.type === "tank");
        return tank.health / tank.maxHealth;
      }),
    )
    .toBeGreaterThan(0.6);

  // L'aimant annonce son attraction puis tire le joueur vers lui
  const start = await game(page, ({ state, spawner }) => {
    state.world.enemies.length = 0;
    spawner.spawnEnemy("magnet", state.player.worldX + 350, state.player.worldY);
    const m = state.world.enemies[0];
    m.magnetTimer = 1;
    return state.player.worldX;
  });
  await expect
    .poll(() =>
      game(
        page,
        ({ state }) => state.world.enemies[0]?.magnetWarn > 0 || state.world.enemies[0]?.pulling > 0,
      ),
    )
    .toBe(true);
  await expect.poll(() => game(page, ({ state }, x0) => state.player.worldX - x0, start)).toBeGreaterThan(30);
  await killPlayer(page);
});
