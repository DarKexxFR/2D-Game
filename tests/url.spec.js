// Adresse de la page selon l'écran ouvert (#modal=option...) et bouton retour du navigateur.
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

const hashOf = (page) => new URL(page.url()).hash;

test("ouvrir les options change l'adresse, le retour du navigateur les ferme", async ({ page }) => {
  await page.goto("/");
  expect(hashOf(page)).toBe("");

  await page.locator("#btnOptions").click();
  await expect(page.locator("#optionsMenu")).toBeVisible();
  await expect(page).toHaveURL(/#modal=option$/);

  await page.goBack();
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#optionsMenu")).toBeHidden();
  expect(hashOf(page)).toBe("");

  // Le bouton RETOUR du jeu remet aussi l'adresse de l'accueil
  await page.locator("#btnShop").click();
  await expect(page).toHaveURL(/#modal=boutique$/);
  await page.locator("#btnShopBack").click();
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect.poll(() => hashOf(page)).toBe("");

  // Enchaîner les menus juste après un retour ne perd pas l'adresse du nouvel écran
  await page.locator("#btnOptions").click();
  await page.locator("#btnOptionsBack").click();
  await page.locator("#btnTalents").click();
  await expect(page.locator("#talentMenu")).toBeVisible();
  await expect(page).toHaveURL(/#modal=talents$/);
  await page.waitForTimeout(100);
  await expect(page).toHaveURL(/#modal=talents$/);
  await expect(page.locator("#talentMenu")).toBeVisible();
});

test("un lien #modal=option ouvre directement les options", async ({ page }) => {
  await page.goto("/#modal=option");
  await expect(page.locator("#optionsMenu")).toBeVisible();
  await expect(page.locator("#btnReset")).toBeVisible(); // ouvertes depuis l'accueil

  await page.goBack();
  await expect(page.locator("#mainMenu")).toBeVisible();
  expect(hashOf(page)).toBe("");
});

test("chaque menu de l'accueil a son lien", async ({ page }) => {
  const links = {
    boutique: "#shopMenu",
    equipement: "#inventoryMenu",
    classement: "#leaderboardMenu",
    succes: "#achievementMenu",
    defi: "#dailyMenu",
    talents: "#talentMenu",
  };
  for (const [slug, screen] of Object.entries(links)) {
    await page.goto(`/#modal=${slug}`); // le premier charge la page, les suivants changent le fragment
    await expect(page.locator(screen)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`#modal=${slug}$`));
  }
});

test("un lien vers un écran de partie ou inconnu ramène à l'accueil", async ({ page }) => {
  await page.goto("/#modal=pause");
  await expect(page.locator("#mainMenu")).toBeVisible();
  expect(hashOf(page)).toBe("");
});

test("en partie : #jeu, le retour du navigateur met en pause puis reprend", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await expect(page).toHaveURL(/#jeu$/);

  await page.goBack();
  await expect(page.locator("#pauseMenu")).toBeVisible();
  await expect(page).toHaveURL(/#modal=pause$/);
  expect(await game(page, ({ state }) => state.game.paused)).toBe(true);

  // Options depuis la pause : le retour revient à la pause
  await page.locator("#btnPauseOptions").click();
  await expect(page).toHaveURL(/#modal=option$/);
  await page.goBack();
  await expect(page.locator("#pauseMenu")).toBeVisible();
  await expect(page).toHaveURL(/#modal=pause$/);

  await page.goBack();
  await expect(page.locator("#pauseMenu")).toBeHidden();
  await expect(page).toHaveURL(/#jeu$/);
  expect(await game(page, ({ state }) => state.game.paused)).toBe(false);
  expect(await game(page, ({ state }) => state.game.started)).toBe(true);
});

test("fin de partie : le retour du navigateur ramène à l'accueil", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await killPlayer(page);
  await expect(page).toHaveURL(/#modal=fin$/);

  await page.goBack();
  await expect(page.locator("#mainMenu")).toBeVisible();
  expect(await game(page, ({ state }) => state.game.started)).toBe(false);
  await expect.poll(() => hashOf(page)).toBe("");
});

test("recharger la page revient à l'accueil", async ({ page }) => {
  await page.goto("/");
  await page.locator("#btnOptions").click();
  await expect(page).toHaveURL(/#modal=option$/);
  await page.reload();
  await expect(page.locator("#mainMenu")).toBeVisible();
  expect(hashOf(page)).toBe("");
});

test("fenêtre de connexion : #modal=connexion, depuis l'accueil ou les options", async ({ page }) => {
  await page.goto("/#modal=connexion");
  await expect(page.locator("#loginMenu")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#mainMenu")).toBeVisible();

  await page.locator("#btnOptions").click();
  await page.locator("#btnOptionsAccount").click();
  await expect(page).toHaveURL(/#modal=connexion$/);
  await page.goBack();
  await expect(page.locator("#optionsMenu")).toBeVisible();
  await expect(page).toHaveURL(/#modal=option$/);
});

test("duel : #jeu pendant le duel, #modal=fin-duel à la fin, le retour ramène à l'accueil", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#btnVersus").click();
  await expect(page.locator("#versusHud")).toBeVisible();
  await expect(page).toHaveURL(/#jeu$/);

  await page.goBack();
  await expect(page.locator("#pauseMenu")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#jeu$/);

  await page.evaluate(async () => {
    const v = await import("/src/systems/versus.js");
    const [p1, p2] = v.versus.fighters;
    v.versus.lives[0] = 1;
    p1.buffs.shield = 0;
    p1.isDashing = false;
    v.hitFighter(p2, p1, 1e9);
  });
  await expect(page.locator("#versusOver")).toBeVisible();
  await expect(page).toHaveURL(/#modal=fin-duel$/);
  await page.goBack();
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#versusHud")).toBeHidden();
});
