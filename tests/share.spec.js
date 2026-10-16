// Carte de score à partager : aperçu depuis l'écran de fin, image PNG téléchargeable.
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

test("partager sa partie : aperçu de la carte puis téléchargement du PNG", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await game(page, ({ state }) => {
    state.game.wave = 7;
    state.game.stats.kills = { normal: 40, fast: 12 };
    state.player.inventory["Force Brute"] = 3;
    state.player.inventory["Vitalité"] = 1;
  });
  await killPlayer(page);
  await expect(page.locator("#gameOver")).toBeVisible();

  await page.locator("#btnShareRun").click();
  await expect(page.locator("#shareMenu")).toBeVisible();
  await expect(page).toHaveURL(/#modal=partage$/);

  const summary = await page.evaluate(async () => {
    const { runSummary } = await import("/src/ui/shareMenu.js");
    return runSummary({ pseudo: "Test", wave: 7, valueLabel: "Vague", isNewRecord: false });
  });
  expect(summary.value).toBe(7);
  expect(summary.kills).toBe(52);
  expect(summary.mode.label).toBe("SURVIE · NORMAL");
  expect(summary.cards.map((c) => [c.name, c.count])).toEqual([
    ["Force Brute", 3],
    ["Vitalité", 1],
  ]);
  expect(summary.weapon).not.toBeNull();

  // Le canvas a été dessiné (pas tout noir)
  await expect
    .poll(() =>
      page.evaluate(() => {
        const c = /** @type {HTMLCanvasElement} */ (document.getElementById("shareCanvas"));
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
        let lit = 0;
        for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 300) lit++;
        return lit;
      }),
    )
    .toBeGreaterThan(50);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#btnShareDownload").click(),
  ]);
  expect(download.suggestedFilename()).toBe("last-pulse-vague-7.png");
  await expect(page.locator("#shareStatus")).toHaveText("Image téléchargée.");

  // RETOUR (ou le retour du navigateur) ramène à l'écran de fin
  await page.locator("#btnShareBack").click();
  await expect(page.locator("#gameOver")).toBeVisible();
  await page.locator("#btnShareRun").click();
  await expect(page.locator("#shareMenu")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#gameOver")).toBeVisible();
});
