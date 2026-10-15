// Biomes : changement de décor toutes les 6 vagues et ennemis propres à chaque biome.
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

test("biomes : annonce, décor et ennemis du biome", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await page.goto("/");
  await startGame(page);
  const biomes = await page.evaluate(async () => {
    const { biomeForWave } = await import("/src/data/biomes.js");
    return [1, 6, 7, 13, 19, 25, 31].map((w) => biomeForWave(w).id);
  });
  expect(biomes).toEqual(["neon", "neon", "desert", "ice", "jungle", "station", "neon"]);

  // Passage de la vague 6 à 7 : bandeau « DÉSERT ROUGE »
  await game(page, ({ state, spawner }) => {
    state.game.wave = 6;
    spawner.startNextWave();
    state.game.pendingBosses.length = 0; // pas de petits ennemis pendant un boss
  });
  await expect(page.locator("#biomeBanner")).toHaveClass(/show/);
  await expect(page.locator("#biomeBanner")).toHaveText("DÉSERT ROUGE");

  // Les scorpions apparaissent dans le désert
  await expect
    .poll(() => game(page, ({ state }) => state.world.enemies.some((e) => e.type === "scorpion")), {
      timeout: 10_000,
    })
    .toBe(true);

  // Le golem de glace gèle le joueur au contact
  await game(page, ({ state, spawner }) => {
    state.world.enemies.length = 0;
    state.game.spawnTimer = 1e9;
    spawner.spawnEnemy("golem", state.player.worldX + 5, state.player.worldY);
  });
  await expect.poll(() => game(page, ({ state }) => state.player.buffs.slow)).toBeGreaterThan(0);
  const speeds = await game(page, ({ state }) => [state.player.speed, state.player.baseSpeed]);
  expect(speeds[0]).toBeLessThan(speeds[1]);
  await killPlayer(page);
});

test("jungle et station : spore qui se divise, mines, téléporteur, drone laser", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await page.goto("/");
  await startGame(page);
  const biomes = await page.evaluate(async () => {
    const { biomeForWave } = await import("/src/data/biomes.js");
    return [biomeForWave(20), biomeForWave(26)].map((b) => [b.name, b.enemies.map((e) => e.type)]);
  });
  expect(biomes).toEqual([
    ["JUNGLE TOXIQUE", ["spore", "bomber"]],
    ["STATION ORBITALE", ["blinker", "laser_drone"]],
  ]);

  // La spore éclate en 3 sporelets
  const sporelings = await game(page, ({ state, spawner, combat }) => {
    state.world.enemies.length = 0;
    spawner.spawnEnemy("spore", state.player.worldX + 300, state.player.worldY);
    combat.killEnemy(state.world.enemies[0]);
    return state.world.enemies.filter((e) => e.type === "sporeling").length;
  });
  expect(sporelings).toBe(3);

  // Le poseur de mines sème une mine annoncée, le drone laser tire un laser annoncé
  await game(page, ({ state, spawner }) => {
    state.world.enemies.length = 0;
    state.world.hazards.length = 0;
    spawner.spawnEnemy("bomber", state.player.worldX + 200, state.player.worldY);
    spawner.spawnEnemy("laser_drone", state.player.worldX - 350, state.player.worldY);
  });
  await expect
    .poll(() => game(page, ({ state }) => state.world.hazards.map((h) => h.kind).sort()), { timeout: 10_000 })
    .toEqual(expect.arrayContaining(["beam", "circle"]));

  // Le téléporteur surgit près du joueur
  await game(page, ({ state, spawner }) => {
    state.world.enemies.length = 0;
    spawner.spawnEnemy("blinker", state.player.worldX + 600, state.player.worldY);
  });
  await expect
    .poll(
      () =>
        game(page, ({ state }) => {
          const b = state.world.enemies.find((e) => e.type === "blinker");
          return b ? Math.hypot(b.x - state.player.worldX, b.y - state.player.worldY) : 1e9;
        }),
      { timeout: 10_000 },
    )
    .toBeLessThan(200);
  await killPlayer(page);
});
