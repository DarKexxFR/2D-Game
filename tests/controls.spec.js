// Touches configurables (AZERTY / QWERTY) et objets au sol bien placés.
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

test("QWERTY : A fait aller à gauche sans basculer le tir auto", async ({ page, isMobile }) => {
  test.skip(isMobile, "clavier uniquement");
  await page.goto("/");
  await startGame(page);
  const before = await game(page, ({ state }) => ({ x: state.player.worldX, auto: state.player.autoShoot }));
  for (let i = 0; i < 4; i++) await page.keyboard.press("a");
  await page.keyboard.down("a");
  await page.waitForTimeout(400);
  await page.keyboard.up("a");
  const after = await game(page, ({ state }) => ({ x: state.player.worldX, auto: state.player.autoShoot }));
  expect(after.auto).toBe(before.auto);
  expect(after.x).toBeLessThan(before.x);
  await page.keyboard.press("t"); // nouvelle touche par défaut du tir auto
  expect(await game(page, ({ state }) => state.player.autoShoot)).toBe(!before.auto);
  await killPlayer(page);
});

test("réassigner une touche dans les Options", async ({ page, isMobile }) => {
  test.skip(isMobile, "clavier uniquement");
  await page.goto("/");
  await page.locator("#btnOptions").click();
  const auto = page.locator('.key-row[data-action="autoShoot"] button');
  await expect(auto).toHaveText("T");
  await auto.click();
  await expect(auto).toHaveText("Touche ?");
  await page.keyboard.press("f");
  await expect(auto).toHaveText("F");

  // Conflit : le dash prend « Z », qui est retiré de « Haut »
  await page.locator('.key-row[data-action="dash"] button').click();
  await page.keyboard.press("z");
  await expect(page.locator('.key-row[data-action="dash"] button')).toHaveText("Z");
  await expect(page.locator('.key-row[data-action="up"] button')).toHaveText("W / ↑");

  // Échap annule une réassignation
  await page.locator('.key-row[data-action="pause"] button').click();
  await page.keyboard.press("Escape");
  await expect(page.locator('.key-row[data-action="pause"] button')).toHaveText("P / ÉCHAP");

  // Les touches sont conservées et utilisées en jeu ; l'aide affiche les nouvelles touches
  await page.reload();
  await startGame(page);
  await expect(page.locator("#controls")).toContainText("F : Tir auto");
  await page.keyboard.press("f");
  expect(await game(page, ({ state }) => state.player.autoShoot)).toBe(true);
  await page.keyboard.press("t");
  expect(await game(page, ({ state }) => state.player.autoShoot)).toBe(true);
  await killPlayer(page);

  await page.locator("#btnGameOverMenu").click();
  await page.locator("#btnOptions").click();
  await page.locator("#btnResetKeys").click();
  await expect(auto).toHaveText("T");
  await expect(page.locator('.key-row[data-action="up"] button')).toHaveText("Z / W / ↑");
});

test("trousses de soin limitées et espacées, bonus dans la zone de combat", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  const r = await page.evaluate(async () => {
    const s = await import("/src/core/state.js");
    const pk = await import("/src/systems/pickups.js");
    const { MAP_BOUNDS } = await import("/src/config.js");
    s.world.lootBoxes.length = 0;
    for (let i = 0; i < 20; i++) pk.dropLootBox(100, 100); // même endroit : une seule
    const samePlace = s.world.lootBoxes.length;
    for (let i = 0; i < 20; i++) pk.dropLootBox(-1500 + i * 200, 300); // bien espacées : plafonnées
    const capped = s.world.lootBoxes.length;
    // Un ennemi mort hors du terrain laisse son soin à l'intérieur
    s.world.lootBoxes.length = 0;
    pk.dropLootBox(MAP_BOUNDS.maxX + 500, MAP_BOUNDS.minY - 500);
    const box = s.world.lootBoxes[0];
    // Sanctuaires près d'un coin
    s.player.worldX = MAP_BOUNDS.maxX - 25;
    s.player.worldY = MAP_BOUNDS.maxY - 25;
    const pts = Array.from({ length: 200 }, () => pk.arenaPointNear(s.player.worldX, s.player.worldY, 1000));
    const inside = (p) =>
      p.x > MAP_BOUNDS.minX && p.x < MAP_BOUNDS.maxX && p.y > MAP_BOUNDS.minY && p.y < MAP_BOUNDS.maxY;
    return { samePlace, capped, boxInside: inside(box), shrinesInside: pts.every(inside) };
  });
  expect(r).toEqual({ samePlace: 1, capped: 5, boxInside: true, shrinesInside: true });
  await killPlayer(page);
});
