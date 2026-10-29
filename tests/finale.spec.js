// Fin de l'aventure (vagues 31 à 40) : biomes Faille quantique et Noyau stellaire, déroulé fixe des
// vagues, nouveaux ennemis et nouveaux boss (Forgeronne, Reflet, Tisseuse, Architecte), Endless Pulse
// après l'Architecte. La logique avance tick par tick à la main (`game.running = false`).
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

test.beforeEach(async ({ isMobile }) => test.skip(isMobile, "logique de jeu : une seule plateforme suffit"));

/** Lance une partie figée, arène vide, et fait apparaître `type` à `dx` du joueur. */
async function setup(page, type, dx = 300, wave = 35) {
  await page.goto("/");
  await startGame(page);
  await game(
    page,
    ({ state, spawner }, { type, dx, wave }) => {
      state.game.running = false;
      state.game.spawnTimer = 1e9;
      state.game.wave = wave;
      state.world.enemies.length = 0;
      state.world.hazards.length = 0;
      state.world.enemyProjectiles.length = 0;
      if (type) spawner.spawnEnemy(type, state.player.worldX + dx, state.player.worldY);
    },
    { type, dx, wave },
  );
}

/**
 * Avance la logique des ennemis et des attaques de zone de `n` ticks ; renvoie le plus grand nombre
 * d'attaques (zones + tirs ennemis) vues en même temps.
 */
const STEP = `async (n) => {
  const enemies = await import("/src/systems/enemies.js");
  const hazards = await import("/src/systems/hazards.js");
  const combat = await import("/src/systems/combat.js");
  const state = await import("/src/core/state.js");
  let attacks = 0;
  for (let i = 0; i < n; i++) {
    state.game.time += 1000 / 60;
    combat.rebuildEnemyGrid();
    enemies.updateEnemies();
    hazards.updateHazards();
    attacks = Math.max(attacks, state.world.hazards.length + state.world.enemyProjectiles.length);
  }
  return attacks;
}`;

const step = (page, n = 1) => page.evaluate(`(${STEP})(${n})`);

test("vagues 31 à 40 : deux biomes, déroulé fixe des boss, puis les biomes en boucle", async ({ page }) => {
  await page.goto("/");
  const layout = await page.evaluate(async () => {
    const { biomeForWave, LAST_BIOME_WAVE } = await import("/src/data/biomes.js");
    const { bossForWave } = await import("/src/data/enemies.js");
    const waves = {};
    for (let w = 29; w <= 41; w++) waves[w] = bossForWave(w)?.type ?? null;
    return {
      last: LAST_BIOME_WAVE,
      biomes: [30, 31, 35, 36, 40, 41, 46].map((w) => biomeForWave(w).id),
      waves,
    };
  });
  expect(layout.last).toBe(40);
  expect(layout.biomes).toEqual(["station", "rift", "rift", "core", "core", "neon", "desert"]);
  expect(layout.waves).toEqual({
    29: "hacker",
    30: "pulse_core",
    31: null,
    32: "forge",
    33: "miniboss",
    34: null,
    35: "mirror",
    36: "miniboss",
    37: "weaver",
    38: null,
    39: null,
    40: "architect",
    41: null,
  });
});

test("Déphaseur : intouchable par moments ; Nova : charge puis explose sans récompense", async ({ page }) => {
  await setup(page, "phaser", 400);
  await game(page, ({ state }) => (state.world.enemies[0].phaseTimer = 0)); // début de sa phase solide
  await step(page, 200); // solide 150 ticks au plus, puis scintille 30 ticks
  const phased = await game(page, ({ state, combat }) => {
    const e = state.world.enemies[0];
    combat.rebuildEnemyGrid();
    const before = e.health;
    combat.damageEnemy(e, 5);
    return { submerged: e.submerged, untouched: e.health === before };
  });
  expect(phased).toEqual({ submerged: true, untouched: true });
  await step(page, 100);
  expect(await game(page, ({ state }) => state.world.enemies[0].submerged)).toBe(false);

  await game(page, ({ state, spawner }) => {
    state.world.enemies.length = 0;
    spawner.spawnEnemy("nova", state.player.worldX + 150, state.player.worldY);
  });
  const kills = await game(page, ({ state }) => state.game.kills);
  await step(page, 2);
  expect(await game(page, ({ state }) => state.world.enemies[0].charging)).toBeGreaterThan(0);
  await step(page, 120);
  const after = await game(page, ({ state }) => ({
    alive: state.world.enemies.length,
    kills: state.game.kills,
  }));
  expect(after.alive).toBe(0);
  expect(after.kills).toBe(kills); // elle s'est sacrifiée : pas une élimination
});

test("Réplicateur : se copie ; Fusionneur : deux qui se touchent n'en font qu'un, plus fort", async ({
  page,
}) => {
  await setup(page, "replicator", 400);
  await step(page, 400);
  const copies = await game(page, ({ state }) => state.world.enemies.filter((e) => e.type === "replicator"));
  expect(copies.length).toBeGreaterThanOrEqual(2);
  expect(copies.some((e) => e.generation === 1)).toBe(true);

  const fused = await game(page, async ({ state, spawner, combat, enemies }) => {
    state.world.enemies.length = 0;
    const { worldX: x, worldY: y } = state.player;
    spawner.spawnEnemy("fuser", x + 300, y);
    spawner.spawnEnemy("fuser", x + 310, y);
    const base = state.world.enemies[0].maxHealth;
    combat.rebuildEnemyGrid();
    enemies.updateEnemies();
    const left = state.world.enemies.filter((e) => !e.dead);
    return { count: left.length, level: left[0].fuseLevel, stronger: left[0].maxHealth > base * 2 };
  });
  expect(fused).toEqual({ count: 1, level: 1, stronger: true });
});

for (const [type, parts] of [
  ["forge", ["forge_drone"]],
  ["mirror", []],
  ["weaver", ["weaver_anchor"]],
  ["architect", []],
]) {
  test(`boss ${type} : attaques annoncées, parties rattachées, aucune erreur`, async ({ page }) => {
    await setup(page, type, 400, 38);
    const attacks = await step(page, 900);
    expect(attacks).toBeGreaterThan(0);
    const s = await game(
      page,
      ({ state }, type) => ({
        alive: state.world.enemies.some((e) => e.type === type && !e.dead),
        parts: [...new Set(state.world.enemies.filter((e) => e.owner).map((e) => e.type))],
        orphans: state.world.enemies.filter((e) => e.owner && e.owner.type !== type).length,
      }),
      type,
    );
    expect(s.alive).toBe(true);
    for (const p of parts) expect(s.parts).toContain(p);
    expect(s.orphans).toBe(0);
    // Ses parties meurent avec lui
    await game(
      page,
      ({ state, combat }, type) => combat.killEnemy(state.world.enemies.find((e) => e.type === type)),
      type,
    );
    await step(page, 2);
    expect(await game(page, ({ state }) => state.world.enemies.filter((e) => !e.dead).length)).toBe(0);
  });
}

test("Forgeronne : les drones se soudent en un colosse qui cumule leurs PV", async ({ page }) => {
  await setup(page, "forge", 500, 32);
  const golem = await game(page, async ({ state }) => {
    const step = async (n) => {
      const enemies = await import("/src/systems/enemies.js");
      const combat = await import("/src/systems/combat.js");
      for (let i = 0; i < n; i++) {
        state.game.time += 1000 / 60;
        combat.rebuildEnemyGrid();
        enemies.updateEnemies();
      }
    };
    const forge = state.world.enemies[0];
    forge.turn = 0; // prochaine attaque : drones
    forge.attackTimer = 1;
    await step(1);
    const drones = forge.drones.filter((d) => d.type === "forge_drone");
    for (const d of drones) d.stun = 1e9; // ils restent groupés
    const health = drones.reduce((n, d) => n + d.health, 0);
    forge.turn = 3; // prochaine attaque : soudure (cycle : enclumes, drones, étincelles, enclumes, soudure)
    forge.attackTimer = 1;
    await step(60);
    const g = state.world.enemies.find((e) => e.type === "forge_golem" && !e.dead);
    return { count: drones.length, golem: !!g, health: g && Math.round((g.maxHealth / health) * 10) / 10 };
  });
  expect(golem).toEqual({ count: 4, golem: true, health: 1.5 });
});

test("Reflet : il dashe quand le joueur dashe et copie ses armes d'appoint", async ({ page }) => {
  await setup(page, "mirror", 400, 35);
  const r = await game(page, async ({ state, upgrades }) => {
    const p = state.player;
    const card = upgrades.SIDE_WEAPON_CARDS.find((c) => c.sideWeapon === "pulse");
    upgrades.applyUpgrade(card, p);
    const enemies = await import("/src/systems/enemies.js");
    const combat = await import("/src/systems/combat.js");
    const m = state.world.enemies[0];
    p.isDashing = true;
    combat.rebuildEnemyGrid();
    enemies.updateEnemies();
    const dashing = m.dashing > 0;
    p.isDashing = false;
    m.turn = 1; // prochaine attaque : contre-attaque (onde, comme l'Onde pulsée du joueur)
    m.attackTimer = 1;
    enemies.updateEnemies();
    return { dashing, ring: state.world.hazards.some((h) => h.kind === "ring") };
  });
  expect(r).toEqual({ dashing: true, ring: true });
});

test("Tisseuse : une ancre détruite l'étourdit ; la cage laisse toujours une sortie", async ({ page }) => {
  await setup(page, "weaver", 500, 37);
  const r = await game(page, async ({ state, combat }) => {
    const enemies = await import("/src/systems/enemies.js");
    const step = (n) => {
      for (let i = 0; i < n; i++) {
        state.game.time += 1000 / 60;
        combat.rebuildEnemyGrid();
        enemies.updateEnemies();
      }
    };
    const w = state.world.enemies[0];
    w.turn = -1; // prochaine attaque : ancres
    w.attackTimer = 1;
    step(60);
    const anchors = w.anchors.length;
    state.world.hazards.length = 0;
    w.turn = 0; // prochaine attaque : tissage
    w.attackTimer = 1;
    step(1);
    const beams = state.world.hazards.filter((h) => h.kind === "beam").length;
    combat.killEnemy(w.anchors[0]);
    step(1);
    return { anchors, beams, stun: w.stun > 0 };
  });
  expect(r.anchors).toBe(4);
  expect(r.beams).toBe(3); // 4 ancres = 4 côtés, l'un reste ouvert
  expect(r.stun).toBe(true);
});

test("Architecte : quatre phases, l'arène se resserre, sa mort lance l'Endless Pulse", async ({ page }) => {
  await setup(page, "architect", 450, 40);
  const phases = await game(page, async ({ state }) => {
    const enemies = await import("/src/systems/enemies.js");
    const a = state.world.enemies[0];
    const seen = [];
    for (const k of [0.7, 0.45, 0.2]) {
      a.health = a.maxHealth * k;
      enemies.updateEnemies();
      seen.push([a.stage, a.arenaScale]);
    }
    return { seen, tag: a.barTag };
  });
  expect(phases.seen).toEqual([
    [1, 0.88],
    [2, 0.76],
    [3, 0.64],
  ]);
  expect(phases.tag).toBe("PHASE 4 · EFFONDREMENT");
  const endless = await game(page, ({ state, combat }) => {
    state.game.endlessAllowed = true;
    combat.killEnemy(state.world.enemies[0]);
    return !!state.game.endless;
  });
  expect(endless).toBe(true);
});

test("le Cœur du Pulse n'est plus le boss final : pas d'Endless Pulse à la vague 30", async ({ page }) => {
  await setup(page, "pulse_core", 400, 30);
  const endless = await game(page, ({ state, combat }) => {
    state.game.endlessAllowed = true;
    combat.killEnemy(state.world.enemies[0]);
    return !!state.game.endless;
  });
  expect(endless).toBe(false);
  await killPlayer(page);
});
