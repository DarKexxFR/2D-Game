// Partie interrompue (services/runSave.js, ui/resumeRun.js) : QUITTER, fermer ou masquer l'onglet
// sauvegarde la partie ; REPRENDRE sur l'accueil la recharge telle quelle, en pause.
import { expect, game, killPlayer, startGame, test, withSave } from "./fixtures.js";

const SAVE_KEY = "survivor_run";

/** Met la partie dans un état reconnaissable (vague, niveau, or, cartes, arme d'appoint). */
async function shapeRun(page) {
  await game(page, ({ state, upgrades }) => {
    const { game: g, player: p } = state;
    g.wave = 9;
    g.kills = 321;
    g.runGold = 77;
    g.totalRunXp = 450;
    g.time = 5 * 60 * 1000;
    p.level = 12;
    p.health = 1234;
    upgrades.applyUpgrade(
      upgrades.availableUpgrades(p).find((u) => u.rarity === "common"),
      p,
    );
    upgrades.applyUpgrade(
      upgrades.availableUpgrades(p).find((u) => u.sideWeapon),
      p,
    );
  });
}

/** Ce que montre la partie chargée (à comparer avant l'interruption et après la reprise). */
const readRun = (page) =>
  game(page, ({ state }) => {
    const { game: g, player: p, world } = state;
    return {
      wave: g.wave,
      time: g.time,
      kills: g.kills,
      gold: g.runGold,
      xp: g.totalRunXp,
      level: p.level,
      health: p.health,
      position: [p.worldX, p.worldY],
      inventory: p.inventory,
      sideWeapons: p.sideWeapons.map((w) => `${w.id}:${w.level}`),
      enemies: world.enemies.map((e) => `${e.type}:${Math.round(e.health)}:${Math.round(e.x)}`),
      gems: world.gems.length,
    };
  });

/** Pause (retour du navigateur, comme le bouton de pause) puis état de la partie figée. */
async function pauseAndRead(page) {
  await page.evaluate(() => history.back());
  await expect(page.locator("#pauseMenu")).toBeVisible();
  return readRun(page);
}

test.beforeEach(async ({ page }) => {
  await withSave(page, { tutorialDone: true, lastFreeChest: Date.now() });
});

test("QUITTER sauvegarde la partie, REPRENDRE la recharge en pause", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.locator("#btnResumeRun")).toBeHidden();
  await startGame(page);
  await shapeRun(page);
  await page.waitForTimeout(1500); // des ennemis apparaissent, le joueur tire
  const before = await pauseAndRead(page);
  expect(before.enemies.length).toBeGreaterThan(0);
  await page.locator("#btnQuit").click();
  await expect(page.locator("#mainMenu")).toBeVisible();

  await expect(page.locator("#btnResumeRun")).toBeVisible();
  await expect(page.locator("#resumeRunInfo")).toHaveText(/^Vague 9 · .* · 5 min$/);
  await expect(page.locator("#btnPlay")).toBeVisible(); // JOUER passe au second plan, toujours là
  if (!isMobile) await page.screenshot({ path: "test-results/resume-home.png" });

  await page.locator("#btnResumeRun").click();
  await expect(page.locator("#pauseMenu")).toBeVisible();
  await expect(page.locator("#pauseMeta")).toHaveText(/^Vague 9 · Niveau 12 · 5:0\d$/);
  expect(await readRun(page)).toEqual(before);

  // La partie repart : elle avance, et rien ne casse
  await page.locator("#btnResume").click();
  await expect(page.locator("#pauseMenu")).toBeHidden();
  await expect.poll(() => game(page, ({ state }) => state.game.time)).toBeGreaterThan(before.time + 500);
});

test("onglet fermé en pleine partie : la partie se reprend au rechargement", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await shapeRun(page);
  await page.waitForTimeout(1000);
  const before = await pauseAndRead(page);
  await page.reload(); // pagehide : sauvegarde
  await expect(page.locator("#btnResumeRun")).toBeVisible();
  await page.locator("#btnResumeRun").click();
  await expect(page.locator("#pauseMenu")).toBeVisible();
  expect(await readRun(page)).toEqual(before);
});

test("sauvegarde régulière en jouant, effacée à la mort", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBeNull();
  // Au-delà de RUN_SAVE.everySeconds de jeu, la partie est sauvegardée sans rien faire
  await game(page, ({ state, config }) => (state.game.time += config.RUN_SAVE.everySeconds * 1000));
  await expect
    .poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null")?.meta?.mode, SAVE_KEY))
    .toBe("normal");

  await killPlayer(page);
  expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBeNull();
  await page.locator("#btnGameOverMenu").click();
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#btnResumeRun")).toBeHidden();
});

test("choix d'amélioration en attente : mêmes cartes à la reprise, or du coffre compté une fois", async ({
  page,
}) => {
  await page.goto("/");
  await startGame(page);
  await game(page, async () => {
    const { showBossChest } = await import("/src/ui/upgradeMenu.js");
    showBossChest();
  });
  await expect(page.locator("#upgradeMenu")).toBeVisible();
  const cards = await page.locator("#upgradeOptions h4").allTextContents();
  const gold = await game(page, ({ state }) => state.game.runGold);
  expect(gold).toBeGreaterThan(0);

  await page.reload();
  await page.locator("#btnResumeRun").click();
  await expect(page.locator("#upgradeMenu")).toBeVisible();
  await expect(page.locator("#upgradeTitle")).toHaveText("COFFRE DE BOSS");
  expect(await page.locator("#upgradeOptions h4").allTextContents()).toEqual(cards);
  expect(await game(page, ({ state }) => state.game.runGold)).toBe(gold);

  await page.locator("#upgradeOptions .upgrade-option").first().click();
  await expect(page.locator("#upgradeMenu")).toBeHidden();
  expect(await game(page, ({ state }) => state.game.running)).toBe(true);
});

test("abandonner : depuis l'accueil (compté comme abandon) ou en lançant une autre partie", async ({
  page,
  supabase,
}) => {
  await page.goto("/");
  await startGame(page);
  await shapeRun(page);
  await page.evaluate(() => history.back());
  await page.locator("#btnQuit").click();
  await expect(page.locator("#btnResumeRun")).toBeVisible();
  // QUITTER n'est pas un abandon : la partie n'est comptée qu'à sa vraie fin
  const runs = () => supabase.analytics.filter((c) => c.rpc === "track_run").map((c) => c.args);
  expect(runs()).toEqual([]);

  // JOUER avec une partie en cours : confirmation ; refusée, rien ne change
  page.once("dialog", (d) => d.dismiss());
  await page.locator("#btnPlay").click();
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#btnResumeRun")).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await page.locator("#btnAbandonRun").click();
  await expect(page.locator("#btnResumeRun")).toBeHidden();
  await expect.poll(() => runs().length).toBe(1);
  expect(runs()[0]).toMatchObject({ p_killer: "abandon", p_wave: 9, p_level: 12 });

  // Nouvelle partie, quittée, puis JOUER accepté : la partie sauvegardée est remplacée
  await startGame(page);
  await page.evaluate(() => history.back());
  await page.locator("#btnQuit").click();
  page.once("dialog", (d) => d.accept());
  await page.locator("#btnPlay").click();
  await expect(page.locator("#ui")).toBeVisible();
  await expect.poll(() => runs().length).toBe(2);
  expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBeNull();
});

test("ABANDONNER dans la pause : partie perdue, rien à reprendre", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await page.evaluate(() => history.back());
  page.once("dialog", (d) => d.accept());
  await page.locator("#btnAbandon").click();
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#btnResumeRun")).toBeHidden();
});

test.describe("logique", () => {
  test.beforeEach(async ({ isMobile }) => test.skip(isMobile, "logique de jeu : une plateforme suffit"));

  test("copie d'un graphe : références partagées, cycles, nombres spéciaux, Set et Map", async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { encodeSnapshot, decodeSnapshot } = await import("/src/utils/snapshot.js");
      const shared = { hp: 5 };
      const root = { a: shared, b: [shared, -Infinity, NaN, undefined], s: new Set([shared]), m: new Map() };
      root.self = root;
      root.m.set("k", shared);
      const live = { root: { old: true } };
      const liveRef = live.root;
      const copy = decodeSnapshot(JSON.parse(JSON.stringify(encodeSnapshot({ root }))), live).root;
      let error = "";
      try {
        encodeSnapshot({ x: { f: () => 1 } });
      } catch (e) {
        error = e.message;
      }
      return {
        inPlace: copy === liveRef && !("old" in copy),
        shared: copy.a === copy.b[0] && copy.s.has(copy.a) && copy.m.get("k") === copy.a,
        cycle: copy.self === copy,
        special: [copy.b[1] === -Infinity, Number.isNaN(copy.b[2]), copy.b[3] === undefined, copy.b.length],
        error,
      };
    });
    expect(result).toEqual({
      inPlace: true,
      shared: true,
      cycle: true,
      special: [true, true, true, 4],
      error: "Valeur non sauvegardable : x.f",
    });
  });

  test("chaque boss se sauvegarde et se reprend en plein combat", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/");
    await startGame(page);
    const types = await page.evaluate(async () =>
      (await import("/src/data/enemies.js")).BOSS_RUSH.order.map((b) => b.type),
    );
    for (const type of types) {
      const result = await page.evaluate(async (type) => {
        const state = await import("/src/core/state.js");
        const spawner = await import("/src/systems/spawner.js");
        const runSave = await import("/src/services/runSave.js");
        const { world, game: g, player: p } = state;
        world.enemies.length = 0;
        world.hazards.length = 0;
        world.enemyProjectiles.length = 0;
        g.wave = 25;
        g.paused = false;
        g.running = true;
        spawner.spawnEnemy(type, p.worldX + 260, p.worldY);
        await new Promise((r) => setTimeout(r, 1200)); // le boss attaque
        const count = world.enemies.length;
        const bossHp = world.enemies.find((e) => e.isBoss)?.health;
        if (!runSave.saveRun("normal")) return { type, saved: false };
        const saved = runSave.savedRun();
        g.running = false;
        runSave.restoreRunState(saved);
        Object.assign(g, { started: true, running: true, paused: false });
        const after = { count: world.enemies.length, bossHp: world.enemies.find((e) => e.isBoss)?.health };
        await new Promise((r) => setTimeout(r, 800)); // le combat continue après la reprise
        return { type, saved: true, same: after.count === count && after.bossHp === bossHp };
      }, type);
      expect(result, type).toEqual({ type, saved: true, same: true });
    }
  });

  test("chaque événement de carte se sauvegarde et se reprend, impacts compris", async ({ page }) => {
    await page.goto("/");
    await startGame(page, { invincible: true });
    const types = await page.evaluate(async () => (await import("/src/systems/mapEvents.js")).EVENT_TYPES);
    for (const type of types) {
      const result = await page.evaluate(async (type) => {
        const state = await import("/src/core/state.js");
        const mapEvents = await import("/src/systems/mapEvents.js");
        const hazards = await import("/src/systems/hazards.js");
        const runSave = await import("/src/services/runSave.js");
        const { world, game: g } = state;
        world.hazards.length = 0;
        g.wave = 5;
        mapEvents.startMapEvent(type);
        g.mapEvent.warn = 0;
        for (let i = 0; i < 200; i++) mapEvents.updateMapEvents(); // l'événement lance ses impacts
        const pending = world.hazards.filter((h) => h.delay > 0).length;
        if (!runSave.saveRun("normal")) return { type, saved: false };
        runSave.restoreRunState(runSave.savedRun());
        const restored = world.hazards.filter((h) => h.delay > 0).length;
        const gems = world.gems.length;
        for (let i = 0; i < 200; i++) hazards.updateHazards(); // les impacts tombent après la reprise
        return {
          type,
          saved: true,
          same: g.mapEvent?.type === type && restored === pending,
          starsDropGems: type !== "stars" || world.gems.length > gems,
        };
      }, type);
      expect(result, type).toEqual({ type, saved: true, same: true, starsDropGems: true });
    }
  });

  test("partie sauvegardée avant une mise à jour : les nouveaux champs prennent leur valeur de départ", async ({
    page,
  }) => {
    await page.goto("/");
    await startGame(page);
    const result = await page.evaluate(async () => {
      const state = await import("/src/core/state.js");
      const runSave = await import("/src/services/runSave.js");
      runSave.saveRun("normal");
      const saved = runSave.savedRun();
      // Champ absent de l'ancienne sauvegarde (ajouté par une mise à jour)
      const player = saved.state.table[saved.state.roots.indexOf("player")][1];
      delete player.projScale;
      delete player.buffs;
      runSave.restoreRunState(saved);
      return { projScale: state.player.projScale, buffs: typeof state.player.buffs?.stun };
    });
    expect(result).toEqual({ projScale: 1, buffs: "number" });
  });

  test("duel : jamais sauvegardé", async ({ page }) => {
    await page.goto("/");
    await page.locator("#btnVersus").click();
    await page.locator("#btnDuelLocal").click();
    await page.waitForTimeout(500);
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.keyboard.press("Escape");
    await expect(page.locator("#pauseMenu")).toBeVisible();
    await expect(page.locator("#btnAbandon")).toBeHidden();
    await page.locator("#btnQuit").click();
    await expect(page.locator("#mainMenu")).toBeVisible();
    await expect(page.locator("#btnResumeRun")).toBeHidden();
    expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBeNull();
  });
});
