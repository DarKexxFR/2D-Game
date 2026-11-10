// Défi entre amis (services/friendChallenge.js, ui/challengeMenu.js) : un code = la même partie pour tous,
// le lien emporte le score à battre.
import { expect, game, killPlayer, test, withSave } from "./fixtures.js";

/** Pas de partage natif : le lien part dans le presse-papiers (relu par le test). */
async function fakeClipboard(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    window.__copied = "";
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async (t) => (window.__copied = t) },
      configurable: true,
    });
  });
}

test("créer un défi, le jouer, puis le partager avec son score", async ({ page }) => {
  await fakeClipboard(page);
  await withSave(page, { tutorialDone: true });
  await page.goto("/");
  await page.locator("#btnDaily").click();
  await page.locator("#btnChallenges").click();
  await expect(page.locator("#challengeMenu")).toBeVisible();
  expect(await page.evaluate(() => location.hash)).toBe("#modal=defi-ami");
  await page.locator("#btnChallengeNew").click();
  await expect(page.locator("#challengeCard")).toBeVisible();
  const code = await page.locator("#challengeCurrent").textContent();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  await expect(page.locator("#challengeBest")).toHaveText("Pas encore joué");

  await page.locator("#btnChallengePlay").click();
  await expect(page.locator("#ui")).toBeVisible();
  const run = await page.evaluate(async (code) => {
    const { game, player } = await import("/src/core/state.js");
    const { challengeRules } = await import("/src/services/friendChallenge.js");
    const rules = challengeRules(code);
    player.health = player.maxHealth = 1e7;
    player.xpToNextLevel = 1e12;
    return {
      challenge: game.challenge,
      hero: player.hero.id,
      weapon: player.weapon.id,
      rules: { hero: rules.hero, weapon: rules.weapon, seed: rules.seed },
      level: player.level,
    };
  }, code);
  expect(run.challenge).toEqual({ code, seed: run.rules.seed });
  expect(run.hero).toBe(run.rules.hero);
  expect(run.weapon).toBe(run.rules.weapon);

  await game(page, ({ state }) => {
    state.game.wave = 7;
    state.game.totalRunXp = 1234;
  });
  await killPlayer(page);
  await expect(page.locator("#gameOver")).toBeVisible();
  await expect(page.locator("#challengeResult")).toContainText("Nouveau record du défi");
  await expect(page.locator("#btnChallengeSend")).toBeVisible();
  await page.locator("#btnChallengeSend").click();
  const copied = await page.evaluate(() => window.__copied);
  expect(copied).toContain(`#defi=${code}.7.1234.`);

  // Le défi est gardé dans le compte avec son record
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("survivor_save_v11")).challenges[0],
  );
  expect(saved).toMatchObject({ code, best: { wave: 7, xp: 1234 }, target: null });

  // REJOUER relance le même défi
  await page.locator("#btnReplay").click();
  await expect(page.locator("#ui")).toBeVisible();
  expect(await game(page, ({ state }) => state.game.challenge?.code)).toBe(code);
});

test("lien d'un ami : défi ouvert avec le score à battre, puis battu", async ({ page }) => {
  await withSave(page, { tutorialDone: true });
  await page.goto("/#defi=K7Q2M9.5.1000.Reda%20%C3%A9");
  await expect(page.locator("#challengeMenu")).toBeVisible();
  await expect(page.locator("#challengeCurrent")).toHaveText("K7Q2M9");
  await expect(page.locator("#challengeTarget")).toHaveText("À battre : Reda é · vague 5 · 1000 XP");
  // Le lien est retiré de l'adresse (un rechargement ne le rouvre pas)
  expect(await page.evaluate(() => location.hash)).toBe("#modal=defi-ami");

  await page.locator("#btnChallengePlay").click();
  await expect(page.locator("#ui")).toBeVisible();
  await game(page, ({ state }) => {
    state.player.health = state.player.maxHealth = 1e7;
    state.player.xpToNextLevel = 1e12;
    state.game.wave = 6;
  });
  await killPlayer(page);
  await expect(page.locator("#challengeResult")).toContainText("DÉFI RELEVÉ ! Tu bats Reda é");
  await expect(page.locator("#challengeResult")).toHaveClass(/won/);
  expect(await game(page, ({ storage }) => storage.account.achievementStats.challengeWins)).toBe(1);
  // Hors classements : rien dans le classement local
  expect(await page.evaluate(() => localStorage.getItem("survivor_lb_v1"))).toBeNull();
});

test("même code, mêmes règles ; code invalide refusé", async ({ page }) => {
  await page.goto("/");
  const same = await page.evaluate(async () => {
    const { challengeRules, normalizeCode } = await import("/src/services/friendChallenge.js");
    const a = challengeRules("K7Q2M9");
    const b = challengeRules(normalizeCode(" k7q-2m9 "));
    return JSON.stringify(a) === JSON.stringify(b);
  });
  expect(same).toBe(true);
  await page.evaluate(() => (location.hash = "#modal=defi-ami"));
  await page.reload();
  await expect(page.locator("#challengeMenu")).toBeVisible();
  await page.locator("#challengeCode").fill("OOPS1");
  await page.locator("#btnChallengeJoin").click();
  await expect(page.locator("#challengeError")).toContainText("Code invalide");
  await page.locator("#challengeCode").fill("k7q2m9");
  await page.locator("#challengeCode").press("Enter");
  await expect(page.locator("#challengeCurrent")).toHaveText("K7Q2M9");
  await expect(page.locator("#challengeList li")).toHaveCount(1);
});
