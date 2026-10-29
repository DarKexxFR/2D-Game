// Fenêtre « Nouveautés » (ui/newsMenu.js, data/changelog.js) : vue une fois après une mise à jour.
import { expect, game, test, withSave } from "./fixtures.js";

test("un joueur qui revient voit les nouveautés une fois, puis la série du jour", async ({ page }) => {
  await withSave(page, { achievementStats: { runs: 3 }, newsSeen: "" });
  await page.goto("/");
  await expect(page.locator("#newsMenu")).toBeVisible();
  await expect(page.locator(".news-entry")).toHaveCount(1);
  await expect(page.locator(".news-item").first()).toContainText("Dix vagues de plus");
  await page.locator("#btnNewsClose").click();
  await expect(page.locator("#streakMenu")).toBeVisible(); // la série du jour suit
  const seen = await game(page, async ({ storage }) => {
    const { CHANGELOG } = await import("/src/data/changelog.js");
    return storage.account.newsSeen === CHANGELOG[0].id;
  });
  expect(seen).toBe(true);
  await page.locator("#btnStreakClaim").click();
  await page.reload();
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#newsMenu")).toBeHidden();
});

test("un tout nouveau joueur ne la voit pas ; les Options la rouvrent", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#newsMenu")).toBeHidden();
  await page.locator("#btnOptions").click();
  await page.locator("#btnNewsReplay").click();
  await expect(page.locator("#newsMenu")).toBeVisible();
  await page.locator("#btnNewsClose").click();
  await expect(page.locator("#optionsMenu")).toBeVisible();
});
