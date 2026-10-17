// Mode Endless Pulse (systems/endless.js) : vaincre le boss final le lance sans arrêter la partie (simple
// annonce, pas d'écran de victoire) ; mutations qui se cumulent à chaque vague, récompenses en hausse,
// classement à part.
import { expect, game, killPlayer, startGame, test, withSave } from "./fixtures.js";

test.beforeEach(async ({ isMobile }) => test.skip(isMobile, "logique de jeu : une seule plateforme suffit"));

/** Partie arrivée à la vague 30 : le Cœur du Pulse est vaincu. */
async function beatFinalBoss(page) {
  return game(page, ({ state, spawner, combat }) => {
    state.player.health = state.player.maxHealth = 1e7;
    state.game.wave = 30;
    state.game.isBossWave = true;
    state.world.enemies.length = 0;
    state.game.pendingBosses.length = 0;
    spawner.spawnEnemy("pulse_core", state.player.worldX + 400, state.player.worldY);
    const boss = state.world.enemies.find((e) => e.type === "pulse_core");
    state.game.totalRunXp = 5000; // une partie sans XP n'irait pas au classement
    combat.killEnemy(boss);
    return {
      endless: state.game.endless,
      running: state.game.running,
      paused: state.game.paused,
    };
  });
}

test("boss final vaincu : l'Endless Pulse se lance tout seul, une mutation par vague, score à part", async ({
  page,
  supabase,
}) => {
  await withSave(page, { tutorialDone: true, lastFreeChest: Date.now() });
  await page.addInitScript(() => localStorage.setItem("survivor_pseudo", "Testeur"));
  await page.goto("/");
  await startGame(page);
  const kill = await beatFinalBoss(page);

  // Pas d'écran de victoire : la partie continue, une annonce suffit
  expect(kill).toEqual({ endless: { depth: 0, stacks: {} }, running: true, paused: false });
  await expect(page.locator("#bossWarning")).toContainText("ENDLESS PULSE");
  await expect(page.locator("#ui")).toBeVisible();
  await expect(page).toHaveURL(/#jeu$/);

  // Vague suivante : première pulsation
  const first = await game(page, ({ state, spawner }) => {
    spawner.startNextWave();
    return {
      wave: state.game.wave,
      depth: state.game.endless.depth,
      stacks: Object.values(state.game.endless.stacks).reduce((a, b) => a + b, 0),
      xp: state.game.modifier.enemyXp,
    };
  });
  expect(first).toMatchObject({ wave: 31, depth: 1, stacks: 1 });
  expect(first.xp).toBeCloseTo(1.08);
  await expect(page.locator("#waveLabel")).toHaveText("PULSE 1 · VAGUE");

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

test("pas d'Endless Pulse hors survie normale (défi du jour)", async ({ page }) => {
  await withSave(page, { tutorialDone: true, lastFreeChest: Date.now() });
  await page.goto("/");
  await page.locator("#btnDaily").click();
  await page.locator("#btnDailyPlay").click();
  await expect(page.locator("#ui")).toBeVisible();
  const kill = await beatFinalBoss(page);
  expect(kill.endless).toBeNull();
  const wave = await game(page, ({ state, spawner }) => {
    spawner.startNextWave();
    return state.game.endless;
  });
  expect(wave).toBeNull();
});
