// Armes d'appoint : cartes « Arme » (nouvelle arme ou niveau), 3 emplacements, effets en jeu, évolutions.
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

const IDS = ["missiles", "mines", "lightning", "pulse", "beam", "whip"];

/** Donne une arme d'appoint au joueur au niveau voulu, comme si les cartes avaient été prises. */
async function giveSideWeapon(page, id, level, extra = {}) {
  await game(
    page,
    ({ state, upgrades }, { id, level, extra }) => {
      const card = upgrades.SIDE_WEAPON_CARDS.find((c) => c.sideWeapon === id);
      for (let i = 0; i < level; i++) upgrades.applyUpgrade(card, state.player);
      Object.assign(state.player.inventory, extra);
    },
    { id, level, extra },
  );
}

/** Ennemis plantés autour du vaisseau, qui ne bougent pas, pour que chaque arme ait des cibles. */
async function surround(page) {
  await game(page, ({ state, spawner }) => {
    const { player } = state;
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16;
      const r = 60 + (i % 4) * 45;
      spawner.spawnEnemy("tank", player.worldX + Math.cos(a) * r, player.worldY + Math.sin(a) * r);
      state.world.enemies[state.world.enemies.length - 1].stun = 1e9;
    }
  });
}

test("une carte d'arme ajoute l'arme, la suivante la fait monter de niveau", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await game(page, ({ state }) => (state.game.running = false)); // rien ne bouge pendant le test
  const cards = await game(page, ({ state, upgrades }) => {
    const p = state.player;
    const offered = () => upgrades.availableUpgrades(p).filter((u) => u.rarity === "weapon");
    const card = (id) => upgrades.SIDE_WEAPON_CARDS.find((c) => c.sideWeapon === id);
    const before = offered().length;
    const newText = upgrades.cardDesc(card("missiles"), p);
    upgrades.applyUpgrade(card("missiles"), p);
    const levelText = upgrades.cardDesc(card("missiles"), p);
    upgrades.applyUpgrade(card("missiles"), p);
    upgrades.applyUpgrade(card("mines"), p);
    upgrades.applyUpgrade(card("beam"), p);
    // 3 emplacements pleins : seules les armes déjà portées restent proposées
    const after = offered().map((u) => u.sideWeapon);
    for (let i = 0; i < 3; i++) upgrades.applyUpgrade(card("missiles"), p);
    const maxed = offered().map((u) => u.sideWeapon);
    return {
      before,
      newText,
      levelText,
      side: p.sideWeapons.map((w) => [w.id, w.level]),
      after,
      maxed,
    };
  });
  expect(cards.before).toBe(IDS.length);
  expect(cards.newText).toContain("Nouvelle arme");
  expect(cards.levelText).toBe("+1 missile");
  expect(cards.after.sort()).toEqual(["beam", "mines", "missiles"]);
  expect(cards.maxed.sort()).toEqual(["beam", "mines"]); // missiles au niveau 5
  expect(cards.side).toEqual([
    ["missiles", 5],
    ["mines", 1],
    ["beam", 1],
  ]);

  // Panneau en jeu (PC) : arme équipée + 3 armes d'appoint avec leur niveau
  await game(page, ({ state }) => (state.game.running = true));
  const weapons = page.locator("#uiWeapons .ui-weapon");
  if (await page.locator("#uiWeapons").isVisible()) {
    await expect(weapons).toHaveCount(4);
    await expect(weapons.nth(1).locator("b")).toHaveText("5");
  }
  await killPlayer(page);
});

test("la carte d'arme s'affiche au choix d'amélioration", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await page.goto("/");
  await startGame(page);
  // seules les cartes d'arme restent proposables
  await page.evaluate(async () => {
    const upgrades = await import("/src/data/upgrades.js");
    const keep = new Set(upgrades.SIDE_WEAPON_CARDS);
    for (const u of [...upgrades.UPGRADES, ...upgrades.CORRUPTED_UPGRADES]) {
      if (!keep.has(u)) u.canApply = () => false;
    }
    (await import("/src/core/events.js")).emit("levelUp");
  });
  const first = page.locator(".upgrade-option").first();
  await expect(first).toHaveClass(/rarity-weapon/);
  await expect(first.locator(".rarity-tag")).toHaveText(/arme/i);
  await expect(first).toContainText("Nouvelle arme");
  await first.click();
  await expect(page.locator("#upgradeMenu")).toBeHidden();
  expect(await game(page, ({ state }) => state.player.sideWeapons.length)).toBe(1);
});

for (const id of IDS) {
  test(`arme d'appoint ${id} : blesse les ennemis, puis son évolution`, async ({ page, isMobile }) => {
    test.skip(isMobile, "une seule plateforme suffit");
    await page.goto("/");
    await startGame(page);
    await game(page, ({ state }) => {
      // pas d'apparitions : seulement les ennemis du test
      state.game.spawnTimer = 1e9;
      state.game.modifier.mobCount = 0;
      state.player.weapon = { ...state.player.weapon, damage: 0 }; // l'arme équipée ne compte pas
    });
    const partner = await game(
      page,
      ({}, id) => import("/src/data/sideWeapons.js").then((m) => m.SIDE_WEAPONS[id].evolution.partner),
      id,
    );
    await giveSideWeapon(page, id, 5, { [partner]: 1 });
    await surround(page);
    await expect
      .poll(() => game(page, ({ state }, id) => state.game.stats.damage[id] || 0, id), { timeout: 10_000 })
      .toBeGreaterThan(0);

    // Niveau 5 + carte partenaire : l'évolution passe en premier au choix suivant
    await page.evaluate(async () => (await import("/src/core/events.js")).emit("levelUp"));
    const first = page.locator(".upgrade-option").first();
    await expect(first).toHaveClass(/rarity-evolution/);
    await first.click();
    await expect(page.locator("#upgradeMenu")).toBeHidden();
    const evo = await game(
      page,
      ({ state }, id) =>
        import("/src/data/sideWeapons.js").then((m) => {
          const e = m.SIDE_WEAPONS[id].evolution;
          return {
            owned: !!state.player.evolutions[e.id],
            name: m.sideName(id, state.player),
            expected: e.name,
          };
        }),
      id,
    );
    expect(evo.owned).toBe(true);
    expect(evo.name).toBe(evo.expected);

    // L'arme évoluée continue de blesser
    const before = await game(page, ({ state }, id) => state.game.stats.damage[id] || 0, id);
    await surround(page);
    await expect
      .poll(() => game(page, ({ state }, id) => state.game.stats.damage[id] || 0, id), { timeout: 10_000 })
      .toBeGreaterThan(before);
    await expect(page.locator("#uiWeapons .ui-weapon.evolved")).toHaveCount(1);
    await killPlayer(page);
  });
}
