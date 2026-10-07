// Défi quotidien : règles identiques pour tous, graine imposée et classement du jour.
import { expect, game, killPlayer, startGame, test, withSave } from "./fixtures.js";

test("même défi pour tout le monde le même jour", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const d = await import("/src/services/daily.js");
    const a = d.dailyChallenge("2026-10-07");
    const b = d.dailyChallenge("2026-10-07");
    const days = new Set(
      ["01", "02", "03", "04", "05", "06", "07", "08"].map((x) =>
        JSON.stringify(d.dailyChallenge(`2026-11-${x}`)),
      ),
    );
    return { same: JSON.stringify(a) === JSON.stringify(b), distinct: days.size };
  });
  expect(r.same).toBe(true);
  expect(r.distinct).toBeGreaterThan(1);
});

test("jouer le défi : équipement imposé, graine, score envoyé au classement du jour", async ({
  page,
  supabase,
}) => {
  await withSave(page, { level: 20, lastFreeChest: Date.now() });
  await page.addInitScript(() => localStorage.setItem("survivor_pseudo", "Testeur"));
  supabase.scores = [{ name: "Ace", wave: 9, xp: 4200, lvl: 12 }];
  await page.goto("/");
  await page.locator("#btnDaily").click();
  await expect(page.locator("#dailyMenu")).toBeVisible();
  const daily = await page.evaluate(async () => (await import("/src/services/daily.js")).dailyChallenge());
  await expect(page.locator("#dailyLbContent")).toContainText("Ace");
  await expect(page.locator("#dailyBest")).toContainText("Pas encore joué");

  await page.locator("#btnDailyPlay").click();
  await expect(page.locator("#ui")).toBeVisible();
  const run = await game(page, ({ state }) => ({
    day: state.game.daily?.day,
    hero: state.player.hero.id,
    weapon: state.player.weapon.id,
    seeded: !Math.random.toString().includes("[native code]"),
  }));
  expect(run).toEqual({ day: daily.day, hero: daily.hero, weapon: daily.weapon, seeded: true });

  await game(page, ({ state }) => (state.game.totalRunXp = 1234));
  await killPlayer(page);
  await expect(page.locator("#onlineStatus")).toContainText("Défi du jour");
  const post = supabase.posts.at(-1);
  expect(post).toMatchObject({ name: "Testeur", day: daily.day, xp: 1234 });
  expect(await page.evaluate(() => Math.random.toString().includes("[native code]"))).toBe(true);

  // Le record du jour est retenu, et « REJOUER » relance le défi
  await page.locator("#btnGameOverMenu").click();
  await page.locator("#btnDaily").click();
  await expect(page.locator("#dailyBest")).toContainText("1234 XP");
  await page.locator("#btnDailyBack").click();
  await startGame(page);
  expect(await game(page, ({ state }) => state.game.daily)).toBeNull();
  await killPlayer(page);
});
