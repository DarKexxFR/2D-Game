// Synergies familier + arme (data/perks.js SYNERGIES, systems/synergies.js) : une par familier, au moins une
// par arme, et le comportement de chacune des nouvelles synergies.
import { expect, game, killPlayer, startGame, test, withSave } from "./fixtures.js";

const own = (ids) => Object.fromEntries(ids.map((id) => [id, { level: 1, prestige: 1, copies: 0 }]));

/** Partie calme (aucun ennemi, aucun tir automatique) avec le familier et l'arme donnés. */
async function quietRun(page, pet, weapon) {
  await withSave(page, {
    lastFreeChest: Date.now(),
    items: own([weapon, "pilot", pet]),
    equipped: { weapon, pet },
  });
  await page.goto("/");
  await startGame(page);
  await game(page, async ({ state, config }) => {
    const { WAVE_SCALING } = await import("/src/data/enemies.js");
    WAVE_SCALING.baseMobs = -1e6;
    config.CURSED_SHRINE.chance = 0;
    Object.assign(state.game, { wave: 5, spawnTimer: 1e9, eventTimer: 1e9, waveTimer: -1e9 });
    state.world.enemies.length = 0;
    state.world.projectiles.length = 0;
    state.player.lastAttack = state.player.lastKunaiAttack = 1e15; // pas de tir
  });
}

/** Ennemi immobile et très résistant posé à (dx, dy) du joueur. */
const spawnAt = (page, dx, dy, health = 1e9) =>
  game(
    page,
    ({ state, spawner, combat }, { dx, dy, health }) => {
      const p = state.player;
      spawner.spawnEnemy("tank", p.worldX + dx, p.worldY + dy);
      const e = state.world.enemies[state.world.enemies.length - 1];
      e.health = e.maxHealth = health;
      e.speed = 0;
      combat.rebuildEnemyGrid();
    },
    { dx, dy, health },
  );

test("chaque familier a une synergie, chaque arme au moins une, chacune a son comportement", async ({
  page,
}) => {
  await page.goto("/");
  const check = await page.evaluate(async () => {
    const { SYNERGIES } = await import("/src/data/perks.js");
    const { PETS, WEAPONS } = await import("/src/data/items.js");
    const { SYNERGY_BEHAVIORS } = await import("/src/systems/synergies.js");
    return {
      pets: Object.keys(PETS).filter((id) => !SYNERGIES.some((s) => s.pet === id)),
      weapons: Object.keys(WEAPONS).filter((id) => !SYNERGIES.some((s) => s.weapons.includes(id))),
      unknown: SYNERGIES.flatMap((s) => [s.pet, ...s.weapons]).filter((id) => !PETS[id] && !WEAPONS[id]),
      noBehavior: SYNERGIES.filter((s) => !SYNERGY_BEHAVIORS.includes(s.id)).map((s) => s.id),
      perPet: Object.keys(PETS).map((id) => SYNERGIES.filter((s) => s.pet === id).length),
    };
  });
  expect(check).toEqual({ pets: [], weapons: [], unknown: [], noBehavior: [], perPet: Array(8).fill(1) });
});

test("Tir de barrage : le drone copie le tir du Mitrailleur à 40 % des dégâts", async ({ page }) => {
  await quietRun(page, "drone", "smg");
  await spawnAt(page, 250, 0);
  const shots = await game(page, ({ state, combat }) => {
    state.player.lastAttack = -1e9;
    state.player.autoShoot = true;
    combat.shoot();
    return state.world.projectiles.map((p) => ({ source: p.source || "weapon", damage: p.damage, x: p.x }));
  });
  const own = shots.find((s) => s.source === "weapon");
  const copy = shots.find((s) => s.source === "synergy");
  expect(copy.damage).toBeCloseTo(own.damage * 0.4);
  expect(copy.x).not.toBe(own.x); // part du drone, pas du vaisseau
  expect(await game(page, ({ state }) => state.player.synergy.id)).toBe("barrage");
  await killPlayer(page);
});

test("Moissonneuse d'âmes : chaque élimination écarte les lames et l'orbite de la Faucheuse", async ({
  page,
}) => {
  await quietRun(page, "reaper", "blades");
  const out = await game(page, async ({ state, combat, spawner }) => {
    const { reaperBonus } = await import("/src/systems/synergies.js");
    const before = reaperBonus().orbit;
    for (let i = 0; i < 4; i++) {
      spawner.spawnEnemy("normal", state.player.worldX + 400, state.player.worldY);
      combat.killEnemy(state.world.enemies[state.world.enemies.length - 1]);
    }
    state.player.lastAttack = -1e9;
    state.player.autoShoot = false;
    state.world.projectiles.length = 0;
    combat.shoot();
    return {
      before,
      after: reaperBonus().orbit,
      stacks: state.player.synergyState.stacks,
      life: state.world.projectiles[0].life,
      range: state.player.weapon.range * state.player.rangeMult,
    };
  });
  expect(out.before).toBe(0);
  expect(out.stacks).toBe(4);
  expect(out.after).toBe(20);
  expect(out.life).toBeCloseTo(out.range * 1.16);
  await killPlayer(page);
});

test("Attraction fatale : une gemme ramassée fait une micro-explosion autour du vaisseau", async ({
  page,
}) => {
  await quietRun(page, "collector", "nova");
  await spawnAt(page, 40, 0);
  const lost = await game(page, async ({ state }) => {
    const { createGem, updatePickups } = await import("/src/systems/pickups.js");
    const e = state.world.enemies[0];
    createGem(state.player.worldX, state.player.worldY, 1);
    updatePickups();
    return e.maxHealth - e.health;
  });
  expect(lost).toBeGreaterThan(0);
  await killPlayer(page);
});

test("Courant vital : le Médic lance un arc électrique à chaque intervention", async ({ page }) => {
  await quietRun(page, "medic", "tesla");
  await spawnAt(page, 120, 0);
  const lost = await game(page, async ({ state }) => {
    const { updatePet } = await import("/src/systems/pet.js");
    const e = state.world.enemies[0];
    state.pet.x = state.player.worldX;
    state.pet.y = state.player.worldY;
    state.pet.lastAction = -1e9;
    updatePet();
    return e.maxHealth - e.health;
  });
  expect(lost).toBeGreaterThan(0);
  await killPlayer(page);
});

test("Rempart offensif : sous le bouclier du Gardien, les plombs sont renforcés et perforants", async ({
  page,
}) => {
  await quietRun(page, "guardian", "shotgun");
  await spawnAt(page, 250, 0);
  const fire = (shield) =>
    game(
      page,
      ({ state, combat }, shield) => {
        state.player.buffs.shield = shield;
        state.player.lastAttack = -1e9;
        state.player.autoShoot = true;
        state.world.projectiles.length = 0;
        state.player.critChance = 0;
        combat.shoot();
        const p = state.world.projectiles[0];
        return { damage: p.damage, pierce: p.pierce };
      },
      shield,
    );
  const plain = await fire(0);
  const shielded = await fire(600);
  expect(shielded.damage).toBeCloseTo(plain.damage * 1.35);
  expect(shielded.pierce).toBe(plain.pierce + 1);
  await killPlayer(page);
});

test("Cendres ardentes : un ennemi qui meurt en brûlant explose et enflamme ses voisins", async ({
  page,
}) => {
  await quietRun(page, "phoenix", "disc");
  await spawnAt(page, 300, 0, 10);
  await spawnAt(page, 330, 0);
  const out = await game(page, ({ state, combat }) => {
    const [burning, neighbour] = state.world.enemies;
    burning.burn = { until: state.game.time + 1e6, dps: 0.5 };
    combat.killEnemy(burning);
    return { lost: neighbour.maxHealth - neighbour.health, burning: !!neighbour.burn };
  });
  expect(out.lost).toBeGreaterThan(0);
  expect(out.burning).toBe(true);
  await game(page, ({ state }) => (state.player.revives = 0)); // le Phénix ramènerait le vaisseau à la vie
  await killPlayer(page);
});

test("équipement : la fiche d'une arme à plusieurs partenaires les nomme tous", async ({ page }) => {
  await withSave(page, { lastFreeChest: Date.now(), items: own(["blaster", "pilot", "collector"]) });
  await page.goto("/");
  await page.locator("#btnInventory").click();
  await page.locator("#invTabPet").click();
  await page.locator(".item-card", { hasText: "Collecteur" }).click();
  await expect(page.locator("#itemDetail .synergy-line")).toContainText("Attraction fatale");
  await expect(page.locator("#itemDetail .synergy-line")).toContainText("Lance-étoiles ou Lance-roquettes");
});
