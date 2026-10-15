// Améliorations de l'équipement : effets de prestige ★3, panoplies, modules, héros et familier
// mythiques, comparaison, équipements enregistrés et offre du jour.
import { expect, game, killPlayer, startGame, test, withSave } from "./fixtures.js";

const own = (ids, prestige = 1) =>
  Object.fromEntries(ids.map((id) => [id, { level: 1, prestige, copies: 0 }]));

/** Tue le joueur même s'il a des résurrections (Phénix, Égide céleste ★3). */
async function killForGood(page) {
  await game(page, ({ state }) => (state.player.revives = 0));
  await killPlayer(page);
}

test("effet ★3 : seulement à partir du prestige 3", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await withSave(page, {
    lastFreeChest: Date.now(),
    items: { ...own(["blaster", "pilot"]), plated: { level: 1, prestige: 2, copies: 0 } },
    equipped: { armor: "plated" },
  });
  await page.goto("/");
  await startGame(page);
  expect(await game(page, ({ state }) => state.player.damageTaken)).toBe(1);
  await killPlayer(page);
  await game(page, ({ storage }) => (storage.account.items.plated.prestige = 3));
  await page.locator("#btnGameOverMenu").click();
  await startGame(page);
  const p = await game(page, ({ state }) => ({
    taken: state.player.damageTaken,
    perks: Object.keys(state.player.perks),
  }));
  expect(p.taken).toBeCloseTo(0.9);
  expect(p.perks).toContain("plated");
  await killPlayer(page);
});

test("fiche d'objet : effet ★3, panoplie et comparaison avec l'objet équipé", async ({ page }) => {
  await withSave(page, {
    lastFreeChest: Date.now(),
    items: { ...own(["blaster", "pilot", "smg"]), vest: { level: 1, prestige: 3, copies: 0 } },
    equipped: { weapon: "blaster", armor: "vest" },
  });
  await page.goto("/");
  await page.locator("#btnInventory").click();
  await page.locator(".item-card", { hasText: "Mitrailleur" }).click();
  const detail = page.locator("#itemDetail");
  await expect(detail.locator(".perk-line")).toContainText("Balles incendiaires");
  await expect(detail.locator(".perk-line")).not.toHaveClass(/unlocked/);
  await expect(detail.locator(".set-line")).toContainText("Panoplie Commando");
  await expect(detail.locator(".compare")).toContainText("Par rapport à Blaster");
  await expect(detail.locator(".compare-chip.up").first()).toBeVisible(); // cadence en hausse
  await expect(detail.locator(".compare-chip.down").first()).toBeVisible(); // dégâts en baisse
  await detail.locator("button", { hasText: "ÉQUIPER" }).click();
  await expect(page.locator("#activeSet")).toContainText("Panoplie Commando active");

  await page.locator("#invTabArmor").click();
  await page.locator(".item-card", { hasText: "Gilet tactique" }).click();
  await expect(detail.locator(".perk-line.unlocked")).toContainText("Réflexe");
  await expect(detail.locator(".set-line.active")).toBeVisible();
});

test("panoplie Stellaire : des étoiles tombent sur les ennemis", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await withSave(page, {
    lastFreeChest: Date.now(),
    items: own(["pilot", "nova", "aegis"]),
    equipped: { weapon: "nova", armor: "aegis" },
  });
  await page.goto("/");
  await startGame(page);
  expect(await game(page, ({ state }) => state.player.set?.id)).toBe("stellar");
  await game(page, ({ state }) => (state.player.autoShoot = false));
  await expect
    .poll(() => game(page, ({ state }) => state.game.stats.damage.perk || 0), { timeout: 15_000 })
    .toBeGreaterThan(0);
  await killForGood(page);
});

test("module : équipé depuis l'écran Équipement et appliqué en partie", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await withSave(page, { lastFreeChest: Date.now(), items: own(["blaster", "pilot", "powerChip"]) });
  await page.goto("/");
  const base = await game(page, async ({ state }) => state.player.attack);
  await page.locator("#btnInventory").click();
  await page.locator("#invTabModule").click();
  await page.locator(".item-card", { hasText: "Puce de puissance" }).click();
  await page.locator("#itemDetail button", { hasText: "ÉQUIPER" }).click();
  await expect(page.locator("#equippedModule")).toContainText("Puce de puissance");
  await page.locator("#btnInventoryBack").click();
  await page.locator("#btnPlay").click();
  const p = await game(page, ({ state }) => ({ id: state.player.module?.id, attack: state.player.attack }));
  expect(p.id).toBe("powerChip");
  if (base) expect(p.attack).toBeGreaterThan(base);
  await killPlayer(page);
});

test("Phénix : tire et ramène le joueur à la vie une fois", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await withSave(page, {
    lastFreeChest: Date.now(),
    items: own(["blaster", "seraph", "phoenix"]),
    equipped: { hero: "seraph", pet: "phoenix" },
  });
  await page.goto("/");
  await page.locator("#btnPlay").click();
  expect(await game(page, ({ state }) => state.player.revives)).toBe(1);
  await game(page, ({ state }) => (state.player.autoShoot = true));
  await expect
    .poll(() => game(page, ({ state }) => state.game.stats.damage.pet || 0), { timeout: 15_000 })
    .toBeGreaterThan(0);
  await game(page, ({ player }) => player.takeDamage(1e9)); // première mort : le Phénix ramène
  expect(await game(page, ({ state }) => ({ over: state.game.over, hp: state.player.health > 0 }))).toEqual({
    over: false,
    hp: true,
  });
  await killPlayer(page);
});

test("tous les effets ★3 et panoplies tournent en partie sans erreur", async ({ page, isMobile }) => {
  test.setTimeout(120_000);
  test.skip(isMobile, "une seule plateforme suffit");
  const ids = await (async () => {
    await page.goto("/");
    // Armes et armures dans l'ordre des panoplies : chaque manche porte une panoplie complète
    return game(page, async ({ items }) => {
      const { SETS } = await import("/src/data/perks.js");
      return {
        weapon: SETS.map((s) => s.weapon),
        armor: SETS.map((s) => s.armor),
        hero: Object.keys(items.HEROES),
        pet: Object.keys(items.PETS),
        module: Object.keys(items.MODULES),
        count: { weapon: Object.keys(items.WEAPONS).length, armor: Object.keys(items.ARMORS).length },
      };
    });
  })();
  const { count, ...lists } = ids;
  expect(lists.weapon.length).toBe(count.weapon); // une panoplie par arme
  expect(new Set(lists.armor).size).toBe(count.armor); // et par armure
  const rounds = Math.max(...Object.values(lists).map((l) => l.length));
  const all = Object.values(lists).flat();
  await game(
    page,
    ({ storage }, list) => {
      for (const id of list) storage.account.items[id] = { level: 30, prestige: 3, copies: 0 };
    },
    all,
  );
  for (let i = 0; i < rounds; i++) {
    const equipped = Object.fromEntries(
      Object.entries(ids).map(([slot, list]) => [slot, list[i % list.length]]),
    );
    await game(page, ({ storage }, eq) => Object.assign(storage.account.equipped, eq), equipped);
    await startGame(page);
    await game(page, ({ state }) => {
      state.player.autoShoot = true;
      state.game.wave = 6;
    });
    // Dash, coups reçus, montée de niveau et gemmes : déclenche tous les types d'effets
    for (let k = 0; k < 4; k++) {
      await game(page, ({ input, player }) => {
        input.setVirtualAction("dash", true);
        player.takeDamage(5);
        player.gainXp(1e3);
      });
      await page.waitForTimeout(150);
      await game(page, ({ input }) => input.setVirtualAction("dash", false));
      if (await page.locator("#upgradeMenu").isVisible()) await page.keyboard.press("1");
      await page.waitForTimeout(500);
    }
    await expect
      .poll(() => game(page, ({ state }) => state.game.kills), { timeout: 15_000 })
      .toBeGreaterThan(3);
    await killForGood(page);
    await page.locator("#btnGameOverMenu").click();
  }
});

test("équipements enregistrés : enregistrer puis recharger", async ({ page }) => {
  await withSave(page, {
    lastFreeChest: Date.now(),
    items: own(["blaster", "pilot", "smg", "vest", "drone"]),
    equipped: { weapon: "smg", armor: "vest", pet: "drone" },
  });
  await page.goto("/");
  await page.locator("#btnInventory").click();
  await expect(page.locator(".loadout-load").first()).toBeDisabled();
  await page.locator(".loadout-save").first().click();
  await expect(page.locator(".loadout").first()).toHaveClass(/active/);
  await page.locator(".item-card", { hasText: "Blaster" }).click();
  await page.locator("#itemDetail button", { hasText: "ÉQUIPER" }).click();
  await expect(page.locator(".loadout").first()).not.toHaveClass(/active/);
  await page.locator(".loadout-load").first().click();
  await expect(page.locator("#equippedWeapon")).toContainText("Mitrailleur");
  const acc = await game(page, ({ storage }) => JSON.parse(JSON.stringify(storage.account)));
  expect(acc.equipped).toMatchObject({ weapon: "smg", armor: "vest", pet: "drone" });
  expect(acc.loadouts[0]).toMatchObject({ weapon: "smg", armor: "vest", pet: "drone" });
});

test("offre du jour : un objet à prix fixe, une seule fois par jour", async ({ page }) => {
  await withSave(page, { gold: 10_000, lastFreeChest: Date.now() });
  await page.goto("/");
  const offer = await game(page, ({ inventory }) => {
    const o = inventory.dailyOffer();
    return { id: o.item.id, rarity: o.item.rarity, price: o.price };
  });
  expect(offer.rarity).not.toBe("mythic");
  await page.locator("#btnShop").click();
  await expect(page.locator("#dailyOfferCard")).toBeVisible();
  await page.locator("#btnDailyOffer").click();
  await expect(page.locator("#chestReveal")).toBeVisible();
  await expect(page.locator("#btnChestAgain")).toBeHidden();
  await page.locator("#btnChestOk").click();
  await expect(page.locator("#btnDailyOffer")).toBeDisabled();
  await expect(page.locator("#btnDailyOffer")).toHaveText("ACHETÉ");
  const acc = await game(page, ({ storage }) => JSON.parse(JSON.stringify(storage.account)));
  expect(acc.gold).toBe(10_000 - offer.price);
  expect(acc.items[offer.id]).toBeTruthy();
  expect(acc.dailyOffer.bought).toBe(true);
});
