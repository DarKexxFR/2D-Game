// Pouvoirs limités : au plus POWER_RULES.slots pouvoirs différents, chacun monte de niveau jusqu'à son
// maximum ; quand tout est au maximum, des cartes de secours (soin, or) remplissent le choix. Deux pouvoirs
// fondus (fusion ou évolution) n'occupent qu'un emplacement.
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
      "Ricochet",
      "Épines",
    ];
    for (const name of names) applyUpgrade(upgrades.cardByName(name), p);
    const offered = availableUpgrades(p).filter((u) => u.power);
    // Un pouvoir au maximum n'est plus proposé
    const fb = upgrades.cardByName("Force Brute");
    while (fb.canApply(p)) applyUpgrade(fb, p);
    return {
      slots: POWER_RULES.slots,
      owned: ownedPowers(p).length,
      used: upgrades.usedPowerSlots(p),
      onlyOwned: offered.every((u) => names.includes(u.name)),
      newOffered: UPGRADES.some((u) => !names.includes(u.name) && u.canApply(p)),
      fbLevel: p.inventory["Force Brute"],
      fbMax: fb.max,
      fbOffered: availableUpgrades(p).includes(fb),
      sideWeaponsStillOffered: availableUpgrades(p).some((u) => u.sideWeapon),
    };
  });
  expect(r.slots).toBe(10);
  expect(r.owned).toBe(r.slots);
  expect(r.used).toBe(r.slots);
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
  await expect(page.locator("#upgradeSubtitle")).toHaveText("Pouvoirs 1/10");
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

test("fusion de pouvoirs : un seul emplacement, bonus, niveaux conservés", async ({ page, isMobile }) => {
  test.skip(isMobile, "logique pure : une seule plateforme suffit");
  await page.goto("/");
  await startGame(page);
  const r = await game(page, ({ state, upgrades }) => {
    const p = state.player;
    const take = (name, n) => {
      for (let i = 0; i < n; i++) upgrades.applyUpgrade(upgrades.cardByName(name), p);
    };
    const fusion = upgrades.POWER_FUSION_CARDS.find((f) => f.id === "fuPredator");
    take("Force Brute", 3);
    take("Sniper", 2);
    const notYet = fusion.canApply(p);
    take("Sniper", 1);
    const ready = fusion.canApply(p);
    const offeredFirst = upgrades.availableEvolutions(p).includes(fusion);
    const usedBefore = upgrades.usedPowerSlots(p);
    const attack = p.attack;
    upgrades.applyUpgrade(fusion, p);
    const brute = upgrades.cardByName("Force Brute");
    return {
      notYet,
      ready,
      offeredFirst,
      usedBefore,
      usedAfter: upgrades.usedPowerSlots(p),
      stronger: p.attack > attack,
      merged: p.mergedPowers,
      again: fusion.canApply(p),
      canStillLevel: brute.canApply(p),
      tradeable: upgrades.tradeableCards(p).map((t) => t.card.name),
      owned: upgrades.ownedEvolutions(p).map((e) => e.id),
    };
  });
  expect(r.notYet).toBe(false);
  expect(r.ready).toBe(true);
  expect(r.offeredFirst).toBe(true);
  expect(r.usedBefore).toBe(2);
  expect(r.usedAfter).toBe(1);
  expect(r.stronger).toBe(true);
  expect(r.merged).toEqual({ "Force Brute": "fuPredator", Sniper: "fuPredator" });
  expect(r.again).toBe(false);
  expect(r.canStillLevel).toBe(true); // un pouvoir fondu monte encore jusqu'à son maximum
  expect(r.tradeable).toEqual([]); // un pouvoir fondu ne se rend pas au Marchand Noir
  expect(r.owned).toContain("fuPredator");
});

test("les fusions de pouvoirs sont valides et une évolution libère aussi un emplacement", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "logique pure : une seule plateforme suffit");
  await page.goto("/");
  await startGame(page);
  const r = await game(page, ({ state, upgrades }) => {
    const powers = new Set(upgrades.UPGRADES.map((u) => u.name));
    const fusions = upgrades.POWER_FUSION_CARDS;
    const ids = new Set(fusions.map((f) => f.id));
    const bad = fusions.filter((f) => f.powers.length !== 2 || !f.powers.every((n) => powers.has(n)));
    const p = state.player;
    Object.assign(p.inventory, { Kunai: 5, "Multi-Tir": 1, Avidité: 1 });
    const before = upgrades.usedPowerSlots(p);
    upgrades.applyUpgrade(
      upgrades.EVOLUTIONS.find((e) => e.id === "bladeStorm"),
      p,
    );
    return {
      count: fusions.length,
      unique: ids.size,
      bad: bad.map((f) => f.id),
      before,
      after: upgrades.usedPowerSlots(p),
    };
  });
  expect(r.count).toBeGreaterThanOrEqual(14);
  expect(r.unique).toBe(r.count);
  expect(r.bad).toEqual([]);
  expect(r.before).toBe(3);
  expect(r.after).toBe(2);
});

test("la carte d'un ingrédient annonce la fusion visée", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await page.goto("/");
  await startGame(page);
  await page.evaluate(async () => {
    const upgrades = await import("/src/data/upgrades.js");
    const p = (await import("/src/core/state.js")).player;
    upgrades.applyUpgrade(upgrades.cardByName("Force Brute"), p);
    const sniper = upgrades.cardByName("Sniper");
    for (const u of [...upgrades.UPGRADES, ...upgrades.CORRUPTED_UPGRADES, ...upgrades.SIDE_WEAPON_CARDS])
      if (u !== sniper) u.canApply = () => false;
    (await import("/src/core/events.js")).emit("levelUp");
  });
  await expect(page.locator(".upgrade-option").first()).toContainText("Prédateur");
});
