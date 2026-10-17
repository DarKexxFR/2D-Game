// Écran de chargement (src/boot.js, ui/loadingScreen.js) : l'accueil n'apparaît, et JOUER ne répond,
// qu'une fois le jeu prêt ; une erreur propose de réessayer ; le compte connecté est vérifié avant.
import { expect, logIn, startGame, test } from "./fixtures.js";

// Un démarrage complet (une centaine de modules) peut être long quand les tests tournent en parallèle
const BOOT = { timeout: 20_000 };

/** Sauvegarde « d'un autre appareil » déjà présente sur le compte. */
const remoteSave = (gold) => ({
  version: 1,
  savedAt: 1000,
  pseudo: "Ailleurs",
  account: { level: 5, gold, currentXp: 0, items: { blaster: { level: 3, prestige: 1, copies: 0 } } },
});

test("l'accueil reste caché tant que le jeu n'est pas prêt", async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await page.route("**/src/main.js", async (route) => {
    await gate; // réseau lent : le point d'entrée tarde
    await route.fallback();
  });
  await page.goto("/", { waitUntil: "commit" });
  await expect(page.locator("#loadingScreen")).toBeVisible();
  await expect(page.locator("#loadingScreen")).toHaveAttribute("role", "progressbar");
  // Avant, l'accueil s'affichait vide (niveau 1, 0 or, sans icônes) et un clic sur JOUER était perdu
  await expect(page.locator("#btnPlay")).toBeHidden();
  await expect(page.locator("#mainMenu")).toBeHidden();

  release();
  await expect(page.locator("#mainMenu")).toBeVisible(BOOT);
  await expect(page.locator("#loadingScreen")).toBeHidden(BOOT);
  await expect(page.locator("#loadingPercent")).toHaveText("100 %");
  await expect(page.locator("#mainMenu i[data-icon]")).toHaveCount(0); // icônes en place
  await startGame(page);
});

test("un fichier du jeu introuvable : message et bouton RÉESSAYER", async ({ page }) => {
  let broken = true;
  await page.route("**/src/ui/hud.js", (route) => (broken ? route.abort() : route.fallback()));
  await page.goto("/");
  await expect(page.locator("#loadingScreen")).toHaveClass(/loading-failed/, BOOT);
  await expect(page.locator("#loadingLabel")).toContainText("connexion");
  await expect(page.locator("#mainMenu")).toBeHidden();

  broken = false; // la connexion revient
  await page.locator("#btnLoadingRetry").click();
  await expect(page.locator("#mainMenu")).toBeVisible(BOOT);
  await expect(page.locator("#loadingScreen")).toBeHidden(BOOT);
});

test("connecté : l'accueil s'ouvre avec la progression du compte, sans rechargement visible", async ({
  page,
  supabase,
}) => {
  supabase.accounts["moi@exemple.fr"] = remoteSave(9000);
  await logIn(page, "moi@exemple.fr");
  await page.goto("/");
  // Le rechargement a lieu derrière l'écran de chargement : dès que l'accueil est visible, il est à jour
  await expect(page.locator("#mainMenu")).toBeVisible(BOOT);
  await expect(page.locator("#acGoldDisplay")).toHaveText("9000");
  await expect(page.locator("#acLvlDisplay")).toHaveText("5");
});

test("réponse tardive du compte en pleine partie : pas de rechargement, reprise à l'accueil", async ({
  page,
  supabase,
}) => {
  supabase.accounts["moi@exemple.fr"] = remoteSave(9000);
  await logIn(page, "moi@exemple.fr");
  // Délai d'attente du compte raccourci, pour que le jeu s'ouvre avant la réponse du serveur
  // (et requêtes jamais abandonnées : c'est le serveur qui tarde)
  await page.route("**/src/config.js", async (route) => {
    const res = await route.fetch();
    const body = (await res.text())
      .replace(/accountTimeoutMs: \d+/, "accountTimeoutMs: 200")
      .replace(/timeoutMs: 6000/, "timeoutMs: 120000");
    await route.fulfill({ response: res, body });
  });
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  let held = true;
  await page.route("**/rpc/load_account_progress", async (route) => {
    if (held) await gate;
    await route.fallback();
  });
  await page.goto("/");
  await expect(page.locator("#mainMenu")).toBeVisible(BOOT);
  await startGame(page);
  await page.evaluate(() => (window.__sameRun = true));
  // Partie en pause (toujours en cours) : elle ne rapporte rien, la progression locale ne bouge pas
  await page.keyboard.press("Escape");
  await expect(page.locator("#pauseMenu")).toBeVisible();

  const answered = page.waitForResponse("**/rpc/load_account_progress");
  held = false;
  release(); // le serveur répond en pleine partie
  await answered;
  await page.waitForTimeout(800);
  // Ni rechargement ni écrasement : la partie continue
  expect(await page.evaluate(() => window.__sameRun)).toBe(true);
  await expect(page.locator("#pauseMenu")).toBeVisible();
  expect(supabase.accounts["moi@exemple.fr"].account.gold).toBe(9000);

  await page.locator("#btnQuit").click();
  // De retour à l'accueil, la vérification reprend : progression du compte récupérée, ou choix
  // proposé si la partie a déjà rapporté quelque chose (un succès dès le premier ennemi tué)
  await expect
    .poll(async () => {
      if (await page.locator("#accountConflict").isVisible()) return "choix";
      return (await page.locator("#acGoldDisplay").textContent()) === "9000" ? "récupérée" : "";
    }, BOOT)
    .not.toBe("");
  expect(supabase.accounts["moi@exemple.fr"].account.gold).toBe(9000);
});
