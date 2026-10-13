// Duel sur un écran : écran scindé, chaque joueur joue sa propre partie de survie ; le premier mort
// perd et le gagnant empoche l'XP et l'or des deux parties. (en ligne : versus-online.spec.js)
import { expect, test } from "./fixtures.js";

/**
 * Exécute `fn(mods, arg)` avec la partie du joueur `i` chargée (0 = J1, 1 = J2) ; sans `i`,
 * avec seulement les modules. `mods` : state, player, versus, config.
 */
function run(page, i, fn, arg) {
  return page.evaluate(
    async ({ i, src, arg }) => {
      const mods = {
        state: await import("/src/core/state.js"),
        player: await import("/src/systems/player.js"),
        versus: await import("/src/systems/versus.js"),
        config: await import("/src/config.js"),
      };
      // eslint-disable-next-line no-new-func
      const fn = new Function("mods", "arg", `return (${src})(mods, arg)`);
      return i === null ? fn(mods, arg) : mods.versus.withRun(i, () => fn(mods, arg));
    },
    { i, src: fn.toString(), arg },
  );
}

/** Ouvre le duel sur cet écran ; les deux joueurs sont invincibles et ne montent pas de niveau. */
async function openDuel(page) {
  await page.goto("/");
  await page.locator("#btnVersus").click();
  await page.locator("#btnDuelLocal").click();
  for (const i of [0, 1]) {
    await run(page, i, ({ state }) => {
      state.player.health = state.player.maxHealth = 1e7;
      state.player.xpToNextLevel = 1e12;
    });
  }
}

/** Pause (Échap, ou le bouton du milieu sur mobile) puis QUITTER. */
async function quit(page, isMobile) {
  if (isMobile) await page.locator("#btnVersusPause").click();
  else await page.keyboard.press("Escape");
  await expect(page.locator("#pauseMenu")).toBeVisible();
  await page.locator("#btnQuit").click();
}

const both = (page, fn, arg) => Promise.all([0, 1].map((i) => run(page, i, fn, arg)));

test("duel : deux parties de survie indépendantes, côte à côte", async ({ page }) => {
  await openDuel(page);
  await expect(page.locator("#ui")).toBeHidden(); // chaque moitié a son propre bandeau
  expect(await run(page, null, ({ versus }) => versus.versus.split)).toBe(true);
  // Les deux parties avancent, chacune avec ses ennemis
  await expect
    .poll(
      async () => await both(page, ({ state }) => state.game.time > 500 && state.world.enemies.length > 0),
    )
    .toEqual([true, true]);
  await run(page, 1, ({ state }) => (state.game.runGold = 77));
  expect(await both(page, ({ state }) => state.game.runGold)).toEqual([0, 77]);
});

test("duel : chaque joueur a ses touches (ZQSD pour J1, flèches pour J2)", async ({ page, isMobile }) => {
  test.skip(isMobile, "clavier");
  await openDuel(page);
  const pos = () => both(page, ({ state }) => state.player.worldX);
  const [x1, x2] = await pos();
  await page.keyboard.down("d");
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(400);
  await page.keyboard.up("d");
  await page.keyboard.up("ArrowLeft");
  const [nx1, nx2] = await pos();
  expect(nx1).toBeGreaterThan(x1 + 20);
  expect(nx2).toBeLessThan(x2 - 20);
});

test("duel : la montée de niveau n'arrête que la partie du joueur, qui choisit dans sa moitié", async ({
  page,
  isMobile,
}) => {
  await openDuel(page);
  await run(page, 1, ({ state, player }) => {
    state.player.xpToNextLevel = 10;
    player.gainXp(10);
  });
  await expect(page.locator("#duelPick2")).toBeVisible();
  await expect(page.locator("#duelPick1")).toBeHidden();
  await expect(page.locator("#duelPick2 .dp-title")).toHaveText("JOUEUR 2");
  // La partie de J1 continue, celle de J2 attend
  const t = await both(page, ({ state }) => state.game.time);
  await page.waitForTimeout(300);
  const t2 = await both(page, ({ state }) => state.game.time);
  expect(t2[0]).toBeGreaterThan(t[0]);
  expect(t2[1]).toBe(t[1]);

  // Choix : flèche puis ENTRÉE pour J2 au clavier, toucher la carte sur mobile
  const second = await page.locator("#duelPick2 .dp-card h4").nth(1).textContent();
  if (isMobile) await page.locator("#duelPick2 .dp-card").nth(1).click();
  else {
    await page.waitForTimeout(400); // délai anti-validation accidentelle
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
  }
  await expect(page.locator("#duelPick2")).toBeHidden();
  const inventories = await both(page, ({ state }) => Object.keys(state.player.inventory));
  expect(inventories[0]).toEqual([]);
  expect(inventories[1]).toEqual([second.replace(/ · niv\. \d+$/, "")]);
  await expect.poll(() => run(page, 1, ({ state }) => state.game.running)).toBe(true);
});

test("duel : sans choix, la carte surlignée est prise au bout du temps imparti", async ({ page }) => {
  await openDuel(page);
  await run(page, null, ({ config }) => (config.VERSUS.pickSeconds = 0.5));
  await run(page, 0, ({ state, player }) => {
    state.player.xpToNextLevel = 10;
    player.gainXp(10);
  });
  await expect(page.locator("#duelPick1")).toBeVisible();
  await expect(page.locator("#duelPick1")).toBeHidden({ timeout: 5000 });
  expect(await run(page, 0, ({ state }) => Object.keys(state.player.inventory).length)).toBe(1);
});

test("duel : la pause arrête les deux parties", async ({ page, isMobile }) => {
  test.skip(isMobile, "touche Échap");
  await openDuel(page);
  await page.keyboard.press("Escape");
  await expect(page.locator("#pauseMenu")).toBeVisible();
  const t = await both(page, ({ state }) => state.game.time);
  await page.waitForTimeout(300);
  expect(await both(page, ({ state }) => state.game.time)).toEqual(t);
  await page.locator("#btnResume").click();
  await expect.poll(async () => (await both(page, ({ state }) => state.game.time))[1]).toBeGreaterThan(t[1]);
});

test("duel : le premier mort perd, le gagnant empoche l'XP et l'or des deux parties", async ({
  page,
  isMobile,
}) => {
  await openDuel(page);
  const gold = await page.evaluate(async () => (await import("/src/services/storage.js")).account.gold);
  await run(page, 0, ({ state }) => (state.game.runGold = 30));
  await run(page, 1, ({ state }) => (state.game.runGold = 12));
  await run(page, 0, ({ state, player }) => {
    state.player.health = 1;
    state.player.revives = 0;
    player.takeDamage(1e9);
  });
  await expect(page.locator("#versusOver")).toBeVisible();
  await expect(page.locator("#versusWinner")).toHaveText("JOUEUR 2 GAGNE !");
  await expect(page.locator("#versusScore")).toContainText("+42 or");
  const after = await page.evaluate(async () => (await import("/src/services/storage.js")).account.gold);
  expect(after - gold).toBeGreaterThanOrEqual(42); // + éventuelles récompenses de succès

  await page.locator("#btnVersusReplay").click();
  await expect(page.locator("#versusOver")).toBeHidden();
  expect(await both(page, ({ state }) => [state.game.runGold, state.game.over])).toEqual([
    [0, false],
    [0, false],
  ]);

  await quit(page, isMobile);
  await expect(page.locator("#mainMenu")).toBeVisible();
});

test("duel puis partie normale : le mode survie repart normalement", async ({ page, isMobile }) => {
  await openDuel(page);
  await quit(page, isMobile);
  await page.locator("#btnPlay").click();
  await expect(page.locator("#ui")).toBeVisible();
  expect(
    await run(page, null, ({ versus, state }) => [versus.versus.active, state.game.time < 2000]),
  ).toEqual([false, true]);
  await expect(page.locator("#duelPick1")).toBeHidden();
});

test("duel sur mobile : une moitié d'écran par joueur, toucher = dash", async ({ page, isMobile }) => {
  test.skip(!isMobile, "tactile");
  await openDuel(page);
  await expect(page.locator("#versusTouch")).toBeVisible();
  await expect(page.locator("#touchControls")).toBeHidden();
  // Portrait : J1 en bas, J2 en haut ; on glisse vers la droite dans la moitié du bas
  const box = await page.locator("#vsZone1").boundingBox();
  const x0 = await run(page, 0, ({ state }) => state.player.worldX);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.locator("#vsZone1").dispatchEvent("pointerdown", { pointerId: 7, clientX: cx, clientY: cy });
  await page
    .locator("#vsZone1")
    .dispatchEvent("pointermove", { pointerId: 7, clientX: cx + 60, clientY: cy });
  await page.waitForTimeout(300);
  await page.locator("#vsZone1").dispatchEvent("pointerup", { pointerId: 7, clientX: cx + 60, clientY: cy });
  expect(await run(page, 0, ({ state }) => state.player.worldX)).toBeGreaterThan(x0 + 20);

  // Touche rapide dans la moitié du haut : dash du joueur 2
  const top = await page.locator("#vsZone2").boundingBox();
  const tx = top.x + top.width / 2;
  const ty = top.y + top.height / 2;
  await page.locator("#vsZone2").dispatchEvent("pointerdown", { pointerId: 8, clientX: tx, clientY: ty });
  await page.locator("#vsZone2").dispatchEvent("pointerup", { pointerId: 8, clientX: tx, clientY: ty });
  await expect.poll(() => run(page, 1, ({ state }) => state.player.dashCooldownTimer > 0)).toBe(true);
  expect(await run(page, 0, ({ state }) => state.player.dashCooldownTimer)).toBe(0);

  // Bouton de compétence de J2 quand elle est prête
  await run(page, 1, ({ state }) => {
    state.player.ultCharge = state.player.maxUltCharge;
    state.player.isUltReady = true;
  });
  await page.locator("#vsSkill2").dispatchEvent("pointerdown");
  expect(await both(page, ({ state }) => state.player.isUltReady)).toEqual([false, false]);
});
