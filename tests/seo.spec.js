// Référencement : favicons lisibles par Google (carrés, multiples de 48 px) et description de la page.
import { expect, test } from "./fixtures.js";

test("favicons et description pour les moteurs de recherche", async ({ page, request }) => {
  await page.goto("/");
  const desc = await page.locator('meta[name="description"]').getAttribute("content");
  expect(desc.length).toBeGreaterThan(50);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);

  const icons = await page.locator('link[rel="icon"]').evaluateAll((links) => links.map((l) => l.href));
  for (const href of icons) expect((await request.get(href)).ok(), href).toBe(true);
  expect((await request.get("/favicon.ico")).ok()).toBe(true);

  // Google exige un favicon carré dont le côté est un multiple de 48 px
  const sizes = await page.evaluate(async () => {
    const out = [];
    for (const href of ["assets/favicon-48.png", "assets/icon-192.png"]) {
      const img = new Image();
      img.src = href;
      await img.decode();
      out.push([img.naturalWidth, img.naturalHeight]);
    }
    return out;
  });
  for (const [w, h] of sizes) {
    expect(w).toBe(h);
    expect(w % 48).toBe(0);
  }
});
