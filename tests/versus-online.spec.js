// Duel en ligne : deux navigateurs, un salon avec code (Supabase Realtime simulé ici),
// puis connexion directe (WebRTC) ou, à défaut, messages relayés par Supabase. Chacun joue sa
// partie de survie et voit celle de l'adversaire ; le gagnant empoche l'XP et l'or des deux.
import { expect, fakeRealtime, logIn, routeSupabase, test } from "./fixtures.js";

// Chromium masque les adresses locales derrière des noms « .local » : inutile entre deux onglets
// de la même machine, et parfois impossible à résoudre dans la CI.
test.use({ launchOptions: { args: ["--disable-features=WebRtcHideLocalIpsWithMdns"] } });

/** Exécute `fn(mods, arg)` dans la page ; `mods` : state, player, versus, online, config. */
function run(page, fn, arg) {
  return page.evaluate(
    async ({ src, arg }) => {
      const mods = {
        state: await import("/src/core/state.js"),
        player: await import("/src/systems/player.js"),
        versus: await import("/src/systems/versus.js"),
        online: await import("/src/systems/versusOnline.js"),
        config: await import("/src/config.js"),
      };
      // eslint-disable-next-line no-new-func
      return new Function("mods", "arg", `return (${src})(mods, arg)`)(mods, arg);
    },
    { src: fn.toString(), arg },
  );
}

const accountGold = (page) =>
  page.evaluate(async () => (await import("/src/services/storage.js")).account.gold);

/** Rend le joueur invincible (sans montée de niveau), ou le tue avec `score` et `gold` imposés. */
const protect = (page) =>
  run(page, ({ state }) => {
    state.player.health = state.player.maxHealth = 1e7;
    state.player.xpToNextLevel = 1e12;
  });
const kill = (page, run_ = {}) =>
  run(
    page,
    ({ state, player }, { score, gold }) => {
      if (score !== undefined) state.game.score = score;
      if (gold !== undefined) state.game.runGold = gold;
      state.player.revives = 0;
      player.takeDamage(1e12);
    },
    run_,
  );

/** Ouvre l'écran Duel avec un pseudo ; `net` ajuste la configuration réseau (délais, relais forcé). */
async function openDuelMenu(page, realtime, pseudo, net = {}) {
  await realtime(page);
  await page.goto("/");
  await page.evaluate(async (net) => {
    const { NET } = await import("/src/config.js");
    Object.assign(NET, { iceServers: [] }, net); // pas de STUN : les deux pages sont sur la même machine
  }, net);
  await page.locator("#playerPseudo").fill(pseudo);
  await page.locator("#playerPseudo").dispatchEvent("change");
  await page.locator("#btnVersus").click();
  await expect(page.locator("#duelMenu")).toBeVisible();
}

/**
 * Crée la partie chez l'hôte, la rejoint chez l'invité. `accounts` = [adresse de l'hôte, de l'invité]
 * (null = non connecté), avec le faux Supabase `supabase` partagé par les deux pages.
 */
async function connect(page, browser, net = {}, realtime = fakeRealtime(), { supabase, accounts = [] } = {}) {
  if (accounts[0]) await logIn(page, accounts[0]);
  await openDuelMenu(page, realtime, "Hote", net);
  await page.locator("#btnDuelHost").click();
  await expect(page.locator("#duelRoomCode")).toHaveText(/^[A-Z2-9]{4}$/);
  const code = await page.locator("#duelRoomCode").textContent();

  const guest = await (await browser.newContext()).newPage();
  const errors = [];
  guest.on("pageerror", (e) => errors.push(e.message));
  if (supabase) await routeSupabase(guest, supabase);
  else await guest.route("https://*.supabase.co/rest/**", (r) => r.fulfill({ status: 200, body: "[]" }));
  if (accounts[1]) await logIn(guest, accounts[1]);
  await openDuelMenu(guest, realtime, "Invite", net);
  await guest.locator("#duelCode").fill(code.toLowerCase()); // le code est remis en majuscules
  await guest.locator("#btnDuelJoin").click();

  for (const [p, rival] of [
    [page, "Invite"],
    [guest, "Hote"],
  ]) {
    await expect(p.locator("#duelRival")).toBeVisible({ timeout: 15_000 });
    await expect(p.locator("#ui")).toBeVisible(); // sa propre partie : le HUD habituel
    await expect(p.locator("#rivalName")).toHaveText(rival);
    await protect(p);
  }
  return { guest, errors, code };
}

for (const [mode, net] of [
  ["connexion directe", {}],
  ["relais par Supabase", { disableP2P: true, p2pTimeoutMs: 200 }],
]) {
  test(`duel en ligne (${mode}) : salon, déplacements, améliorations, victoire, revanche`, async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "deux joueurs au clavier");
    test.setTimeout(60_000);
    const { guest, errors } = await connect(page, browser, net);
    const usesRelay = () => page.evaluate(async () => (await import("/src/services/netplay.js")).net.relay);
    expect(await usesRelay()).toBe(!!net.disableP2P);

    // Chacun voit la partie de l'autre (vague, niveau, PV)
    // (sa partie continue : son tir auto peut encore ajouter quelques éliminations)
    await run(guest, ({ state }) => (state.game.kills = 4200));
    await expect(page.locator("#rivalInfo")).toContainText(/42\d\d ÉLIM\./);

    // L'invité meurt le premier : l'hôte gagne et empoche l'or des deux parties
    const gold = await accountGold(page);
    await run(page, ({ state }) => (state.game.runGold = 25));
    await kill(guest, { gold: 17 });
    await expect(page.locator("#versusWinner")).toHaveText("TU GAGNES !");
    await expect(guest.locator("#versusWinner")).toHaveText("Hote GAGNE !");
    // (la partie de l'hôte tourne jusqu'à l'annonce de la mort : il peut ramasser encore un peu d'or)
    await expect(page.locator("#versusScore")).toContainText(/Tu empoches les deux parties : .*\+\d+ or/);
    const shown = (await page.locator("#versusScore").textContent()).match(/\+(\d+) or/)[1];
    expect(Number(shown)).toBeGreaterThanOrEqual(42);
    expect((await accountGold(page)) - gold).toBeGreaterThanOrEqual(42);
    await expect(guest.locator("#versusScore")).toHaveText("Hote empoche tes gains.");
    // Récap : courbes de vie des deux joueurs (la sienne et celle reçue de l'adversaire)
    for (const p of [page, guest]) await expect(p.locator("#versusChart")).toBeVisible();
    await expect(page.locator("#versusTable tr", { hasText: "Attaques envoyées" })).toBeVisible();
    // Personne n'est connecté : duel non classé
    await expect(page.locator("#versusElo")).toHaveText(
      "Duel non classé : connecte-toi pour gagner des points ELO.",
    );

    // Revanche demandée par l'invité : tout recommence chez les deux
    await guest.locator("#btnVersusReplay").click();
    for (const p of [page, guest]) {
      await expect(p.locator("#duelRival")).toBeVisible();
      await expect
        .poll(() => run(p, ({ state }) => [state.game.over, state.game.runGold]))
        .toEqual([false, 0]);
      await protect(p);
    }

    // L'hôte quitte en pleine partie : l'invité gagne par abandon
    page.once("dialog", (d) => d.accept());
    await page.keyboard.press("Escape");
    await expect(page.locator("#mainMenu")).toBeVisible();
    await expect(guest.locator("#versusWinner")).toHaveText("TU GAGNES !");
    await expect(guest.locator("#versusScore")).toContainText("Hote a quitté le duel.");
    await expect(guest.locator("#btnVersusReplay")).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test("duel en ligne : deux morts qui se croisent, le meilleur score gagne chez les deux", async ({
  page,
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "deux navigateurs");
  test.setTimeout(60_000);
  const realtime = fakeRealtime();
  const { guest } = await connect(page, browser, { disableP2P: true, p2pTimeoutMs: 200 }, realtime);
  // Les deux meurent avant d'avoir reçu la nouvelle de l'autre (messages retenus)
  realtime.hold(true);
  await kill(page, { score: 100 });
  await kill(guest, { score: 300 });
  for (const p of [page, guest]) await expect(p.locator("#versusWinner")).toHaveText(/GAGNE/);
  realtime.hold(false);
  for (const p of [page, guest]) await expect(p.locator("#versusOver")).toBeVisible();
  await expect(guest.locator("#versusWinner")).toHaveText("TU GAGNES !");
  await expect(page.locator("#versusWinner")).toHaveText("Invite GAGNE !");
});

test("duel en ligne : la jauge d'attaque pleine envoie des ennemis chez l'adversaire", async ({
  page,
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "deux navigateurs");
  test.setTimeout(60_000);
  const { guest } = await connect(page, browser);
  await run(guest, ({ state }) => (state.player.autoShoot = false));
  const mobs = await run(page, ({ config, state }) => {
    state.game.duelAttack = config.VERSUS.attack.killsPerSend - 1;
    return config.VERSUS.attack.mobs;
  });
  await page.evaluate(async () => {
    const { killEnemy } = await import("/src/systems/combat.js");
    const { spawnEnemy } = await import("/src/systems/spawner.js");
    const { world } = await import("/src/core/state.js");
    spawnEnemy("normal", 0, 0);
    killEnemy(world.enemies[world.enemies.length - 1]);
  });
  await expect
    .poll(() => run(guest, ({ state }) => state.world.enemies.filter((e) => e.sent).length))
    .toBe(mobs);
  await expect(guest.locator("#bossWarning")).toHaveText(`ATTAQUE DE Hote ! +${mobs} ENNEMIS`);
  expect(await run(page, ({ state }) => state.world.enemies.some((e) => e.sent))).toBe(false);

  // Sort : prêt chez l'hôte (touche F), il tombe sur l'invité
  await run(page, ({ state }) => (state.game.spellReady = "fog"));
  await expect(page.locator("#duelSpellLabel")).toHaveText("SORT PRÊT : BROUILLARD (F)");
  await page.keyboard.press("f");
  await expect.poll(() => run(guest, ({ state }) => state.game.hex?.type)).toBe("fog");
  await expect(guest.locator("#bossWarning")).toHaveText("BROUILLARD ! (SORT DE Hote)");
  await expect(page.locator("#duelSpellLabel")).toHaveText("TON SORT");
});

test("duel en ligne : la partie de l'adversaire est visible en direct en haut à droite", async ({
  page,
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "deux navigateurs");
  test.setTimeout(60_000);
  const { guest } = await connect(page, browser);
  // L'hôte fait apparaître un boss : l'invité doit le recevoir dans l'aperçu
  await page.evaluate(async () => {
    const { spawnEnemy } = await import("/src/systems/spawner.js");
    const { player } = await import("/src/core/state.js");
    spawnEnemy("boss", player.worldX + 200, player.worldY);
  });
  const view = () =>
    run(guest, ({ online }) => {
      const v = online.rival.view?.cur;
      return v && { boss: v.e.some((e) => e[1] === online.ENEMY_KEYS.indexOf("boss")), wave: v.w, ship: v.s };
    });
  await expect.poll(async () => (await view())?.boss).toBe(true);
  const host = await run(page, ({ state }) => [Math.round(state.player.worldX), state.game.wave]);
  const v = await run(guest, ({ online }) => [online.rival.view.cur.x, online.rival.view.cur.w]);
  expect(Math.abs(v[0] - host[0])).toBeLessThan(200);
  expect(v[1]).toBe(host[1]);
  await expect(guest.locator("body")).toHaveClass(/duel-live/);
});

test("duel en ligne : le choix d'amélioration se fait seul au bout du temps imparti", async ({
  page,
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "deux navigateurs");
  test.setTimeout(60_000);
  const { guest } = await connect(page, browser);
  await run(guest, ({ config, state, player }) => {
    config.VERSUS.pickSeconds = 0.5;
    state.player.xpToNextLevel = 10;
    player.gainXp(10);
  });
  await expect(guest.locator("#upgradeMenu")).toBeVisible();
  await expect(page.locator("#upgradeMenu")).toBeHidden(); // l'adversaire continue
  await expect(guest.locator("#upgradeMenu")).toBeHidden({ timeout: 15_000 });
  expect(await run(guest, ({ state }) => Object.keys(state.player.inventory).length)).toBe(1);
});

test("duel en ligne classé : ELO des deux joueurs connectés, abandon = défaite, onglet DUEL ELO", async ({
  page,
  browser,
  isMobile,
  supabase,
}) => {
  test.skip(isMobile, "deux navigateurs");
  test.setTimeout(60_000);
  const accounts = ["hote@test.fr", "invite@test.fr"];
  const { guest } = await connect(page, browser, {}, fakeRealtime(), { supabase, accounts });

  // L'invité meurt : les deux déclarent le résultat, le serveur compte le duel
  await kill(guest);
  await expect(page.locator("#versusElo")).toHaveText("BRONZE · 1016 ELO (+16)");
  await expect(guest.locator("#versusElo")).toHaveText("BRONZE · 984 ELO (-16)");

  // Revanche, puis l'hôte quitte en pleine partie : défaite pour lui, victoire pour l'invité
  await guest.locator("#btnVersusReplay").click();
  for (const p of [page, guest]) {
    await expect(p.locator("#duelRival")).toBeVisible();
    await expect(p.locator("#versusElo")).toHaveText("");
    await expect(p.locator("#rivalRank .rank-bronze")).toBeVisible(); // ELO connu depuis le premier duel
    await protect(p);
  }
  page.once("dialog", (d) => d.accept());
  await page.keyboard.press("Escape");
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#homeRank")).toBeVisible(); // rang sur l'accueil après un duel compté
  await expect(guest.locator("#versusWinner")).toHaveText("TU GAGNES !");
  await expect(guest.locator("#versusElo")).toHaveText(/^BRONZE · 1001 ELO \(\+17\)$/);

  // Classement : onglet DUEL ELO, avec sa propre place
  await page.locator("#btnLeaderboard").click();
  await page.locator("#lbTabDuel").click();
  await expect(page.locator("#lbContent tr")).toHaveCount(2);
  await expect(page.locator("#lbContent tr").first()).toContainText("Invite");
  await expect(page.locator("#lbContent tr").first()).toContainText("1001");
  await expect(page.locator("#lbMe")).toHaveText("Ta place : #2 · Bronze · 999 ELO · 1 V / 1 D");
});

test("duel en ligne : un code inconnu est signalé", async ({ page }) => {
  await openDuelMenu(page, fakeRealtime(), "Seul", { joinTimeoutMs: 800 });
  await page.locator("#duelCode").fill("ZZZZ");
  await page.locator("#btnDuelJoin").click();
  await expect(page.locator("#duelStatus")).toHaveText(/Aucune partie avec ce code/);
});

test("duel en ligne : une partie complète refuse un troisième joueur", async ({
  page,
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "deux joueurs au clavier");
  const realtime = fakeRealtime();
  const { code } = await connect(page, browser, {}, realtime);
  const third = await (await browser.newContext()).newPage();
  await third.route("https://*.supabase.co/rest/**", (r) => r.fulfill({ status: 200, body: "[]" }));
  await openDuelMenu(third, realtime, "Trois");
  await third.locator("#duelCode").fill(code);
  await third.locator("#btnDuelJoin").click();
  await expect(third.locator("#duelStatus")).toHaveText("Cette partie a déjà deux joueurs.");
});
