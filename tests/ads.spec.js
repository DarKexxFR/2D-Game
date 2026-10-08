// Publicités récompensées (fausse pub de démo) : revivre une fois par partie, coffre bonus,
// et page des conditions générales.
import { expect, game, startGame, test, withSave } from "./fixtures.js";

/** Raccourcit la fausse pub et le délai de choix pour les tests. */
async function fastAds(page, overrides = {}) {
  await page.evaluate(async (o) => {
    const { ADS } = await import("/src/config.js");
    Object.assign(ADS, { demoDurationMs: 300 }, o);
  }, overrides);
}

const kill = (page) => game(page, ({ player }) => player.takeDamage(1e12));

test("revivre avec une pub, une seule fois par partie", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await fastAds(page);
  await kill(page);
  await expect(page.locator("#reviveMenu")).toBeVisible();
  await page.locator("#btnReviveAd").click();
  await expect(page.locator("#adOverlay")).toBeVisible();
  await expect(page.locator("#adOverlay")).toBeHidden();
  await expect(page.locator("#reviveMenu")).toBeHidden();
  const s = await game(page, ({ state }) => ({
    running: state.game.running,
    over: state.game.over,
    used: state.game.adReviveUsed,
    hp: state.player.health / state.player.maxHealth,
  }));
  expect(s).toEqual({ running: true, over: false, used: true, hp: 0.5 });

  // Deuxième mort : plus d'offre, fin de partie directe
  await kill(page);
  await expect(page.locator("#gameOver")).toBeVisible();
  await expect(page.locator("#reviveMenu")).toBeHidden();
});

test("pub fermée avant la fin : pas de récompense", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await fastAds(page, { demoDurationMs: 60_000 });
  await kill(page);
  await page.locator("#btnReviveAd").click();
  await page.locator(".ad-close").click();
  await expect(page.locator("#reviveMessage")).toContainText("pas de récompense");
  expect(await game(page, ({ state }) => state.game.over)).toBe(true);
  await page.locator("#btnReviveGiveUp").click();
  await expect(page.locator("#gameOver")).toBeVisible();
});

test("sans choix, la partie se termine toute seule", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await fastAds(page, { reviveDecisionMs: 600 });
  await kill(page);
  await expect(page.locator("#reviveMenu")).toBeVisible();
  await expect(page.locator("#gameOver")).toBeVisible({ timeout: 5000 });
});

test("pas de pub pour revivre pendant le défi du jour", async ({ page }) => {
  await page.goto("/");
  await page.locator("#btnDaily").click();
  await page.locator("#btnDailyPlay").click();
  await game(page, ({ state }) => (state.player.xpToNextLevel = 1e12));
  await kill(page);
  await expect(page.locator("#gameOver")).toBeVisible();
  await expect(page.locator("#reviveMenu")).toBeHidden();
});

test("coffre bonus contre une pub, limité par jour", async ({ page }) => {
  const day = new Date().toISOString().slice(0, 10);
  await withSave(page, { gold: 0, lastFreeChest: Date.now(), adChests: { day, count: 2 } });
  await page.goto("/");
  await fastAds(page);
  await page.locator("#btnShop").click();
  await expect(page.locator("#adChestCard")).toContainText("1/3");
  await page.locator("#btnAdChest").click();
  await expect(page.locator("#chestReveal")).toBeVisible();
  expect(await game(page, ({ storage }) => storage.account.adChests)).toEqual({ day, count: 3 });
  await page.locator("#btnChestOk").click();
  await expect(page.locator("#btnAdChest")).toBeDisabled();
  await expect(page.locator("#adChestCard")).toContainText("0/3");
});

test("conditions générales accessibles depuis l'accueil et les options", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".home-legal")).toHaveAttribute("href", "legal.html");
  await page.locator("#btnOptions").click();
  await expect(page.locator(".option-legal")).toBeVisible();
  await page.goto("/legal.html");
  await expect(page.locator("h1")).toHaveText("Conditions générales d'utilisation");
  await expect(page.locator("#pubs")).toBeVisible();
});
