// Parcours principal sur PC : menus, partie, pause, amélioration, mort, rejouer.
import { declineRevive, expect, game, killPlayer, startGame, test } from "./fixtures.js";

test.beforeEach(async ({ isMobile }) => test.skip(isMobile, "parcours clavier/souris"));

test("le menu principal s'affiche et la navigation fonctionne", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#mainMenu")).toBeVisible();
  await page.locator("#btnShop").click();
  await expect(page.locator("#shopMenu")).toBeVisible();
  await page.locator("#btnShopBack").click();
  await page.locator("#btnLeaderboard").click();
  await expect(page.locator("#leaderboardMenu")).toBeVisible();
  await page.locator("#btnLeaderboardBack").click();
  await page.locator("#btnInventory").click();
  await expect(page.locator("#inventoryMenu")).toBeVisible();
  await page.locator("#btnInventoryBack").click();
  await expect(page.locator("#mainMenu")).toBeVisible();
});

test("une partie se joue : ennemis, tir auto, kills", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await page.keyboard.press("t"); // tir automatique
  await expect
    .poll(() => game(page, ({ state }) => state.game.kills), { timeout: 15_000 })
    .toBeGreaterThan(0);
  const s = await game(page, ({ state }) => ({
    enemies: state.world.enemies.length,
    auto: state.player.autoShoot,
  }));
  expect(s.auto).toBe(true);
  expect(s.enemies).toBeGreaterThan(10);
});

test("déplacement au clavier (ZQSD)", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await page.keyboard.down("d");
  await expect.poll(() => game(page, ({ state }) => state.player.worldX)).toBeGreaterThan(50);
  await page.keyboard.up("d");
});

test("pause, amélioration, mort, rejouer et retour au menu", async ({ page }) => {
  await page.goto("/");
  await startGame(page, { levelUps: true });

  await page.keyboard.press("p");
  await expect(page.locator("#pauseMenu")).toBeVisible();
  await page.locator("#btnResume").click();
  await expect(page.locator("#pauseMenu")).toBeHidden();

  await game(page, ({ player }) => player.gainXp(1000));
  await expect(page.locator("#upgradeMenu")).toBeVisible();
  await page.locator(".upgrade-option").first().click();
  await expect(page.locator("#upgradeMenu")).toBeHidden();
  expect(await game(page, ({ state }) => Object.keys(state.player.inventory).length)).toBe(1);

  await killPlayer(page);
  await page.locator("#btnReplay").click();
  const fresh = await game(page, ({ state }) => ({
    running: state.game.running,
    inv: Object.keys(state.player.inventory).length,
    lvl: state.player.level,
  }));
  expect(fresh).toEqual({ running: true, inv: 0, lvl: 1 });

  await page.keyboard.press("Escape");
  await page.locator("#btnQuit").click();
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#ui")).toBeHidden();
});

test("les récompenses de fin ne sont comptées qu'une fois", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await game(page, ({ state, player }) => {
    state.game.runGold = 123;
    player.takeDamage(1e12);
    player.takeDamage(1e12); // coups simultanés
  });
  await declineRevive(page);
  await expect(page.locator("#runGoldGain")).toHaveText("123");
  expect(await game(page, ({ storage }) => storage.account.gold)).toBe(123);
});

test("charge : 200+ ennemis et toutes les améliorations sans erreur", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await page.evaluate(async () => {
    const s = await import("/src/core/state.js");
    const sp = await import("/src/systems/spawner.js");
    const up = await import("/src/data/upgrades.js");
    for (let k = 0; k < 4; k++) for (const u of up.availableUpgrades(s.player)) up.applyUpgrade(u, s.player);
    s.player.autoShoot = true;
    s.game.wave = 7;
    sp.startNextWave(); // vague 8 : Roi Slime
    for (let i = 0; i < 200; i++) sp.spawnEnemy();
  });
  // La partie avance (le rythme dépend de la machine : on attend au lieu de mesurer à durée fixe)
  await expect
    .poll(() => game(page, ({ state }) => state.game.kills), { timeout: 15_000 })
    .toBeGreaterThan(20);
  const nan = await game(
    page,
    ({ state }) => state.world.enemies.filter((e) => !Number.isFinite(e.x)).length,
  );
  expect(nan).toBe(0);
});
