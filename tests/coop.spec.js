// Coop en ligne : de 2 à 4 joueurs dans la même partie de survie. Salon avec code (Supabase Realtime
// simulé ici), connexion directe ou relais ; l'hôte fait tourner la partie, les invités envoient leurs
// commandes et dessinent l'état reçu. Réanimation d'un coéquipier à terre, fin quand toute l'équipe tombe.
import { expect, fakeRealtime, test } from "./fixtures.js";

test.use({ launchOptions: { args: ["--disable-features=WebRtcHideLocalIpsWithMdns"] } });

/** Exécute `fn(mods, arg)` dans la page ; `mods` : state, player, party, sync, config, upgrades, storage. */
function run(page, fn, arg) {
  return page.evaluate(
    async ({ src, arg }) => {
      const mods = {
        state: await import("/src/core/state.js"),
        player: await import("/src/systems/player.js"),
        party: await import("/src/systems/party.js"),
        sync: await import("/src/systems/coopSync.js"),
        config: await import("/src/config.js"),
        upgrades: await import("/src/data/upgrades.js"),
        storage: await import("/src/services/storage.js"),
        spawner: await import("/src/systems/spawner.js"),
      };
      // eslint-disable-next-line no-new-func
      return new Function("mods", "arg", `return (${src})(mods, arg)`)(mods, arg);
    },
    { src: fn.toString(), arg },
  );
}

/** Ouvre l'écran Coop avec un pseudo ; `net` ajuste la configuration réseau (délais, relais forcé). */
async function openCoopMenu(page, realtime, pseudo, net = {}) {
  await realtime(page);
  await page.goto("/");
  await page.evaluate(async (net) => {
    const { NET } = await import("/src/config.js");
    Object.assign(NET, { iceServers: [] }, net); // pas de STUN : toutes les pages sont sur la même machine
  }, net);
  await page.locator("#playerPseudo").fill(pseudo);
  await page.locator("#playerPseudo").dispatchEvent("change");
  await page.locator("#btnCoop").click();
  await expect(page.locator("#coopMenu")).toBeVisible();
}

/** Nouvel invité (navigateur à part) qui rejoint le salon `code`. */
async function newGuest(browser, realtime, pseudo, code, net, errors) {
  const guest = await (await browser.newContext()).newPage();
  guest.on("pageerror", (e) => errors.push(`${pseudo} : ${e.message}`));
  await guest.route("https://*.supabase.co/rest/**", (r) => r.fulfill({ status: 200, body: "[]" }));
  await openCoopMenu(guest, realtime, pseudo, net);
  await guest.locator("#coopCode").fill(code.toLowerCase()); // le code est remis en majuscules
  await guest.locator("#btnCoopJoin").click();
  await expect(guest.locator("#coopStatus")).toHaveText(/Connecté/, { timeout: 15_000 });
  return guest;
}

/** Salon de `names.length` joueurs (le premier est l'hôte, `page`), partie lancée. */
async function startCoop(page, browser, names, net = {}, realtime = fakeRealtime()) {
  const errors = [];
  await openCoopMenu(page, realtime, names[0], net);
  await page.locator("#btnCoopHost").click();
  await expect(page.locator("#coopRoomCode")).toHaveText(/^[A-Z2-9]{4}$/);
  const code = await page.locator("#coopRoomCode").textContent();
  const guests = [];
  for (const name of names.slice(1)) guests.push(await newGuest(browser, realtime, name, code, net, errors));
  await expect(page.locator("#coopLobby li")).toHaveCount(names.length);
  await expect(guests[0].locator("#coopLobby li")).toHaveCount(names.length);
  await page.locator("#btnCoopStart").click();
  for (const p of [page, ...guests]) {
    await expect(p.locator("#ui")).toBeVisible({ timeout: 15_000 });
    await expect(p.locator("#coopParty .coop-member")).toHaveCount(names.length);
  }
  // Toute l'équipe invincible (sauf demande contraire) et sans montée de niveau
  await run(page, ({ state, party }) => {
    party.forEachMember(
      () => {
        state.player.health = state.player.maxHealth = 1e7;
        state.player.xpToNextLevel = 1e12;
      },
      { down: true },
    );
  });
  return { guests, errors, code, realtime };
}

for (const [mode, net] of [
  ["connexion directe", {}],
  ["relais par Supabase", { disableP2P: true, p2pTimeoutMs: 200 }],
]) {
  test(`coop en ligne à 3 (${mode}) : partie commune, déplacements, carte agrandie, ennemis partagés`, async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "plusieurs joueurs au clavier");
    test.setTimeout(90_000);
    const { guests, errors } = await startCoop(page, browser, ["Hote", "Alice", "Bob"], net);
    const [alice, bob] = guests;

    // Partie à 3 : carte et arène plus grandes, ennemis plus résistants
    const scaled = await run(page, ({ state, config }) => ({
      maxX: state.game.map.maxX,
      size: state.game.coopSize,
      map: state.game.map.maxX / config.MAP_BOUNDS.maxX,
      arena: state.game.arenaSize / config.BOSS_ZONE.size,
      health: state.game.modifier.enemyHealth,
    }));
    expect(scaled).toEqual({ maxX: 2250, size: 3, map: 1.5, arena: 1.4, health: 2.1 });

    // Chaque invité reçoit la partie de l'hôte (mêmes ennemis, même vague, carte agrandie)
    await expect.poll(() => run(bob, ({ state }) => state.world.enemies.length)).toBeGreaterThan(0);
    await expect.poll(() => run(bob, ({ state }) => state.game.map?.maxX)).toBe(scaled.maxX);
    await run(page, ({ state }) => (state.game.wave = 4));
    await expect(bob.locator("#wave")).toHaveText("4");

    // Alice se déplace vers la droite : l'hôte fait avancer son vaisseau, Bob le voit bouger
    const startX = await run(page, ({ party }) => party.memberObj(1).worldX);
    await alice.keyboard.down("d");
    await expect.poll(() => run(page, ({ party }) => party.memberObj(1).worldX)).toBeGreaterThan(startX + 80);
    await alice.keyboard.up("d");
    const hostView = await run(page, ({ party }) => party.memberObj(1).worldX);
    await expect
      .poll(() => run(bob, ({ party }) => party.memberObj(1).worldX))
      .toBeGreaterThan(hostView - 30);
    // Sa propre position est prédite : elle rejoint celle de l'hôte (relevées ensemble : le relais n'envoie que
    // quelques messages par seconde, une mesure prise juste après le relâchement pouvait encore les séparer)
    await expect
      .poll(async () => {
        const own = await run(alice, ({ state }) => state.player.worldX);
        const host = await run(page, ({ party }) => party.memberObj(1).worldX);
        return Math.abs(own - host);
      })
      .toBeLessThan(60);

    // Un ennemi poursuit le joueur le plus proche
    const aggro = await run(page, ({ state, party, spawner, sync }) => {
      const bobShip = party.memberObj(2);
      state.world.enemies.length = 0;
      spawner.spawnEnemy("normal", bobShip.worldX + 40, bobShip.worldY);
      party.assignAggro();
      return state.world.enemies.at(-1).aggro;
    });
    expect(aggro).toBe(2);

    // Les tirs de chaque joueur lui appartiennent. Une cible à distance de chacun : collés aux vaisseaux, les
    // ennemis prenaient chaque tir dans le tick même où il partait, et la liste des tirs restait vide.
    await run(page, ({ state, party, spawner }) => {
      state.world.enemies.length = 0;
      state.game.spawnTimer = 1e9; // plus d'apparitions le temps de la vérification
      for (const k of [0, 1, 2]) {
        const p = party.memberObj(k);
        spawner.spawnEnemy("normal", p.worldX + 260, p.worldY);
      }
    });
    await expect
      .poll(() =>
        run(page, ({ state }) => [...new Set(state.world.projectiles.map((p) => p.owner))].sort().join()),
      )
      .toMatch(/0|1|2/);
    expect(errors).toEqual([]);
  });
}

test("coop en ligne : à terre, réanimation par un coéquipier, fin de partie pour toute l'équipe", async ({
  page,
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "plusieurs joueurs au clavier");
  test.setTimeout(90_000);
  const { guests, errors } = await startCoop(page, browser, ["Hote", "Alice"]);
  const [alice] = guests;

  // Alice tombe : l'équipe continue, son panneau dit « À TERRE »
  await run(page, ({ state, party, player }) => {
    party.withMember(1, () => {
      state.player.revives = 0;
      state.player.energyShield = 0;
      state.player.buffs.shield = 0;
      player.takeDamage(1e12);
    });
  });
  await expect(alice.locator("#coopParty .coop-member").nth(1)).toContainText("À TERRE");
  expect(await run(page, ({ state }) => [state.game.over, state.game.running])).toEqual([false, true]);

  // L'hôte reste à côté d'elle : elle se relève avec une partie de ses PV
  await run(page, ({ state, party }) => {
    const a = party.memberObj(1);
    state.player.worldX = a.worldX + 20;
    state.player.worldY = a.worldY;
    state.world.enemies.length = 0;
  });
  await expect
    .poll(() => run(page, ({ party }) => [party.memberObj(1).downed, party.isUp(1)]), { timeout: 10_000 })
    .toEqual([false, true]);
  await expect(alice.locator("#coopParty .coop-member").nth(1)).not.toContainText("À TERRE");

  // Toute l'équipe tombe : fin de partie chez tout le monde, chacun empoche l'XP et l'or de la partie
  const before = await run(alice, ({ storage }) => storage.account.gold);
  await run(page, ({ state, party, player }) => {
    state.game.runGold = 77;
    for (const k of [1, 0]) {
      party.withMember(k, () => {
        state.player.revives = 0;
        state.player.energyShield = 0;
        state.player.buffs.shield = 0;
        state.player.isDashing = false;
        player.takeDamage(1e12);
      });
    }
  });
  for (const p of [page, alice]) {
    await expect(p.locator("#gameOver")).toBeVisible();
    await expect(p.locator("#finalWaveLabel")).toHaveText("Vague · Coop 2 joueurs");
  }
  expect((await run(alice, ({ storage }) => storage.account.gold)) - before).toBeGreaterThanOrEqual(77);

  // REJOUER ramène tout le monde au salon ; l'hôte relance avec le même groupe
  await page.locator("#btnReplay").click();
  await expect(page.locator("#coopMenu")).toBeVisible();
  await expect(page.locator("#coopLobby li")).toHaveCount(2);
  await page.locator("#btnCoopStart").click();
  for (const p of [page, alice]) {
    await expect(p.locator("#coopParty")).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => run(p, ({ state }) => state.game.over)).toBe(false);
  }

  // L'hôte quitte : la partie s'arrête chez l'invité
  page.once("dialog", (d) => d.accept());
  await page.keyboard.press("Escape");
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(alice.locator("#gameOver")).toBeVisible({ timeout: 10_000 });
  await expect(alice.locator("#onlineStatus")).toHaveText("L'hôte a quitté la partie.");
  expect(errors).toEqual([]);
});

test("coop en ligne : pendant son choix d'amélioration, un joueur est retiré du jeu, la partie continue", async ({
  page,
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "plusieurs joueurs au clavier");
  test.setTimeout(60_000);
  const { guests, errors } = await startCoop(page, browser, ["Hote", "Alice"]);
  const [alice] = guests;
  // Protection au retour allongée : vérifiable même si la relève tarde un peu
  await run(page, ({ config }) => (config.COOP.pickReturnShield = 6000));

  // Alice monte de niveau : ses cartes s'affichent chez elle, l'hôte voit qu'elle choisit
  await run(page, ({ party, player, state }) =>
    party.withMember(1, () => {
      state.player.xpToNextLevel = 10;
      player.gainXp(20);
      state.player.xpToNextLevel = 1e12; // la partie continue : pas d'autre montée de niveau d'ici la fin
    }),
  );
  await expect(alice.locator("#upgradeMenu")).toBeVisible();
  await expect(page.locator("#coopWait")).toHaveText("Alice choisit une amélioration…");
  await expect(page.locator("#coopParty .coop-member").nth(1)).toHaveClass(/picking/);
  await expect.poll(() => run(page, ({ party }) => party.memberObj(1).picking)).toBe(true);

  // La partie continue ; Alice n'est ni visée ni touchée, même par un ennemi posé sur elle
  const time = await run(page, ({ state }) => state.game.time);
  const before = await run(page, ({ party, spawner }) => {
    const a = party.memberObj(1);
    spawner.spawnEnemy("normal", a.worldX, a.worldY);
    return { x: a.worldX, y: a.worldY, health: a.health };
  });
  await page.waitForTimeout(400);
  const during = await run(page, ({ party, state }) => {
    const a = party.memberObj(1);
    return {
      time: state.game.time,
      x: a.worldX,
      y: a.worldY,
      health: a.health,
      aggro: state.world.enemies.some((e) => e.aggro === 1),
      nearest: party.nearestMember(a.worldX, a.worldY) === a,
    };
  });
  expect(during.time).toBeGreaterThan(time); // la partie n'attend pas
  expect(during).toMatchObject({
    x: before.x,
    y: before.y,
    health: before.health,
    aggro: false,
    nearest: false,
  });

  const card = (await alice.locator("#upgradeOptions .upgrade-option h4").first().textContent()).split(
    " · ",
  )[0];
  await alice.locator("#upgradeOptions .upgrade-option").first().click();
  await expect(alice.locator("#upgradeMenu")).toBeHidden();
  await expect
    .poll(() => run(page, ({ party }, name) => party.memberObj(1).inventory[name] ?? 0, card))
    .toBeGreaterThan(0);
  await expect(page.locator("#coopWait")).toBeHidden();
  // De retour dans la partie, protégée un instant
  await expect.poll(() => run(page, ({ party }) => party.memberObj(1).picking)).toBe(false);
  expect(await run(page, ({ party }) => party.memberObj(1).buffs.shield)).toBeGreaterThan(0);

  // L'hôte aussi : son choix ne met pas la partie en pause
  await run(page, ({ state, player }) => {
    state.player.xpToNextLevel = 10;
    player.gainXp(20);
    state.player.xpToNextLevel = 1e12;
  });
  await expect(page.locator("#upgradeMenu")).toBeVisible();
  const hostTime = await run(page, ({ state }) => state.game.time);
  await expect.poll(() => run(page, ({ state }) => state.game.time)).toBeGreaterThan(hostTime + 200);
  expect(await run(page, ({ state }) => state.player.picking)).toBe(true);
  await expect(alice.locator("#coopWait")).toHaveText("Hote choisit une amélioration…");
  await page.locator("#upgradeOptions .upgrade-option").first().click();
  await expect(page.locator("#upgradeMenu")).toBeHidden();
  await expect.poll(() => run(page, ({ state }) => state.player.picking)).toBe(false);

  // XP partagée : une gemme ramassée par l'hôte fait aussi progresser Alice
  const xp = await run(page, ({ party }) => {
    party.memberObj(1).xpToNextLevel = 1e12;
    return party.memberObj(1).xp;
  });
  await run(page, ({ state }) =>
    state.world.gems.push({ x: state.player.worldX, y: state.player.worldY, xp: 5, collected: false }),
  );
  await expect.poll(() => run(page, ({ party }) => party.memberObj(1).xp)).toBeGreaterThan(xp);
  expect(errors).toEqual([]);
});

test("coop en ligne : 4 joueurs au plus, un code inconnu est signalé", async ({
  page,
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "plusieurs joueurs au clavier");
  test.setTimeout(90_000);
  const realtime = fakeRealtime();
  const errors = [];
  await openCoopMenu(page, realtime, "Hote");
  await page.locator("#btnCoopHost").click();
  await expect(page.locator("#coopRoomCode")).toHaveText(/^[A-Z2-9]{4}$/);
  const code = await page.locator("#coopRoomCode").textContent();
  for (const name of ["J2", "J3", "J4"]) await newGuest(browser, realtime, name, code, {}, errors);
  await expect(page.locator("#coopLobby li")).toHaveCount(4);

  const fifth = await (await browser.newContext()).newPage();
  await fifth.route("https://*.supabase.co/rest/**", (r) => r.fulfill({ status: 200, body: "[]" }));
  await openCoopMenu(fifth, realtime, "J5");
  await fifth.locator("#coopCode").fill(code);
  await fifth.locator("#btnCoopJoin").click();
  await expect(fifth.locator("#coopStatus")).toHaveText("Ce salon est complet (4 joueurs).");

  await fifth.locator("#coopCode").fill("ZZZZ");
  await fifth.evaluate(async () => ((await import("/src/config.js")).NET.joinTimeoutMs = 800));
  await fifth.locator("#btnCoopJoin").click();
  await expect(fifth.locator("#coopStatus")).toHaveText(/Aucun salon avec ce code/);
  expect(errors).toEqual([]);
});
