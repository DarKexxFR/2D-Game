// Commandes tactiles sur téléphone simulé.
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

test.beforeEach(async ({ isMobile }) => test.skip(!isMobile, "commandes tactiles"));

async function touch(page, cdp, type, points) {
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
}

test("tir auto par défaut et commandes tactiles visibles", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#touchControls")).toBeHidden();
  await page.locator("#btnPlay").tap();
  await expect(page.locator("#touchControls")).toBeVisible();
  await expect(page.locator("#controls")).toBeHidden();
  expect(await game(page, ({ state }) => state.player.autoShoot)).toBe(true);
});

test("joystick + dash en multi-touch, ultime et pause", async ({ page, context }) => {
  await page.goto("/");
  await startGame(page);
  const cdp = await context.newCDPSession(page);
  const vp = page.viewportSize();
  const j = { x: vp.width * 0.25, y: vp.height * 0.7, id: 1 };

  await touch(page, cdp, "touchStart", [j]);
  await touch(page, cdp, "touchMove", [{ ...j, x: j.x + 60, y: j.y - 60 }]);
  await expect.poll(() => game(page, ({ state }) => state.player.worldX)).toBeGreaterThan(40);
  const y = await game(page, ({ state }) => state.player.worldY);
  expect(y).toBeLessThan(-40);

  const dash = await page.locator("#btnTouchDash").boundingBox();
  await touch(page, cdp, "touchStart", [
    { ...j, x: j.x + 60, y: j.y - 60 },
    { x: dash.x + dash.width / 2, y: dash.y + dash.height / 2, id: 2 },
  ]);
  await expect.poll(() => game(page, ({ state }) => state.player.dashCooldownTimer)).toBeGreaterThan(0);
  await touch(page, cdp, "touchEnd", []);
  await expect.poll(() => game(page, ({ input }) => input.touchMove.x)).toBe(0);

  await game(page, ({ state }) => (state.player.isUltReady = true));
  await page.locator("#btnTouchUlt").tap();
  expect(await game(page, ({ state }) => state.player.isUltReady)).toBe(false);

  await page.locator("#btnTouchPause").tap();
  await expect(page.locator("#pauseMenu")).toBeVisible();
  await page.locator("#btnResume").tap();
  await killPlayer(page);
  await expect(page.locator("#touchControls")).toBeHidden();
});

test("les menus tiennent dans l'écran", async ({ page }) => {
  await page.goto("/");
  for (const btn of ["#btnShop", "#btnInventory", "#btnLeaderboard", "#btnOptions"]) {
    await page.locator(btn).tap();
    const menu = page.locator(".menu-overlay:visible");
    const box = await menu.boundingBox();
    const vp = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
    await page.evaluate(async () => (await import("/src/ui/screens.js")).showScreen("mainMenu"));
  }
});
