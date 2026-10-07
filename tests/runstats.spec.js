// Écran de fin : durée, boss vaincus, ennemi le plus tué et dégâts par source.
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

test("statistiques de fin de partie", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await game(page, ({ state }) => (state.player.autoShoot = true));
  await expect
    .poll(() => game(page, ({ state }) => state.game.kills), { timeout: 15_000 })
    .toBeGreaterThan(3);
  await page.evaluate(async () => {
    const s = await import("/src/core/state.js");
    const sp = await import("/src/systems/spawner.js");
    const c = await import("/src/systems/combat.js");
    sp.spawnEnemy("miniboss", s.player.worldX + 300, s.player.worldY);
    c.damageEnemy(s.world.enemies.at(-1), 1e9, "skill");
  });
  const stats = await game(page, ({ state }) => JSON.parse(JSON.stringify(state.game.stats)));
  expect(stats.bosses).toBe(1);
  expect(stats.damage.weapon).toBeGreaterThan(0);
  expect(stats.kills.miniboss).toBe(1);

  await killPlayer(page);
  await expect(page.locator(".run-tile")).toHaveCount(3);
  await expect(page.locator(".run-tile").nth(1)).toContainText("1");
  await expect(page.locator('.dmg-row[data-source="weapon"]')).toContainText("Blaster");
  await expect(page.locator('.dmg-row[data-source="skill"]')).toContainText("Onde de choc");
});
