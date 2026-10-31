// Build de la partie : le menu Pause montre armes, évolutions et pouvoirs (icône, niveau, effet),
// l'écran de fin le reprend en icônes.
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

test("la pause montre les armes et les améliorations prises", async ({ page, isMobile }) => {
  test.skip(isMobile, "pause au clavier");
  await page.goto("/");
  await startGame(page);
  await game(page, ({ state, upgrades }) => {
    const p = state.player;
    const take = (name, n = 1) => {
      for (let i = 0; i < n; i++) upgrades.applyUpgrade(upgrades.cardByName(name), p);
    };
    take("Multi-Tir", 2);
    take("Force Brute");
    const missiles = upgrades.SIDE_WEAPON_CARDS.find((c) => c.sideWeapon === "missiles");
    upgrades.applyUpgrade(missiles, p);
    upgrades.applyUpgrade(missiles, p);
  });

  await page.keyboard.press("p");
  const view = page.locator("#pauseInventory .build-view");
  await expect(view).toBeVisible();
  await expect(page.locator("#pauseMeta")).toContainText("Vague 1");
  // Armes : l'arme équipée, les missiles niveau 2, deux emplacements libres
  await expect(view.locator(".bv-weapon")).toHaveCount(4);
  await expect(view.locator(".bv-weapon", { hasText: "Niveau 2" })).toBeVisible();
  await expect(view.locator(".bv-weapon.empty")).toHaveCount(2);
  // Pouvoirs : une tuile par pouvoir, avec son niveau et son effet ; la carte d'arme n'y est pas.
  // Les emplacements de pouvoir encore libres suivent.
  await expect(view).toContainText("Pouvoirs 2/8");
  await expect(view.locator(".bv-card:not(.empty)")).toHaveCount(2);
  await expect(view.locator(".bv-card.empty")).toHaveCount(6);
  const multi = view.locator(".bv-card", { hasText: "Multi-Tir" });
  await expect(multi.locator(".bv-count")).toHaveText("2");
  await expect(multi.locator(".bv-pips i.on")).toHaveCount(2);
  await expect(multi).toContainText("Projectile");
  await page.locator("#btnResume").click();

  await killPlayer(page);
  await expect(page.locator("#runBuild .build-view.compact .bv-card:not(.empty)")).toHaveCount(2);
});

test("sans amélioration, la pause le dit", async ({ page, isMobile }) => {
  test.skip(isMobile, "pause au clavier");
  await page.goto("/");
  await startGame(page);
  await page.keyboard.press("p");
  await expect(page.locator("#pauseInventory .bv-empty")).toBeVisible();
  await page.locator("#btnResume").click();
  await killPlayer(page);
});
