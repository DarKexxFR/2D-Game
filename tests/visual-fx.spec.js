// Effets néon (config.js VISUAL_FX) : grille du sol qui ondule, halo lumineux, aberration aux gros chocs,
// calque « écran rétro », réglages des Options et mode économie (qualité basse).
import { expect, game, startGame, test } from "./fixtures.js";

test("une explosion fait onduler la grille, ondes plafonnées puis effacées", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  const r = await game(page, async ({ state, config }) => {
    const fx = await import("/src/systems/effects.js");
    const p = state.player;
    fx.createShockwave(p.worldX + 100, p.worldY, 150, "#ff2a6d");
    const one = state.world.gridPulses.length;
    for (let i = 0; i < 40; i++) fx.createShockwave(p.worldX, p.worldY, 80);
    return { one, many: state.world.gridPulses.length, max: config.VISUAL_FX.grid.pulses };
  });
  expect(r.one).toBe(1);
  expect(r.many).toBe(r.max);
  await expect.poll(() => game(page, ({ state }) => state.world.gridPulses.length)).toBe(0);
});

test("la grille s'assombrit pendant l'annonce d'une attaque de boss", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await game(page, async ({ state }) => {
    const hz = await import("/src/systems/hazards.js");
    hz.addCircle(state.player.worldX + 300, state.player.worldY, 120, 10, { delay: 600 });
  });
  await expect.poll(() => game(page, ({ state }) => state.game.gridDim)).toBeLessThan(0.6);
  await game(page, ({ state }) => (state.world.hazards.length = 0));
  await expect.poll(() => game(page, ({ state }) => state.game.gridDim)).toBeGreaterThan(0.95);
});

test("furie d'un boss : aberration chromatique pendant quelques images", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  const chroma = await game(page, async ({ state }) => {
    const kit = await import("/src/systems/bosses/kit.js");
    const boss = { enraged: false, health: 10, maxHealth: 100, baseSpeed: 1, speed: 1, x: 0, y: 0, size: 40 };
    kit.enrage(boss, "#ff0040", 1.2, "FURIE !");
    return state.game.chroma;
  });
  expect(chroma).toBeGreaterThan(0);
  await expect.poll(() => game(page, ({ state }) => state.game.chroma)).toBe(0);
});

test("halo lumineux dessiné quand il est activé, jamais en qualité basse", async ({ page }) => {
  await page.addInitScript(() => {
    window.__bloomDraws = 0;
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args) {
      if (this.canvas.id === "gameCanvas" && this.globalCompositeOperation === "screen")
        window.__bloomDraws++;
      return draw.apply(this, args);
    };
  });
  await page.goto("/");
  await game(page, ({ settings }) => settings.updateSettings({ quality: "high", fxBloom: true }));
  await startGame(page);
  await expect.poll(() => page.evaluate(() => window.__bloomDraws)).toBeGreaterThan(0);

  await game(page, ({ settings }) => settings.updateSettings({ quality: "low" }));
  await page.evaluate(() => (window.__bloomDraws = 0));
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__bloomDraws)).toBe(0);
});

test("Options : un interrupteur par effet, conservé ; qualité basse les verrouille", async ({ page }) => {
  await page.goto("/");
  await page.locator("#btnOptions").click();
  await page.locator('#optionsMenu [data-quality="high"]').click();
  const crt = page.locator('#optionsMenu [data-fx="fxCrt"]');
  const grid = page.locator('#optionsMenu [data-fx="fxGrid"]');
  await expect(crt).toHaveText("ACTIVÉ");
  await expect(page.locator("body")).toHaveClass(/fx-crt/);
  await crt.click();
  await expect(crt).toHaveText("DÉSACTIVÉ");
  await expect(page.locator("body")).not.toHaveClass(/fx-crt/);
  await grid.click();
  await expect(grid).toHaveText("DÉSACTIVÉ");

  // Qualité basse (mode économie) : seuls les effets sans coût restent réglables
  await page.locator('#optionsMenu [data-quality="low"]').click();
  await expect(grid).toBeDisabled();
  await expect(grid).toHaveText("QUALITÉ BASSE");
  await expect(crt).toBeEnabled();

  await page.reload();
  const s = await game(page, ({ settings }) => ({ ...settings.settings }));
  expect(s).toMatchObject({ fxCrt: false, fxGrid: false, quality: "low" });
});
