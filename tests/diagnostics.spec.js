// Journal de diagnostic (services/diagnostics.js) et rapports d'erreurs envoyés à Supabase
// (services/errorReports.js, RPC report_error). La page stats.html qui les affiche : tests/analytics.spec.js.
import { expect, game, startGame, test, withSave } from "./fixtures.js";

const SAVE = { tutorialDone: true, lastFreeChest: Date.now() };
const SLOW = { timeout: 15_000 }; // les rapports partent quelques secondes après l'ouverture (DIAGNOSTICS.sendDelayMs)

/** Erreur levée une fois pendant le rendu d'une image (dans la vraie boucle du jeu). */
function breakOneFrame(page, message) {
  return game(
    page,
    ({ canvas }, msg) => {
      const { ctx } = canvas;
      ctx.clearRect = function () {
        delete ctx.clearRect;
        throw new Error(msg);
      };
    },
    message,
  );
}

test.describe("erreur en partie", () => {
  test.use({ allowedErrors: ["panne de test", "panne de test"] });

  test("rapport envoyé une fois, avec l'état du jeu, le journal et l'appareil", async ({
    page,
    supabase,
  }) => {
    await withSave(page, SAVE);
    await page.goto("/");
    await startGame(page);
    await game(page, ({ state }) => (state.game.wave = 7));
    await expect.poll(() => journal(page)).toContain("[vague] 7");
    await breakOneFrame(page, "panne de test");
    await expect.poll(() => supabase.errors.length, SLOW).toBe(1);

    const r = supabase.errors[0];
    expect(r).toMatchObject({ p_kind: "error", p_message: "panne de test", p_build: "dev" });
    expect(r.p_fingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(r.p_stack).toContain("/src/");
    expect(r.p_stack).not.toContain("http://"); // adresse du site retirée
    expect(r.p_context).toMatchObject({ mode: "normal", wave: 7, screen: "jeu", running: true });
    expect(r.p_device_info.browser).toMatch(/^Chrome \d+$/);
    expect(r.p_device_info).not.toHaveProperty("userAgent");
    const lines = r.p_journal.map(([, c, m]) => `[${c}] ${m}`);
    expect(lines).toContain("[partie] début normal · normal");
    expect(lines).toContain("[erreur] error : panne de test");
    // Même identifiant d'appareil que les statistiques anonymes, ni pseudo ni compte
    const device = await page.evaluate(() => JSON.parse(localStorage.getItem("survivor_app")).analytics.id);
    expect(r.p_device).toBe(device);

    // La même erreur une deuxième fois : comptée dans le journal, pas de deuxième rapport
    await breakOneFrame(page, "panne de test");
    await expect.poll(() => journal(page)).toContain("(×2)");
    await page.waitForTimeout(500);
    expect(supabase.errors.length).toBe(1);
    // Le jeu tourne toujours
    const t0 = await game(page, ({ state }) => state.game.time);
    await expect.poll(() => game(page, ({ state }) => state.game.time)).toBeGreaterThan(t0 + 300);
  });
});

test("boucle du jeu arrêtée : rapport « gel »", async ({ page, supabase }) => {
  await withSave(page, SAVE);
  await page.goto("/");
  await startGame(page);
  // Plus aucune image demandée : le jeu paraît figé
  await page.evaluate(() => (window.requestAnimationFrame = () => 0));
  await expect.poll(() => supabase.errors.length, SLOW).toBe(1);
  expect(supabase.errors[0]).toMatchObject({ p_kind: "freeze" });
  expect(supabase.errors[0].p_message).toMatch(/^Boucle du jeu arrêtée depuis \d+ s$/);
});

test.describe("statistiques refusées", () => {
  test.use({ allowedErrors: ["panne hors ligne"] });

  test("aucun rapport envoyé, mais journal copiable depuis les Options", async ({
    page,
    supabase,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await withSave(page, SAVE);
    await page.addInitScript(() =>
      localStorage.setItem("survivor_app", JSON.stringify({ analytics: { id: "", enabled: false } })),
    );
    await page.goto("/");
    await startGame(page);
    await breakOneFrame(page, "panne hors ligne");
    await expect.poll(() => journal(page)).toContain("panne hors ligne");
    await page.keyboard.press("Escape");
    await page.locator("#btnPauseOptions").click();
    await page.locator("#btnCopyJournal").click();
    await expect(page.locator("#journalHint")).toContainText("Journal copié");
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("LAST PULSE · JOURNAL DE DIAGNOSTIC");
    expect(text).toContain("ERROR");
    expect(text).toContain("panne hors ligne");
    expect(text).toContain("[écran] optionsMenu");
    await page.waitForTimeout(4500); // délai d'envoi passé
    expect(supabase.errors).toEqual([]);
  });
});

test.describe("hors ligne", () => {
  test.use({ allowedErrors: ["panne sans réseau"] });

  test("rapport non envoyé : il part à l'ouverture suivante, journal précédent gardé", async ({
    page,
    supabase,
  }) => {
    await withSave(page, SAVE);
    supabase.mode = "down";
    await page.goto("/");
    await startGame(page);
    await breakOneFrame(page, "panne sans réseau");
    await expect.poll(() => journal(page)).toContain("panne sans réseau");
    await page.waitForTimeout(4500); // essai d'envoi raté
    supabase.mode = "ok";
    await page.reload();
    await expect.poll(() => supabase.errors.length, SLOW).toBe(1);
    expect(supabase.errors[0].p_message).toBe("panne sans réseau");
    const text = await journal(page);
    expect(text).toContain("Session précédente");
    expect(text).toContain("[partie] début normal");
    await page.waitForTimeout(500);
    expect(supabase.errors.length).toBe(1); // pas renvoyé une deuxième fois
  });
});

function journal(page) {
  return page.evaluate(async () => (await import("/src/services/diagnostics.js")).journalText());
}
