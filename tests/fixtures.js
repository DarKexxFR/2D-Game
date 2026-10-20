// Fixtures communes : Supabase simulé (aucun appel réseau réel) et échec du test
// si la page lève une erreur JavaScript.
import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  // Réponses du faux Supabase, modifiables par test : supabase.scores, supabase.mode...
  supabase: async ({}, use) => {
    // accounts : sauvegardes liées à un compte (par adresse) ; emails : codes demandés ;
    // duel : classement ELO simulé (ratings par adresse, déclarations par duel)
    // friends : profils (par identifiant) et liens d'amitié { requester, addressee, accepted }
    // push : appels des RPC de notifications { rpc, args, token } (voir services/notifications.js)
    await use({
      scores: [],
      mode: "ok",
      posts: [],
      cloud: {},
      accounts: {},
      emails: [],
      duel: { ratings: {}, reports: {}, settled: {} },
      friends: { profiles: {}, links: [] },
      push: [],
      analytics: [], // appels track_session / track_run { rpc, args } (voir services/analytics.js)
      adminStats: null, // réponse de admin_stats (null = compte non administrateur)
      errors: [], // rapports d'erreurs reçus par report_error (arguments, voir services/errorReports.js)
      adminErrors: [], // erreurs regroupées renvoyées par admin_errors (page stats.html)
      errorReports: {}, // rapports détaillés renvoyés par admin_error_reports, par empreinte
    });
  },
  // Erreurs provoquées exprès par un test (test.use({ allowedErrors: [...] })) : tolérées, une fois chacune
  allowedErrors: [[], { option: true }],
  page: async ({ page, supabase, allowedErrors }, use) => {
    const errors = [];
    const allowed = [...allowedErrors];
    page.on("pageerror", (e) => {
      const i = allowed.indexOf(e.message);
      if (i >= 0) allowed.splice(i, 1);
      else errors.push(e.message);
    });
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
    const friends = fakeFriends(route, req, supabase);
    if (friends) return friends;
    // Fonctions RPC de la sauvegarde en ligne (stockées dans supabase.cloud)
    const rpc = req.url().match(/\/rpc\/(\w+)/)?.[1];
    if (rpc === "track_session" || rpc === "track_run") {
      supabase.analytics.push({ rpc, args: req.postDataJSON() });
      return route.fulfill({ status: 204, body: "" });
    }
    if (rpc === "admin_stats") {
      if (!supabase.adminStats || !userFromToken(req)) {
        return route.fulfill(
          json({ code: "42501", message: "Statistiques réservées aux administrateurs" }, 403),
        );
      }
      return route.fulfill(json(supabase.adminStats));
    }
    if (rpc === "report_error") {
      supabase.errors.push(req.postDataJSON());
      return route.fulfill({ status: 204, body: "" });
    }
    if (rpc === "admin_errors" || rpc === "admin_error_reports" || rpc === "admin_error_resolve") {
      if (!supabase.adminStats || !userFromToken(req)) {
        return route.fulfill(json({ code: "42501", message: "Réservé aux administrateurs" }, 403));
      }
      const args = req.postDataJSON();
      if (rpc === "admin_errors")
        return route.fulfill(json({ days: args.p_days, groups: supabase.adminErrors }));
      if (rpc === "admin_error_reports")
        return route.fulfill(json(supabase.errorReports[args.p_fingerprint] || []));
      const group = supabase.adminErrors.find((g) => g.fingerprint === args.p_fingerprint);
      if (group) group.resolved_at = args.p_resolved ? new Date().toISOString() : null;
      return route.fulfill({ status: 204, body: "" });
    }
    if (rpc === "push_subscribe" || rpc === "push_unsubscribe") {
      supabase.push.push({ rpc, args: req.postDataJSON(), token: userFromToken(req) });
      return route.fulfill({ status: 204, body: "" });
    }
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
        config: await import("/src/config.js"),
        mapEvents: await import("/src/systems/mapEvents.js"),
        arena: await import("/src/systems/arena.js"),
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

/**
 * Faux serveur Supabase Realtime (protocole Phoenix) partagé par les pages du test :
 * rejoint les canaux et retransmet les diffusions aux autres membres du canal.
 */
export function fakeRealtime() {
  const rooms = new Map(); // topic → Set de connexions
  let held = null; // diffusions retenues (voir `hold`)
  const realtime = async (page) => {
    await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
      const topics = new Set();
      const reply = (msg, status = "ok") =>
        ws.send(
          JSON.stringify({
            topic: msg.topic,
            event: "phx_reply",
            payload: { status, response: {} },
            ref: msg.ref,
          }),
        );
      ws.onMessage((raw) => {
        const msg = JSON.parse(raw);
        if (msg.event === "phx_join") {
          if (!rooms.has(msg.topic)) rooms.set(msg.topic, new Set());
          rooms.get(msg.topic).add(ws);
          topics.add(msg.topic);
          reply(msg);
        } else if (msg.event === "heartbeat") reply(msg);
        else if (msg.event === "phx_leave") rooms.get(msg.topic)?.delete(ws);
        else if (msg.event === "broadcast") {
          for (const other of rooms.get(msg.topic) || []) {
            if (other === ws) continue;
            const out = JSON.stringify({ topic: msg.topic, event: "broadcast", payload: msg.payload });
            if (held) held.push(() => other.send(out));
            else other.send(out);
          }
        }
      });
      ws.onClose(() => {
        for (const t of topics) rooms.get(t)?.delete(ws);
      });
    });
  };
  /** Retient les messages (true) puis les délivre tous (false) : simule un réseau lent. */
  realtime.hold = (on) => {
    if (on) held ??= [];
    else for (const send of held?.splice(0) ?? []) send();
    if (!on) held = null;
  };
  return realtime;
}

/** Session de connexion du faux Supabase (voir fixtures.js) enregistrée avant le chargement. */
export function logIn(page, email) {
  const session = {
    accessToken: `tok-${email}`,
    refreshToken: `ref-${email}`,
    expiresAt: Date.now() + 3_600_000,
    user: { id: `id-${email}`, email, provider: "email" },
  };
  return page.addInitScript((s) => localStorage.setItem("survivor_auth", JSON.stringify(s)), session);
}

/** Amis (mêmes règles que friends_sync / friend_request... dans supabase/schema.sql), présence comprise. */
function fakeFriends(route, req, supabase) {
  const rpc = req.url().match(/\/rpc\/(friends_sync|friend_request|friend_respond|friend_remove)$/)?.[1];
  if (!rpc) return null;
  const email = userFromToken(req);
  if (!email) return route.fulfill(json({ message: "Non connecté" }, 401));
  const me = `id-${email}`;
  const { profiles } = supabase.friends;
  const args = req.postDataJSON();
  const fail = (reason) => route.fulfill(json({ code: "P0001", message: `ami:${reason}` }, 400));
  const pair = (a, b) =>
    supabase.friends.links.find(
      (l) => (l.requester === a && l.addressee === b) || (l.requester === b && l.addressee === a),
    );
  const drop = (link) => (supabase.friends.links = supabase.friends.links.filter((l) => l !== link));
  if (rpc === "friends_sync") {
    const code = profiles[me]?.code ?? email.slice(0, 6).toUpperCase().padEnd(6, "X");
    profiles[me] = { id: me, name: args.p_name || "Pilote", code, status: args.p_status, seen: Date.now() };
    const other = (l) => profiles[l.requester === me ? l.addressee : l.requester];
    const links = supabase.friends.links.filter((l) => l.requester === me || l.addressee === me);
    const brief = (p) => ({ id: p.id, name: p.name });
    return route.fulfill(
      json({
        code,
        friends: links
          .filter((l) => l.accepted)
          .map(other)
          .map((p) => ({
            ...brief(p),
            online: Date.now() - p.seen < 75_000,
            status: p.status,
            rating: supabase.duel.ratings[p.id.replace(/^id-/, "")]?.rating ?? null,
          })),
        incoming: links.filter((l) => !l.accepted && l.addressee === me).map((l) => brief(other(l))),
        outgoing: links.filter((l) => !l.accepted && l.requester === me).map((l) => brief(other(l))),
      }),
    );
  }
  if (rpc === "friend_request") {
    const q = args.p_query.trim();
    let target = Object.values(profiles).find((p) => p.code === q.toUpperCase());
    if (!target) {
      const named = Object.values(profiles).filter(
        (p) => p.id !== me && p.name.toLowerCase() === q.toLowerCase(),
      );
      if (named.length > 1) return fail("ambigu");
      target = named[0];
    }
    if (!target) return fail("introuvable");
    if (target.id === me) return fail("soi");
    const link = pair(me, target.id);
    if (link && !link.accepted && link.requester === target.id) {
      link.accepted = true;
      return route.fulfill(json({ status: "accepted", id: target.id, name: target.name }));
    }
    if (link) return fail("deja");
    supabase.friends.links.push({ requester: me, addressee: target.id, accepted: false });
    return route.fulfill(json({ status: "sent", id: target.id, name: target.name }));
  }
  const link = pair(me, args.p_id);
  if (rpc === "friend_respond" && link && !link.accepted && link.addressee === me) {
    if (args.p_accept) link.accepted = true;
    else drop(link);
  }
  if (rpc === "friend_remove" && link) drop(link);
  return route.fulfill({ status: 204, body: "" });
}
