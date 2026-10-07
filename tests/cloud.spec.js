// Sauvegarde en ligne : activation, envoi automatique et restauration sur un autre appareil.
import { expect, game, test, withSave } from "./fixtures.js";

test("activer la sauvegarde en ligne puis la restaurer sur un autre appareil", async ({
  page,
  browser,
  supabase,
}) => {
  await withSave(page, { gold: 777, lastFreeChest: Date.now() });
  await page.goto("/");
  await page.locator("#btnOptions").click();
  await expect(page.locator("#cloudOff")).toBeVisible();
  await page.locator("#btnCloudEnable").click();
  await expect(page.locator("#cloudOn")).toBeVisible();
  const code = await page.locator("#cloudCode").textContent();
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await expect(page.locator("#cloudStatus")).toHaveText("Progression sauvegardée en ligne");
  expect(supabase.cloud[code].account.gold).toBe(777);

  // Une sauvegarde locale est renvoyée automatiquement (après un court délai)
  await game(page, ({ storage }) => {
    storage.account.gold = 900;
    storage.saveAccount();
  });
  await expect.poll(() => supabase.cloud[code].account.gold, { timeout: 8000 }).toBe(900);

  // « Autre appareil » : contexte vierge qui partage le même faux Supabase
  const other = await (await browser.newContext({ baseURL: test.info().project.use.baseURL })).newPage();
  await other.route("https://*.supabase.co/**", (route) => {
    const req = route.request();
    if (req.url().includes("/rpc/load_progress")) {
      const data = supabase.cloud[req.postDataJSON().p_code] ?? null;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  other.on("dialog", (d) => d.accept());
  await other.goto("/");
  await other.locator("#btnOptions").click();
  await other.locator("#cloudRestoreInput").fill(code.toLowerCase().replaceAll("-", " "));
  await other.locator("#btnCloudRestore").click();
  await other.waitForLoadState("load");
  await expect(other.locator("#acGoldDisplay")).toHaveText("900");
  await other.locator("#btnOptions").click();
  await expect(other.locator("#cloudCode")).toHaveText(code);
});

test("restauration : code invalide ou inconnu", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page.locator("#btnOptions").click();
  await page.locator("#cloudRestoreInput").fill("abc");
  await page.locator("#btnCloudRestore").click();
  await expect(page.locator("#cloudMessage")).toContainText("Code invalide");
  await page.locator("#cloudRestoreInput").fill("AAAA-BBBB-CCCC");
  await page.locator("#btnCloudRestore").click();
  await expect(page.locator("#cloudMessage")).toContainText("Aucune sauvegarde");
});
