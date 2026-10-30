// Écran d'accueil : héros équipé mis en scène, raccourcis et infos des tuiles.
import { expect, test, withSave } from "./fixtures.js";

test("accueil : héros équipé, tuiles et accès rapides", async ({ page }) => {
  await withSave(page, {
    gold: 321,
    lastFreeChest: Date.now(),
    items: {
      blaster: { level: 1, prestige: 1 },
      pilot: { level: 1, prestige: 1 },
      mage: { level: 1, prestige: 1 },
    },
    equipped: { weapon: "blaster", armor: null, hero: "mage", pet: null },
    talents: { power: 2, vitality: 1 },
  });
  await page.goto("/");
  await expect(page.locator("#homeHeroName")).toHaveText("MAGE");
  await expect(page.locator("#acGoldDisplay")).toHaveText("321");
  await expect(page.locator("#talentTileSub")).toHaveText("3 / 54 rangs");
  await expect(page.locator("#shopTileSub")).toContainText("Gratuit dans");
  await expect(page.locator("#btnDaily")).toHaveClass(/has-new/);
  await expect(page.locator("#dailyTileSub")).toHaveText("Nouveau défi !");

  // Toucher le héros ouvre l'équipement
  await page.locator("#heroStage").click();
  await expect(page.locator("#inventoryMenu")).toBeVisible();

  // Équiper un autre héros met l'accueil à jour
  await page.evaluate(async () => (await import("/src/services/inventory.js")).equip("pilot"));
  await page.locator("#btnInventoryBack").click();
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#homeHeroName")).toHaveText("PILOTE");
});

test("les options n'ont plus de remise à zéro de la progression", async ({ page }) => {
  await page.goto("/");
  await page.locator("#btnOptions").click();
  await expect(page.locator("#optionsMenu")).toBeVisible();
  await expect(page.locator("#optionsMenu .opt-card").first()).toBeVisible();
  await expect(page.locator("#btnReset")).toHaveCount(0);
  await page.locator("#btnOptionsBack").click();
  await expect(page.locator("#mainMenu")).toBeVisible();
});
