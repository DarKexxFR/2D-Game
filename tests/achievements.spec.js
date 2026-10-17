import { test, expect, game, killPlayer, startGame, withSave } from "./fixtures.js";

test("menu des succès : liste, progression et retour", async ({ page }) => {
  await withSave(page, { achievementStats: { kills: 40 }, achievements: [] });
  await page.goto("/");
  await page.locator("#btnAchievements").click();
  await expect(page.locator("#achievementMenu")).toBeVisible();
  await expect(page.locator("#achievementCount")).toHaveText("1 / 48 débloqués"); // « Premier sang » : déjà mérité par la sauvegarde;
  await expect(page.locator(".achievement-item")).toHaveCount(48);
  await expect(page.locator(".achievement-item").nth(1)).toContainText("40 / 100");
  await page.locator("#btnAchievementsBack").click();
  await expect(page.locator("#mainMenu")).toBeVisible();
});

test("un kill débloque « Premier sang », notifié et sauvegardé", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await page.evaluate(async () => {
    const { world } = await import("/src/core/state.js");
    const { killEnemy } = await import("/src/systems/combat.js");
    const { spawnEnemy } = await import("/src/systems/spawner.js");
    spawnEnemy("normal", 0, 0);
    killEnemy(world.enemies.at(-1));
  });
  await expect(page.locator("#achievementToast")).toHaveClass(/visible/);
  await expect(page.locator("#achievementToast")).toContainText("Premier sang");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("survivor_save_v11")));
  expect(saved.achievements).toContain("first_kill");
  expect(saved.achievementStats.kills).toBeGreaterThanOrEqual(1);
});

test("fin de partie : la partie est comptée et la progression conservée", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await killPlayer(page);
  await page.reload();
  expect(await game(page, ({ storage }) => storage.account.achievementStats.runs)).toBe(1);
});

test("débloquer un succès rapporte de l'or", async ({ page }) => {
  await withSave(page, {
    gold: 0,
    lastFreeChest: Date.now(),
    achievementStats: { kills: 99 },
    achievements: [],
  });
  await page.goto("/");
  await startGame(page);
  await page.evaluate(async () => {
    const { world } = await import("/src/core/state.js");
    const { killEnemy } = await import("/src/systems/combat.js");
    const { spawnEnemy } = await import("/src/systems/spawner.js");
    spawnEnemy("normal", 0, 0);
    killEnemy(world.enemies.at(-1)); // 100e élimination : « Nettoyage » (+150) et « Premier sang » (+50)
  });
  await expect(page.locator("#achievementToast")).toContainText("or");
  expect(await game(page, ({ storage }) => storage.account.gold)).toBe(200);
  await killPlayer(page);
});
