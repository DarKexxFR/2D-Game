// Pouvoirs limités : au plus POWER_RULES.slots pouvoirs différents, chacun monte de niveau jusqu'à son
// maximum ; quand tout est au maximum, des cartes de secours (soin, or) remplissent le choix.
import { expect, game, startGame, test } from "./fixtures.js";

test("emplacements pleins : seuls les pouvoirs possédés sont encore proposés", async ({ page, isMobile }) => {
  test.skip(isMobile, "logique pure : une seule plateforme suffit");
  await page.goto("/");
  await startGame(page);
  const r = await game(page, ({ state, upgrades }) => {
    const p = state.player;
    const { POWER_RULES, UPGRADES, availableUpgrades, applyUpgrade, ownedPowers } = upgrades;
    const names = [
      "Force Brute",
      "Vitalité",
      "Avidité",
      "Recul",
      "Perçage",
      "Régénération",
      "Aimant",
      "Sniper",
    ];
    for (const name of names) applyUpgrade(upgrades.cardByName(name), p);
    const offered = availableUpgrades(p).filter((u) => u.power);
    // Un pouvoir au maximum n'est plus proposé
    const fb = upgrades.cardByName("Force Brute");
    while (fb.canApply(p)) applyUpgrade(fb, p);
    return {
      slots: POWER_RULES.slots,
      owned: ownedPowers(p).length,
      onlyOwned: offered.every((u) => names.includes(u.name)),
      newOffered: UPGRADES.some((u) => !names.includes(u.name) && u.canApply(p)),
      fbLevel: p.inventory["Force Brute"],
      fbMax: fb.max,
      fbOffered: availableUpgrades(p).includes(fb),
      sideWeaponsStillOffered: availableUpgrades(p).some((u) => u.sideWeapon),
    };
  });
  expect(r.owned).toBe(r.slots);
  expect(r.onlyOwned).toBe(true);
  expect(r.newOffered).toBe(false);
  expect(r.fbLevel).toBe(r.fbMax);
  expect(r.fbOffered).toBe(false);
  expect(r.sideWeaponsStillOffered).toBe(true); // les armes d'appoint ont leurs propres emplacements
});

test("une carte corrompue prend un emplacement de pouvoir", async ({ page, isMobile }) => {
  test.skip(isMobile, "logique pure : une seule plateforme suffit");
  await page.goto("/");
  await startGame(page);
  const r = await game(page, ({ state, upgrades }) => {
    const p = state.player;
    const glass = upgrades.cardByName("Cœur de verre");
    upgrades.applyUpgrade(glass, p);
    return { owned: upgrades.ownedPowers(p), again: glass.canApply(p) };
  });
  expect(r.owned).toEqual(["Cœur de verre"]);
  expect(r.again).toBe(false);
});

test("la carte montre le niveau visé et les emplacements", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await page.goto("/");
  await startGame(page);
  await page.evaluate(async () => {
    const upgrades = await import("/src/data/upgrades.js");
    const p = (await import("/src/core/state.js")).player;
    const orb = upgrades.cardByName("Orbe Protecteur");
    upgrades.applyUpgrade(orb, p);
    // seule la carte Orbe reste proposable
    for (const u of [...upgrades.UPGRADES, ...upgrades.CORRUPTED_UPGRADES, ...upgrades.SIDE_WEAPON_CARDS])
      if (u !== orb) u.canApply = () => false;
    (await import("/src/core/events.js")).emit("levelUp");
  });
  expect(await game(page, ({ state }) => state.player.orbitals)).toBe(2); // niveau 1 : deux orbes
  const first = page.locator(".upgrade-option").first();
  await expect(first).toContainText("Orbe Protecteur · niv. 2/5");
  await expect(page.locator("#upgradeSubtitle")).toHaveText("Pouvoirs 1/8");
});

test("tout au maximum : cartes de secours (soin et or)", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await page.goto("/");
  await startGame(page);
  await page.evaluate(async () => {
    const upgrades = await import("/src/data/upgrades.js");
    for (const u of [...upgrades.UPGRADES, ...upgrades.CORRUPTED_UPGRADES, ...upgrades.SIDE_WEAPON_CARDS])
      u.canApply = () => false;
    (await import("/src/core/events.js")).emit("levelUp");
  });
  const cards = page.locator(".upgrade-option");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("Réparation");
  await expect(cards.nth(1)).toContainText("Butin");
  const before = await game(page, ({ state }) => state.game.runGold);
  await cards.nth(1).click();
  await expect(page.locator("#upgradeMenu")).toBeHidden();
  const after = await game(page, ({ state }) => ({
    gold: state.game.runGold,
    inventory: Object.keys(state.player.inventory),
  }));
  expect(after.gold).toBeGreaterThan(before);
  expect(after.inventory).toEqual([]); // une carte de secours n'est pas un pouvoir
});
