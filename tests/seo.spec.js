// Référencement (moteurs de recherche et IA) : favicons lisibles par Google, description de la page dès le
// HTML (sans JavaScript), données structurées schema.org, llms.txt, robots.txt et sitemap.xml.
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

test("le HTML initial décrit le jeu et porte un JSON-LD VideoGame valide", async ({ request }) => {
  const html = await (await request.get("/")).text();
  // Ce que lit un robot qui n'exécute pas le JavaScript (avant : seulement « Chargement du jeu... 0 % »)
  expect(html).toContain("Last Pulse est un jeu vidéo de survie et de stratégie de type roguelike spatial");
  expect(html).toMatch(/<meta\s+name="description"\s+content="Last Pulse est un jeu de survie roguelike/);

  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  expect(blocks).toHaveLength(1);
  const data = JSON.parse(blocks[0][1]);
  expect(data["@type"]).toBe("VideoGame");
  expect(data.name).toBe("Last Pulse");
  expect(data.url).toBe("https://last-pulse.com/");
  expect(data.isAccessibleForFree).toBe(true);
  expect(data.offers.price).toBe("0");
});

test("la phrase de présentation est visible pendant le chargement", async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await page.route("**/src/main.js", async (route) => {
    await gate;
    await route.fallback();
  });
  await page.goto("/", { waitUntil: "commit" });
  await expect(page.locator(".loading-desc")).toBeVisible();
  await expect(page.locator(".loading-desc")).toContainText("jouable gratuitement dans le navigateur");
  release();
});

test("llms.txt, robots.txt et sitemap.xml sont servis à la racine", async ({ request }) => {
  const llms = await request.get("/llms.txt");
  expect(llms.ok()).toBe(true);
  const text = await llms.text();
  expect(text.startsWith("# Last Pulse\n")).toBe(true);
  expect(text).toContain("https://last-pulse.com/");

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /stats.html");
  expect(robots).toContain("Sitemap: https://last-pulse.com/sitemap.xml");

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>https://last-pulse.com/</loc>");
  expect(sitemap).not.toContain("<loc>https://last-pulse.com/stats.html</loc>");
});
