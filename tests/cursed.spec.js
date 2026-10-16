// Cartes « Corrompues » (risque / récompense), sanctuaires maudits et synergies familier + arme.
import { expect, game, killPlayer, startGame, test, withSave } from "./fixtures.js";

test.beforeEach(async ({ isMobile }) => test.skip(isMobile, "logique de jeu : une seule plateforme suffit"));

const own = (ids) => Object.fromEntries(ids.map((id) => [id, { level: 1, prestige: 1, copies: 0 }]));

/** Partie sans petits ennemis ni sanctuaire automatique, à la vague voulue. */
async function quietRun(page, wave = 5) {
  await page.goto("/");
  await startGame(page);
  await game(
    page,
    async ({ state, config }, wave) => {
      const { WAVE_SCALING } = await import("/src/data/enemies.js");
      WAVE_SCALING.baseMobs = -1e6;
      config.CURSED_SHRINE.chance = 0;
      Object.assign(state.game, { wave, spawnTimer: 1e9, eventTimer: 1e9, waveTimer: -1e9 });
      state.world.enemies.length = 0;
      state.player.lastAttack = state.player.lastKunaiAttack = 1e15; // pas de tir
    },
    wave,
  );
}

/** Applique une carte (par son nom) au joueur. */
function applyCard(page, name) {
  return game(
    page,
    ({ upgrades, state }, name) => {
      const card = upgrades.CORRUPTED_UPGRADES.find((u) => u.name === name);
      upgrades.applyUpgrade(card, state.player);
    },
    name,
  );
}

test("carte corrompue : bonus et malus affichés, proposée une seule fois, jamais dans un coffre", async ({
  page,
}) => {
  await quietRun(page);
  // Seules les cartes corrompues sont tirées
  await game(page, ({ config }) => {
    for (const r of Object.values(config.RARITIES)) r.weight = 0;
    config.RARITIES.corrupted.weight = 10;
  });
  await game(page, ({ state, player }) => player.gainXp(state.player.xpToNextLevel));
  await expect(page.locator("#upgradeMenu")).toBeVisible();
  const card = page.locator(".upgrade-option.rarity-corrupted").first();
  await expect(card.locator(".rarity-tag")).toHaveText(/Corrompue/i);
  await expect(card.locator(".upg-malus")).toBeVisible();
  const name = (await card.locator("h4").textContent()).trim();
  await card.click();
  await expect(page.locator("#upgradeMenu")).toBeHidden();
  const left = await game(page, ({ upgrades, state }) =>
    upgrades.availableUpgrades(state.player).map((u) => u.name),
  );
  expect(left).not.toContain(name); // une seule fois par partie
  // Coffre de boss et sanctuaire maudit : aucune carte corrompue
  const picks = await game(page, async ({ state }) => {
    const { drawChoices } = await import("/src/ui/upgradeMenu.js");
    return [...drawChoices("chest", state.player), ...drawChoices("shrine", state.player)].map(
      (u) => u.rarity,
    );
  });
  expect(picks).not.toContain("corrupted");
  await killPlayer(page);
});

test("Surcharge moteur : plus rapide mais plus de dash", async ({ page }) => {
  await quietRun(page);
  const before = await game(page, ({ state }) => state.player.baseSpeed);
  await applyCard(page, "Surcharge moteur");
  expect(await game(page, ({ state }) => state.player.baseSpeed)).toBeCloseTo(before * 1.35);
  await page.keyboard.down("Space");
  await page.waitForTimeout(200);
  await page.keyboard.up("Space");
  expect(await game(page, ({ state }) => state.player.dashCooldownTimer)).toBe(0); // aucun dash parti
  await killPlayer(page);
});

test("Singularité : tirs et explosions plus gros, cadence réduite", async ({ page }) => {
  await quietRun(page);
  const before = await game(page, ({ state }) => state.player.attackSpeed);
  await applyCard(page, "Singularité");
  const shot = await game(page, ({ state, combat }) => {
    state.player.lastAttack = -1e9;
    state.player.autoShoot = false;
    state.world.projectiles.length = 0;
    combat.shoot();
    return {
      size: state.world.projectiles[0].size,
      base: state.player.weapon.size,
      rate: state.player.attackSpeed,
    };
  });
  expect(shot.size).toBeCloseTo(shot.base * 1.5);
  expect(shot.rate).toBeCloseTo(before / 0.75);
  await killPlayer(page);
});

test("Pacte de sang : après un coup, les gemmes soignent ; moins d'XP", async ({ page }) => {
  await quietRun(page);
  const xpBefore = await game(page, ({ state }) => state.player.xpBonus);
  await applyCard(page, "Pacte de sang");
  expect(await game(page, ({ state }) => state.player.xpBonus)).toBeCloseTo(xpBefore - 0.15);
  // Sans coup reçu : la gemme ne soigne pas
  const gem = ({ state }) => {
    const p = state.player;
    p.health = p.maxHealth / 2;
    state.world.gems.push({ x: p.worldX, y: p.worldY, xp: 1, color: "#f00", collected: false });
  };
  await game(page, gem);
  await page.waitForTimeout(150);
  const hp = await game(page, ({ state }) => state.player.health / state.player.maxHealth);
  expect(hp).toBeCloseTo(0.5, 3);
  // Après un coup : la gemme soigne
  await game(page, ({ state, player }) => {
    player.takeDamage(1);
    state.player.health = state.player.maxHealth / 2;
  });
  await game(page, ({ state }) => {
    const p = state.player;
    state.world.gems.push({ x: p.worldX, y: p.worldY, xp: 1, color: "#f00", collected: false });
  });
  await expect
    .poll(() => game(page, ({ state }) => state.player.health / state.player.maxHealth))
    .toBeGreaterThan(0.505);
  await killPlayer(page);
});

test("sanctuaire maudit : tenir 5 s pendant que les élites arrivent → carte rare ou épique", async ({
  page,
}) => {
  await quietRun(page);
  await game(page, ({ config }) => {
    config.CURSED_SHRINE.cardChance = 1;
    config.CURSED_SHRINE.hold = 60; // 1 s pour le test
  });
  const shrine = await game(page, async ({ state }) => {
    const { spawnCursedShrine } = await import("/src/systems/cursedShrines.js");
    spawnCursedShrine();
    return state.world.cursedShrines[0];
  });
  expect(shrine.state).toBe("idle");
  // Le joueur entre dans le cercle : la horde d'élites arrive
  await game(page, ({ state }) => {
    const s = state.world.cursedShrines[0];
    state.player.worldX = s.x;
    state.player.worldY = s.y;
  });
  await expect
    .poll(() => game(page, ({ state }) => state.world.enemies.filter((e) => e.elite).length))
    .toBeGreaterThan(0);
  // Les élites ne gênent pas le test
  await game(page, ({ state }) => {
    for (const e of state.world.enemies) e.speed = e.baseSpeed = e.damage = 0;
  });
  await expect(page.locator("#upgradeMenu")).toBeVisible();
  await expect(page.locator("#upgradeTitle")).toHaveText("SANCTUAIRE MAUDIT");
  const rarities = await page
    .locator(".upgrade-option")
    .evaluateAll((cards) => cards.map((c) => [...c.classList].find((k) => k.startsWith("rarity-"))));
  for (const r of rarities) expect(["rarity-rare", "rarity-epic"]).toContain(r);
  expect(await game(page, ({ state }) => state.world.cursedShrines.length)).toBe(0);
  await page.locator(".upgrade-option").first().click();
  await killPlayer(page);
});

test("sanctuaire maudit : quitter le cercle trop longtemps fait échouer le défi ; jamais pendant un boss", async ({
  page,
}) => {
  await quietRun(page);
  await game(page, ({ config }) => (config.CURSED_SHRINE.grace = 10));
  await game(page, async ({ state }) => {
    const { spawnCursedShrine } = await import("/src/systems/cursedShrines.js");
    spawnCursedShrine();
    const s = state.world.cursedShrines[0];
    state.player.worldX = s.x;
    state.player.worldY = s.y;
  });
  await expect.poll(() => game(page, ({ state }) => state.world.cursedShrines[0]?.state)).toBe("active");
  const gold = await game(page, ({ state }) => {
    state.player.worldX += 1000;
    return state.game.runGold;
  });
  await expect.poll(() => game(page, ({ state }) => state.world.cursedShrines.length)).toBe(0);
  expect(await game(page, ({ state }) => state.game.runGold)).toBe(gold); // pas de récompense

  // Pendant un boss : le totem disparaît et aucun n'apparaît
  await game(page, async ({ state, config }) => {
    const { spawnCursedShrine } = await import("/src/systems/cursedShrines.js");
    spawnCursedShrine();
    config.CURSED_SHRINE.chance = 1;
    state.game.pendingBosses.push({ type: "hydra", delay: 1e9 });
  });
  await page.waitForTimeout(300);
  expect(await game(page, ({ state }) => state.world.cursedShrines.length)).toBe(0);
  await killPlayer(page);
});

test("synergie Cristal de givre + Railgun : les ennemis gelés touchés éclatent en éclats de glace", async ({
  page,
}) => {
  await withSave(page, {
    lastFreeChest: Date.now(),
    items: own(["railgun", "pilot", "frost"]),
    equipped: { weapon: "railgun", pet: "frost" },
  });
  await page.goto("/");
  await page.locator("#btnInventory").click();
  await expect(page.locator("#activeSet")).toContainText("Synergie Givre brisé active");
  await page.locator(".item-card", { hasText: "Railgun" }).click();
  await expect(page.locator("#itemDetail .synergy-line.active")).toContainText("Cristal de givre");
  await quietRun(page);
  expect(await game(page, ({ state }) => state.player.synergy?.id)).toBe("iceShatter");
  const shards = await game(page, ({ state, spawner, combat }) => {
    const p = state.player;
    spawner.spawnEnemy("tank", p.worldX + 200, p.worldY);
    const e = state.world.enemies[0];
    e.health = e.maxHealth = 1e9;
    e.frozenUntil = state.game.time + 1e6; // gelé par le cristal
    state.pet.active = false; // le familier ne tire pas pendant le test
    combat.rebuildEnemyGrid();
    combat.spawnProjectile({ x: e.x, y: e.y, vx: 0, vy: 0, size: 4, damage: 10, color: "#0ff" });
    combat.updateProjectiles();
    return state.world.projectiles.filter((pr) => pr.source === "synergy").length;
  });
  expect(shards).toBe(6);
  await killPlayer(page);
});

test("synergie Dragonnet + Lance-flammes : aura et portée des flammes +20 %", async ({ page }) => {
  await withSave(page, {
    lastFreeChest: Date.now(),
    items: own(["flamer", "pilot", "dragon"]),
    equipped: { weapon: "flamer", pet: "dragon" },
  });
  await page.goto("/");
  await startGame(page);
  const p = await game(page, ({ state, combat }) => {
    state.player.lastAttack = -1e9;
    state.player.autoShoot = false;
    state.world.projectiles.length = 0;
    combat.shoot();
    return {
      synergy: state.player.synergy?.id,
      aura: state.player.auraMult,
      life: state.world.projectiles[0].life,
      range: state.player.weapon.range,
    };
  });
  expect(p.synergy).toBe("dragonFire");
  expect(p.aura).toBeCloseTo(1.2);
  expect(p.life).toBeCloseTo(p.range * 1.2);
  await killPlayer(page);
});
