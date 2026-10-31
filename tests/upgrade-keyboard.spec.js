// Choix d'une amélioration sans souris (touches 1 / 2 / 3, flèches ou ZQSD + Entrée / Espace),
// en partie normale comme en duel sur un écran (chaque joueur avec ses touches).
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

test.beforeEach(async ({ isMobile }) => test.skip(isMobile, "clavier uniquement"));

/** Cartes proposées (titres), et celle qui est surlignée. */
async function cards(page) {
  const names = await page.locator(".upgrade-option h4").allTextContents();
  const selected = await page
    .locator(".upgrade-option")
    .evaluateAll((els) => els.findIndex((c) => c.classList.contains("selected")));
  return { names, selected };
}

/** Améliorations possédées (noms). */
function owned(page) {
  return game(page, ({ state }) => Object.keys(state.player.inventory));
}

test("montée de niveau : touche 2, puis flèches + Entrée, puis ZQSD + Espace", async ({ page }) => {
  await page.goto("/");
  await startGame(page, { levelUps: true });

  // Touche 2 : prend directement la deuxième carte
  await game(page, ({ player }) => player.gainXp(1000));
  await expect(page.locator("#upgradeMenu")).toBeVisible();
  let shown = await cards(page);
  expect(shown.selected).toBe(0); // première carte surlignée d'office
  await expect(page.locator(".upgrade-option .upg-key")).toHaveText(["1", "2", "3"]);
  await page.keyboard.press("2");
  await expect(page.locator("#upgradeMenu")).toBeHidden();
  const second = shown.names[1].split(" · ")[0];
  expect(await owned(page)).toEqual([second]);

  // Flèche bas deux fois → troisième carte, Entrée valide
  await game(page, ({ state, player }) => {
    state.player.xp = 0;
    player.gainXp(1e6);
  });
  await expect(page.locator("#upgradeMenu")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  shown = await cards(page);
  expect(shown.selected).toBe(2);
  await page.keyboard.press("ArrowUp");
  expect((await cards(page)).selected).toBe(1);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(400); // un dash au moment de l'ouverture ne valide pas
  await page.keyboard.press("Enter");
  // (le tirage suivant peut reproposer les mêmes cartes : on attend l'amélioration elle-même)
  await expect.poll(() => owned(page)).toContain(shown.names[2].split(" · ")[0]);

  await killPlayer(page);
});

test("un dash juste à l'ouverture ne choisit pas de carte", async ({ page }) => {
  await page.goto("/");
  await startGame(page, { levelUps: true });
  await game(page, ({ player }) => player.gainXp(1000));
  await expect(page.locator("#upgradeMenu")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.locator("#upgradeMenu")).toBeVisible();
  await page.waitForTimeout(400);
  await page.keyboard.press("d"); // ZQSD : droite = carte suivante
  expect((await cards(page)).selected).toBe(1);
  await page.keyboard.press("Space");
  await expect(page.locator("#upgradeMenu")).toBeHidden();
  await killPlayer(page);
});

test("duel sur un écran : J1 choisit avec D puis ESPACE, sans toucher au choix de J2", async ({ page }) => {
  await page.goto("/");
  await page.locator("#btnVersus").click();
  await page.locator("#btnDuelLocal").click();
  await page.evaluate(async () => {
    const v = await import("/src/systems/versus.js");
    const { player } = await import("/src/core/state.js");
    const { gainXp } = await import("/src/systems/player.js");
    for (const i of [0, 1]) {
      v.withRun(i, () => {
        player.health = player.maxHealth = 1e7;
        player.xpToNextLevel = 10;
        gainXp(10);
      });
    }
  });
  await expect(page.locator("#duelPick1")).toBeVisible();
  await expect(page.locator("#duelPick2")).toBeVisible();
  const second = await page.locator("#duelPick1 .dp-card h4").nth(1).textContent();
  await page.waitForTimeout(400);
  await page.keyboard.press("d");
  await page.keyboard.press("Space");
  await expect(page.locator("#duelPick1")).toBeHidden();
  await expect(page.locator("#duelPick2")).toBeVisible(); // J2 n'a pas encore choisi
  const owned = await page.evaluate(async () => {
    const v = await import("/src/systems/versus.js");
    const { player } = await import("/src/core/state.js");
    return [0, 1].map((i) => v.withRun(i, () => Object.keys(player.inventory)));
  });
  expect(owned).toEqual([[second.replace(/ · (?:niv\. [\d/]+|nouveau)$/, "")], []]);
});
