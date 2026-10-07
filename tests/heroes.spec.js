// Héros jouables, familiers, leurs coffres et le boss Nécro-Hydre.
import { expect, game, killPlayer, startGame, test, withSave } from "./fixtures.js";

const owned = (ids) => Object.fromEntries(ids.map((id) => [id, { level: 1, prestige: 1, copies: 0 }]));

test("coffres Héros et Familier : ne donnent que des héros / familiers", async ({ page }) => {
  await withSave(page, { gold: 100_000, lastFreeChest: Date.now() });
  await page.goto("/");
  const slots = await page.evaluate(async () => {
    const inv = await import("/src/services/inventory.js");
    const out = { hero: new Set(), pet: new Set() };
    for (let i = 0; i < 25; i++) {
      out.hero.add(inv.openChest("hero").item.slot);
      out.pet.add(inv.openChest("pet").item.slot);
    }
    return { hero: [...out.hero], pet: [...out.pet] };
  });
  expect(slots.hero).toEqual(["hero"]);
  expect(slots.pet).toEqual(["pet"]);

  await page.locator("#btnShop").click();
  await page.locator(".chest-hero .shop-btn").click();
  await expect(page.locator("#chestReveal")).toBeVisible();
  await expect(page.locator(".reveal-result")).toHaveText(/NOUVEL OBJET|Doublon|converti/);
});

test("écran Équipement : onglets Héros / Familiers, équiper puis retirer un familier", async ({ page }) => {
  await withSave(page, { lastFreeChest: Date.now(), items: owned(["blaster", "pilot", "titan", "medic"]) });
  await page.goto("/");
  await page.locator("#btnInventory").click();
  await page.locator("#invTabHero").click();
  await page.locator(".item-card", { hasText: "Titan" }).locator("button", { hasText: "ÉQUIPER" }).click();
  await expect(page.locator("#equippedHero")).toContainText("Titan");

  await page.locator("#invTabPet").click();
  const medic = page.locator(".item-card", { hasText: "Médic" });
  await medic.locator("button", { hasText: "ÉQUIPER" }).click();
  await expect(page.locator("#equippedPet")).toContainText("Médic");
  await medic.locator("button", { hasText: "RETIRER" }).click();
  await expect(page.locator("#equippedPet")).toContainText("Aucun familier");
  const eq = await game(page, ({ storage }) => ({ ...storage.account.equipped }));
  expect(eq).toMatchObject({ hero: "titan", pet: null });
});

test("les héros appliquent leurs bonus en partie", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  const heroes = ["pilot", "ninja", "titan", "mage", "pirate"];
  await withSave(page, { lastFreeChest: Date.now(), items: owned(["blaster", ...heroes]) });
  await page.goto("/");
  const results = {};
  for (const hero of heroes) {
    await game(page, ({ storage }, h) => (storage.account.equipped.hero = h), hero);
    await page.locator("#btnPlay").click(); // sans startGame : on lit les PV réels du héros
    results[hero] = await game(page, ({ state }) => {
      const p = state.player;
      return {
        hull: p.hero.hull,
        maxHealth: p.maxHealth,
        speed: p.baseSpeed,
        kunai: p.inventory["Kunai"] || 0,
        aura: p.auraRadius,
        gold: p.goldBonus,
        crit: p.critChance,
      };
    });
    await killPlayer(page);
    await page.locator("#btnGameOverMenu").click();
  }
  const base = results.pilot;
  expect(results.ninja.kunai).toBe(1);
  expect(results.ninja.speed).toBeGreaterThan(base.speed);
  expect(results.titan.maxHealth).toBeGreaterThan(base.maxHealth + 100);
  expect(results.titan.speed).toBeLessThan(base.speed);
  expect(results.mage.aura).toBeGreaterThan(0);
  expect(results.pirate.gold).toBeCloseTo(0.5);
  expect(results.pirate.crit).toBeGreaterThan(base.crit);
  expect(new Set(Object.values(results).map((r) => r.hull)).size).toBe(5);
});

for (const pet of ["drone", "collector", "medic", "reaper"]) {
  test(`le familier ${pet} agit en jeu`, async ({ page, isMobile }) => {
    test.skip(isMobile, "une seule plateforme suffit");
    await withSave(page, {
      lastFreeChest: Date.now(),
      items: owned(["blaster", "pilot", pet]),
      equipped: { weapon: "blaster", hero: "pilot", pet },
    });
    await page.goto("/");
    await startGame(page);
    expect(await game(page, ({ state }) => state.pet.kind)).toBe(pet);

    if (pet === "medic") {
      await game(page, ({ state }) => {
        state.game.spawnTimer = 1e9; // aucun ennemi pour ne pas fausser les PV
        state.world.enemies.length = 0;
        state.player.buffs.shield = 1e9; // bouclier : les ennemis ne peuvent plus le blesser
        state.player.health = 10;
      });
      await expect
        .poll(() => game(page, ({ state }) => state.player.health), { timeout: 8000 })
        .toBeGreaterThan(10);
    } else if (pet === "collector") {
      expect(await game(page, ({ state }) => state.player.magnetRadius)).toBeGreaterThan(200);
    } else {
      // Le drone tire et la faucheuse tranche : un ennemi immobile collé au joueur finit par prendre des dégâts
      await game(page, ({ state, spawner }) => {
        state.game.spawnTimer = 1e9;
        state.world.enemies.length = 0;
        spawner.spawnEnemy("tank", state.player.worldX + 80, state.player.worldY);
        const e = state.world.enemies[0];
        e.speed = e.baseSpeed = 0;
        e.health = e.maxHealth = 1e6;
      });
      await expect
        .poll(() => game(page, ({ state }) => state.world.enemies[0]?.health ?? 1e6), { timeout: 8000 })
        .toBeLessThan(1e6);
    }
    await killPlayer(page);
  });
}

test("Nécro-Hydre : vague 12, tire avec ses têtes et invoque à mi-vie", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await page.goto("/");
  await startGame(page);
  const before = await game(page, ({ state, spawner }) => {
    state.game.spawnTimer = 1e9;
    state.world.enemies.length = 0;
    state.game.wave = 11;
    spawner.startNextWave(); // vague 12 → boss
    return state.game.pendingBosses.map((b) => b.type);
  });
  expect(before).toEqual(["hydra"]);
  await expect
    .poll(() => game(page, ({ state }) => state.world.enemies.some((e) => e.type === "hydra")))
    .toBe(true);
  await expect.poll(() => game(page, ({ state }) => state.world.enemyProjectiles.length)).toBeGreaterThan(0);

  await game(page, ({ state }) => {
    const h = state.world.enemies.find((e) => e.type === "hydra");
    h.health = h.maxHealth * 0.4;
  });
  await expect
    .poll(() => game(page, ({ state }) => state.world.enemies.filter((e) => e.type === "hydra_spawn").length))
    .toBeGreaterThanOrEqual(6);
  await killPlayer(page);
});
