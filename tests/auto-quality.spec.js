// Qualité AUTO (core/quality.js) : la qualité suit la fluidité de l'appareil pendant la partie.
import { expect, test } from "./fixtures.js";

/** Joue `frames` images de `ms` chacune dans la mesure de l'AUTO (horodatages simulés). */
async function feed(page, frames, ms, jitter = 0) {
  return page.evaluate(
    async ({ frames, ms, jitter }) => {
      const q = await import("/src/core/quality.js");
      const { gfx } = await import("/src/core/gfx.js");
      window.__t = window.__t || 1000;
      for (let i = 0; i <= frames; i++) {
        // une image de plus : la première ne sert que de point de départ (pas de durée)
        window.__t += ms + (i % 2 ? jitter : -jitter);
        q.sampleFrame(window.__t);
      }
      return { level: q.qualityLevel(), ratio: gfx.maxPixelRatio, shadows: gfx.shadows, ...q.probeState() };
    },
    { frames, ms, jitter },
  );
}

test("nouveau joueur : qualité AUTO, au niveau de l'appareil", async ({ page, isMobile }) => {
  await page.addInitScript(() => localStorage.setItem("survivor_settings", "{}"));
  await page.goto("/");
  const s = await page.evaluate(async () => {
    const { settings } = await import("/src/services/settings.js");
    const q = await import("/src/core/quality.js");
    return { quality: settings.quality, level: q.qualityLevel() };
  });
  expect(s).toEqual({ quality: "auto", level: isMobile ? "medium" : "high" });
  await page.locator("#btnOptions").click();
  await expect(page.locator('#optionsMenu [data-quality="auto"]')).toHaveClass(/active/);
  await expect(page.locator("#optQualityHint")).toContainText("Auto :");
});

test("images lentes : un cran plus bas, puis remontée quand tout redevient fluide", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const { updateSettings } = await import("/src/services/settings.js");
    updateSettings({ quality: "auto", autoLevel: "high" });
  });
  // Une seule mesure lente : rien ne bouge encore (un pic passager ne suffit pas). Chaque appel est joué
  // d'un bloc : entre deux, une image de l'accueil remet la mesure à zéro.
  expect((await feed(page, 90, 40)).level).toBe("high");
  let r = await feed(page, 180, 40);
  expect(r.level).toBe("medium");
  expect(r.ratio).toBe(1); // définition réduite (haute qualité : 1,5)
  r = await feed(page, 180, 40);
  expect(r).toMatchObject({ level: "low", shadows: false });
  // Plus bas que bas : on y reste
  expect((await feed(page, 360, 40)).level).toBe("low");

  // Fluide pendant 8 mesures : un cran plus haut, retenu pour la prochaine session
  r = await feed(page, 90 * 8, 1000 / 60);
  expect(r.level).toBe("medium");
  await page.reload();
  expect(await page.evaluate(async () => (await import("/src/core/quality.js")).qualityLevel())).toBe(
    "medium",
  );
});

test("remontée aussitôt trop lente : plus de remontée de la session", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const { updateSettings } = await import("/src/services/settings.js");
    updateSettings({ quality: "auto", autoLevel: "medium" });
  });
  expect((await feed(page, 90 * 8, 1000 / 60)).level).toBe("high");
  expect((await feed(page, 180, 40)).level).toBe("medium");
  const r = await feed(page, 90 * 20, 1000 / 60);
  expect(r).toMatchObject({ level: "medium", noRaise: true });
});

test("navigateur bridé à 30 images/s : la qualité ne baisse pas", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const { updateSettings } = await import("/src/services/settings.js");
    updateSettings({ quality: "auto", autoLevel: "high" });
  });
  // Images très régulières à 33 ms : cadence imposée par le navigateur, pas un appareil qui peine
  expect((await feed(page, 90 * 6, 1000 / 30, 0.3)).level).toBe("high");
  // Images irrégulières autour de 33 ms : l'appareil peine vraiment
  expect((await feed(page, 180, 1000 / 30, 8)).level).toBe("medium");
});

test("qualité choisie à la main : l'AUTO ne touche à rien", async ({ page }) => {
  await page.goto("/");
  await page.locator("#btnOptions").click();
  await page.locator('#optionsMenu [data-quality="high"]').click();
  expect((await feed(page, 90 * 6, 50)).level).toBe("high");
  await page.locator('#optionsMenu [data-quality="auto"]').click();
  await expect(page.locator('#optionsMenu [data-quality="auto"]')).toHaveClass(/active/);
});

test("en partie, la mesure ne compte que les images de jeu (pas la pause)", async ({ page, isMobile }) => {
  test.skip(isMobile, "touche P");
  await page.goto("/");
  await page.evaluate(async () => {
    const { updateSettings } = await import("/src/services/settings.js");
    updateSettings({ quality: "auto", autoLevel: "high" });
  });
  await page.locator("#btnPlay").click();
  await expect(page.locator("#ui")).toBeVisible();
  await page.waitForTimeout(300);
  await page.keyboard.press("p");
  await page.waitForTimeout(200);
  const st = await page.evaluate(async () => (await import("/src/core/quality.js")).probeState());
  expect(st.count).toBe(0); // en pause : mesure remise à zéro à chaque image
});
