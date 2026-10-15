// Niveaux de difficulté : Facile / Normal / Cauchemar (débloqué à la vague 10), choisis à l'accueil.
import { expect, game, killPlayer, startGame, test, withSave } from "./fixtures.js";

test("Cauchemar verrouillé tant que la vague 10 n'est pas atteinte", async ({ page }) => {
  await page.goto("/");
  const nightmare = page.locator('.diff-btn[data-diff="nightmare"]');
  await expect(page.locator('.diff-btn[data-diff="normal"]')).toHaveClass(/active/);
  await expect(nightmare).toHaveClass(/locked/);
  await nightmare.click();
  await expect(page.locator("#difficultyHint")).toHaveText("Atteins la vague 10 pour débloquer CAUCHEMAR");
  await expect(page.locator('.diff-btn[data-diff="normal"]')).toHaveClass(/active/);
});

test("Cauchemar : ennemis plus forts, élites plus tôt, récompenses et classement à part", async ({
  page,
  supabase,
  isMobile,
}) => {
  test.skip(isMobile, "logique de jeu : une seule plateforme suffit");
  await withSave(page, { achievementStats: { bestWave: 12 } });
  await page.goto("/");
  await page.locator('.diff-btn[data-diff="nightmare"]').click();
  await expect(page.locator('.diff-btn[data-diff="nightmare"]')).toHaveClass(/active/);
  await expect(page.locator("#difficultyHint")).toContainText("×1,75");
  // Le choix est retenu dans la sauvegarde
  expect(await game(page, ({ storage }) => storage.account.difficulty)).toBe("nightmare");

  await page.locator("#playerPseudo").fill("Ombre");
  await startGame(page);
  await expect(page.locator("#wave")).toHaveCSS("color", "rgb(255, 42, 109)"); // vague en rose Cauchemar
  const r = await game(page, ({ state, spawner }) => {
    state.world.enemies.length = 0;
    spawner.spawnEnemy("normal", state.player.worldX + 500, state.player.worldY, true);
    const e = state.world.enemies[0];
    return { difficulty: state.game.difficulty, mod: state.game.modifier, xp: e.xp };
  });
  expect(r.difficulty).toBe("nightmare");
  expect(r.mod).toMatchObject({ enemyHealth: 1.6, enemyDamage: 1.5, goldMult: 1.75, enemyXp: 1.75 });
  const elites = await page.evaluate(async () => {
    const { eliteChance } = await import("/src/systems/spawner.js");
    return eliteChance(3 + 5); // vague 3 en Cauchemar = vague 8 en Normal
  });
  expect(elites).toBeGreaterThan(0);

  // Score envoyé au classement Cauchemar
  await game(page, ({ state }) => (state.game.totalRunXp = 500));
  const post = page.waitForRequest(
    (req) => req.method() === "POST" && req.url().includes("nightmare_scores"),
  );
  await killPlayer(page);
  await post;
  await expect(page.locator("#finalWaveLabel")).toHaveText("Vague · CAUCHEMAR");
  await expect(page.locator("#onlineStatus")).toContainText("Cauchemar");
  expect(supabase.posts.at(-1)).toMatchObject({ xp: 500 });
});

test("Facile : ennemis plus faibles, hors classements", async ({ page, supabase, isMobile }) => {
  test.skip(isMobile, "logique de jeu : une seule plateforme suffit");
  await page.goto("/");
  await page.locator('.diff-btn[data-diff="easy"]').click();
  await page.locator("#playerPseudo").fill("Ombre");
  await startGame(page);
  const mod = await game(page, ({ state }) => state.game.modifier);
  expect(mod).toMatchObject({ enemyHealth: 0.7, enemyDamage: 0.6, goldMult: 0.7 });
  await game(page, ({ state }) => (state.game.totalRunXp = 500));
  await killPlayer(page);
  await expect(page.locator("#onlineStatus")).toHaveText("Mode Facile : hors classement mondial");
  expect(supabase.posts).toEqual([]);
});

test("onglet CAUCHEMAR du classement", async ({ page, supabase }) => {
  supabase.scores = [{ name: "Ombre", wave: 21, xp: 9000, lvl: 30 }];
  await page.goto("/");
  await page.locator("#btnLeaderboard").click();
  const req = page.waitForRequest((r) => r.url().includes("nightmare_leaderboard"));
  await page.locator("#lbTabNightmare").click();
  await req;
  await expect(page.locator("#lbContent")).toContainText("Ombre");
});

test("le duel, le défi du jour et le Boss Rush restent en Normal", async ({ page, isMobile }) => {
  test.skip(isMobile, "logique de jeu : une seule plateforme suffit");
  await page.goto("/");
  await page.locator('.diff-btn[data-diff="easy"]').click();
  await page.locator("#btnDaily").click();
  await page.locator("#btnDailyPlay").click();
  await expect(page.locator("#ui")).toBeVisible();
  expect(await game(page, ({ state }) => state.game.difficulty)).toBe("normal");
});
