// Boss Rush : écran d'accueil du mode, enchaînement des boss, record et fin de partie.
import { expect, game, killPlayer, test } from "./fixtures.js";

/** Ouvre le Boss Rush et lance la partie (joueur invincible, sans montée de niveau). */
async function startRush(page) {
  await page.locator("#btnBossRush").click();
  await expect(page.locator("#bossRushMenu")).toBeVisible();
  await page.locator("#btnRushPlay").click();
  await expect(page.locator("#ui")).toBeVisible();
  await game(page, ({ state }) => {
    state.player.health = state.player.maxHealth = 1e7;
    state.player.xpToNextLevel = 1e12;
  });
}

test("l'écran du Boss Rush liste les boss et se ferme avec RETOUR", async ({ page }) => {
  await page.goto("/");
  await page.locator("#btnBossRush").click();
  await expect(page.locator("#rushList li")).toHaveCount(8);
  await expect(page.locator("#rushList")).toContainText("Titan de l'orage");
  await expect(page.locator("#rushBest")).toHaveText("Pas encore tenté");
  await page.locator("#btnRushBack").click();
  await expect(page.locator("#mainMenu")).toBeVisible();
});

test("Boss Rush : seulement des boss, l'un après l'autre, chacun lâche un coffre", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "logique de jeu : une seule plateforme suffit");
  await page.goto("/");
  await startRush(page);
  await expect(page.locator("#bossWarning")).toContainText("BOSS 1");
  await expect(page.locator("#waveLabel")).toHaveText("BOSS");
  await expect(page.locator("#timerContainer")).toBeHidden();
  // Le premier boss (le crabe) arrive ; aucun petit ennemi n'apparaît
  await expect
    .poll(() => game(page, ({ state }) => state.world.enemies.map((e) => e.type).join(",")), {
      timeout: 10_000,
    })
    .toBe("miniboss");
  // Le crabe vaincu lâche toujours son coffre, rend des PV et annonce le boss suivant
  const after = await page.evaluate(async () => {
    const s = await import("/src/core/state.js");
    const c = await import("/src/systems/combat.js");
    s.player.health = s.player.maxHealth * 0.5;
    c.killEnemy(s.world.enemies[0]);
    return {
      chests: s.world.bossChests.length,
      health: s.player.health / s.player.maxHealth,
      defeated: s.game.rush.defeated,
    };
  });
  expect(after).toEqual({ chests: 1, health: 0.8, defeated: 1 });
  await game(page, ({ state }) => (state.world.bossChests.length = 0));
  await expect(page.locator("#bossWarning")).toContainText("BOSS 2", { timeout: 10_000 });
  await expect(page.locator("#wave")).toHaveText("2");
  await expect
    .poll(() => game(page, ({ state }) => state.world.enemies.map((e) => e.type).join(",")), {
      timeout: 10_000,
    })
    .toBe("boss");
  // Réglé comme à sa vague habituelle (5), dans le bon biome
  expect(await game(page, ({ state }) => state.game.wave)).toBe(5);
  await killPlayer(page);
  await expect(page.locator("#finalWaveLabel")).toHaveText("Boss vaincus");
  await expect(page.locator("#finalWave")).toHaveText("1");
  await expect(page.locator("#newRecordMsg")).toBeVisible();
  // Pas de score de vague au classement local
  const local = await page.evaluate(() => localStorage.getItem("survivor_lb_v1"));
  expect(JSON.parse(local ?? "[]")).toHaveLength(0);
  // REJOUER relance un Boss Rush ; le record est affiché sur l'écran du mode
  await page.locator("#btnReplay").click();
  expect(await game(page, ({ state }) => state.game.rush?.stage)).toBe(1);
  await game(page, ({ state }) => (state.player.health = state.player.maxHealth = 1e7));
  await killPlayer(page);
  await page.locator("#btnGameOverMenu").click();
  await page.locator("#btnBossRush").click();
  await expect(page.locator("#rushBest")).toHaveText("Ton record : 1 boss vaincus");
});

test("Boss Rush : après le dernier boss, le cycle recommence plus fort", async ({ page, isMobile }) => {
  test.skip(isMobile, "logique de jeu : une seule plateforme suffit");
  await page.goto("/");
  await startRush(page);
  const waves = await game(page, ({ state, spawner }) => {
    const out = [];
    for (let i = 0; i < 9; i++) {
      state.game.pendingBosses.length = 0;
      spawner.startNextWave();
      out.push(`${state.game.pendingBosses[0].type}@${state.game.wave}`);
    }
    return out;
  });
  expect(waves).toEqual([
    "boss@5",
    "storm_titan@7",
    "slime_boss@8",
    "prism@9",
    "colossus@10",
    "hydra@12",
    "void_reaper@15",
    "miniboss@17",
    "boss@20",
  ]);
  await killPlayer(page);
});
