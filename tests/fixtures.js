// Fixtures communes : Supabase simulé (aucun appel réseau réel) et échec du test
// si la page lève une erreur JavaScript.
import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  // Réponses du faux Supabase, modifiables par test : supabase.scores, supabase.mode...
  supabase: async ({}, use) => {
    await use({ scores: [], mode: "ok", posts: [] });
  },
  page: async ({ page, supabase }, use) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://*.supabase.co/**", (route) => {
      const req = route.request();
      if (supabase.mode === "down") return route.fulfill({ status: 503, body: "down" });
      if (req.method() === "POST") {
        supabase.posts.push(req.postDataJSON());
        if (supabase.mode === "rateLimited") {
          return route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({ code: "P0001", message: "Trop de scores envoyés" }),
          });
        }
        return route.fulfill({ status: 201, body: "" });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(supabase.scores),
      });
    });
    await use(page);
    expect(errors, "erreurs JavaScript dans la page").toEqual([]);
  },
});

export { expect };

/** Exécute une fonction avec les modules du jeu chargés : run(page, ({ state, player }) => ...). */
export async function game(page, fn, arg) {
  return page.evaluate(
    async ({ fnSrc, arg }) => {
      const mods = {
        state: await import("/src/core/state.js"),
        player: await import("/src/systems/player.js"),
        storage: await import("/src/services/storage.js"),
        inventory: await import("/src/services/inventory.js"),
        settings: await import("/src/services/settings.js"),
        spawner: await import("/src/systems/spawner.js"),
        input: await import("/src/core/input.js"),
        canvas: await import("/src/core/canvas.js"),
      };
      // eslint-disable-next-line no-new-func
      return new Function("mods", "arg", `return (${fnSrc})(mods, arg)`)(mods, arg);
    },
    { fnSrc: fn.toString(), arg },
  );
}

/** Pré-remplit la sauvegarde avant le chargement de la page. */
export async function withSave(page, save) {
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem("__seeded")) {
      localStorage.setItem("survivor_save_v11", JSON.stringify(s));
      sessionStorage.setItem("__seeded", "1");
    }
  }, save);
}

/**
 * Lance une partie (clic sur JOUER). Par défaut le joueur est invincible et ne monte pas
 * de niveau : le menu d'amélioration mettrait la partie en pause au hasard des tests.
 */
export async function startGame(page, { invincible = true, levelUps = false } = {}) {
  await page.locator("#btnPlay").click();
  await expect(page.locator("#ui")).toBeVisible();
  await game(
    page,
    ({ state }, opts) => {
      if (opts.invincible) state.player.health = state.player.maxHealth = 1e7;
      if (!opts.levelUps) state.player.xpToNextLevel = 1e12;
    },
    { invincible, levelUps },
  );
}

export async function killPlayer(page) {
  await game(page, ({ player }) => player.takeDamage(1e12));
  await expect(page.locator("#gameOver")).toBeVisible();
}
