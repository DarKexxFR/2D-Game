// Talents : achat avec l'or, effets en partie, relance des améliorations et seconde chance.
import { expect, game, test, withSave } from "./fixtures.js";

test("acheter des talents puis en profiter en partie", async ({ page }) => {
  await withSave(page, { gold: 20_000, lastFreeChest: Date.now() });
  await page.goto("/");
  await page.locator("#btnTalents").click();
  await expect(page.locator("#talentMenu")).toBeVisible();
  const power = page.locator('[data-talent="power"]');
  await power.locator("button").click(); // 300
  await power.locator("button").click(); // 600
  await page.locator('[data-talent="reroll"] button').click(); // 1000
  await page.locator('[data-talent="revive"] button').click(); // 5000
  await expect(power).toContainText("2/10");
  await expect(page.locator('[data-talent="revive"] button')).toBeDisabled();
  await expect(page.locator("#talentGoldDisplay")).toHaveText(String(20_000 - 300 - 600 - 1000 - 5000));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("survivor_save_v11")).talents);
  expect(saved).toEqual({ power: 2, reroll: 1, revive: 1 });

  await page.locator("#btnTalentsBack").click();
  await page.locator("#btnPlay").click();
  const p = await game(page, ({ state }) => ({
    attack: state.player.attack,
    rerolls: state.player.rerolls,
    revives: state.player.revives,
  }));
  expect(p.attack).toBeCloseTo(8 * 1.1, 5);
  expect(p).toMatchObject({ rerolls: 1, revives: 1 });

  // Relance : nouvelles cartes, compteur décrémenté puis bouton masqué
  await page.evaluate(async () => (await import("/src/core/events.js")).emit("levelUp"));
  await expect(page.locator("#btnReroll")).toHaveText("RELANCER (1)");
  await page.locator("#btnReroll").click();
  await expect(page.locator("#btnReroll")).toBeHidden();
  await page.locator(".upgrade-option").first().click();

  // Seconde chance : le premier coup fatal laisse à 50 % des PV
  await game(page, ({ player }) => player.takeDamage(1e12));
  const after = await game(page, ({ state }) => ({
    ...state.game,
    hp: state.player.health,
    max: state.player.maxHealth,
  }));
  expect(after.over).toBe(false);
  expect(after.hp).toBeCloseTo(after.max / 2);
  await game(page, ({ player }) => player.takeDamage(1e12));
  await expect(page.locator("#gameOver")).toBeVisible();
});

test("le défi du jour ignore les talents", async ({ page }) => {
  await withSave(page, { lastFreeChest: Date.now(), talents: { power: 10, vitality: 10 } });
  await page.goto("/");
  await page.locator("#btnDaily").click();
  await page.locator("#btnDailyPlay").click();
  const p = await game(page, ({ state }) => ({ attack: state.player.attack, hero: state.player.hero.id }));
  const daily = await page.evaluate(async () => (await import("/src/services/daily.js")).dailyChallenge());
  // Attaque de base (8), seulement modifiée par le modificateur du jour
  expect(p.attack).toBeCloseTo(8 * (daily.modifier.playerAttack || 1), 5);
});
