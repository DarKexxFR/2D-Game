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

test("calendrier des boss : Titan à la 7, Sentinelle à la 9, Colosse à la 10, Kraken à la 11, Jumeaux à la 13", async ({
  page,
}) => {
  await page.goto("/");
  await startGame(page);
  const bosses = await game(page, ({ state, spawner }) => {
    const out = {};
    for (const wave of [5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18]) {
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
    11: "kraken",
    12: "hydra",
    13: "twin_fire",
    14: "storm_titan",
    15: "void_reaper",
    18: "prism",
  });
  await killPlayer(page);
});

for (const type of [
  "miniboss",
  "boss",
  "colossus",
  "void_reaper",
  "hydra",
  "storm_titan",
  "prism",
  "kraken",
  "twin_fire",
]) {
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
    if (["boss", "colossus", "void_reaper", "storm_titan", "prism", "slime_boss"].includes(type)) {
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

test("à l'arrivée d'un boss, les petits ennemis disparaissent et n'apparaissent plus tant qu'il vit", async ({
  page,
}) => {
  await page.goto("/");
  await startGame(page, { invincible: true });
  const before = await game(page, ({ state, spawner }) => {
    state.world.enemies.length = 0;
    for (let i = 0; i < 6; i++) spawner.spawnEnemy("normal");
    state.game.pendingBosses.push({ type: "storm_titan", delay: 1 });
    return state.world.enemies.length;
  });
  expect(before).toBe(6);
  // Le boss arrive : il reste seul, et le spawner n'ajoute plus rien pendant un moment
  await page.waitForTimeout(1500);
  const during = await game(page, ({ state, spawner }) => ({
    types: [...new Set(state.world.enemies.filter((e) => !e.dead).map((e) => e.type))],
    fight: spawner.bossFight(),
  }));
  expect(during).toEqual({ types: ["storm_titan"], fight: true });
  // Boss vaincu : les ennemis reviennent
  await game(page, ({ state }) => (state.world.enemies.length = 0));
  await expect
    .poll(() => game(page, ({ state }) => state.world.enemies.filter((e) => e.type !== "storm_titan").length))
    .toBeGreaterThan(0);
  await killPlayer(page);
});

test("le Crabe blindé, lui, laisse les petits ennemis", async ({ page }) => {
  await page.goto("/");
  await startGame(page, { invincible: true });
  const types = await game(page, ({ state, spawner }) => {
    state.world.enemies.length = 0;
    for (let i = 0; i < 3; i++) spawner.spawnEnemy("normal");
    state.game.pendingBosses.push({ type: "miniboss", delay: 1 });
    return spawner.bossFight();
  });
  expect(types).toBe(false);
  await page.waitForTimeout(500);
  expect(
    await game(page, ({ state }) => state.world.enemies.filter((e) => !e.dead && e.type === "normal").length),
  ).toBeGreaterThanOrEqual(3);
  await killPlayer(page);
});

test("Kraken : ses tentacules restent dans l'arène, même quand ses murs se referment encore", async ({
  page,
}) => {
  await page.goto("/");
  await startGame(page, { invincible: true });
  await game(page, ({ state, spawner, arena }) => {
    Object.assign(state.game, { spawnTimer: 1e9, eventTimer: 1e9 });
    state.world.enemies.length = 0;
    // Près du bord gauche : l'arène est collée à gauche et son mur droit a un long chemin à faire
    state.player.worldX = -1500;
    state.player.worldY = 0;
    state.game.pendingBosses.push({ type: "kraken", delay: 1e9 });
    arena.updateArena();
    // Le joueur est encore loin, du côté où le mur avance, quand le Kraken plonge
    state.player.worldX = state.game.arena.maxX + 250;
    spawner.spawnEnemy("kraken", state.game.arena.maxX - 300, 0);
  });
  await expect
    .poll(() =>
      game(page, ({ state }) => state.world.enemies.filter((e) => e.type === "kraken_tentacle").length),
    )
    .toBe(4);
  // Murs arrivés : aucune tentacule n'est restée dehors
  await expect
    .poll(() => game(page, ({ state }) => state.game.bounds.maxX === state.game.arena.maxX))
    .toBe(true);
  const out = await game(page, ({ state }) => {
    const a = state.game.arena;
    return state.world.enemies
      .filter((e) => e.type === "kraken_tentacle")
      .filter((e) => e.x < a.minX || e.x > a.maxX || e.y < a.minY || e.y > a.maxY).length;
  });
  expect(out).toBe(0);
  await killPlayer(page);
});

test("Kraken : invulnérable sous l'eau tant que ses tentacules tiennent, puis la tête remonte", async ({
  page,
}) => {
  await page.goto("/");
  await startGame(page);
  await spawnAlone(page, "kraken");
  // Il plonge et fait jaillir ses tentacules autour du joueur
  await expect
    .poll(() =>
      game(page, ({ state }) => state.world.enemies.filter((e) => e.type === "kraken_tentacle").length),
    )
    .toBe(4);
  const submerged = await game(page, ({ state, combat }) => {
    const k = state.world.enemies.find((e) => e.type === "kraken");
    const hp = k.health;
    combat.damageEnemy(k, 500);
    combat.rebuildEnemyGrid();
    return {
      submerged: k.submerged,
      unhurt: k.health === hp,
      targeted: combat.getNearestEnemy(k.x, k.y, 1)?.type ?? null,
    };
  });
  expect(submerged).toEqual({ submerged: true, unhurt: true, targeted: null });
  await expect(page.locator("#bossBarName")).toContainText("SOUS L'EAU");
  // Toutes les tentacules détruites : la tête remonte et prend des dégâts
  await game(page, ({ state, combat }) => {
    for (const e of state.world.enemies) if (e.type === "kraken_tentacle") combat.killEnemy(e);
  });
  await expect
    .poll(() => game(page, ({ state }) => state.world.enemies.find((e) => e.type === "kraken").submerged))
    .toBe(false);
  const exposed = await game(page, ({ state, combat }) => {
    const k = state.world.enemies.find((e) => e.type === "kraken");
    const hp = k.health;
    combat.damageEnemy(k, 100);
    return hp - k.health;
  });
  expect(exposed).toBe(100);
  // Plus de tête exposée : il replonge avec de nouvelles tentacules
  await game(page, ({ state }) => (state.world.enemies.find((e) => e.type === "kraken").exposedFor = 1));
  await expect
    .poll(() =>
      game(
        page,
        ({ state }) => state.world.enemies.filter((e) => e.type === "kraken_tentacle" && !e.dead).length,
      ),
    )
    .toBe(4);
  // Le Kraken vaincu : ses tentacules retombent
  await game(page, ({ state, combat }) => {
    const k = state.world.enemies.find((e) => e.type === "kraken");
    k.submerged = false;
    combat.killEnemy(k);
  });
  await expect
    .poll(() =>
      game(page, ({ state }) => state.world.enemies.filter((e) => e.type === "kraken_tentacle").length),
    )
    .toBe(0);
  await killPlayer(page);
});

test("Kraken : le tourbillon attire le joueur vers la tête, sauf pendant le dash", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await spawnAlone(page, "kraken", 400);
  const pulled = await game(page, ({ state, enemies }) => {
    const k = state.world.enemies[0];
    state.game.running = false; // le test fait avancer la logique lui-même
    k.tentacles = [{ dead: false }]; // déjà sous l'eau
    k.submerged = true;
    k.emergeIn = 0;
    k.whirlTimer = 1;
    const p = state.player;
    const moved = () => {
      const [x, y] = [p.worldX, p.worldY];
      for (let i = 0; i < 30; i++) enemies.updateEnemies();
      return Math.hypot(p.worldX - x, p.worldY - y);
    };
    const pulled = moved();
    p.isDashing = true;
    const dashing = moved();
    p.isDashing = false;
    state.game.running = true;
    return { pulled, dashing };
  });
  expect(pulled.pulled).toBeGreaterThan(30);
  expect(pulled.dashing).toBe(0);
  await killPlayer(page);
});

test("Jumeaux : reliés par un lien qui blesse, le survivant se venge, un seul coffre", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await spawnAlone(page, "twin_fire");
  await expect.poll(() => game(page, ({ state }) => state.world.enemies.length)).toBe(2);
  // Le lien blesse le joueur qui le traverse
  const hurt = await game(page, ({ state, enemies }) => {
    state.game.running = false;
    const [a, b] = state.world.enemies;
    const p = state.player;
    a.pair.theta = 0;
    a.pair.hit = -1e9;
    // Le joueur se place au milieu du lien
    p.worldX = (a.x + b.x) / 2;
    p.worldY = (a.y + b.y) / 2;
    const before = p.health;
    enemies.updateEnemies();
    state.game.running = true;
    return before - p.health;
  });
  expect(hurt).toBeGreaterThan(0);
  // Le premier jumeau tombe : pas de coffre, l'autre se venge (soin + furie)
  const revenge = await game(page, ({ state, combat }) => {
    const [fire, ice] = state.world.enemies;
    ice.health = ice.maxHealth * 0.4;
    combat.killEnemy(fire);
    return { chests: state.world.bossChests.length };
  });
  expect(revenge.chests).toBe(0);
  await expect
    .poll(() => game(page, ({ state }) => state.world.enemies.find((e) => e.type === "twin_ice")?.revenge))
    .toBe(true);
  const after = await game(page, ({ state }) => {
    const ice = state.world.enemies.find((e) => e.type === "twin_ice");
    return { health: ice.health / ice.maxHealth, enraged: ice.enraged };
  });
  expect(after.enraged).toBe(true);
  expect(after.health).toBeCloseTo(0.75, 1);
  await expect(page.locator("#bossBarName")).toContainText("FURIE");
  // Le second tombe vite : coffre, bonus SYNCHRO et succès
  const end = await game(page, ({ state, combat, storage }) => {
    const gold = state.game.runGold;
    combat.killEnemy(state.world.enemies.find((e) => e.type === "twin_ice"));
    return {
      chests: state.world.bossChests.length,
      bonus: state.game.runGold - gold,
      stat: storage.account.achievementStats.twinsDefeated,
    };
  });
  expect(end.chests).toBe(1);
  expect(end.bonus).toBeGreaterThanOrEqual(150);
  expect(end.stat).toBe(1);
  await killPlayer(page);
});

test("Jumeaux : les ciseaux font passer le lien de l'autre côté du joueur", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await spawnAlone(page, "twin_fire");
  await expect.poll(() => game(page, ({ state }) => state.world.enemies.length)).toBe(2);
  // Côté du joueur par rapport au lien (signe du produit vectoriel)
  const side = () =>
    game(page, ({ state }) => {
      const [a, b] = state.world.enemies;
      const p = state.player;
      return Math.sign((b.x - a.x) * (p.worldY - a.y) - (b.y - a.y) * (p.worldX - a.x));
    });
  await game(page, ({ state }) => {
    const fire = state.world.enemies.find((e) => e.type === "twin_fire");
    fire.turn = 2; // prochaine attaque : ciseaux
    fire.attackTimer = 1;
    state.player.isDashing = true; // le test regarde le lien, pas les dégâts
  });
  await page.waitForTimeout(800);
  const before = await side();
  await expect
    .poll(() => game(page, ({ state }) => state.world.enemies[0].pair.scissors), { timeout: 5000 })
    .toBeGreaterThan(0);
  await expect.poll(() => game(page, ({ state }) => state.world.enemies[0].pair.scissors)).toBe(0);
  await page.waitForTimeout(500);
  expect(await side()).toBe(-before);
  await game(page, ({ state }) => (state.player.isDashing = false));
  await killPlayer(page);
});

test("Jumeaux : Éclipse, Lien vital, furie commune et nouvelles attaques", async ({ page }) => {
  await page.goto("/");
  await startGame(page, { invincible: true });
  await spawnAlone(page, "twin_fire");
  await expect.poll(() => game(page, ({ state }) => state.world.enemies.length)).toBe(2);
  const r = await game(page, ({ state, enemies }) => {
    state.game.running = false;
    const [fire, ice] = state.world.enemies;
    const pair = fire.pair;
    const hz = state.world.hazards;
    // Éclipse : lasers tournants des deux jumeaux, en sens contraires, et le duo s'arrête
    hz.length = 0;
    fire.attackTimer = ice.attackTimer = 1e9;
    pair.eclipse = 1;
    enemies.updateEnemies();
    const spins = hz.filter((h) => h.kind === "beam").map((h) => Math.sign(h.spin));
    const at = { x: fire.x, y: fire.y };
    for (let i = 0; i < 20; i++) enemies.updateEnemies();
    const held = fire.x === at.x && fire.y === at.y && pair.hold > 0;
    // Lien vital : le jumeau le plus abîmé est soigné
    ice.health = ice.maxHealth * 0.5;
    pair.vital = 1;
    enemies.updateEnemies();
    const healed = ice.health / ice.maxHealth;
    // Furie commune sous 50 % de vie à eux deux
    fire.health = fire.maxHealth * 0.3;
    ice.health = ice.maxHealth * 0.3;
    enemies.updateEnemies();
    const fury = { pair: pair.fury, fire: fire.enraged, ice: ice.enraged };
    // Prison de glace : un cercle de zones autour du joueur avec une sortie, puis le centre
    hz.length = 0;
    pair.hold = 0;
    pair.eclipse = 1e9;
    ice.turn = 0; // prochaine attaque : prison
    ice.attackTimer = 1;
    enemies.updateEnemies();
    const prison = hz.filter((h) => h.kind === "circle").length;
    // Mur de feu et nova du jumeau de feu
    hz.length = 0;
    fire.turn = 0; // prochaine attaque : mur de feu
    fire.attackTimer = 1;
    enemies.updateEnemies();
    const wall = hz.filter((h) => h.kind === "circle" && h.pool > 0).length;
    hz.length = 0;
    fire.turn = 3; // prochaine attaque : nova
    fire.attackTimer = 1;
    enemies.updateEnemies();
    const rings = hz.filter((h) => h.kind === "ring").length;
    state.game.running = true;
    return { spins, held, healed, fury, prison, wall, rings };
  });
  expect(r.spins.filter((s) => s > 0).length).toBe(2);
  expect(r.spins.filter((s) => s < 0).length).toBe(2);
  expect(r.held).toBe(true);
  expect(r.healed).toBeCloseTo(0.56, 2);
  expect(r.fury).toEqual({ pair: true, fire: true, ice: true });
  expect(r.prison).toBe(9); // 10 cases moins 2 pour la sortie, plus le centre
  expect(r.wall).toBe(7);
  expect(r.rings).toBe(2); // furie : deux ondes
  await expect(page.locator("#bossBarName")).toContainText("FURIE");
});

test("boss renforcés : plus de PV, de dégâts et de taille, et encore plus de PV aux vagues tardives", async ({
  page,
}) => {
  await page.goto("/");
  await startGame(page);
  const p = await game(page, ({ spawner }) => ({
    eye5: spawner.bossPower("boss", 5),
    reaper15: spawner.bossPower("void_reaper", 15),
    crab: spawner.bossPower("miniboss", 2),
    mob: spawner.bossPower("normal", 15),
  }));
  expect(p.eye5.health).toBeCloseTo(1.6);
  expect(p.reaper15.health).toBeCloseTo(2.4);
  expect(p.eye5.size).toBeGreaterThan(1);
  expect(p.eye5.damage).toBeGreaterThan(1);
  expect(p.crab.health).toBeLessThan(p.eye5.health);
  expect(p.mob).toEqual({ health: 1, damage: 1, size: 1 });
  await spawnAlone(page, "boss");
  const eye = await game(page, ({ state }) => {
    const e = state.world.enemies[0];
    return { size: e.size, base: e.template.size };
  });
  expect(eye.size).toBeCloseTo(eye.base * 1.3);
  await killPlayer(page);
});

test("Roi Slime : saut annoncé, pluie de slime, absorption de ses petits, mitose en furie", async ({
  page,
}) => {
  await page.goto("/");
  await startGame(page);
  await spawnAlone(page, "slime_boss");
  // Saut : zone d'atterrissage sous le joueur, puis petits slimes à l'arrivée
  await game(page, ({ state }) => (state.world.enemies[0].attackTimer = 1));
  await expect
    .poll(() => game(page, ({ state }) => state.world.enemies.filter((e) => e.type === "slime_small").length))
    .toBeGreaterThanOrEqual(3);
  // Pluie de slime : flaques qui ralentissent
  await game(page, ({ state }) => {
    const k = state.world.enemies.find((e) => e.type === "slime_boss");
    k.turn = 0; // prochaine attaque : pluie
    k.attackTimer = 1;
  });
  await expect
    .poll(() => game(page, ({ state }) => state.world.hazards.filter((h) => h.pool > 0 && h.slow > 0).length))
    .toBeGreaterThan(0);
  // Absorption : les petits slimes disparaissent et le roi reprend de la vie
  const absorbed = await game(page, ({ state, enemies, combat }) => {
    state.game.running = false;
    const k = state.world.enemies.find((e) => e.type === "slime_boss");
    k.jump = null;
    k.health = k.maxHealth * 0.6;
    for (const s of state.world.enemies) {
      if (s.type === "slime_small") Object.assign(s, { x: k.x + 50, y: k.y, dead: false });
    }
    const before = k.health;
    const slimes = state.world.enemies.filter((e) => e.type === "slime_small").length;
    k.turn = 2; // prochaine attaque : absorption
    k.attackTimer = 1;
    combat.rebuildEnemyGrid();
    enemies.updateEnemies();
    state.game.running = true;
    return {
      healed: k.health - before > 0,
      left: state.world.enemies.filter((e) => e.type === "slime_small").length,
      slimes,
    };
  });
  expect(absorbed.slimes).toBeGreaterThan(0);
  expect(absorbed).toMatchObject({ healed: true, left: 0 });
  // Furie : mitose (deux gros slimes)
  await game(page, ({ state }) => {
    const k = state.world.enemies.find((e) => e.type === "slime_boss");
    k.health = k.maxHealth * 0.4;
  });
  await expect
    .poll(() => game(page, ({ state }) => state.world.enemies.filter((e) => e.type === "slime_big").length))
    .toBe(2);
  await killPlayer(page);
});
