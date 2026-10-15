// Évolutions d'armes : proposées en priorité quand la recette est complète, puis actives en jeu.
import { expect, game, killPlayer, startGame, test, withSave } from "./fixtures.js";

const RECIPES = {
  bladeStorm: { name: "Tempête de lames", inventory: { Kunai: 5, "Multi-Tir": 1 } },
  inferno: {
    name: "Enfer",
    inventory: { "Aura de Feu": 5, Explosion: 1 },
    setup: { auraRadius: 100, auraDamage: 5 },
  },
  guardianRing: {
    name: "Anneau gardien",
    inventory: { "Orbe Protecteur": 6, Épines: 1 },
    setup: { orbitals: 6 },
  },
  bloodHarvest: { name: "Moisson sanglante", inventory: { Vampirisme: 5, Régénération: 1 } },
};

for (const [id, recipe] of Object.entries(RECIPES)) {
  test(`évolution ${recipe.name}`, async ({ page, isMobile }) => {
    test.skip(isMobile, "une seule plateforme suffit");
    await page.goto("/");
    await startGame(page);
    await page.evaluate(
      async ({ recipe }) => {
        const { player } = await import("/src/core/state.js");
        Object.assign(player.inventory, recipe.inventory);
        Object.assign(player, recipe.setup || {});
        (await import("/src/core/events.js")).emit("levelUp");
      },
      { recipe },
    );
    const first = page.locator(".upgrade-option").first();
    await expect(first).toHaveClass(/rarity-evolution/);
    await expect(first).toContainText(recipe.name);
    await first.click();
    await expect(page.locator("#upgradeMenu")).toBeHidden();
    expect(await game(page, ({ state }, k) => state.player.evolutions[k], id)).toBe(true);

    // L'évolution tourne quelques secondes sans erreur et tue des ennemis
    await game(page, ({ state }) => (state.player.autoShoot = true));
    await expect
      .poll(() => game(page, ({ state }) => state.game.kills), { timeout: 15_000 })
      .toBeGreaterThan(3);
    if (id === "bladeStorm") {
      await expect
        .poll(() =>
          game(page, ({ state }) => state.world.projectiles.filter((p) => p.type === "kunai").length),
        )
        .toBeGreaterThanOrEqual(16);
    }
    // Une évolution obtenue n'est plus proposée
    const again = await page.evaluate(async () => {
      const { player } = await import("/src/core/state.js");
      return (await import("/src/data/upgrades.js")).availableEvolutions(player).length;
    });
    expect(again).toBe(0);
    await killPlayer(page);
  });
}

// Évolutions d'armes : arme équipée + amélioration partenaire → arme évoluée
const WEAPON_RECIPES = {
  blaster: { id: "solarBlaster", name: "Blaster solaire", inventory: { "Force Brute": 3 } },
  smg: { id: "leadStorm", name: "Ouragan de plomb", inventory: { Mitraillette: 2 } },
  shotgun: { id: "stormCannon", name: "Canon tempête", inventory: { Recul: 2 } },
  railgun: { id: "ionLance", name: "Lance ionique", inventory: { Perçage: 3 } },
  rocket: { id: "missileRain", name: "Pluie de missiles", inventory: { Explosion: 2 } },
  plasma: { id: "supernova", name: "Supernova", inventory: { Sniper: 2 } },
  flamer: { id: "dragonBreath", name: "Souffle du dragon", inventory: { "Aura de Feu": 2 } },
  disc: { id: "whirlwind", name: "Tourbillon", inventory: { "Orbe Protecteur": 2 } },
  tesla: { id: "ionStorm", name: "Tempête ionique", inventory: { "Multi-Tir": 2 } },
  blades: { id: "chaosWheel", name: "Roue du chaos", inventory: { Kunai: 2 } },
  nova: { id: "starfall", name: "Pluie d'étoiles", inventory: { Divinité: 1 } },
};

for (const [weapon, recipe] of Object.entries(WEAPON_RECIPES)) {
  test(`évolution d'arme ${recipe.name}`, async ({ page, isMobile }) => {
    test.skip(isMobile, "une seule plateforme suffit");
    await withSave(page, {
      lastFreeChest: Date.now(),
      items: { [weapon]: { level: 20, prestige: 2, copies: 0 } },
      equipped: { weapon },
    });
    await page.goto("/");
    await startGame(page);
    const before = await game(page, ({ state }) => ({
      ...state.player.weapon,
      rate: state.player.attackSpeed,
    }));
    await page.evaluate(
      async ({ recipe }) => {
        const { player } = await import("/src/core/state.js");
        Object.assign(player.inventory, recipe.inventory);
        (await import("/src/core/events.js")).emit("levelUp");
      },
      { recipe },
    );
    const first = page.locator(".upgrade-option").first();
    await expect(first).toHaveClass(/rarity-evolution/);
    await expect(first).toContainText(recipe.name);
    await first.click();
    await expect(page.locator("#upgradeMenu")).toBeHidden();
    const after = await game(page, ({ state }) => ({
      ...state.player.weapon,
      rate: state.player.attackSpeed,
    }));
    expect(after).toMatchObject({ id: weapon, name: recipe.name, evolved: recipe.id, color: before.color });
    // L'arme évoluée est plus puissante : plus de dégâts, de projectiles, de rebonds ou de cadence
    const power = (w) =>
      (w.damage * w.projectiles * (1 + (w.chain || 0)) * (1 + (w.explosion || 0) / 100)) / w.rate;
    expect(power(after)).toBeGreaterThan(power(before));

    await game(page, ({ state }) => (state.player.autoShoot = true));
    await expect
      .poll(() => game(page, ({ state }) => state.game.kills), { timeout: 15_000 })
      .toBeGreaterThan(3);
    await killPlayer(page);
  });
}

test("une évolution d'arme exige l'arme équipée", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await page.goto("/");
  await startGame(page);
  const names = await page.evaluate(async () => {
    const { player } = await import("/src/core/state.js");
    Object.assign(player.inventory, { Mitraillette: 2, Perçage: 3, Sniper: 2 }); // blaster équipé
    const { availableEvolutions } = await import("/src/data/upgrades.js");
    return availableEvolutions(player).map((e) => e.name);
  });
  expect(names).toEqual([]);
  await killPlayer(page);
});
