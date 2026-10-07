// Évolutions d'armes : proposées en priorité quand la recette est complète, puis actives en jeu.
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

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
