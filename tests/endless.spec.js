// Victoire sur le boss final et mode Endless Pulse (systems/endless.js) : écran de victoire, mutations qui
// se cumulent à chaque vague, récompenses en hausse, classement à part.
import { expect, game, killPlayer, startGame, test, withSave } from "./fixtures.js";

test.beforeEach(async ({ isMobile }) => test.skip(isMobile, "logique de jeu : une seule plateforme suffit"));

/** Partie normale arrivée à la vague 30 : le Cœur du Pulse est vaincu. */
async function beatFinalBoss(page) {
  await startGame(page);
  return game(page, ({ state, spawner, combat }) => {
    state.game.wave = 30;
    state.game.isBossWave = true;
    state.game.spawnTimer = 1e9;
    state.world.enemies.length = 0;
    state.game.pendingBosses.length = 0;
    spawner.spawnEnemy("pulse_core", state.player.worldX + 400, state.player.worldY);
    const boss = state.world.enemies.find((e) => e.type === "pulse_core");
    const gold = state.game.runGold;
    state.game.totalRunXp = 5000; // une partie sans XP n'irait pas au classement
    combat.killEnemy(boss);
    return { gold: state.game.runGold - gold, victory: state.game.victory };
  });
}

test("victoire puis Endless Pulse : une mutation par vague, récompenses en hausse, score à part", async ({
  page,
  supabase,
}) => {
  await withSave(page, { tutorialDone: true, lastFreeChest: Date.now() });
  await page.addInitScript(() => localStorage.setItem("survivor_pseudo", "Testeur"));
  await page.goto("/");
  const kill = await beatFinalBoss(page);
  expect(kill.victory).toBe(true);
  expect(kill.gold).toBeGreaterThanOrEqual(2000);

  // Célébration (plus d'ennemis ni de minuteur), puis l'écran de victoire met la partie en pause
  await expect(page.locator("#victoryMenu")).toBeVisible({ timeout: 15_000 }); // après la célébration
  await expect(page).toHaveURL(/#modal=victoire$/);
  await expect(page.locator("#victoryGold")).toHaveText("+2000");
  const paused = await game(page, ({ state }) => ({ running: state.game.running, wave: state.game.wave }));
  expect(paused).toEqual({ running: false, wave: 30 });

  await page.locator("#btnEndless").click();
  await expect(page.locator("#victoryMenu")).toBeHidden();
  await expect(page.locator("#waveLabel")).toHaveText("PULSE 1 · VAGUE");
  const first = await game(page, ({ state }) => ({
    wave: state.game.wave,
    depth: state.game.endless.depth,
    stacks: Object.values(state.game.endless.stacks).reduce((a, b) => a + b, 0),
    xp: state.game.modifier.enemyXp,
    running: state.game.running,
  }));
  expect(first).toMatchObject({ wave: 31, depth: 1, stacks: 1, running: true });
  expect(first.xp).toBeCloseTo(1.08);

  // Chaque vague ajoute une pulsation et une mutation ; les ennemis en tiennent compte
  const later = await game(page, ({ state, spawner }) => {
    for (let i = 0; i < 4; i++) spawner.startNextWave();
    return {
      depth: state.game.endless.depth,
      stacks: Object.values(state.game.endless.stacks).reduce((a, b) => a + b, 0),
      xp: state.game.modifier.enemyXp,
      gold: state.game.modifier.goldMult,
    };
  });
  expect(later.depth).toBe(5);
  expect(later.stacks).toBe(5);
  expect(later.xp).toBeCloseTo(1.08 ** 5);
  expect(later.gold).toBeCloseTo(1.08 ** 5);

  // La pause liste les mutations
  await page.keyboard.press("Escape");
  await expect(page.locator("#pauseMenu")).toBeVisible();
  await expect(page.locator("#pauseCorruption")).toContainText("PULSATION 5");
  await page.keyboard.press("Escape");

  // Mort : score envoyé avec ses pulsations (classement Endless), succès et record retenus
  await killPlayer(page);
  await expect(page.locator("#finalTitle")).toHaveText("MORT");
  await expect(page.locator("#finalWaveLabel")).toHaveText("Vague · Pulse 5");
  await expect
    .poll(() => supabase.posts.find((p) => p.name === "Testeur"))
    .toMatchObject({ wave: 35, pulse: 5 });
  const stats = await game(page, ({ storage }) => storage.account.achievementStats);
  expect(stats).toMatchObject({ pulseVictories: 1, bestPulse: 5, endlessRuns: 1 });
});

test("terminer sur une victoire : écran de fin « VICTOIRE », sans pulsation", async ({ page, supabase }) => {
  await withSave(page, { tutorialDone: true, lastFreeChest: Date.now() });
  await page.addInitScript(() => localStorage.setItem("survivor_pseudo", "Testeur"));
  await page.goto("/");
  await beatFinalBoss(page);
  await expect(page.locator("#victoryMenu")).toBeVisible({ timeout: 15_000 }); // après la célébration
  await page.locator("#btnVictoryEnd").click();
  await expect(page.locator("#gameOver")).toBeVisible();
  await expect(page.locator("#finalTitle")).toHaveText("VICTOIRE");
  await expect(page.locator("#btnKillCam")).toBeHidden();
  await expect(page.locator("#finalWave")).toHaveText("30");
  await expect.poll(() => supabase.posts.find((p) => p.name === "Testeur")).toBeTruthy();
  expect(supabase.posts.find((p) => p.name === "Testeur").pulse).toBeUndefined();
});

test("pas de victoire hors survie normale (défi du jour)", async ({ page }) => {
  await withSave(page, { tutorialDone: true, lastFreeChest: Date.now() });
  await page.goto("/");
  await page.locator("#btnDaily").click();
  await page.locator("#btnDailyPlay").click();
  await expect(page.locator("#ui")).toBeVisible();
  await game(page, ({ state, spawner, combat }) => {
    state.player.health = state.player.maxHealth = 1e7;
    state.game.wave = 30;
    state.world.enemies.length = 0;
    spawner.spawnEnemy("pulse_core", state.player.worldX + 400, state.player.worldY);
    combat.killEnemy(state.world.enemies.find((e) => e.type === "pulse_core"));
  });
  await page.waitForTimeout(3500);
  await expect(page.locator("#victoryMenu")).toBeHidden();
  expect(await game(page, ({ state }) => state.game.victory)).toBe(false);
});
