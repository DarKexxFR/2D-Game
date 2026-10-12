// Déménagement vers last-pulse.com : la progression passe de l'ancienne adresse à la nouvelle.
import { expect, test } from "./fixtures.js";

test.beforeEach(async ({ isMobile }) => test.skip(isMobile, "logique de navigation : une plateforme suffit"));

const OLD = "https://darkexxfr.github.io/2D-Game/Survivor/";
const NEW = "https://last-pulse.com/";

/** Encode comme transfer.js (base64 « URL » d'un JSON UTF-8). */
function encode(data) {
  return Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
}

/**
 * Sert le jeu local sous les deux vraies adresses. `redirect` active la redirection de
 * l'ancienne adresse (désactivée dans le dépôt tant que le nouveau site n'est pas en ligne).
 */
async function serveBothDomains(page, baseURL, { redirect }) {
  const serve = (prefix) => async (route) => {
    const path = new URL(route.request().url()).pathname.replace(prefix, "/");
    const response = await route.fetch({ url: new URL(path, baseURL).href });
    let body = await response.text();
    if (redirect && path.endsWith("/src/transfer.js")) {
      body = body.replace("REDIRECT_ENABLED = false", "REDIRECT_ENABLED = true");
    }
    await route.fulfill({ response, body });
  };
  await page.route("https://darkexxfr.github.io/**", serve("/2D-Game/Survivor/"));
  await page.route("https://last-pulse.com/**", serve("/"));
}

test("nouvelle adresse : la progression transférée est importée et l'URL nettoyée", async ({ page }) => {
  const save = { level: 7, gold: 4321, lastFreeChest: Date.now() };
  await page.goto(
    `/#transfer=${encode({ survivor_save_v11: JSON.stringify(save), survivor_pseudo: "Zoé" })}`,
  );
  await expect(page.locator("#acGoldDisplay")).toHaveText("4321");
  await expect(page.locator("#playerPseudo")).toHaveValue("Zoé");
  expect(new URL(page.url()).hash).toBe("");
});

for (const accept of [true, false]) {
  test(`une progression existe déjà ici : le joueur choisit (${accept ? "ancienne" : "celle d'ici"})`, async ({
    page,
  }) => {
    await page.goto("/legal.html"); // même domaine, autre page : l'arrivée sera un vrai chargement
    await page.evaluate(() =>
      localStorage.setItem(
        "survivor_save_v11",
        JSON.stringify({ level: 2, gold: 50, lastFreeChest: Date.now() }),
      ),
    );
    let message = "";
    page.on("dialog", (d) => {
      message = d.message();
      return accept ? d.accept() : d.dismiss();
    });
    const old = { level: 9, gold: 999, lastFreeChest: Date.now() };
    await page.goto(`/#transfer=${encode({ survivor_save_v11: JSON.stringify(old) })}`);
    await expect(page.locator("#acGoldDisplay")).toHaveText(accept ? "999" : "50");
    expect(message).toContain("niveau 9, 999 or");
    expect(message).toContain("niveau 2, 50 or");
  });
}

test("redirection désactivée : l'ancienne adresse reste jouable", async ({ page, baseURL }) => {
  await serveBothDomains(page, baseURL, { redirect: false });
  await page.goto(OLD);
  await expect(page.locator("#mainMenu")).toBeVisible();
  expect(page.url()).toBe(OLD);
});

test("déménagement complet : ancienne adresse → last-pulse.com avec la progression, une seule fois", async ({
  page,
  baseURL,
}) => {
  await serveBothDomains(page, baseURL, { redirect: true });
  // Progression enregistrée sur l'ancienne adresse
  await page.goto(`${OLD}legal.html`);
  await page.evaluate(() => {
    localStorage.setItem(
      "survivor_save_v11",
      JSON.stringify({ level: 12, gold: 8888, lastFreeChest: Date.now() }),
    );
    localStorage.setItem("survivor_pseudo", "Ancien");
    localStorage.setItem("survivor_auth", "jeton-secret");
  });

  await page.goto(OLD);
  await page.waitForURL(NEW);
  await expect(page.locator("#acGoldDisplay")).toHaveText("8888");
  await expect(page.locator("#playerPseudo")).toHaveValue("Ancien");
  // La session de connexion n'a pas voyagé dans l'URL
  expect(await page.evaluate(() => localStorage.getItem("survivor_auth"))).toBeNull();

  // Revenir sur l'ancienne adresse ne renvoie plus la vieille progression
  await page.evaluate(() =>
    localStorage.setItem(
      "survivor_save_v11",
      JSON.stringify({ level: 13, gold: 9000, lastFreeChest: Date.now() }),
    ),
  );
  await page.goto(OLD);
  await page.waitForURL(NEW);
  await expect(page.locator("#acGoldDisplay")).toHaveText("9000");
});
