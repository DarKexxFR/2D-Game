// Menu Options : réglages appliqués et sauvegardés.
import { expect, game, startGame, test } from "./fixtures.js";

test("les réglages sont appliqués et conservés après rechargement", async ({ page }) => {
  await page.goto("/");
  await page.locator("#btnOptions").click();
  await expect(page.locator("#optionsMenu")).toBeVisible();

  await page.locator("#optMusic").fill("0");
  await page.locator("#optSfx").fill("80");
  await page.locator('#optionsMenu [data-quality="low"]').click();
  await expect(page.locator("#optMusicValue")).toHaveText("0%");
  await expect(page.locator('#optionsMenu [data-quality="low"]')).toHaveClass(/active/);

  await page.reload();
  const s = await game(page, ({ settings }) => ({ ...settings.settings }));
  expect(s).toMatchObject({ musicVolume: 0, sfxVolume: 0.8, quality: "low" });
});

test("qualité basse : plus d'ombres lumineuses ni de chiffres de dégâts", async ({ page }) => {
  await page.goto("/");
  await game(page, ({ settings }) => settings.updateSettings({ quality: "low" }));
  const shadow = await game(page, ({ canvas }) => {
    canvas.ctx.shadowBlur = 20;
    return canvas.ctx.shadowBlur;
  });
  expect(shadow).toBe(0);
  expect(await game(page, ({ canvas }) => canvas.gfx.damageNumbers)).toBe(false);

  await game(page, ({ settings }) => settings.updateSettings({ quality: "high" }));
  const shadowHigh = await game(page, ({ canvas }) => {
    canvas.ctx.shadowBlur = 20;
    const v = canvas.ctx.shadowBlur;
    canvas.ctx.shadowBlur = 0;
    return v;
  });
  expect(shadowHigh).toBe(20);
});

test("options depuis la pause : retour à la pause, partie toujours en pause", async ({ page, isMobile }) => {
  test.skip(isMobile, "touche P");
  await page.goto("/");
  await startGame(page);
  await page.keyboard.press("p");
  await page.locator("#btnPauseOptions").click();
  await expect(page.locator("#optionsMenu")).toBeVisible();
  await page.locator("#btnOptionsBack").click();
  await expect(page.locator("#pauseMenu")).toBeVisible();
  expect(await game(page, ({ state }) => state.game.paused)).toBe(true);
});

test("opacité des tirs alliés : seuls les tirs du joueur deviennent transparents", async ({ page }) => {
  await page.goto("/");
  await page.locator("#btnOptions").click();
  await page.locator("#optShotOpacity").fill("20");
  await expect(page.locator("#optShotOpacityValue")).toHaveText("20%");
  await page.reload();
  expect(await game(page, ({ settings }) => settings.settings.shotOpacity)).toBe(0.2);

  // Un tir du joueur et un tir ennemi : on relève l'alpha au moment où chacun est dessiné
  const alphas = await page.evaluate(async () => {
    const { ctx } = await import("/src/core/canvas.js");
    const { world } = await import("/src/core/state.js");
    const { drawProjectiles } = await import("/src/render/entities.js");
    world.projectiles.length = 0;
    world.enemyProjectiles.length = 0;
    world.projectiles.push({ x: 100, y: 100, vx: 5, vy: 0, size: 6, color: "#00ffff" });
    world.enemyProjectiles.push({ x: 140, y: 100, vx: -5, vy: 0, size: 6, color: "#ff2a6d" });
    const seen = [];
    const draw = ctx.drawImage;
    ctx.drawImage = function (...a) {
      seen.push(Math.round(ctx.globalAlpha * 100) / 100);
      return draw.apply(this, a);
    };
    drawProjectiles();
    ctx.drawImage = draw;
    world.projectiles.length = 0;
    world.enemyProjectiles.length = 0;
    return seen;
  });
  expect(alphas).toEqual([0.2, 1]);
});
