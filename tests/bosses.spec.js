// Boss (attaques annoncées, furie, barre de vie), coffre de boss et Voleur doré.
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

test.beforeEach(async ({ isMobile }) => test.skip(isMobile, "logique de jeu : une seule plateforme suffit"));

/** Vide l'arène et fait apparaître un ennemi à côté du joueur ; renvoie rien (lire via game()). */
async function spawnAlone(page, type, dx = 300) {
  await game(
    page,
    ({ state, spawner }, { type, dx }) => {
      state.game.spawnTimer = 1e9;
      state.world.enemies.length = 0;
      spawner.spawnEnemy(type, state.player.worldX + dx, state.player.worldY);
    },
    { type, dx },
  );
}

test("calendrier des boss : Titan à la vague 7, Sentinelle à la 9, Colosse à la 10, Faucheur à la 15", async ({
  page,
}) => {
  await page.goto("/");
  await startGame(page);
  const bosses = await game(page, ({ state, spawner }) => {
    const out = {};
    for (const wave of [5, 7, 8, 9, 10, 12, 14, 15, 18]) {
      state.game.pendingBosses.length = 0;
      state.game.wave = wave - 1;
      spawner.startNextWave();
      out[wave] = state.game.pendingBosses[0]?.type;
    }
    return out;
  });
  expect(bosses).toEqual({
    5: "boss",
    7: "storm_titan",
    8: "slime_boss",
    9: "prism",
    10: "colossus",
    12: "hydra",
    14: "storm_titan",
    15: "void_reaper",
    18: "prism",
  });
  await killPlayer(page);
});

for (const type of ["miniboss", "boss", "colossus", "void_reaper", "hydra", "storm_titan", "prism"]) {
  test(`le boss ${type} enchaîne ses attaques et passe en furie`, async ({ page }) => {
    await page.goto("/");
    await startGame(page);
    await spawnAlone(page, type);
    // Plusieurs attaques : zones annoncées et/ou projectiles
    await expect
      .poll(
        () =>
          game(page, ({ state }) => {
            const e = state.world.enemies.find((x) => x.template.isBoss);
            if (e) e.attackTimer = Math.min(e.attackTimer, 5); // accélère le cycle
            if (e) e.skillTimer = Math.min(e.skillTimer, 5);
            return state.world.hazards.length + state.world.enemyProjectiles.length;
          }),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);
    // Barre de vie du boss en haut de l'écran
    await expect(page.locator("#bossBar")).toBeVisible();
    // Sous 50 % de vie : furie (sauf le crabe et l'hydre, qui ont leur propre réaction)
    await game(page, ({ state }) => {
      const e = state.world.enemies.find((x) => x.template.isBoss);
      e.health = e.maxHealth * 0.4;
    });
    if (["boss", "colossus", "void_reaper", "storm_titan", "prism"].includes(type)) {
      await expect.poll(() => game(page, ({ state }) => state.world.enemies[0].enraged)).toBe(true);
      await expect(page.locator("#bossBarName")).toContainText("FURIE");
    }
    await page.waitForTimeout(1500); // les attaques se déroulent sans erreur
    await killPlayer(page);
  });
}

test("les attaques de zone blessent, sauf pendant le dash ou sous bouclier", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  const hits = await page.evaluate(async () => {
    const s = await import("/src/core/state.js");
    const h = await import("/src/systems/hazards.js");
    s.game.spawnTimer = 1e9;
    s.world.enemies.length = 0;
    const p = s.player;
    const before = p.health;
    h.addCircle(p.worldX, p.worldY, 80, 50, { delay: 1 });
    h.updateHazards();
    const hurt = before - p.health;
    p.buffs.shield = 100;
    const shielded = p.health;
    h.addBeam(p.worldX - 100, p.worldY, 0, 50, { delay: 1 });
    for (let i = 0; i < 5; i++) h.updateHazards();
    return { hurt, shieldedLoss: shielded - p.health };
  });
  expect(hits).toEqual({ hurt: 50, shieldedLoss: 0 });
  await killPlayer(page);
});

test("les éclairs du Titan étourdissent : ni déplacement ni dash, puis courte insensibilité", async ({
  page,
}) => {
  await page.goto("/");
  await startGame(page);
  const r = await page.evaluate(async () => {
    const s = await import("/src/core/state.js");
    const h = await import("/src/systems/hazards.js");
    const p = s.player;
    s.game.spawnTimer = 1e9;
    s.world.enemies.length = 0;
    s.game.running = false; // le test fait avancer la logique lui-même
    h.addCircle(p.worldX, p.worldY, 80, 10, { delay: 1, stun: 50 });
    h.updateHazards();
    return { stun: p.buffs.stun };
  });
  expect(r.stun).toBe(50);
  // Étourdi : les touches de déplacement et de dash n'ont aucun effet
  const moved = await game(page, ({ state, player, input }) => {
    const p = state.player;
    const x = p.worldX;
    input.setVirtualAction("right", true);
    input.setVirtualAction("dash", true);
    p.dashCooldownTimer = 0;
    for (let i = 0; i < 10; i++) player.updatePlayer();
    input.setVirtualAction("right", false);
    input.setVirtualAction("dash", false);
    return { dx: p.worldX - x, dashing: p.isDashing, stunned: player.isStunned() };
  });
  expect(moved).toEqual({ dx: 0, dashing: false, stunned: true });
  // À la fin de l'étourdissement, un nouvel éclair ne l'étourdit pas tout de suite
  const after = await page.evaluate(async () => {
    const s = await import("/src/core/state.js");
    const pl = await import("/src/systems/player.js");
    const h = await import("/src/systems/hazards.js");
    const p = s.player;
    for (let i = 0; i < 60; i++) pl.updatePlayer();
    const free = !pl.isStunned();
    h.addCircle(p.worldX, p.worldY, 80, 10, { delay: 1, stun: 50 });
    h.updateHazards();
    // Le bouclier protège aussi de l'étourdissement
    p.buffs.stunImmune = 0;
    p.buffs.shield = 100;
    h.addCircle(p.worldX, p.worldY, 80, 10, { delay: 1, stun: 50 });
    h.updateHazards();
    return { free, restunned: p.buffs.stun > 0 };
  });
  expect(after).toEqual({ free: true, restunned: false });
  await game(page, ({ state }) => (state.game.running = true));
  await killPlayer(page);
});

test("un boss vaincu lâche un coffre : augmentation au choix et or bonus", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await spawnAlone(page, "boss", 200);
  await page.evaluate(async () => {
    const s = await import("/src/core/state.js");
    const c = await import("/src/systems/combat.js");
    c.killEnemy(s.world.enemies[0]);
  });
  expect(await game(page, ({ state }) => state.world.bossChests.length)).toBe(1);
  const gold = await game(page, ({ state }) => state.game.runGold);
  // Le joueur marche sur le coffre
  await game(page, ({ state }) => {
    state.player.worldX = state.world.bossChests[0].x;
    state.player.worldY = state.world.bossChests[0].y;
  });
  await expect(page.locator("#upgradeMenu")).toBeVisible();
  await expect(page.locator("#upgradeTitle")).toHaveText("COFFRE DE BOSS");
  await expect(page.locator("#upgradeMenu")).toHaveClass(/boss-chest/);
  await expect(page.locator(".upgrade-option.rarity-common")).toHaveCount(0);
  expect(await game(page, ({ state }) => state.game.runGold)).toBeGreaterThan(gold);
  await page.locator(".upgrade-option").first().click();
  await expect(page.locator("#upgradeMenu")).toBeHidden();
  const after = await game(page, ({ state, storage }) => ({
    running: state.game.running,
    upgrades: Object.keys(state.player.inventory).length,
    chests: storage.account.achievementStats.bossChests,
  }));
  expect(after).toEqual({ running: true, upgrades: 1, chests: 1 });
  await killPlayer(page);
});

test("montée de niveau et coffre en même temps : les deux choix s'enchaînent", async ({ page }) => {
  await page.goto("/");
  await startGame(page, { levelUps: true });
  await page.evaluate(async () => {
    const { emit } = await import("/src/core/events.js");
    emit("levelUp");
    emit("bossChest");
  });
  await expect(page.locator("#upgradeTitle")).toHaveText("CHOISISSEZ !");
  await page.locator(".upgrade-option").first().click();
  await expect(page.locator("#upgradeTitle")).toHaveText("COFFRE DE BOSS");
  await page.locator(".upgrade-option").first().click();
  await expect(page.locator("#upgradeMenu")).toBeHidden();
  expect(await game(page, ({ state }) => state.game.running)).toBe(true);
  await killPlayer(page);
});

test("Voleur doré : annoncé, lâche de l'or quand on le touche, puis un coffre", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await game(page, ({ state, spawner }) => {
    state.game.spawnTimer = 1e9;
    state.world.enemies.length = 0;
    spawner.spawnGoblin();
  });
  await expect(page.locator("#bossWarning")).toHaveText("VOLEUR DORÉ !");
  const loot = await page.evaluate(async () => {
    const s = await import("/src/core/state.js");
    const c = await import("/src/systems/combat.js");
    const g = s.world.enemies.find((e) => e.type === "goblin");
    c.damageEnemy(g, 1);
    const afterHit = s.game.runGold;
    c.killEnemy(g);
    return { afterHit, chests: s.world.bossChests.length };
  });
  expect(loot.afterHit).toBeGreaterThan(0);
  expect(loot.chests).toBe(1);
  expect(await game(page, ({ storage }) => storage.account.achievements)).toContain("goblin");
  await killPlayer(page);
});

test("Voleur doré : s'enfuit sans récompense si on le laisse filer", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await game(page, ({ state, spawner }) => {
    state.game.spawnTimer = 1e9;
    state.world.enemies.length = 0;
    spawner.spawnGoblin();
    state.world.enemies[0].life = 2; // sur le point de partir
  });
  await expect
    .poll(() => game(page, ({ state }) => state.world.enemies.some((e) => e.type === "goblin")))
    .toBe(false);
  const s = await game(page, ({ state }) => ({
    goblinKills: state.game.stats.kills.goblin ?? 0,
    chests: state.world.bossChests.length,
  }));
  expect(s).toEqual({ goblinKills: 0, chests: 0 });
  await killPlayer(page);
});
