// Forge de l'écran Équipement : 3 doublons de même emplacement et de même rareté + de l'or = un objet
// de la rareté au-dessus. Jamais de forge vers le mythique.
import { expect, game, test, withSave } from "./fixtures.js";

test("forger des armes rares donne une arme épique ; doublons et or retirés", async ({ page }) => {
  await withSave(page, {
    gold: 1000,
    items: {
      blaster: { level: 1, prestige: 1, copies: 0 },
      smg: { level: 1, prestige: 1, copies: 2 },
      shotgun: { level: 1, prestige: 1, copies: 1 },
    },
  });
  await page.goto("/");
  await page.locator("#btnInventory").click();
  await expect(page.locator("#forgePanel")).toContainText("FORGE");
  // Armes : commun → rare, rare → épique, épique → légendaire (jamais mythique)
  await expect(page.locator("#forgePanel .forge-row")).toHaveCount(3);
  const rare = page.locator('#forgePanel .forge-btn[data-rarity="rare"]');
  await expect(rare).toBeEnabled();
  await expect(page.locator('#forgePanel .forge-btn[data-rarity="common"]')).toBeDisabled();
  await rare.click();
  await expect(page.locator(".forge-result")).toBeVisible();
  const acc = await game(page, ({ storage, items }) => ({
    gold: storage.account.gold,
    copies: storage.account.items.smg.copies + storage.account.items.shotgun.copies,
    epic: Object.keys(storage.account.items).filter((id) => items.ITEMS[id].rarity === "epic").length,
    forges: storage.account.achievementStats.forges,
  }));
  expect(acc).toEqual({ gold: 1000 - 800 + 300, copies: 0, epic: 1, forges: 1 }); // + succès « Apprenti forgeron »
  await expect(rare).toBeDisabled();
});
