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
  const blaster = page.locator(".item-card", { hasText: "Blaster" });
  await blaster.locator(".prestige-btn").click();
  await blaster.locator("button", { hasText: "NIV" }).click();
  await page
    .locator(".item-card", { hasText: "Mitrailleur" })
    .locator("button", { hasText: "ÉQUIPER" })
    .click();
  await expect(page.locator("#equippedWeapon")).toContainText("Mitrailleur");
  const acc = await game(page, ({ storage }) => JSON.parse(JSON.stringify(storage.account)));
  expect(acc.items.blaster).toEqual({ level: 2, prestige: 2, copies: 0 });
  expect(acc.equipped.weapon).toBe("smg");
  expect(acc.gold).toBe(5000 - 40);
});

for (const weapon of ["blaster", "smg", "shotgun", "railgun", "rocket", "plasma"]) {
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
