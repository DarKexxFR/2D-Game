import { test, expect, game, startGame, killPlayer } from "./fixtures.js";

test.beforeEach(async ({ isMobile }) => test.skip(isMobile, "logique de jeu : une seule plateforme suffit"));

/** Partie sans petits ennemis, à la vague voulue, sans événement automatique. */
async function quietRun(page, wave = 4) {
  await page.goto("/");
  await startGame(page);
  await game(
    page,
    async ({ state }, wave) => {
      const { WAVE_SCALING } = await import("/src/data/enemies.js");
      WAVE_SCALING.baseMobs = -1e6; // plus de petits ennemis
      Object.assign(state.game, { wave, spawnTimer: 1e9, eventTimer: 1e9, waveTimer: -1e9 });
      state.world.enemies.length = 0;
      state.player.lastAttack = state.player.lastKunaiAttack = 1e15; // pas de tir (recul des ennemis)
    },
    wave,
  );
}

/** Lance un événement sans attendre l'annonce. */
async function startEvent(page, type) {
  await game(
    page,
    ({ mapEvents, state }, type) => {
      mapEvents.startMapEvent(type);
      state.game.mapEvent.warn = 0;
    },
    type,
  );
}

test("un événement arrive tout seul à partir de la vague 3, avec un bandeau d'annonce", async ({ page }) => {
  await quietRun(page, 2);
  await game(page, ({ state }) => (state.game.eventTimer = 1));
  await page.waitForTimeout(300);
  expect(await game(page, ({ state }) => state.game.mapEvent)).toBeNull(); // vague 2 : trop tôt
  await game(page, ({ state }) => (state.game.wave = 3));
  await expect.poll(() => game(page, ({ state }) => state.game.mapEvent?.type)).toBeTruthy();
  const name = await game(page, ({ state, config }) => config.MAP_EVENTS[state.game.mapEvent.type].name);
  await expect(page.locator("#bossWarning")).toHaveText(name);
  // Fin de l'événement : le suivant est reprogrammé
  await game(page, ({ state, config }) => {
    state.game.mapEvent.warn = 0;
    state.game.mapEvent.tick = config.MAP_EVENTS[state.game.mapEvent.type].duration;
  });
  await expect.poll(() => game(page, ({ state }) => state.game.mapEvent)).toBeNull();
  expect(await game(page, ({ state }) => state.game.eventTimer)).toBeGreaterThan(1000);
  await killPlayer(page);
});

test("pluie d'astéroïdes : impacts annoncés qui blessent le joueur et les ennemis dessous", async ({
  page,
}) => {
  await quietRun(page);
  await startEvent(page, "asteroids");
  await expect.poll(() => game(page, ({ state }) => state.world.hazards.length)).toBeGreaterThan(0);
  // Un ennemi et le joueur sous le premier astéroïde, encore en l'air
  const hp = await game(page, ({ state, spawner }) => {
    const h = state.world.hazards[0];
    h.delay = h.total = 20;
    spawner.spawnEnemy("tank", h.x, h.y);
    state.world.enemies[0].damage = 0; // seul l'astéroïde blesse le joueur
    state.player.worldX = h.x;
    state.player.worldY = h.y;
    return { fall: h.fall, enemy: state.world.enemies[0].health, player: state.player.health };
  });
  expect(hp.fall).toBe("rock");
  await page.waitForTimeout(600);
  const after = await game(page, ({ state }) => ({
    enemy: state.world.enemies[0]?.health ?? 0, // tué et retiré : 0
    player: state.player.health,
  }));
  expect(after.enemy).toBeLessThan(hp.enemy);
  expect(after.player).toBeLessThan(hp.player);
  await killPlayer(page);
});

test("pluie acide : les flaques ralentissent le joueur", async ({ page }) => {
  await quietRun(page);
  await startEvent(page, "acid");
  await expect.poll(() => game(page, ({ state }) => state.world.hazards.length)).toBeGreaterThan(0);
  await game(page, ({ state }) => {
    state.game.mapEvent = null; // une seule flaque suffit
    const h = state.world.hazards[0];
    state.world.hazards.length = 1;
    h.delay = 1;
    state.player.worldX = h.x;
    state.player.worldY = h.y;
  });
  await expect.poll(() => game(page, ({ state }) => state.player.buffs.slow)).toBeGreaterThan(0);
  expect(await game(page, ({ state }) => state.world.hazards[0]?.pool)).toBeGreaterThan(0);
  await killPlayer(page);
});

test("trou noir : aspire les ennemis vers son centre et les broie", async ({ page }) => {
  await quietRun(page);
  await startEvent(page, "vortex");
  const start = await game(page, ({ state, spawner }) => {
    const ev = state.game.mapEvent;
    spawner.spawnEnemy("tank", ev.x + 200, ev.y);
    const e = state.world.enemies[0];
    e.speed = e.baseSpeed = 0; // reste sur place sans l'aspiration
    return { d: 200, hp: e.health };
  });
  await expect
    .poll(() =>
      game(page, ({ state }) => {
        const ev = state.game.mapEvent;
        const e = state.world.enemies[0];
        return !e || e.dead ? 0 : Math.hypot(e.x - ev.x, e.y - ev.y); // broyé : 0
      }),
    )
    .toBeLessThan(80);
  await expect
    .poll(() => game(page, ({ state }) => state.world.enemies[0]?.health ?? 0))
    .toBeLessThan(start.hp);
  await killPlayer(page);
});

test("pluie d'étoiles : chaque étoile lâche de l'XP, sans blesser", async ({ page }) => {
  await quietRun(page);
  const before = await game(page, ({ state }) => {
    state.world.gems.length = 0;
    state.player.xp = 0;
    return state.player.health;
  });
  await startEvent(page, "stars");
  await expect.poll(() => game(page, ({ state }) => state.world.hazards.length)).toBeGreaterThan(0);
  await game(page, ({ state }) => {
    const h = state.world.hazards[0];
    h.delay = 2;
    state.player.worldX = h.x;
    state.player.worldY = h.y;
  });
  // La gemme tombe sous le joueur, qui la ramasse aussitôt
  await expect
    .poll(() => game(page, ({ state }) => state.world.gems.length + state.player.xp))
    .toBeGreaterThan(0);
  expect(await game(page, ({ state }) => state.player.health)).toBe(before);
  await killPlayer(page);
});

test("pas d'événement pendant un combat de boss (celui en cours s'arrête)", async ({ page }) => {
  await quietRun(page, 5);
  await startEvent(page, "asteroids");
  await game(page, ({ state }) => {
    state.game.pendingBosses.push({ type: "storm_titan", delay: 1e9 });
    state.game.eventTimer = 1;
  });
  await page.waitForTimeout(400);
  expect(await game(page, ({ state }) => state.game.mapEvent)).toBeNull();
  await killPlayer(page);
});

test("combat de boss : l'arène se resserre autour du joueur, puis se rouvre", async ({ page }) => {
  await quietRun(page, 5);
  await game(page, ({ state }) => {
    state.player.worldX = 200;
    state.player.worldY = -100;
    state.game.pendingBosses.push({ type: "storm_titan", delay: 1e9 });
  });
  const size = await game(page, ({ config }) => config.BOSS_ZONE.size);
  await expect
    .poll(() => game(page, ({ state }) => state.game.bounds.maxX - state.game.bounds.minX))
    .toBe(size);
  const arena = await game(page, ({ state }) => state.game.bounds);
  expect(arena.minX).toBe(200 - size / 2);
  expect(arena.minY).toBe(-100 - size / 2);
  // Le joueur ne peut pas sortir de l'arène
  await game(page, ({ state }) => (state.player.worldX = 1400));
  await expect.poll(() => game(page, ({ state }) => state.player.worldX)).toBeLessThanOrEqual(arena.maxX);
  // Boss vaincu : la carte entière revient
  await game(page, ({ state }) => (state.game.pendingBosses.length = 0));
  await expect
    .poll(() => game(page, ({ state, config }) => state.game.bounds.maxX === config.MAP_BOUNDS.maxX))
    .toBe(true);
  await killPlayer(page);
});

test("l'arène reste dans la carte quand le boss arrive près d'un bord", async ({ page }) => {
  await quietRun(page, 5);
  await game(page, ({ state }) => {
    state.player.worldX = 1400;
    state.game.pendingBosses.push({ type: "storm_titan", delay: 1e9 });
  });
  await expect.poll(() => game(page, ({ state }) => state.game.arena?.maxX)).toBe(1500);
  await killPlayer(page);
});
