// Anomalies de biome (verglas, tourelles piratables, portails) et Marchand Noir.
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

test.beforeEach(async ({ isMobile }) => test.skip(isMobile, "logique de jeu : une seule plateforme suffit"));

/** Partie sans petits ennemis, sanctuaire, événement ni tir, à la vague voulue. */
async function quietRun(page, wave) {
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

const anomalyId = (page) => game(page, ({ state }) => state.game.anomaly?.id ?? null);

test("une anomalie par biome : verglas en Toundra, tourelles en Station, portails dans la Faille", async ({
  page,
}) => {
  await quietRun(page, 2);
  expect(await anomalyId(page)).toBeNull(); // Cité néon : terrain neutre
  await game(page, ({ state }) => (state.game.wave = 13));
  await expect.poll(() => anomalyId(page)).toBe("ice");
  await expect(page.locator("#bossWarning")).toContainText("PLAQUES DE VERGLAS");
  await game(page, ({ state }) => (state.game.wave = 25));
  await expect.poll(() => anomalyId(page)).toBe("turrets");
  await game(page, ({ state }) => (state.game.wave = 31));
  await expect.poll(() => anomalyId(page)).toBe("portals");
  await game(page, ({ state }) => (state.game.wave = 37));
  await expect.poll(() => anomalyId(page)).toBeNull(); // Noyau stellaire : rien
  // Endless Pulse : la Toundra revient en boucle, son anomalie aussi
  const loop = await game(page, async () => {
    const { biomeForWave } = await import("/src/data/biomes.js");
    for (let w = 41; w < 80; w++) if (biomeForWave(w).id === "ice") return w;
  });
  await game(page, ({ state }, w) => (state.game.wave = w), loop);
  await expect.poll(() => anomalyId(page)).toBe("ice");
  await killPlayer(page);
});

test("verglas : plus rapide sur la glace, le vaisseau glisse ; hors de la glace, contrôle normal", async ({
  page,
}) => {
  await quietRun(page, 13);
  await expect.poll(() => anomalyId(page)).toBe("ice");
  const r = await game(page, async ({ state }) => {
    const { steerOnTerrain } = await import("/src/systems/anomalies/index.js");
    const { onPlate, update } = await import("/src/systems/anomalies/ice.js");
    state.game.paused = true; // le test fait avancer le terrain lui-même
    const a = state.game.anomaly;
    const plate = a.items[0];
    // Les plaques ne se chevauchent pas avec le joueur à leur apparition
    const underPlayer = a.items.some((p) => onPlate(p, state.player.worldX, state.player.worldY));
    state.player.worldX = plate.x;
    state.player.worldY = plate.y;
    update(a);
    const onIce = a.onIce;
    // 60 ticks de poussée vers la droite à 5 px/tick, puis on lâche
    let v = { x: 0, y: 0 };
    const first = steerOnTerrain(5, 0).x;
    for (let i = 0; i < 120; i++) v = steerOnTerrain(5, 0);
    const top = v.x;
    v = steerOnTerrain(0, 0);
    const slide = v.x;
    // Hors de la glace : la vitesse suit la commande tout de suite
    state.player.worldX = state.game.bounds.maxX + 1e4;
    update(a);
    const off = steerOnTerrain(0, 5);
    state.game.paused = false;
    return { underPlayer, onIce, first, top, slide, off, centre: onPlate(plate, plate.x, plate.y) };
  });
  expect(r.underPlayer).toBe(false);
  expect(r.onIce).toBe(true);
  expect(r.centre).toBe(true);
  expect(r.first).toBeLessThan(1); // inertie : démarre lentement
  expect(r.top).toBeCloseTo(6.5, 1); // +30 % une fois lancé
  expect(r.slide).toBeGreaterThan(5); // relâché : continue sur sa lancée
  expect(r.off).toEqual({ x: 0, y: 5 });
  await killPlayer(page);
});

test("tourelles : 3 s à côté la piratent, elle tire sur les ennemis puis redevient neutre", async ({
  page,
}) => {
  await quietRun(page, 25);
  await expect.poll(() => anomalyId(page)).toBe("turrets");
  await game(page, ({ config, state }) => {
    const t = state.game.anomaly.items[0];
    state.player.worldX = t.x;
    state.player.worldY = t.y + 40;
  });
  // Pas encore piratée au bout d'une seconde
  await page.waitForTimeout(800);
  expect(await game(page, ({ state }) => state.game.anomaly.items[0].state)).toBe("idle");
  await expect
    .poll(() => game(page, ({ state }) => state.game.anomaly.items[0].state), { timeout: 6000 })
    .toBe("hacked");
  // Un ennemi immobile à portée : la tourelle le touche (dégâts « Tourelles piratées »)
  await game(page, ({ state, spawner }) => {
    const t = state.game.anomaly.items[0];
    state.player.worldX = t.x - 400; // le joueur s'éloigne : la tourelle continue de tirer
    spawner.spawnEnemy("tank", t.x + 220, t.y);
    const e = state.world.enemies.at(-1);
    e.speed = e.baseSpeed = e.damage = 0;
    e.health = e.maxHealth = 1e9;
  });
  await expect.poll(() => game(page, ({ state }) => state.game.stats.damage.station ?? 0)).toBeGreaterThan(0);
  // Fin du piratage : recharge, puis à nouveau neutre
  await game(page, ({ state }) => (state.game.anomaly.items[0].timer = 1));
  await expect.poll(() => game(page, ({ state }) => state.game.anomaly.items[0].state)).toBe("cooldown");
  await killPlayer(page);
});

test("portails : un coin envoie au coin opposé, sans rebondir ; ils suivent l'arène d'un boss", async ({
  page,
}) => {
  await quietRun(page, 31);
  await expect.poll(() => anomalyId(page)).toBe("portals");
  const corners = await game(page, ({ state }) => {
    const [tl, , , br] = state.game.anomaly.items;
    state.player.worldX = tl.x;
    state.player.worldY = tl.y;
    return { tl: { x: tl.x, y: tl.y }, br: { x: br.x, y: br.y } };
  });
  expect(corners.tl.x).toBeLessThan(0);
  expect(corners.br.x).toBeGreaterThan(0);
  await expect
    .poll(() => game(page, ({ state }) => Math.round(state.player.worldX)))
    .toBe(Math.round(corners.br.x));
  // Reste sur le portail d'arrivée : pas renvoyé au départ
  await page.waitForTimeout(500);
  const after = await game(page, ({ state }) => ({
    x: Math.round(state.player.worldX),
    uses: state.game.anomaly.uses,
  }));
  expect(after).toEqual({ x: Math.round(corners.br.x), uses: 1 });

  // Combat de boss : les portails se reposent aux coins de l'arène
  await game(page, ({ state, spawner }) => {
    state.player.worldX = state.player.worldY = 0;
    spawner.spawnEnemy("hydra", 300, 300);
  });
  await expect.poll(() => game(page, ({ state }) => state.game.anomaly.arena)).toBe(true);
  const inside = await game(page, ({ state, arena }) => {
    const z = arena.combatZone();
    return state.game.anomaly.items.every(
      (p) => p.x > z.minX && p.x < z.maxX && p.y > z.minY && p.y < z.maxY,
    );
  });
  expect(inside).toBe(true);
  await killPlayer(page);
});

test("cartes rendables : une carte de statistiques se rend exactement, une carte spéciale non", async ({
  page,
}) => {
  await quietRun(page, 5);
  const r = await game(page, ({ state, upgrades }) => {
    const p = state.player;
    const card = (name) => upgrades.UPGRADES.find((u) => u.name === name);
    const attack = p.attack;
    const maxHealth = p.maxHealth;
    upgrades.applyUpgrade(card("Force Brute"), p);
    upgrades.applyUpgrade(card("Force Brute"), p);
    upgrades.applyUpgrade(card("Berserker"), p);
    const tradeable = upgrades.tradeableCards(p).map((t) => [t.card.name, t.count]);
    const removed = upgrades.removeCard(p, "Berserker") && upgrades.removeCard(p, "Force Brute");
    return {
      tradeable,
      removed,
      attack: p.attack - attack,
      maxHealth: Math.round(p.maxHealth - maxHealth),
      inv: p.inventory["Force Brute"],
      berserker: p.inventory["Berserker"] ?? 0,
      corrupted: (() => {
        const c = upgrades.CORRUPTED_UPGRADES.find((u) => u.name === "Surcharge moteur");
        upgrades.applyUpgrade(c, p);
        return (
          upgrades.tradeableCards(p).some((t) => t.card.name === c.name) || upgrades.removeCard(p, c.name)
        );
      })(),
    };
  });
  expect(r.tradeable).toEqual([
    ["Force Brute", 2],
    ["Berserker", 1],
  ]);
  expect(r.removed).toBe(true);
  expect(r.attack).toBe(4); // il reste une Force Brute
  expect(r.maxHealth).toBe(0); // Berserker rendu : PV max d'avant
  expect(r.inv).toBe(1);
  expect(r.berserker).toBe(0);
  expect(r.corrupted).toBe(false); // une corrompue ne se rend pas
  await killPlayer(page);
});

test("Marchand Noir : remplace un sanctuaire, échange une carte contre une légendaire ou corrompue", async ({
  page,
}) => {
  await quietRun(page, 6);
  // Le prochain sanctuaire est forcément un marchand
  await game(page, ({ config, state, upgrades }) => {
    config.BLACK_MARKET.chance = 1;
    config.CURSED_SHRINE.chance = 1;
    upgrades.applyUpgrade(
      upgrades.UPGRADES.find((u) => u.name === "Force Brute"),
      state.player,
    );
  });
  await expect.poll(() => game(page, ({ state }) => state.world.merchants.length)).toBe(1);
  expect(await game(page, ({ state }) => state.world.cursedShrines.length)).toBe(0);
  const attack = await game(page, ({ state, config }) => {
    config.CURSED_SHRINE.chance = 0;
    const m = state.world.merchants[0];
    state.player.worldX = m.x;
    state.player.worldY = m.y;
    return state.player.attack;
  });
  await expect(page.locator("#blackMarket")).toBeVisible();
  expect(await game(page, ({ state }) => state.world.merchants.length)).toBe(0); // une seule affaire
  const rarities = await page
    .locator("#marketOffers .upgrade-option")
    .evaluateAll((cards) => cards.map((c) => [...c.classList].find((k) => k.startsWith("rarity-"))));
  expect(rarities.sort()).toEqual(["rarity-corrupted", "rarity-legendary"]);
  // Prix : PV max ou la Force Brute prise plus tôt
  await expect(page.locator("#marketPrices .market-price")).toHaveCount(2);
  await expect(page.locator("#btnMarketDeal")).toBeDisabled();
  await page.locator("#marketOffers .rarity-legendary").click();
  await page.locator('#marketPrices [data-price="Force Brute"]').click();
  const reward = await page.locator("#marketOffers .rarity-legendary h4").textContent();
  await page.locator("#btnMarketDeal").click();
  await expect(page.locator("#blackMarket")).toBeHidden();
  const after = await game(
    page,
    ({ state }, reward) => {
      const p = state.player;
      return {
        running: state.game.running,
        force: p.inventory["Force Brute"] ?? 0,
        reward: p.inventory[reward],
      };
    },
    reward,
  );
  expect(after).toEqual({ running: true, force: 0, reward: 1 });
  if (reward !== "Berserker" && reward !== "Divinité") {
    expect(await game(page, ({ state }) => state.player.attack)).toBe(attack - 4);
  }
  await killPlayer(page);
});

test("Marchand Noir : payer en PV max, ou partir sans rien ; jamais en Boss Rush ni pendant un boss", async ({
  page,
}) => {
  await quietRun(page, 6);
  const maxHealth = await game(page, async ({ state }) => {
    const { spawnMerchant } = await import("/src/systems/blackMarket.js");
    spawnMerchant();
    const m = state.world.merchants[0];
    state.player.worldX = m.x;
    state.player.worldY = m.y;
    return state.player.maxHealth;
  });
  await expect(page.locator("#blackMarket")).toBeVisible();
  await expect(page.locator("#marketPrices .market-price")).toHaveCount(1); // aucune carte prise
  await page.locator("#marketOffers .upgrade-option").first().click();
  await page.locator('#marketPrices [data-price="hp"]').click();
  await page.locator("#btnMarketDeal").click();
  // PV max × 0,8, plus ce que la carte prise a pu changer (Divinité, Berserker...)
  const paid = await game(page, ({ state }) => {
    const p = state.player;
    return p.maxHealth - (p.cardLog.at(-1).delta?.maxHealth ?? 0);
  });
  expect(paid).toBeCloseTo(maxHealth * 0.8, 0);

  // Refuser : rien ne change
  const before = await game(page, async ({ state }) => {
    const { spawnMerchant } = await import("/src/systems/blackMarket.js");
    spawnMerchant();
    const m = state.world.merchants[0];
    state.player.worldX = m.x;
    state.player.worldY = m.y;
    return JSON.stringify(state.player.inventory);
  });
  await expect(page.locator("#blackMarket")).toBeVisible();
  await page.locator("#btnMarketLeave").click();
  await expect(page.locator("#blackMarket")).toBeHidden();
  expect(await game(page, ({ state }) => JSON.stringify(state.player.inventory))).toBe(before);

  // Un boss arrive : le marchand s'en va ; en Boss Rush, il ne remplace jamais un sanctuaire
  await game(page, async ({ state }) => {
    const { spawnMerchant } = await import("/src/systems/blackMarket.js");
    spawnMerchant();
    state.game.pendingBosses.push({ type: "hydra", delay: 1e9 });
  });
  await expect.poll(() => game(page, ({ state }) => state.world.merchants.length)).toBe(0);
  const rush = await game(page, async ({ state, config }) => {
    const { merchantReplacesShrine } = await import("/src/systems/blackMarket.js");
    config.BLACK_MARKET.chance = 1;
    state.game.rush = { stage: 0, defeated: 0 };
    const r = merchantReplacesShrine();
    state.game.rush = null;
    return r;
  });
  expect(rush).toBe(false);
  await killPlayer(page);
});
