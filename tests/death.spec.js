// Mort du joueur : jamais de jeu figé. La mort survient au milieu d'un tick (gemmes, coffres et
// ennemis continuent d'être traités) ; l'écran « revivre » ou de fin doit toujours s'afficher et
// rester, et une erreur dans une image ne doit jamais arrêter la boucle du jeu.
import { expect, game, startGame, test } from "./fixtures.js";

test.beforeEach(async ({ isMobile }) => test.skip(isMobile, "logique de jeu : une seule plateforme suffit"));

/** Partie calme (ni petits ennemis, ni événement automatique), joueur à 1 PV, à un point du niveau suivant. */
async function fragileRun(page, { adRevive = false } = {}) {
  await page.goto("/");
  await startGame(page, { invincible: false, levelUps: true });
  await game(
    page,
    async ({ state }, adRevive) => {
      const { WAVE_SCALING } = await import("/src/data/enemies.js");
      WAVE_SCALING.baseMobs = -1e6;
      Object.assign(state.game, { wave: 4, spawnTimer: 1e9, eventTimer: 1e9, waveTimer: -1e9 });
      state.game.adReviveUsed = !adRevive; // sans pub : fin de partie directe
      state.world.enemies.length = 0;
      state.player.lastAttack = state.player.lastKunaiAttack = 1e15;
      state.player.health = 1;
      state.player.buffs.shield = 0;
      state.player.xp = state.player.xpToNextLevel - 1;
    },
    adRevive,
  );
}

const screen = (page) => page.evaluate(async () => (await import("/src/ui/screens.js")).currentScreen());

/** Le trou noir tue le joueur (avant le ramassage des gemmes) et une gemme posée sur lui le fait monter de niveau : même tick. */
async function dieThenLevelUp(page) {
  await game(page, async ({ mapEvents, state }) => {
    const { createGem } = await import("/src/systems/pickups.js");
    const p = state.player;
    mapEvents.startMapEvent("vortex");
    const ev = state.game.mapEvent;
    ev.warn = 0;
    ev.hit = -1e9; // le trou noir frappe dès ce tick
    p.worldX = ev.x;
    p.worldY = ev.y;
    createGem(p.worldX, p.worldY, 50);
  });
  await expect.poll(() => game(page, ({ state }) => state.game.over)).toBe(true);
}

/** Gemme ramassée (montée de niveau) puis coup fatal d'un ennemi, dans le même tick. */
async function levelUpThenDie(page) {
  await game(page, async ({ spawner, state }) => {
    const { createGem } = await import("/src/systems/pickups.js");
    const p = state.player;
    createGem(p.worldX, p.worldY, 50);
    spawner.spawnEnemy("tank", p.worldX, p.worldY);
    state.world.enemies[0].lastDamage = -1e9; // frappe dès ce tick
  });
  await expect.poll(() => game(page, ({ state }) => state.game.over)).toBe(true);
}

test("mort puis montée de niveau dans le même tick : l'écran de fin reste affiché", async ({ page }) => {
  await fragileRun(page);
  await dieThenLevelUp(page);
  await page.waitForTimeout(300);
  // Avant : le choix d'amélioration recouvrait l'écran de fin et relançait une partie terminée
  expect(await screen(page)).toBe("gameOver");
  expect(await game(page, ({ state }) => state.game.running)).toBe(false);

  // La partie suivante propose de nouveau ses améliorations (rien ne reste « en cours »)
  await page.locator("#btnReplay").click();
  await game(page, ({ player }) => player.gainXp(1e6));
  await expect(page.locator("#upgradeMenu")).toBeVisible();
});

test("montée de niveau puis mort dans le même tick : écran de fin, puis nouvelle partie normale", async ({
  page,
}) => {
  await fragileRun(page);
  await levelUpThenDie(page);
  await page.waitForTimeout(300);
  expect(await screen(page)).toBe("gameOver");
  await page.locator("#btnReplay").click();
  await game(page, ({ player }) => player.gainXp(1e6));
  await expect(page.locator("#upgradeMenu")).toBeVisible();
});

test("revivre avec la pub : la montée de niveau gagnée à la mort est proposée ensuite", async ({ page }) => {
  test.setTimeout(45_000);
  await fragileRun(page, { adRevive: true });
  await dieThenLevelUp(page);
  await page.waitForTimeout(300);
  expect(await screen(page)).toBe("reviveMenu");
  await game(page, ({ state }) => (state.game.mapEvent = null)); // plus de trou noir au retour
  await page.locator("#btnReviveAd").click();
  await expect(page.locator("#upgradeMenu")).toBeVisible({ timeout: 15_000 });
  expect(await game(page, ({ state }) => state.game.over)).toBe(false);
  await page.locator("#upgradeOptions > *").first().click();
  await expect(page.locator("#upgradeMenu")).toBeHidden();
  expect(await game(page, ({ state }) => state.game.running)).toBe(true);
});

test("un choix ouvert juste avant la mort ne bloque pas les suivants après la pub", async ({ page }) => {
  test.setTimeout(45_000);
  await fragileRun(page, { adRevive: true });
  await levelUpThenDie(page);
  await expect(page.locator("#reviveMenu")).toBeVisible();
  await game(page, ({ state }) => (state.world.enemies.length = 0));
  await page.locator("#btnReviveAd").click();
  // Le choix interrompu par la mort revient, puis les suivants s'ouvrent normalement
  await expect(page.locator("#upgradeMenu")).toBeVisible({ timeout: 15_000 });
  await page.locator("#upgradeOptions > *").first().click();
  await expect(page.locator("#upgradeMenu")).toBeHidden();
  await game(page, ({ player }) => player.gainXp(1e6));
  await expect(page.locator("#upgradeMenu")).toBeVisible();
});

// Erreurs provoquées exprès : chacune doit apparaître une fois, sans arrêter le jeu.
test.describe("erreur pendant la partie", () => {
  test.use({ allowedErrors: ["image cassée", "bilan illisible"] });

  test("une erreur dans une image ne fige pas le jeu", async ({ page }) => {
    await page.goto("/");
    await startGame(page);
    const t0 = await game(page, ({ canvas, state }) => {
      const { ctx } = canvas;
      ctx.clearRect = function () {
        delete ctx.clearRect; // une seule fois
        throw new Error("image cassée");
      };
      return state.game.time;
    });
    // Avant : la boucle (requestAnimationFrame) s'arrêtait pour de bon, plus rien ne bougeait
    await expect.poll(() => game(page, ({ state }) => state.game.time)).toBeGreaterThan(t0 + 500);
    expect(await game(page, ({ canvas }) => Object.hasOwn(canvas.ctx, "clearRect"))).toBe(false);
  });

  test("une erreur dans le bilan de fin affiche quand même l'écran de fin", async ({ page }) => {
    await page.goto("/");
    await startGame(page);
    await game(page, ({ state, player }) => {
      state.game.adReviveUsed = true;
      // Bilan qui plante une fois (ici en lisant les boss vaincus) : avant, plus aucun écran ne s'affichait
      const stats = state.game.stats;
      const bosses = stats.bosses;
      Object.defineProperty(stats, "bosses", {
        configurable: true,
        get() {
          Object.defineProperty(stats, "bosses", { value: bosses, writable: true });
          throw new Error("bilan illisible");
        },
      });
      player.takeDamage(1e12);
    });
    await expect(page.locator("#gameOver")).toBeVisible();
  });
});

test("Seconde chance sur un tir ennemi : la partie continue (plus de gel)", async ({ page }) => {
  await fragileRun(page);
  await game(page, async ({ state }) => {
    const { fireEnemyProjectile } = await import("/src/systems/bosses/kit.js");
    const p = state.player;
    p.revives = 1;
    p.xp = 0;
    // Plusieurs tirs sur le vaisseau : le premier tue, la renaissance efface les autres pendant le tick
    for (let i = 0; i < 5; i++)
      fireEnemyProjectile(p.worldX + 2, p.worldY, Math.PI, 0.1, { size: 8, damage: 50 });
  });
  await expect.poll(() => game(page, ({ state }) => state.player.revives)).toBe(0);
  const t0 = await game(page, ({ state }) => state.game.time);
  // Avant : le tick plantait (tableau des tirs vidé sous la boucle) et le jeu restait figé
  await expect.poll(() => game(page, ({ state }) => state.game.time)).toBeGreaterThan(t0 + 500);
  expect(await game(page, ({ state }) => state.game.over)).toBe(false);
});
