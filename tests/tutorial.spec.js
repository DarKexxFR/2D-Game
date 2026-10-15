// Tutoriel de la première partie : bulles qui avancent avec les actions du joueur, facultatif.
import { expect, game, startGame, test, withSave } from "./fixtures.js";

const bubble = (page) => page.locator("#tutorialBubble");
const text = (page) => page.locator("#tutorialText");

test("première partie : les bulles suivent les actions jusqu'à la fin du tutoriel", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await expect(text(page)).toContainText(/Déplace-toi|glisse pour te déplacer/);

  await game(page, ({ state }) => (state.player.worldX += 300));
  await expect(text(page)).toContainText("tire tout seul");

  await game(page, ({ state }) => (state.game.kills = 5));
  await expect(text(page)).toContainText(/dash/i);
  await page.keyboard.down("Space");
  await expect(text(page)).toContainText("cristaux d'XP");
  await page.keyboard.up("Space");

  await game(page, ({ state }) => (state.player.level = 2));
  // La compétence attend que sa jauge soit pleine
  await expect(bubble(page)).toBeHidden();
  await game(page, ({ state }) => (state.player.isUltReady = true));
  await expect(text(page)).toContainText("est chargée");
  await page.keyboard.press("r");

  await expect(text(page)).toContainText("Tutoriel terminé");
  await expect(page.locator("#btnTutorialSkip")).toBeHidden();
  expect(await game(page, ({ storage }) => storage.account.tutorialDone)).toBe(true);
  await expect(bubble(page)).toBeHidden({ timeout: 8000 });
});

test("PASSER le coupe pour de bon ; les Options permettent de le revoir", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await expect(bubble(page)).toBeVisible();
  await page.locator("#btnTutorialSkip").click();
  await expect(bubble(page)).toBeHidden();

  // Après rechargement, une nouvelle partie se lance sans tutoriel
  await page.reload();
  await startGame(page);
  await page.waitForTimeout(500);
  await expect(bubble(page)).toBeHidden();

  await page.reload();
  await page.locator("#btnOptions").click();
  await page.locator("#btnTutorialReplay").click();
  await expect(page.locator("#tutorialReplayHint")).toContainText("prochaine partie");
  await page.locator("#btnOptionsBack").click();
  await startGame(page);
  await expect(text(page)).toContainText(/Déplace-toi|glisse pour te déplacer/);
});

test("un joueur qui a déjà fini des parties ne le voit pas", async ({ page }) => {
  await withSave(page, { level: 3, gold: 100, achievementStats: { runs: 4 } });
  await page.goto("/");
  await page.locator("#btnStreakClaim").click(); // série de connexion proposée à l'arrivée
  await startGame(page);
  await page.waitForTimeout(500);
  await expect(bubble(page)).toBeHidden();
});

test("pas de tutoriel en défi du jour", async ({ page }) => {
  await page.goto("/");
  await page.locator("#btnDaily").click();
  await page.locator("#btnDailyPlay").click();
  await expect(page.locator("#ui")).toBeVisible();
  await page.waitForTimeout(500);
  await expect(bubble(page)).toBeHidden();
});
