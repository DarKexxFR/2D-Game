// Difficulté croissante : montée exponentielle, élites, défense en %, soins corrompus.
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

test.beforeEach(async ({ isMobile }) => test.skip(isMobile, "logique de jeu : une seule plateforme suffit"));

test("PV et dégâts des ennemis s'envolent après la vague 10, élites de plus en plus fréquentes", async ({
  page,
}) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const sp = await import("/src/systems/spawner.js");
    const m = (w) => sp.waveMultipliers(w);
    return {
      linear: m(10).health / m(5).health, // avant la rampe : croissance linéaire
      ramp: m(30).health / m(20).health,
      dmgRamp: m(30).damage / m(20).damage,
      elites: [5, 8, 15, 40].map((w) => sp.eliteChance(w)),
    };
  });
  expect(r.linear).toBeCloseTo(4.5 / 2.75, 5);
  expect(r.ramp).toBeGreaterThan(2.5); // ×1,07 par vague en plus du linéaire
  expect(r.dmgRamp).toBeGreaterThan(2);
  expect(r.elites[0]).toBe(0);
  expect(r.elites[1]).toBeGreaterThan(0);
  expect(r.elites[2]).toBeGreaterThan(r.elites[1]);
  expect(r.elites[3]).toBe(0.35); // plafond
});

test("élites : plus gros, plus résistants, mieux récompensés", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  const r = await game(page, ({ state, spawner }) => {
    state.game.spawnTimer = 1e9;
    state.world.enemies.length = 0;
    state.game.wave = 40;
    const random = Math.random;
    Math.random = () => 0; // force l'élite
    spawner.spawnEnemy("normal");
    Math.random = () => 0.99; // ennemi ordinaire
    spawner.spawnEnemy("normal");
    Math.random = random;
    const [elite, normal] = state.world.enemies;
    return {
      flags: [elite.elite, normal.elite],
      health: elite.maxHealth / normal.maxHealth,
      size: elite.size / normal.size,
      gold: elite.gold / normal.gold,
    };
  });
  expect(r.flags).toEqual([true, false]);
  expect(r.health).toBeCloseTo(4);
  expect(r.size).toBeCloseTo(1.3);
  expect(r.gold).toBeCloseTo(3);
  await killPlayer(page);
});

test("la défense réduit les coups en % sans jamais les annuler", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  const r = await page.evaluate(async () => {
    const s = await import("/src/core/state.js");
    const sp = await import("/src/systems/spawner.js");
    const en = await import("/src/systems/enemies.js");
    s.game.paused = true; // on fait avancer l'IA à la main : un seul tick, un seul coup
    s.game.time += 10_000; // hors du délai de contact initial (0,5 s)
    s.world.enemies.length = 0;
    const hit = (defense) => {
      s.player.defense = defense;
      s.player.health = s.player.maxHealth;
      sp.spawnEnemy("tank", s.player.worldX + 10, s.player.worldY);
      const e = s.world.enemies.at(-1);
      en.updateEnemies();
      s.world.enemies.length = 0;
      return { loss: s.player.maxHealth - s.player.health, damage: e.damage };
    };
    return { none: hit(0), half: hit(40), huge: hit(10000) };
  });
  expect(r.none.loss).toBeCloseTo(r.none.damage);
  expect(r.half.loss).toBeCloseTo(r.half.damage * 0.5); // 40 / (40 + 40)
  expect(r.huge.loss).toBeGreaterThanOrEqual(1); // jamais annulé
  await killPlayer(page);
});

test("corruption : les soins faiblissent avec les vagues, la Moisson sanglante est plafonnée", async ({
  page,
}) => {
  await page.goto("/");
  await startGame(page);
  const r = await page.evaluate(async () => {
    const s = await import("/src/core/state.js");
    const pl = await import("/src/systems/player.js");
    const sp = await import("/src/systems/spawner.js");
    const c = await import("/src/systems/combat.js");
    const factors = [1, 12, 20, 60].map((w) => pl.healFactor(w));
    // Moisson sanglante : 20 éliminations au même instant = un seul soin
    s.game.wave = 1;
    s.game.spawnTimer = 1e9;
    s.world.enemies.length = 0;
    s.player.maxHealth = 1000;
    s.player.health = 100;
    s.player.evolutions.bloodHarvest = true;
    for (let i = 0; i < 20; i++) {
      sp.spawnEnemy("normal", s.player.worldX + 400, s.player.worldY);
      c.killEnemy(s.world.enemies.at(-1));
    }
    return { factors, healed: s.player.health - 100 };
  });
  expect(r.factors[0]).toBe(1);
  expect(r.factors[1]).toBe(1);
  expect(r.factors[2]).toBeLessThan(1);
  expect(r.factors[3]).toBe(0.35); // plancher
  expect(r.healed).toBeCloseTo(10); // 1 % de 1000, une seule fois
  await killPlayer(page);
});
