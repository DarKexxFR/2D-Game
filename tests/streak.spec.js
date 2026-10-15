// Série de connexion : or chaque jour d'affilée, de plus en plus jusqu'au 7e jour.
import { expect, game, test, withSave } from "./fixtures.js";

/** Jour local décalé de `offset` jours (AAAA-MM-JJ), comme services/loginStreak.js. */
function dayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

test("un tout nouveau joueur n'a pas la fenêtre (il commence par le tutoriel)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#streakMenu")).toBeHidden();
});

test("série continuée : jour 3, or récupéré une seule fois par jour", async ({ page }) => {
  await withSave(page, {
    gold: 50,
    achievementStats: { runs: 2 },
    loginStreak: { day: dayKey(-1), count: 2 },
  });
  await page.goto("/");
  await expect(page.locator("#streakMenu")).toBeVisible();
  await expect(page.locator("#streakSub")).toHaveText("Jour 3 d'affilée");
  await expect(page.locator(".streak-day")).toHaveCount(7);
  await expect(page.locator(".streak-day.today")).toContainText("JOUR 3");
  await expect(page.locator(".streak-day.past")).toHaveCount(2);
  await page.locator("#btnStreakClaim").click();
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#acGoldDisplay")).toHaveText("250");
  expect(await game(page, ({ storage }) => storage.account.loginStreak)).toEqual({ day: dayKey(), count: 3 });

  await page.reload();
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#streakMenu")).toBeHidden();
});

test("série interrompue : elle repart au jour 1", async ({ page }) => {
  await withSave(page, { achievementStats: { runs: 5 }, loginStreak: { day: dayKey(-3), count: 5 } });
  await page.goto("/");
  await expect(page.locator("#streakSub")).toHaveText("Série interrompue : elle repart de zéro !");
  await expect(page.locator("#btnStreakClaim")).toHaveText("RÉCUPÉRER +100 OR");
});

test("7e jour : grosse récompense et succès, puis le cycle recommence", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const { account } = await import("/src/services/storage.js");
    const streak = await import("/src/services/loginStreak.js");
    const day = (n) => new Date(2026, 0, n, 12);
    account.loginStreak = { day: streak.localDayKey(day(6)), count: 6 };
    const seventh = streak.claimLoginStreak(day(7));
    const again = streak.claimLoginStreak(day(7));
    const eighth = streak.getLoginStreak(day(8));
    return { seventh, again, eighth, unlocked: account.achievements.includes("streak_7") };
  });
  expect(r.seventh).toBe(1200);
  expect(r.again).toBe(0);
  expect(r.eighth).toMatchObject({ claimable: true, count: 8, slot: 1, reward: 100 });
  expect(r.unlocked).toBe(true);
});
