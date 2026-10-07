// Effets : ralenti et onde de choc à la mort d'un boss, compteur de combo.
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

test("mort d'un boss : ralenti, flash et onde de choc", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  const fx = await page.evaluate(async () => {
    const s = await import("/src/core/state.js");
    const sp = await import("/src/systems/spawner.js");
    const c = await import("/src/systems/combat.js");
    sp.spawnEnemy("boss", s.player.worldX + 300, s.player.worldY);
    c.killEnemy(s.world.enemies.at(-1));
    return {
      slowMo: s.game.slowMo,
      flash: !!s.game.flash,
      shockwave: s.world.visualEffects.some((e) => e.type === "shockwave"),
    };
  });
  expect(fx).toEqual({ slowMo: 50, flash: true, shockwave: true });
  // Le ralenti finit par s'arrêter
  await expect.poll(() => game(page, ({ state }) => state.game.slowMo), { timeout: 8000 }).toBe(0);
  await killPlayer(page);
});

test("combo : compteur affiché, palier annoncé, meilleur combo retenu", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await page.evaluate(async () => {
    const s = await import("/src/core/state.js");
    const sp = await import("/src/systems/spawner.js");
    const c = await import("/src/systems/combat.js");
    s.game.spawnTimer = 1e9;
    for (let i = 0; i < 12; i++) {
      sp.spawnEnemy("normal", s.player.worldX + 400, s.player.worldY);
      c.killEnemy(s.world.enemies.at(-1));
    }
  });
  await expect(page.locator("#comboDisplay")).toHaveText("×12 COMBO");
  const texts = await game(page, ({ state }) => state.world.floatingTexts.map((t) => t.text));
  expect(texts).toContain("COMBO ×10 !");
  // Sans nouvelle élimination, le combo retombe à zéro
  await expect.poll(() => game(page, ({ state }) => state.game.combo), { timeout: 5000 }).toBeLessThan(12);
  await killPlayer(page);
  await expect(page.locator(".run-tile").nth(2)).toContainText("×");
});
