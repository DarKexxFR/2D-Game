// Coffres, équipement, niveau, prestige et coffre gratuit.
import { expect, game, killPlayer, startGame, test, withSave } from "./fixtures.js";

test("une ancienne sauvegarde sans équipement est migrée", async ({ page }) => {
  await withSave(page, { level: 3, gold: 42, petLevels: { drone: 2 } });
  await page.goto("/");
  const acc = await game(page, ({ storage }) => JSON.parse(JSON.stringify(storage.account)));
  expect(acc.level).toBe(3);
  expect(acc.gold).toBe(42);
  expect(acc.items.blaster).toEqual({ level: 1, prestige: 1, copies: 0 });
  expect(acc.items.pilot).toEqual({ level: 1, prestige: 1, copies: 0 });
  // L'ancien drone acheté (niveau 2) devient le familier Drone, équipé
  expect(acc.items.drone).toEqual({ level: 2, prestige: 1, copies: 0 });
  expect(acc.petLevels.drone).toBe(0);
  expect(acc.equipped).toEqual({ weapon: "blaster", armor: null, hero: "pilot", pet: "drone" });
});

test("ouvrir des coffres donne des objets et des doublons", async ({ page }) => {
  await withSave(page, { gold: 10_000, lastFreeChest: Date.now() });
  await page.goto("/");
  await page.locator("#btnShop").click();
  await page.locator(".chest-legendary .shop-btn").click();
  await expect(page.locator("#chestReveal")).toBeVisible();
  await expect(page.locator(".reveal-result")).toHaveText(/NOUVEL OBJET|Doublon|converti/);
  while (!(await page.locator("#btnChestAgain").isDisabled())) await page.locator("#btnChestAgain").click();
  const acc = await game(page, ({ storage }) => JSON.parse(JSON.stringify(storage.account)));
  expect(acc.gold).toBe(1000); // 3 coffres à 3000
  const counted = Object.values(acc.items).reduce((n, it) => n + 1 + it.copies, 0);
  expect(counted).toBe(2 + 3); // Blaster et Pilote de départ + 3 objets
});

test("niveau, prestige et équipement depuis l'écran Équipement", async ({ page }) => {
  await withSave(page, {
    gold: 5000,
    lastFreeChest: Date.now(),
    items: { blaster: { level: 1, prestige: 1, copies: 1 }, smg: { level: 1, prestige: 1, copies: 0 } },
  });
  await page.goto("/");
  await page.locator("#btnInventory").click();
  await page.locator(".item-card", { hasText: "Blaster" }).click();
  await expect(page.locator("#itemDetail")).toContainText("Blaster");
  await page.locator("#itemDetail .prestige-btn").click();
  await page.locator("#itemDetail button", { hasText: "NIV" }).click();
  await page.locator(".item-card", { hasText: "Mitrailleur" }).click();
  await page.locator("#itemDetail button", { hasText: "ÉQUIPER" }).click();
  await expect(page.locator("#equippedWeapon")).toContainText("Mitrailleur");
  const acc = await game(page, ({ storage }) => JSON.parse(JSON.stringify(storage.account)));
  expect(acc.items.blaster).toEqual({ level: 2, prestige: 2, copies: 0 });
  expect(acc.equipped.weapon).toBe("smg");
  expect(acc.gold).toBe(5000 - 40);
});

for (const weapon of [
  "blaster",
  "smg",
  "shotgun",
  "railgun",
  "rocket",
  "plasma",
  "flamer",
  "disc",
  "tesla",
  "blades",
  "nova",
]) {
  test(`l'arme ${weapon} fonctionne en jeu`, async ({ page, isMobile }) => {
    test.skip(isMobile, "une seule plateforme suffit");
    await withSave(page, {
      lastFreeChest: Date.now(),
      items: { [weapon]: { level: 50, prestige: 5, copies: 0 }, exo: { level: 50, prestige: 5, copies: 0 } },
      equipped: { weapon, armor: "exo" },
    });
    await page.goto("/");
    await startGame(page);
    await game(page, ({ state }) => (state.player.autoShoot = true));
    await expect
      .poll(() => game(page, ({ state }) => state.game.kills), { timeout: 15_000 })
      .toBeGreaterThan(2);
    expect(await game(page, ({ state }) => state.player.weapon.id)).toBe(weapon);
    await killPlayer(page);
  });
}

test("coffre mythique : rareté mythique, objets mythiques et évolutions des nouvelles armes", async ({
  page,
}) => {
  await withSave(page, { gold: 7000, lastFreeChest: Date.now() });
  await page.goto("/");
  await page.locator("#btnShop").click();
  const tile = page.locator(".chest-mythic");
  await expect(tile).toContainText("Coffre mythique");
  await expect(tile.locator(".odds-chip", { hasText: "Mythique 15%" })).toBeVisible();
  await expect(page.locator(".chest-legendary .odds-chip", { hasText: "Mythique 3%" })).toBeVisible();
  // Tirage forcé sur la rareté mythique : seules des armes ou armures mythiques peuvent sortir
  await game(page, () => {
    Math.random = () => 0.99;
  });
  await tile.locator(".shop-btn").click();
  await expect(page.locator("#chestReveal .item-rarity")).toHaveText(/Mythique/i);
  const info = await game(page, ({ items, storage }) => ({
    gold: storage.account.gold,
    mythics: Object.values(items.ITEMS)
      .filter((it) => it.rarity === "mythic")
      .map((it) => it.slot),
    owned: Object.keys(storage.account.items).filter((id) => items.ITEMS[id].rarity === "mythic"),
  }));
  expect(info.gold).toBe(1000);
  expect(info.mythics.sort()).toEqual(["armor", "weapon"]);
  expect(info.owned).toHaveLength(1);
  // Chaque arme a son évolution
  const missing = await game(page, ({ items, upgrades }) =>
    Object.keys(items.WEAPONS).filter((id) => !upgrades.WEAPON_EVOLUTIONS.some((e) => e.weapon === id)),
  );
  expect(missing).toEqual([]);
});

test("coffre gratuit : disponible, puis compte à rebours, puis de nouveau disponible", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#btnShop")).toHaveClass(/has-free/);
  await page.locator("#btnShop").click();
  await expect(page.locator("#btnFreeChest")).toHaveText("OUVRIR !");
  await page.locator("#btnFreeChest").click();
  await expect(page.locator("#chestReveal")).toBeVisible();
  await expect(page.locator("#btnChestAgain")).toBeHidden();
  await page.locator("#btnChestOk").click();
  await expect(page.locator("#btnFreeChest")).toHaveText(/\dh \d\dm/);
  await expect(page.locator("#btnFreeChest")).toBeDisabled();
  await expect(page.locator("#btnShop")).not.toHaveClass(/has-free/);

  await page.reload();
  await page.locator("#btnShop").click();
  await expect(page.locator("#btnFreeChest")).toBeDisabled();

  await game(page, ({ storage }) => (storage.account.lastFreeChest -= 4 * 3600 * 1000));
  await expect(page.locator("#btnFreeChest")).toHaveText("OUVRIR !");
});

test("disque laser : disparaît (en fondu) au bout de sa durée de vie", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await withSave(page, {
    items: { disc: { level: 1, prestige: 0, copies: 0 } },
    equipped: { weapon: "disc" },
  });
  await page.goto("/");
  await startGame(page);
  await game(page, ({ state }) => {
    state.game.spawnTimer = 1e9;
    state.world.enemies.length = 0;
    state.player.autoShoot = false; // tir vers la souris : un disque part même sans ennemi
  });
  await expect.poll(() => game(page, ({ state }) => state.world.projectiles.length)).toBeGreaterThan(0);
  const disc = await game(page, ({ state }) => {
    state.player.lastAttack = Infinity; // plus de nouveau tir : on suit les disques déjà lancés
    for (const p of state.world.projectiles) p.tracked = true;
    const p = state.world.projectiles[0];
    return { type: p.type, life: p.life, fade: p.fade };
  });
  expect(disc.type).toBe("disc");
  expect(disc.life).toBeLessThanOrEqual(180);
  expect(disc.fade).toBeGreaterThan(0);
  await expect
    .poll(() => game(page, ({ state }) => state.world.projectiles.filter((p) => p.tracked).length), {
      timeout: 10_000,
    })
    .toBe(0);
  await killPlayer(page);
});
