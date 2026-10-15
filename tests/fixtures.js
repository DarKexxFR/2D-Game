// Fixtures communes : Supabase simulé (aucun appel réseau réel) et échec du test
// si la page lève une erreur JavaScript.
import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  // Réponses du faux Supabase, modifiables par test : supabase.scores, supabase.mode...
  supabase: async ({}, use) => {
    // accounts : sauvegardes liées à un compte (par adresse) ; emails : codes demandés ;
    // duel : classement ELO simulé (ratings par adresse, déclarations par duel)
    await use({
      scores: [],
      mode: "ok",
      posts: [],
      cloud: {},
      accounts: {},
      emails: [],
      duel: { ratings: {}, reports: {}, settled: {} },
    });
  },
  page: async ({ page, supabase }, use) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await routeSupabase(page, supabase);
    await use(page);
    expect(errors, "erreurs JavaScript dans la page").toEqual([]);
  },
});

export { expect };

/** Faux Supabase pour une page (aussi pour une deuxième page, en duel en ligne : même état partagé). */
export function routeSupabase(page, supabase) {
  return page.route("https://*.supabase.co/**", (route) => {
    const req = route.request();
    if (supabase.mode === "down") return route.fulfill({ status: 503, body: "down" });
    const auth = fakeAuth(route, req, supabase);
    if (auth) return auth;
    const duel = fakeDuelRanking(route, req, supabase);
    if (duel) return duel;
    // Fonctions RPC de la sauvegarde en ligne (stockées dans supabase.cloud)
    const rpc = req.url().match(/\/rpc\/(\w+)/)?.[1];
    if (rpc === "save_progress") {
      const { p_code, p_data } = req.postDataJSON();
      supabase.cloud[p_code] = p_data;
      return route.fulfill({ status: 204, body: "" });
    }
    if (rpc === "load_progress") {
      const data = supabase.cloud[req.postDataJSON().p_code] ?? null;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    }
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
}

/** Code à 6 chiffres accepté par le faux Supabase pour toute adresse e-mail. */
export const EMAIL_CODE = "123456";
/** Adresses des faux comptes Google et Discord. */
export const GOOGLE_EMAIL = "joueur@gmail.com";
export const DISCORD_EMAIL = "joueur@discord.test";
const OAUTH_EMAILS = { google: GOOGLE_EMAIL, discord: DISCORD_EMAIL };

const json = (body, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

/** Faux compte : le jeton porte l'adresse (« tok-adresse »), l'identifiant en découle. */
function fakeSession(email) {
  return {
    access_token: `tok-${email}`,
    refresh_token: `ref-${email}`,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: `id-${email}`,
      email,
      app_metadata: {
        provider: Object.keys(OAUTH_EMAILS).find((p) => OAUTH_EMAILS[p] === email) || "email",
      },
    },
  };
}

const userFromToken = (req) => req.headers().authorization?.match(/^Bearer tok-(.+)$/)?.[1] ?? null;

/** Authentification simulée (/auth/v1/...) et sauvegardes liées au compte (RPC). */
function fakeAuth(route, req, supabase) {
  const url = new URL(req.url());
  const path = url.pathname;
  if (path.endsWith("/auth/v1/authorize")) {
    // « Google » / « Discord » : renvoie directement sur le jeu avec la session dans l'URL
    const s = fakeSession(OAUTH_EMAILS[url.searchParams.get("provider")]);
    const hash = `access_token=${s.access_token}&refresh_token=${s.refresh_token}&expires_in=3600`;
    return route.fulfill({
      status: 302,
      headers: { location: `${url.searchParams.get("redirect_to")}#${hash}` },
    });
  }
  if (path.endsWith("/auth/v1/otp")) {
    supabase.emails.push(req.postDataJSON().email);
    return route.fulfill(json({}));
  }
  if (path.endsWith("/auth/v1/verify")) {
    const { email, token } = req.postDataJSON();
    return route.fulfill(
      token === EMAIL_CODE ? json(fakeSession(email)) : json({ msg: "Code invalide" }, 403),
    );
  }
  if (path.endsWith("/auth/v1/user")) {
    const email = userFromToken(req);
    return route.fulfill(email ? json(fakeSession(email).user) : json({}, 401));
  }
  if (path.endsWith("/auth/v1/token")) {
    return route.fulfill(json(fakeSession(req.postDataJSON().refresh_token.replace(/^ref-/, ""))));
  }
  if (path.endsWith("/auth/v1/logout")) return route.fulfill({ status: 204, body: "" });
  const rpc = path.match(/\/rpc\/(\w+_account_progress)$/)?.[1];
  if (!rpc) return null;
  const user = userFromToken(req);
  if (!user) return route.fulfill(json({ message: "Non connecté" }, 401));
  if (rpc === "load_account_progress") return route.fulfill(json(supabase.accounts[user] ?? null));
  if (rpc === "save_account_progress") supabase.accounts[user] = req.postDataJSON().p_data;
  if (rpc === "delete_account_progress") delete supabase.accounts[user];
  return route.fulfill({ status: 204, body: "" });
}

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
        combat: await import("/src/systems/combat.js"),
        enemies: await import("/src/systems/enemies.js"),
        input: await import("/src/core/input.js"),
        canvas: await import("/src/core/canvas.js"),
        items: await import("/src/data/items.js"),
        upgrades: await import("/src/data/upgrades.js"),
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
  await declineRevive(page);
  await expect(page.locator("#gameOver")).toBeVisible();
}

/** À la mort, refuse l'offre « revivre avec une pub » si elle s'affiche. */
export async function declineRevive(page) {
  if (await page.locator("#reviveMenu").isVisible()) await page.locator("#btnReviveGiveUp").click();
}

/**
 * Classement ELO du duel (même règle que report_duel dans supabase/schema.sql) : un duel compte
 * quand les deux joueurs l'ont déclaré et sont d'accord ; ELO K = 32, départ à 1000.
 */
function fakeDuelRanking(route, req, supabase) {
  const rpc = req.url().match(/\/rpc\/(report_duel|get_duel_ranking)$/)?.[1];
  if (!rpc) return null;
  const d = supabase.duel;
  const me = userFromToken(req);
  const rating = (u) => (d.ratings[u] ??= { name: u, rating: 1000, wins: 0, losses: 0 });
  if (rpc === "get_duel_ranking") {
    const ranked = Object.values(d.ratings)
      .filter((r) => r.wins + r.losses > 0)
      .sort((a, b) => b.rating - a.rating);
    const mine = me && d.ratings[me];
    const rank = mine && ranked.indexOf(mine) + 1;
    return route.fulfill(json({ top: ranked, me: rank ? { ...mine, rank } : null }));
  }
  if (!me) return route.fulfill(json({ message: "Non connecté" }, 401));
  const { p_match, p_won, p_name } = req.postDataJSON();
  rating(me).name = p_name;
  const settled = d.settled[p_match];
  const result = (delta) => json({ status: "settled", rating: d.ratings[me].rating, delta });
  if (settled) return route.fulfill(result(settled.winner === me ? settled.delta : -settled.delta));
  const reports = (d.reports[p_match] ??= {});
  reports[me] = p_won;
  const other = Object.keys(reports).find((u) => u !== me);
  if (!other || reports[other] === p_won)
    return route.fulfill(json({ status: "pending", rating: rating(me).rating }));
  const [w, l] = p_won ? [me, other] : [other, me];
  const delta = Math.round(32 * (1 - 1 / (1 + 10 ** ((rating(l).rating - rating(w).rating) / 400))));
  rating(w).rating += delta;
  rating(w).wins++;
  rating(l).rating -= delta;
  rating(l).losses++;
  d.settled[p_match] = { winner: w, delta };
  return route.fulfill(result(p_won ? delta : -delta));
}
