// Icônes faites main dans Figma (design/icons/*.svg → data/iconPaths.js) : chaque icône citée par le jeu
// existe, les tracés générés sont à jour, et l'icône s'affiche au trait dans les menus comme sur le canvas.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseIcon } from "../scripts/build-icons.mjs";
import { expect, test } from "./fixtures.js";

const ROOT = join(import.meta.dirname, "..");

/** Fichiers du jeu (HTML et JS), récursivement. */
function sources(dir = join(ROOT, "Survivor")) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sources(path);
    return /\.(js|html)$/.test(e.name) && e.name !== "iconPaths.js" ? [path] : [];
  });
}

test("chaque icône citée par le jeu est dessinée", async () => {
  const { ICON_PATHS } = await import("../Survivor/src/data/iconPaths.js");
  const used = new Set();
  for (const file of sources()) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (/^\s*(\/\/|\/?\*)/.test(line)) continue;
      for (const m of line.matchAll(/data-icon="(\w+)"|\bicon\("(\w+)"|\bicon: "(\w+)"/g)) {
        used.add(m[1] ?? m[2] ?? m[3]);
      }
    }
  }
  expect(used.size).toBeGreaterThan(50);
  const missing = [...used].filter((name) => !ICON_PATHS[name]);
  expect(missing).toEqual([]);
});

test("les tracés générés correspondent aux SVG exportés de Figma", async () => {
  const { ICON_PATHS } = await import("../Survivor/src/data/iconPaths.js");
  const dir = join(ROOT, "design/icons");
  const files = readdirSync(dir).filter((n) => n.endsWith(".svg"));
  expect(Object.keys(ICON_PATHS).length).toBe(files.length);
  for (const file of files) {
    const { s, f } = parseIcon(readFileSync(join(dir, file), "utf8"), file);
    const icon = ICON_PATHS[file.slice(0, -4)];
    expect(icon.s ?? "", file).toBe(s);
    expect(icon.f ?? "", file).toBe(f);
  }
  // Formes simples converties, transform refusé
  const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="#0ff">${body}</svg>`;
  expect(parseIcon(svg('<circle cx="12" cy="12" r="3" fill="#0ff" stroke="none"/>')).f).toContain("A3 3");
  expect(parseIcon(svg('<line x1="2" y1="3" x2="4" y2="5"/>')).s).toBe("M2 3L4 5");
  expect(() => parseIcon(svg('<path transform="rotate(4)" d="M0 0L1 1"/>'))).toThrow(/transform/);
});

test("une icône s'affiche au trait dans les menus et sur le canvas", async ({ page }) => {
  await page.goto("/");
  const svg = page.locator(".home-gold .ico svg").first();
  await expect(svg).toBeVisible();
  const style = await svg.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { stroke: cs.stroke, fill: cs.fill, paths: el.querySelectorAll("path").length };
  });
  expect(style.fill).toBe("none");
  expect(style.stroke).not.toBe("none");
  expect(style.paths).toBeGreaterThan(0);

  // Nom inconnu = icône « unknown » ; dessin sur canvas : des pixels de la couleur demandée
  const drawn = await page.evaluate(async () => {
    const { icon } = await import("/src/ui/icons.js");
    const { drawIcon } = await import("/src/render/icons.js");
    const fallback = icon("pas-une-icone").querySelector("path").getAttribute("d");
    const c = document.createElement("canvas");
    c.width = c.height = 48;
    const ctx = c.getContext("2d");
    drawIcon(ctx, "heart", 24, 24, 48, "#00ff00");
    const px = ctx.getImageData(0, 0, 48, 48).data;
    let green = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i + 1] > 200 && px[i + 3] > 200) green++;
    return { fallback, green };
  });
  const { ICON_PATHS } = await import("../Survivor/src/data/iconPaths.js");
  expect(drawn.fallback).toBe(ICON_PATHS.unknown.s);
  expect(drawn.green).toBeGreaterThan(50);
});
