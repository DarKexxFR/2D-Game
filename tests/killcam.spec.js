// Ralenti de la mort : les dernières secondes sont rejouées depuis l'écran de fin, avec le coupable.
import { expect, game, startGame, test } from "./fixtures.js";

/** Fait apparaître un ennemi près du vaisseau, laisse tourner la partie, puis le laisse porter le coup fatal. */
async function dieTo(page, type, healthLeft = 1) {
  await game(
    page,
    ({ state, spawner }, t) => spawner.spawnEnemy(t, state.player.worldX + 160, state.player.worldY),
    type,
  );
  await expect
    .poll(() => game(page, ({ state }) => state.game.killCam.frames.length), { timeout: 10_000 })
    .toBeGreaterThan(60);
  await game(
    page,
    ({ state, player }, { t, k }) => {
      const e = state.world.enemies.find((x) => x.type === t);
      e.health = e.maxHealth * k;
      player.takeDamage(1e12, e);
    },
    { t: type, k: healthLeft },
  );
  if (await page.locator("#reviveMenu").isVisible()) await page.locator("#btnReviveGiveUp").click();
  await expect(page.locator("#gameOver")).toBeVisible();
}

test("revoir sa mort au ralenti, puis revenir à l'écran de fin", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await dieTo(page, "tank");

  const killer = await game(page, ({ state }) => state.game.killCam.killer);
  expect(killer.name).toBe(
    await page.evaluate(async () => (await import("/src/data/enemies.js")).ENEMY_NAMES.tank),
  );
  // Pas plus de quelques secondes en mémoire
  const frames = await game(page, ({ state }) => state.game.killCam.frames.length);
  expect(frames).toBeLessThanOrEqual(120);

  await page.locator("#btnKillCam").click();
  await expect(page.locator("body")).toHaveClass(/kill-cam/);
  await expect(page.locator("#gameOver")).toBeHidden();
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/kill-cam/);
  await expect(page.locator("#gameOver")).toBeVisible();

  // REJOUER : le ralenti de la partie précédente est oublié
  await page.locator("#btnReplay").click();
  expect(await game(page, ({ state }) => state.game.killCam.killer)).toBeNull();
});

test("boss presque mort : le replay le rappelle et se termine tout seul", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await dieTo(page, "miniboss", 0.05);

  const line = await page.evaluate(async () => {
    const { killerLine } = await import("/src/render/killCam.js");
    const { game } = await import("/src/core/state.js");
    return killerLine(game.killCam.killer);
  });
  expect(line).toContain("5 %");

  await page.locator("#btnKillCam").click();
  await expect(page.locator("body")).toHaveClass(/kill-cam/);
  await expect(page.locator("body")).not.toHaveClass(/kill-cam/, { timeout: 20_000 });
  await expect(page.locator("#gameOver")).toBeVisible();
});

test("REJOUER pendant le ralenti relance aussitôt une partie", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await dieTo(page, "tank");

  await expect(page.locator("#btnKillCamReplay")).toBeHidden();
  await page.locator("#btnKillCam").click();
  await expect(page.locator("body")).toHaveClass(/kill-cam/);
  await page.locator("#btnKillCamReplay").click();
  await expect(page.locator("body")).not.toHaveClass(/kill-cam/);
  await expect(page.locator("#gameOver")).toBeHidden();
  await expect(page.locator("#btnKillCamReplay")).toBeHidden();
  const run = await game(page, ({ state }) => ({ over: state.game.over, killer: state.game.killCam.killer }));
  expect(run).toEqual({ over: false, killer: null });
});
