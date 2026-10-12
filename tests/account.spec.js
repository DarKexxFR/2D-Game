// Connexion facultative (Google ou code par e-mail) et sauvegarde liée au compte :
// la progression n'est jamais écrasée sans le choix du joueur.
import { EMAIL_CODE, GOOGLE_EMAIL, expect, game, test, withSave } from "./fixtures.js";

/** Sauvegarde « d'un autre appareil » déjà présente sur le compte. */
const remoteSave = (gold, level = 5) => ({
  version: 1,
  savedAt: 1000,
  pseudo: "Ailleurs",
  account: { level, gold, currentXp: 0, items: { blaster: { level: 3, prestige: 1, copies: 0 } } },
});

async function loginWithEmail(page, email, code = EMAIL_CODE) {
  await page.locator("#btnOptions").click();
  await page.locator("#accountEmail").fill(email);
  await page.locator("#btnEmailCode").click();
  await expect(page.locator("#codeStep")).toBeVisible();
  await page.locator("#accountCode").fill(code);
  await page.locator("#btnEmailVerify").click();
}

test("on peut jouer sans compte : la connexion est facultative", async ({ page }) => {
  await page.goto("/");
  await page.locator("#btnOptions").click();
  await expect(page.locator("#accountSection")).toContainText("facultatif");
  await expect(page.locator("#accountOut")).toBeVisible();
  await expect(page.locator("#accountIn")).toBeHidden();
});

test("Google : première connexion, la progression de l'appareil part sur le compte", async ({
  page,
  supabase,
}) => {
  await withSave(page, { gold: 555, level: 4, lastFreeChest: Date.now() });
  await page.goto("/");
  await page.locator("#btnOptions").click();
  await page.locator("#btnGoogle").click();
  // Retour de « Google » : l'URL est nettoyée et le joueur est connecté
  await page.waitForURL((url) => !url.hash);
  await expect.poll(() => supabase.accounts[GOOGLE_EMAIL]?.account.gold).toBe(555);
  await page.locator("#btnOptions").click();
  await expect(page.locator("#accountWho")).toContainText(`${GOOGLE_EMAIL} (Google)`);
  await expect(page.locator("#accountStatus")).toHaveText("Progression sauvegardée sur ton compte");

  // Les sauvegardes suivantes partent toutes seules
  await game(page, ({ storage }) => {
    storage.account.gold = 600;
    storage.saveAccount();
  });
  await expect.poll(() => supabase.accounts[GOOGLE_EMAIL].account.gold, { timeout: 8000 }).toBe(600);

  // Déconnexion : la progression reste sur l'appareil
  await page.locator("#btnSignOut").click();
  await expect(page.locator("#accountOut")).toBeVisible();
  expect(await game(page, ({ storage }) => storage.account.gold)).toBe(600);
});

test("e-mail : un mauvais code est refusé, le bon connecte", async ({ page, supabase }) => {
  await withSave(page, { gold: 42, level: 2, lastFreeChest: Date.now() });
  await page.goto("/");
  await loginWithEmail(page, "moi@exemple.fr", "000000");
  await expect(page.locator("#accountMessage")).toHaveText("Code incorrect ou expiré.");
  expect(supabase.emails).toEqual(["moi@exemple.fr"]);
  await page.locator("#accountCode").fill(EMAIL_CODE);
  await page.locator("#btnEmailVerify").click();
  await expect(page.locator("#accountWho")).toContainText("moi@exemple.fr (e-mail)");
  await expect.poll(() => supabase.accounts["moi@exemple.fr"]?.account.gold).toBe(42);
});

test("appareil vierge : la progression du compte est récupérée", async ({ page, supabase }) => {
  supabase.accounts["moi@exemple.fr"] = remoteSave(9000);
  await page.goto("/");
  await loginWithEmail(page, "moi@exemple.fr");
  await page.waitForLoadState("load"); // rechargement après récupération
  await expect(page.locator("#acGoldDisplay")).toHaveText("9000");
  await expect(page.locator("#acLvlDisplay")).toHaveText("5");
  // Le compte n'a pas été écrasé par l'appareil vierge
  expect(supabase.accounts["moi@exemple.fr"].account.gold).toBe(9000);
});

for (const choice of ["remote", "local"]) {
  test(`conflit : le joueur choisit (${choice === "remote" ? "compte" : "cet appareil"})`, async ({
    page,
    supabase,
  }) => {
    supabase.accounts["moi@exemple.fr"] = remoteSave(9000);
    await withSave(page, { gold: 123, level: 3, lastFreeChest: Date.now() });
    await page.goto("/");
    await loginWithEmail(page, "moi@exemple.fr");
    await expect(page.locator("#accountConflict")).toBeVisible();
    await expect(page.locator("#btnKeepLocal")).toContainText("123 or");
    await expect(page.locator("#btnKeepRemote")).toContainText("9000 or");
    // Tant que le joueur n'a pas choisi, rien n'est envoyé
    expect(supabase.accounts["moi@exemple.fr"].account.gold).toBe(9000);

    if (choice === "remote") {
      await page.locator("#btnKeepRemote").click();
      await page.waitForLoadState("load");
      await expect(page.locator("#acGoldDisplay")).toHaveText("9000");
    } else {
      await page.locator("#btnKeepLocal").click();
      await expect.poll(() => supabase.accounts["moi@exemple.fr"].account.gold).toBe(123);
      await expect(page.locator("#accountConflict")).toBeHidden();
    }
  });
}

test("au démarrage, un compte inchangé reçoit la progression de l'appareil (pas de conflit)", async ({
  page,
  supabase,
}) => {
  await withSave(page, { gold: 10, level: 2, lastFreeChest: Date.now() });
  await page.goto("/");
  await loginWithEmail(page, "moi@exemple.fr");
  await expect.poll(() => supabase.accounts["moi@exemple.fr"]?.account.gold).toBe(10);
  // Partie jouée hors ligne puis nouveau lancement : la session est restée, l'appareil a avancé
  await game(page, ({ storage }) => {
    storage.account.gold = 77;
    localStorage.setItem("survivor_save_v11", JSON.stringify(storage.account));
  });
  await page.reload();
  await expect.poll(() => supabase.accounts["moi@exemple.fr"].account.gold).toBe(77);
  await page.locator("#btnOptions").click();
  await expect(page.locator("#accountConflict")).toBeHidden();
});

test("supprimer sa sauvegarde en ligne garde la progression de l'appareil", async ({ page, supabase }) => {
  page.on("dialog", (d) => d.accept());
  await withSave(page, { gold: 31, level: 2, lastFreeChest: Date.now() });
  await page.goto("/");
  await loginWithEmail(page, "moi@exemple.fr");
  await expect.poll(() => supabase.accounts["moi@exemple.fr"]?.account.gold).toBe(31);
  await page.locator("#btnDeleteOnline").click();
  await expect(page.locator("#accountMessage")).toHaveText("Sauvegarde en ligne supprimée.");
  expect(supabase.accounts["moi@exemple.fr"]).toBeUndefined();
  await expect(page.locator("#accountOut")).toBeVisible();
  expect(await game(page, ({ storage }) => storage.account.gold)).toBe(31);
});
