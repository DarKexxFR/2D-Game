// Visuels : vaisseaux des héros et pièces animées des boss dessinés en code, illustrations dans les menus
// (data/art.js : fiches d'équipement et du bestiaire seulement, jamais en jeu).
import { expect, game, startGame, test, withSave } from "./fixtures.js";

test("chaque héros a une coque détaillée, cache borné même en arc-en-ciel", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const ships = await import("/src/render/ships.js");
    const { HEROES } = await import("/src/data/items.js");
    const c = document.createElement("canvas").getContext("2d");
    const missing = Object.values(HEROES)
      .map((h) => h.hull)
      .filter((hull) => !ships.hasShipDesign(hull));
    for (const h of Object.values(HEROES)) ships.drawDesignedShip(c, 50, 50, 20, 0, h.color, true, 0, h.hull);
    for (let i = 0; i < 400; i++) {
      const color = `#${(i * 40503).toString(16).padStart(6, "0").slice(-6)}`;
      ships.drawDesignedShip(c, 50, 50, 20, 0, color, true, i * 16, "seraph");
    }
    return { missing, size: ships.shipCacheSize() };
  });
  expect(r.missing).toEqual([]);
  expect(r.size).toBeLessThanOrEqual(96);
});

test("boss : pièces animées dessinées sans erreur (Cœur, Crabe, Œil, autre boss)", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  for (const type of ["pulse_core", "miniboss", "boss", "colossus"]) {
    await game(
      page,
      ({ state, spawner }, type) => {
        state.game.spawnTimer = 1e9;
        state.world.enemies.length = 0;
        spawner.spawnEnemy(type, state.player.worldX + 250, state.player.worldY);
      },
      type,
    );
    await page.waitForTimeout(300);
    const layered = await page.evaluate(async () => {
      const { hasBossLayers } = await import("/src/render/bossLayers.js");
      const { world } = await import("/src/core/state.js");
      return world.enemies.filter((e) => e.template.isBoss).every(hasBossLayers);
    });
    expect(layered).toBe(true);
  }
});

test("illustrations : fiche d'un héros obtenu, ombre d'une arme non obtenue", async ({ page }) => {
  await withSave(page, { tutorialDone: true });
  await page.goto("/");
  await page.locator("#btnInventory").click();
  await page.getByRole("button", { name: /HÉROS/ }).first().click();
  const art = page.locator("#itemDetail img.detail-art");
  await expect(art).toHaveAttribute("src", "assets/art/hero-pilot.webp");
  await expect
    .poll(() => art.evaluate((img) => /** @type {HTMLImageElement} */ (img).naturalWidth))
    .toBeGreaterThan(0);
  await expect(art).not.toHaveClass(/locked/);

  await page.getByRole("button", { name: /ARMES/ }).first().click();
  await page.getByText("Canon plasma").first().click();
  await expect(page.locator("#itemDetail img.detail-art")).toHaveClass(/locked/);
});

test("illustrations : toutes présentes, fiche du bestiaire débloquée seulement", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const names = await page.evaluate(async () => {
    const art = await import("/src/data/art.js");
    return [...Object.values(art.ITEM_ART), ...Object.values(art.ENEMY_ART)];
  });
  for (const n of names) expect((await request.get(`/assets/art/${n}.webp`)).ok()).toBe(true);

  await withSave(page, { tutorialDone: true, bestiary: { pulse_core: 1 } });
  await page.goto("/bestiaire.html#fiche-pulse_core");
  await expect(page.locator("#bsEntry img.bs-art")).toHaveAttribute("src", "assets/art/boss-pulse-core.webp");
  await page.goto("/bestiaire.html#fiche-boss");
  await expect(page.locator("#bsEntry")).toHaveClass(/locked/);
  await expect(page.locator("#bsEntry img.bs-art")).toHaveCount(0);
});

test("chaque forme de skin a un plan détaillé", async ({ page }) => {
  await page.goto("/");
  const missing = await page.evaluate(async () => {
    const ships = await import("/src/render/ships.js");
    const { SKIN_HULLS } = await import("/src/data/skins.js");
    const c = document.createElement("canvas").getContext("2d");
    const ids = SKIN_HULLS.map((h) => h.id).filter((id) => id !== "hero");
    for (const id of ids) ships.drawDesignedShip(c, 50, 50, 20, 0.5, "#00ffff", true, 1234, id);
    return ids.filter((id) => !ships.hasShipDesign(id));
  });
  expect(missing).toEqual([]);
});

test("chaque boss a ses propres pièces, chaque ennemi et familier ses détails animés", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  const r = await page.evaluate(async () => {
    const { ENEMY_TYPES } = await import("/src/data/enemies.js");
    const { PETS } = await import("/src/data/items.js");
    const bosses = await import("/src/render/bossLayers.js");
    const mobs = await import("/src/render/mobLayers.js");
    const pets = await import("/src/render/petParts.js");
    const { player } = await import("/src/core/state.js");
    const types = Object.entries(ENEMY_TYPES);
    const ownBoss = new Set(bosses.bossLayerTypes());
    const ownMob = new Set(mobs.mobLayerTypes());
    // Chaque pièce se dessine sans erreur, en charge d'attaque et en furie
    for (const [type, t] of types) {
      const e = { type, template: t, x: player.worldX + 100, y: player.worldY, size: t.size, color: t.color };
      Object.assign(e, { attackTimer: 10, skillTimer: 10, enraged: true, heading: 0.3, facing: 1 });
      if (t.isBoss) bosses.drawBossLayers(e, 5000);
      else mobs.drawMobLayers(e, 5000);
    }
    for (const kind of Object.keys(PETS)) pets.drawPetParts(kind, 100, 100, 10, "#00ffff", 5000, 0.4);
    return {
      bossMissing: types.filter(([id, t]) => t.isBoss && !ownBoss.has(id)).map(([id]) => id),
      mobMissing: types.filter(([id, t]) => !t.isBoss && !ownMob.has(id)).map(([id]) => id),
      petMissing: Object.keys(PETS).filter((k) => !pets.petPartKinds().includes(k)),
    };
  });
  expect(r.bossMissing).toEqual([]);
  expect(r.mobMissing).toEqual([]);
  expect(r.petMissing).toEqual([]);
});

test("détails des ennemis plafonnés par image, coupés en qualité basse", async ({ page }) => {
  await page.goto("/");
  await startGame(page, { invincible: true });
  await game(page, ({ state, spawner }) => {
    state.game.spawnTimer = 1e9;
    state.world.enemies.length = 0;
    for (let i = 0; i < 150; i++) {
      const a = (i / 150) * Math.PI * 2;
      spawner.spawnEnemy(
        "normal",
        state.player.worldX + Math.cos(a) * 200,
        state.player.worldY + Math.sin(a) * 200,
      );
    }
  });
  await page.waitForTimeout(200);
  const drawn = await page.evaluate(async () => (await import("/src/render/mobLayers.js")).mobLayersDrawn());
  expect(drawn).toBe(80);
  await game(page, ({ settings }) => settings.updateSettings({ quality: "low" }));
  await page.waitForTimeout(200);
  expect(await page.evaluate(async () => (await import("/src/render/mobLayers.js")).mobLayersDrawn())).toBe(
    0,
  );
});
