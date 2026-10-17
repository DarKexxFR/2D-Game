// Boss des vagues tardives (systems/bosses/) : Ver des sables, Mère-Ruche, Chronophage, Hacker et
// Cœur du Pulse. La logique avance tick par tick à la main (`game.running = false`).
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

test.beforeEach(async ({ isMobile }) => test.skip(isMobile, "logique de jeu : une seule plateforme suffit"));

/** Lance une partie, arrête la boucle et fait apparaître le boss seul, à `dx` du joueur. */
async function setup(page, type, dx = 300) {
  await page.goto("/");
  await startGame(page);
  await game(
    page,
    ({ state, spawner }, { type, dx }) => {
      state.game.running = false; // le test fait avancer la logique lui-même
      state.game.spawnTimer = 1e9;
      state.world.enemies.length = 0;
      state.world.hazards.length = 0;
      state.world.enemyProjectiles.length = 0;
      spawner.spawnEnemy(type, state.player.worldX + dx, state.player.worldY);
    },
    { type, dx },
  );
}

/** Avance la logique des ennemis et des attaques de zone de `n` ticks (dans la page). */
const STEP = `async (n) => {
  const enemies = await import("/src/systems/enemies.js");
  const hazards = await import("/src/systems/hazards.js");
  const combat = await import("/src/systems/combat.js");
  const state = await import("/src/core/state.js");
  for (let i = 0; i < n; i++) {
    state.game.time += 1000 / 60;
    combat.rebuildEnemyGrid();
    enemies.updateEnemies();
    hazards.updateHazards();
  }
}`;

async function step(page, n = 1) {
  await page.evaluate(`(${STEP})(${n})`);
}

test("Ver des sables : anneaux qui suivent la tête, plongée intouchable, éruption et sables mouvants", async ({
  page,
}) => {
  await setup(page, "sandworm");
  await step(page);
  const body = await game(page, ({ state }) => {
    const head = state.world.enemies.find((e) => e.type === "sandworm");
    return {
      segments: head.segments.length,
      linked: head.segments.every((s) => s.type === "sandworm_segment" && s.owner === head),
      bossParts: head.segments.some((s) => s.template.isBoss),
    };
  });
  expect(body).toEqual({ segments: 8, linked: true, bossParts: false });

  // Un anneau détruit arrache 7 % de la vie de la tête et raccourcit le ver
  const before = await game(page, ({ state, combat }) => {
    const head = state.world.enemies.find((e) => e.type === "sandworm");
    combat.killEnemy(head.segments[3]);
    return head.health / head.maxHealth;
  });
  await step(page);
  const after = await game(page, ({ state }) => {
    const head = state.world.enemies.find((e) => e.type === "sandworm");
    return { ratio: head.health / head.maxHealth, segments: head.segments.length };
  });
  expect(before - after.ratio).toBeCloseTo(0.07, 3);
  expect(after.segments).toBe(7);

  // Plongée : la tête et les anneaux sont intouchables
  await game(page, ({ state }) => {
    state.world.enemies.find((e) => e.type === "sandworm").surfacedFor = 1;
  });
  await step(page, 2);
  const dived = await game(page, ({ state, combat }) => {
    const head = state.world.enemies.find((e) => e.type === "sandworm");
    const hp = head.health;
    combat.damageEnemy(head, 1e6);
    return {
      submerged: head.submerged,
      all: head.segments.every((s) => s.submerged),
      hurt: hp - head.health,
    };
  });
  expect(dived).toEqual({ submerged: true, all: true, hurt: 0 });

  // Sous terre, il annonce son éruption sous le joueur, ressort et laisse des sables mouvants
  await game(page, ({ state }) => {
    state.world.enemies.find((e) => e.type === "sandworm").burrowFor = 1;
  });
  await step(page);
  const warn = await game(page, ({ state }) => {
    const p = state.player;
    return state.world.hazards.some(
      (h) => h.kind === "circle" && Math.hypot(h.x - p.worldX, h.y - p.worldY) < 5,
    );
  });
  expect(warn).toBe(true);
  await step(page, 60);
  const out = await game(page, ({ state }) => {
    const head = state.world.enemies.find((e) => e.type === "sandworm");
    return {
      submerged: head.submerged,
      sand: state.world.hazards.filter((h) => h.kind === "circle" && h.pool > 0 && h.slow > 0).length,
    };
  });
  expect(out.submerged).toBe(false);
  expect(out.sand).toBeGreaterThanOrEqual(4);

  // La tête meurt : les anneaux retombent avec elle
  await game(page, ({ state, combat }) => {
    combat.killEnemy(state.world.enemies.find((e) => e.type === "sandworm"));
  });
  await step(page, 2);
  expect(await game(page, ({ state }) => state.world.enemies.length)).toBe(0);
  await game(page, ({ state }) => (state.game.running = true));
  await killPlayer(page);
});

test("Mère-Ruche : fleurs toxiques, carapace tant qu'elles vivent, pollen à tête chercheuse", async ({
  page,
}) => {
  await setup(page, "hive_queen");
  await game(page, ({ state }) => {
    const q = state.world.enemies[0];
    q.turn = -1; // prochaine attaque : floraison
    q.attackTimer = 1;
  });
  await step(page);
  await step(page, 55); // les fleurs sortent de terre après l'alerte
  const garden = await game(page, ({ state, combat }) => {
    const q = state.world.enemies.find((e) => e.type === "hive_queen");
    const hp = q.health;
    combat.damageEnemy(q, 100);
    return { flowers: q.flowers.length, armor: q.armor, taken: hp - q.health, tag: q.barTag };
  });
  expect(garden.flowers).toBe(3);
  expect(garden.armor).toBeCloseTo(0.6, 5);
  expect(garden.taken).toBeCloseTo(40, 5);
  expect(garden.tag).toContain("CARAPACE");

  // Le poison s'étend autour d'une fleur et blesse le joueur qui s'y tient
  const poisoned = await game(page, ({ state }) => {
    const f = state.world.enemies.find((e) => e.type === "hive_flower");
    state.player.worldX = f.x + 30;
    state.player.worldY = f.y;
    return { aura: f.aura, hp: state.player.health };
  });
  await step(page, 40);
  const later = await game(page, ({ state }) => ({
    aura: state.world.enemies.find((e) => e.type === "hive_flower").aura,
    hp: state.player.health,
  }));
  expect(later.aura).toBeGreaterThan(poisoned.aura);
  expect(later.hp).toBeLessThan(poisoned.hp);

  // Fleurs fauchées : plus de carapace
  await game(page, ({ state, combat }) => {
    for (const f of state.world.enemies.filter((e) => e.type === "hive_flower")) combat.killEnemy(f);
  });
  await step(page);
  expect(await game(page, ({ state }) => state.world.enemies[0].armor)).toBe(0);

  // Pollen : tirs à tête chercheuse
  await game(page, ({ state }) => {
    const q = state.world.enemies[0];
    q.turn = 0; // prochaine attaque : pollen
    q.attackTimer = 1;
  });
  await step(page);
  expect(await game(page, ({ state }) => state.world.enemyProjectiles.filter((p) => p.homing).length)).toBe(
    6,
  );
  await game(page, ({ state }) => (state.game.running = true));
  await killPlayer(page);
});

test("Chronophage : bulles qui ralentissent les tirs, retour arrière, rembobinage et écho en furie", async ({
  page,
}) => {
  await setup(page, "chronophage", 500);
  // Bulles temporelles : un tir du joueur y avance au quart de sa vitesse
  await game(page, ({ state }) => {
    const c = state.world.enemies[0];
    c.turn = 0; // prochaine attaque : bulles
    c.attackTimer = 1;
  });
  await step(page);
  const slowed = await game(page, ({ state, combat }) => {
    const p = state.player;
    const bubbles = state.world.hazards.filter((h) => h.kind === "bubble");
    state.world.projectiles.push({ x: p.worldX, y: p.worldY, vx: 8, vy: 0, size: 4, life: 100, damage: 1 });
    combat.updateProjectiles();
    const shot = state.world.projectiles.at(-1);
    return { bubbles: bubbles.length, moved: shot.x - p.worldX };
  });
  expect(slowed).toEqual({ bubbles: 3, moved: 2 });

  // Retour arrière : le joueur est ramené là où il était 3 s plus tôt
  const start = await game(page, ({ state }) => {
    state.world.projectiles.length = 0;
    state.world.hazards.length = 0;
    state.world.enemies[0].attackTimer = 1e9; // pas d'autre attaque pendant que le joueur avance
    return { x: state.player.worldX, y: state.player.worldY };
  });
  for (let i = 0; i < 20; i++) {
    await game(page, ({ state }) => (state.player.worldX += 20));
    await step(page, 10);
  }
  await game(page, ({ state }) => {
    const c = state.world.enemies[0];
    c.turn = 1; // prochaine attaque : retour arrière
    c.attackTimer = 1;
  });
  await step(page);
  const target = await game(page, ({ state }) => state.world.enemies[0].rewindTo);
  await step(page, 45);
  const back = await game(page, ({ state }) => ({ x: state.player.worldX, y: state.player.worldY }));
  expect(Math.abs(back.x - target.x)).toBeLessThan(1);
  expect(back.x).toBeLessThan(start.x + 100); // il avait avancé de 400 px : bien en arrière

  // Rembobinage : trop peu de dégâts pendant le sablier, il en récupère la moitié
  const healed = await game(page, ({ state }) => {
    const c = state.world.enemies[0];
    c.mark = c.health;
    c.health -= c.maxHealth * 0.02;
    c.hourglass = 1;
    return c.health;
  });
  await step(page);
  const restored = await game(page, ({ state }) => state.world.enemies[0]);
  expect(restored.health - healed).toBeCloseTo(restored.maxHealth * 0.01, 3);

  // Furie : le cadran a un écho qui se rejoue au même endroit
  await game(page, ({ state }) => {
    const c = state.world.enemies[0];
    c.health = c.maxHealth * 0.4;
    state.world.hazards.length = 0;
  });
  await step(page);
  await game(page, ({ state }) => {
    const c = state.world.enemies[0];
    c.turn = -1; // prochaine attaque : cadran
    c.attackTimer = 1;
    c.hourglass = 1e9;
  });
  await step(page);
  const dial = await game(page, ({ state }) => state.world.hazards.filter((h) => h.kind === "circle").length);
  expect(dial).toBe(24); // deux couronnes en furie
  await step(page, 90);
  const echo = await game(page, ({ state }) => state.world.enemies[0].echoes.length);
  expect(echo).toBe(0);
  const rings = await game(
    page,
    ({ state }) => state.world.hazards.filter((h) => h.kind === "circle").length,
  );
  expect(rings).toBeGreaterThan(0);
  await game(page, ({ state }) => (state.game.running = true));
  await killPlayer(page);
});

test("Hacker : commandes inversées, pare-feu, brouillage du tir, clones en furie", async ({ page }) => {
  await setup(page, "hacker");
  // GLITCH : annoncé, puis les commandes s'inversent
  await game(page, ({ state }) => {
    const h = state.world.enemies[0];
    h.turn = 0; // prochaine attaque : glitch
    h.attackTimer = 1;
  });
  await step(page, 52);
  const inverted = await game(page, ({ state, player, input }) => {
    const p = state.player;
    const x = p.worldX;
    input.setVirtualAction("right", true);
    for (let i = 0; i < 5; i++) player.updatePlayer();
    input.setVirtualAction("right", false);
    return { glitch: p.buffs.glitch > 0, dx: p.worldX - x };
  });
  expect(inverted.glitch).toBe(true);
  expect(inverted.dx).toBeLessThan(0);

  // Pare-feu : quatre murs autour du joueur, puis la purge au centre
  await game(page, ({ state }) => {
    state.player.buffs.glitch = 0;
    state.world.hazards.length = 0;
    const h = state.world.enemies[0];
    h.turn = 1; // prochaine attaque : pare-feu
    h.attackTimer = 1;
  });
  await step(page);
  const walls = await game(page, ({ state }) => ({
    beams: state.world.hazards.filter((h) => h.kind === "beam").length,
    purge: state.world.hazards.filter((h) => h.kind === "circle").length,
  }));
  expect(walls).toEqual({ beams: 4, purge: 1 });

  // Brouillage : dans la zone, le joueur ne tire plus
  await game(page, ({ state }) => {
    state.world.hazards.length = 0;
    const h = state.world.enemies[0];
    h.turn = 2; // prochaine attaque : brouillage
    h.attackTimer = 1;
  });
  await step(page, 45);
  const jammed = await game(page, ({ state, combat }) => {
    const p = state.player;
    p.autoShoot = true;
    p.lastAttack = -Infinity;
    const before = state.world.projectiles.length;
    combat.shoot();
    return { jammed: p.buffs.jammed > 0, shots: state.world.projectiles.length - before };
  });
  expect(jammed).toEqual({ jammed: true, shots: 0 });

  // Furie : trois clones identiques, avec la barre de vie du vrai
  await game(page, ({ state }) => {
    state.world.hazards.length = 0;
    const h = state.world.enemies[0];
    h.health = h.maxHealth * 0.4;
  });
  await step(page);
  const clones = await game(page, ({ state }) => {
    const h = state.world.enemies.find((e) => e.type === "hacker");
    return h.clones.map((c) => ({
      size: c.size === h.size,
      color: c.color === h.color,
      mimic: c.mimic === h,
    }));
  });
  expect(clones).toEqual(Array(3).fill({ size: true, color: true, mimic: true }));

  // Tous les clones détruits : de nouveaux reviennent ; le Hacker meurt : ses clones disparaissent
  await game(page, ({ state, combat }) => {
    for (const c of state.world.enemies.filter((e) => e.type === "hacker_clone")) combat.killEnemy(c);
  });
  await step(page, 2);
  await game(page, ({ state }) => (state.world.enemies.find((e) => e.type === "hacker").respawnIn = 1));
  await step(page);
  expect(
    await game(page, ({ state }) => state.world.enemies.filter((e) => e.type === "hacker_clone").length),
  ).toBe(3);
  await game(page, ({ state, combat }) =>
    combat.killEnemy(state.world.enemies.find((e) => e.type === "hacker")),
  );
  await step(page, 2);
  expect(await game(page, ({ state }) => state.world.enemies.length)).toBe(0);
  await game(page, ({ state }) => (state.game.running = true));
  await killPlayer(page);
});

test("Cœur du Pulse : au centre, battements, phases qui resserrent l'arène, arène rouverte à sa mort", async ({
  page,
}) => {
  await setup(page, "pulse_core", 100);
  await game(page, ({ arena }) => arena.updateArena()); // le combat de boss scelle l'arène
  await step(page);
  const placed = await game(page, ({ state }) => {
    const e = state.world.enemies[0];
    return Math.hypot(e.x - state.player.worldX, e.y - state.player.worldY);
  });
  expect(placed).toBeGreaterThanOrEqual(300);

  // Premier battement : une onde de choc
  await step(page, 95);
  expect(await game(page, ({ state }) => state.world.hazards.some((h) => h.kind === "ring"))).toBe(true);

  // Phase 2 sous 66 % : battements plus rapides et arène resserrée
  const zones = await game(page, ({ state, arena }) => {
    const before = arena.combatZone();
    state.world.enemies[0].health = state.world.enemies[0].maxHealth * 0.6;
    return before.maxX - before.minX;
  });
  await step(page);
  const phase2 = await game(page, ({ state, arena }) => {
    const e = state.world.enemies[0];
    const z = arena.combatZone();
    return { phase: e.pulsePhase, scale: e.arenaScale, width: z.maxX - z.minX, tag: e.barTag };
  });
  expect(phase2.phase).toBe(1);
  expect(phase2.scale).toBe(0.8);
  expect(phase2.width).toBeCloseTo(zones * 0.8, 0);
  expect(phase2.tag).toBe("PHASE 2");

  // Phase 3 sous 33 % : furie
  await game(page, ({ state }) => (state.world.enemies[0].health = state.world.enemies[0].maxHealth * 0.3));
  await step(page);
  expect(await game(page, ({ state }) => state.world.enemies[0].enraged)).toBe(true);

  // Vaincu : l'arène se rouvre
  await game(page, ({ state, combat, arena }) => {
    combat.killEnemy(state.world.enemies[0]);
    state.world.enemies.length = 0;
    arena.updateArena();
  });
  expect(await game(page, ({ state }) => state.game.arena)).toBe(null);
  await game(page, ({ state }) => (state.game.running = true));
  await killPlayer(page);
});

test("les cinq nouveaux boss ont leur succès et sont dans le Boss Rush", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const { ACHIEVEMENTS } = await import("/src/data/achievements.js");
    const { BOSS_RUSH } = await import("/src/data/enemies.js");
    const types = ["sandworm", "hive_queen", "chronophage", "hacker", "pulse_core"];
    return types.map((t) => ({
      achievement: ACHIEVEMENTS.some((a) => a.metric === `kill_${t}`),
      rush: BOSS_RUSH.order.some((o) => o.type === t),
    }));
  });
  expect(r).toEqual(Array(5).fill({ achievement: true, rush: true }));
});
