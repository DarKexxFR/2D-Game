// Aides de lecture : cœur fissuré de la corruption des soins (vague 12+) et icône d'évolution
// sur les cartes de montée de niveau qui complètent une recette.
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

test("corruption : cœur fissuré près de la barre de vie et rappel dans la pause", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await startGame(page, { invincible: true });
  const heart = page.locator("#healCorruption");
  await expect(heart).toBeHidden();

  // Avant la corruption : rien dans la pause
  if (isMobile) await page.locator("#btnTouchPause").tap();
  else await page.keyboard.press("p");
  await expect(page.locator("#pauseMenu")).toBeVisible();
  await expect(page.locator("#pauseCorruption")).toBeHidden();
  await page.locator("#btnResume").click();

  // Vague 17 : 5 vagues de corruption à 4 % = soins −20 %
  await game(page, ({ state }) => (state.game.wave = 17));
  await expect(heart).toBeVisible();
  await expect(heart).toHaveAttribute("data-tip", "Corruption : soins −20 %");
  if (!isMobile) {
    await heart.hover();
    await expect.poll(() => heart.evaluate((n) => getComputedStyle(n, "::after").opacity)).toBe("1");
  }

  if (isMobile) await page.locator("#btnTouchPause").tap();
  else await page.keyboard.press("p");
  await expect(page.locator("#pauseCorruption")).toBeVisible();
  await expect(page.locator("#pauseCorruption")).toContainText("soins −20 %");
  await page.locator("#btnResume").click();
  await killPlayer(page);
});

test("évolutions : la carte qui complète une recette montre l'évolution visée", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await page.goto("/");
  await startGame(page, { invincible: true });
  const hints = await page.evaluate(async () => {
    const { player } = await import("/src/core/state.js");
    const { UPGRADES, evolutionsFor } = await import("/src/data/upgrades.js");
    const card = (name) => UPGRADES.find((u) => u.name === name);
    const names = (name) => evolutionsFor(card(name), player).map((e) => e.name);
    const r = {
      empty: { force: names("Force Brute"), regen: names("Régénération"), pierce: names("Perçage") },
    };
    Object.assign(player.inventory, { Vampirisme: 1 });
    r.withVampire = names("Régénération");
    delete player.inventory.Vampirisme; // sinon la carte Régénération montrerait aussi un indice à l'écran
    player.evolutions.solarBlaster = true; // déjà obtenue : plus d'indice
    r.afterEvolution = names("Force Brute");
    player.evolutions.solarBlaster = false;
    player.weapon = { ...player.weapon, id: "railgun" };
    r.railgun = { pierce: names("Perçage"), force: names("Force Brute") };
    player.weapon = { ...player.weapon, id: "blaster" };
    return r;
  });
  // Blaster équipé d'office : Force Brute mène au Blaster solaire
  expect(hints.empty).toEqual({ force: ["Blaster solaire"], regen: [], pierce: [] });
  expect(hints.withVampire).toEqual(["Moisson sanglante"]);
  expect(hints.afterEvolution).toEqual([]);
  expect(hints.railgun).toEqual({ pierce: ["Lance ionique"], force: [] });

  // À l'écran : la carte Force Brute porte l'icône du Blaster solaire, les autres rien
  await game(page, ({ state }) => (state.player.rerolls = 60));
  await page.evaluate(async () => (await import("/src/core/events.js")).emit("levelUp"));
  const force = page.locator(".upgrade-option", { hasText: "Force Brute" });
  for (let i = 0; i < 60 && (await force.count()) === 0; i++) await page.locator("#btnReroll").click();
  await expect(force.locator(".upg-evo")).toContainText("Blaster solaire");
  await expect(force.locator(".upg-evo .ico")).toHaveCount(1);
  const others = page.locator(".upgrade-option", { hasNotText: "Force Brute" });
  await expect(others.locator(".upg-evo")).toHaveCount(0);
  await force.click();
  await killPlayer(page);
});
