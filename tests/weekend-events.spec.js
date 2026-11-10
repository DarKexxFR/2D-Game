// Événements du week-end (data/weekendEvents.js, services/weekendEvent.js) : bonus de récompenses le samedi
// et le dimanche, différent chaque semaine, jamais sur le score.
import { expect, game, killPlayer, startGame, test, withSave } from "./fixtures.js";

test.use({ weekendEvents: true });

const SATURDAY = new Date(2026, 10, 14, 15, 0); // samedi 14 novembre 2026, 15 h (heure locale)
const TUESDAY = new Date(2026, 10, 10, 15, 0);

test("rotation : même événement samedi et dimanche, un autre le week-end suivant, rien en semaine", async ({
  page,
}) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const w = await import("/src/services/weekendEvent.js");
    const { WEEKEND_EVENTS } = await import("/src/data/weekendEvents.js");
    const at = (d) => w.weekendEvent(new Date(2026, 10, d, 12))?.id ?? null;
    // quatre week-ends d'affilée : chaque événement passe une fois
    const four = [14, 21, 28, 35].map(at);
    return {
      sat: at(14),
      sun: at(15),
      mon: at(16),
      fri: at(13),
      four: [...new Set(four)].length,
      count: WEEKEND_EVENTS.length,
      left: w.minutesLeft(new Date(2026, 10, 15, 23, 0)),
    };
  });
  expect(r.sat).not.toBeNull();
  expect(r.sun).toBe(r.sat);
  expect(r.mon).toBeNull();
  expect(r.fri).toBeNull();
  expect(r.four).toBe(Math.min(4, r.count));
  expect(r.left).toBe(60); // dimanche 23 h : fini lundi 0 h
});

test("samedi : bannière sur l'accueil et bonus versé en fin de partie", async ({ page }) => {
  await page.clock.setFixedTime(SATURDAY);
  await withSave(page, { tutorialDone: true, gold: 0 });
  await page.goto("/");
  const ev = await page.evaluate(async () => {
    const w = await import("/src/services/weekendEvent.js");
    return w.weekendEvent();
  });
  await expect(page.locator("#homeEvent")).toBeVisible();
  await expect(page.locator("#homeEvent")).toContainText(ev.name);
  await expect(page.locator(".home-tagline")).toBeHidden();

  await startGame(page);
  await game(page, ({ state }) => {
    state.game.runGold = 100;
    state.game.totalRunXp = 1000;
  });
  await killPlayer(page);
  await expect(page.locator("#gameOver")).toBeVisible();
  const gold = await game(page, ({ storage }) => storage.account.gold);
  expect(gold).toBe(100 + Math.floor(100 * ((ev.gold ?? 1) - 1)));
  await expect(page.locator("#runWeekendGain")).toContainText(ev.name);
});

test("en semaine : ni bannière ni bonus", async ({ page }) => {
  await page.clock.setFixedTime(TUESDAY);
  await withSave(page, { tutorialDone: true, gold: 0 });
  await page.goto("/");
  await expect(page.locator(".home-tagline")).toBeVisible();
  await expect(page.locator("#homeEvent")).toBeHidden();
  await startGame(page);
  await game(page, ({ state }) => {
    state.game.runGold = 100;
  });
  await killPlayer(page);
  await expect(page.locator("#gameOver")).toBeVisible();
  expect(await game(page, ({ storage }) => storage.account.gold)).toBe(100);
  await expect(page.locator("#runWeekendGain")).toBeHidden();
});
