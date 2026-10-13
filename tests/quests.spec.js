// Quêtes hebdomadaires : tirage de la semaine, progression, récompenses et renouvellement le lundi.
import { expect, game, startGame, test, withSave } from "./fixtures.js";

const WEDNESDAY = new Date(2026, 9, 14, 12, 0); // mercredi 14/10/2026, semaine du lundi 12/10

const weekly = (quests, extra = {}) => ({
  week: "2026-10-12",
  quests: quests.map(([id, progress, claimed = false]) => ({ id, progress, claimed })),
  bonusClaimed: false,
  ...extra,
});

test("semaine du lundi au dimanche, mêmes quêtes pour tous", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const q = await import("/src/services/quests.js");
    const ids = (key) => q.questsForWeek(key).map((x) => x.id);
    const weeks = new Set(["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"].map((k) => ids(k).join()));
    return {
      monday: q.weekKey(new Date(2026, 9, 12, 0, 1)),
      sunday: q.weekKey(new Date(2026, 9, 18, 23, 59)),
      nextMonday: q.weekKey(new Date(2026, 9, 19, 0, 0)),
      same: ids("2026-10-12").join() === ids("2026-10-12").join(),
      distinct: new Set(ids("2026-10-12")).size,
      weeks: weeks.size,
    };
  });
  expect(r.monday).toBe("2026-10-12");
  expect(r.sunday).toBe("2026-10-12");
  expect(r.nextMonday).toBe("2026-10-19");
  expect(r.same).toBe(true);
  expect(r.distinct).toBe(3);
  expect(r.weeks).toBeGreaterThan(1);
});

test("écran des quêtes : progression, récompense et quête accomplie en partie", async ({ page }) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await withSave(page, {
    gold: 0,
    lastFreeChest: Date.now(),
    weekly: weekly([
      ["kills", 1999],
      ["runs", 8],
      ["wave", 3],
    ]),
  });
  await page.goto("/");
  await expect(page.locator("#questTileSub")).toHaveText("Or à récupérer !");
  await expect(page.locator("#btnQuests")).toHaveClass(/has-new/);

  await page.locator("#btnQuests").click();
  await expect(page.locator("#questMenu")).toBeVisible();
  await expect(page).toHaveURL(/#modal=quetes$/);
  await expect(page.locator("#questReset")).toHaveText("Nouvelles quêtes dans 4j 12h");
  const cards = page.locator(".quest-card");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText("1999 / 2000");
  await expect(cards.nth(0).locator(".quest-claim")).toBeDisabled();

  await cards.nth(1).locator(".quest-claim").click();
  await expect(cards.nth(1).locator(".quest-claim")).toHaveText("RÉCUPÉRÉ");
  await expect(page.locator("#questGoldDisplay")).toHaveText("250");
  expect(await game(page, ({ storage }) => storage.account.gold)).toBe(250);

  await page.locator("#btnQuestsBack").click();
  await expect(page.locator("#questTileSub")).toHaveText("1 / 3 accomplies");
  await startGame(page);
  await page.evaluate(async () => {
    const { world } = await import("/src/core/state.js");
    const { killEnemy } = await import("/src/systems/combat.js");
    const { spawnEnemy } = await import("/src/systems/spawner.js");
    spawnEnemy("normal", 0, 0);
    killEnemy(world.enemies.at(-1));
  });
  await expect(page.locator("#achievementToast")).toContainText("Quête accomplie : Éliminer 2 000 ennemis");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("survivor_save_v11")));
  expect(saved.weekly.quests[0]).toEqual({ id: "kills", progress: 2000, claimed: false });
});

test("« atteindre » compte le record de la semaine, même sous le record de toujours", async ({ page }) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await withSave(page, {
    achievementStats: { bestWave: 30 },
    weekly: weekly([
      ["wave", 3],
      ["kills", 0],
      ["runs", 0],
    ]),
  });
  await page.goto("/");
  const progress = await page.evaluate(async () => {
    const { recordWave } = await import("/src/services/achievements.js");
    const { getWeeklyQuests } = await import("/src/services/quests.js");
    recordWave(12);
    recordWave(9);
    return getWeeklyQuests().quests[0].progress;
  });
  expect(progress).toBe(12);
});

test("les trois quêtes récupérées donnent le bonus de la semaine", async ({ page }) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await withSave(page, {
    gold: 0,
    lastFreeChest: Date.now(),
    weekly: weekly([
      ["kills", 2000],
      ["runs", 8],
      ["wave", 15],
    ]),
  });
  await page.goto("/#modal=quetes");
  await expect(page.locator("#questMenu")).toBeVisible();
  for (let i = 0; i < 3; i++) await page.locator(".quest-claim:not(:disabled)").first().click();
  await expect(page.locator(".quest-claim:not(:disabled)")).toHaveCount(0);
  await expect(page.locator("#questBonus")).toContainText("Bonus de la semaine récupéré");
  expect(await game(page, ({ storage }) => storage.account.gold)).toBe(300 + 250 + 350 + 750);
});

test("nouvelle semaine : nouvelles quêtes à zéro", async ({ page }) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await withSave(page, {
    weekly: weekly(
      [
        ["kills", 2000, true],
        ["runs", 8, true],
        ["wave", 15, true],
      ],
      { week: "2026-10-05", bonusClaimed: true },
    ),
  });
  await page.goto("/");
  await expect(page.locator("#questTileSub")).toHaveText("0 / 3 accomplies");
  const w = await game(page, ({ storage }) => storage.account.weekly);
  expect(w.week).toBe("2026-10-12");
  expect(w.bonusClaimed).toBe(false);
  expect(w.quests.every((q) => q.progress === 0 && !q.claimed)).toBe(true);
});
