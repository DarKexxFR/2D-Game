// Biomes : changement de décor toutes les 10 vagues et ennemis propres à chaque biome.
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

test("biomes : annonce, décor et ennemis du biome", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await page.goto("/");
  await startGame(page);
  const biomes = await page.evaluate(async () => {
    const { biomeForWave } = await import("/src/data/biomes.js");
    return [1, 10, 11, 21, 31].map((w) => biomeForWave(w).id);
  });
  expect(biomes).toEqual(["neon", "neon", "desert", "ice", "neon"]);

  // Passage de la vague 10 à 11 : bandeau « DÉSERT ROUGE »
  await game(page, ({ state, spawner }) => {
    state.game.wave = 10;
    spawner.startNextWave();
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
