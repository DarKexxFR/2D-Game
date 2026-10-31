// Forge de l'écran Équipement : 3 doublons de même emplacement et de même rareté + de l'or = un objet
// de la rareté au-dessus. Jamais de forge vers le mythique.
import { expect, game, test, withSave } from "./fixtures.js";

test("forger des armes rares donne une arme épique ; doublons et or retirés", async ({ page }) => {
  await withSave(page, {
    gold: 1000,
    items: {
      blaster: { level: 1, prestige: 1, copies: 0 },
      smg: { level: 1, prestige: 1, copies: 2 },
      shotgun: { level: 1, prestige: 1, copies: 1 },
    },
  });
  await page.goto("/");
  await page.locator("#btnInventory").click();
  await expect(page.locator("#forgePanel")).toContainText("FORGE");
  // Armes : commun → rare, rare → épique, épique → légendaire (jamais mythique)
  await expect(page.locator("#forgePanel .forge-row")).toHaveCount(3);
  const rare = page.locator('#forgePanel .forge-btn[data-rarity="rare"]');
  await expect(rare).toBeEnabled();
  await expect(page.locator('#forgePanel .forge-btn[data-rarity="common"]')).toBeDisabled();
  await rare.click();
  await expect(page.locator(".forge-result")).toBeVisible();
  const acc = await game(page, ({ storage, items }) => ({
    gold: storage.account.gold,
    copies: storage.account.items.smg.copies + storage.account.items.shotgun.copies,
    epic: Object.keys(storage.account.items).filter((id) => items.ITEMS[id].rarity === "epic").length,
    forges: storage.account.achievementStats.forges,
  }));
  expect(acc).toEqual({ gold: 1000 - 800 + 300, copies: 0, epic: 1, forges: 1 }); // + succès « Apprenti forgeron »
  await expect(rare).toBeDisabled();
});

test("démantèlement : un doublon légendaire donne des Éclats de Pulse ; attributs d'un mythique relancés ou ciblés", async ({
  page,
}) => {
  await withSave(page, {
    gold: 0,
    pulseShards: 0,
    items: {
      blaster: { level: 1, prestige: 1, copies: 0 },
      plasma: { level: 1, prestige: 1, copies: 7 },
      nova: { level: 1, prestige: 1, copies: 0 },
    },
  });
  await page.goto("/");
  await page.locator("#btnInventory").click();
  const row = page.locator('#forgePanel .dismantle-row[data-item="plasma"]');
  await expect(row).toContainText("Canon plasma ×7");
  for (let i = 0; i < 6; i++) await row.locator(".dismantle-btn").click();
  await expect(row).toContainText("×1");
  await expect(page.locator("#forgePanel .shard-pill")).toContainText("60");

  // Fiche du Lance-étoiles (mythique) : deux emplacements vides
  await page.locator(".item-card", { hasText: "Lance-étoiles" }).click();
  const slots = page.locator("#itemDetail .affix-row");
  await expect(slots).toHaveCount(2);
  await expect(slots.first()).toContainText("Emplacement vide");
  await slots.first().locator(".affix-reroll").click(); // 15 éclats, au hasard
  await expect(slots.first()).not.toContainText("Emplacement vide");
  await slots.nth(1).locator(".affix-select").selectOption("hunter");
  await slots.nth(1).locator(".affix-target").click(); // 45 éclats, au choix
  await expect(slots.nth(1)).toContainText("Chasseur de boss");

  const acc = await game(page, ({ storage }) => ({
    shards: storage.account.pulseShards,
    copies: storage.account.items.plasma.copies,
    affixes: storage.account.items.nova.affixes,
  }));
  expect(acc.shards).toBe(0);
  expect(acc.copies).toBe(1);
  expect(acc.affixes[1]).toBe("hunter");
  expect(acc.affixes[0]).not.toBe("hunter"); // jamais deux fois le même attribut
  await expect(slots.first().locator(".affix-reroll")).toBeDisabled(); // plus assez d'éclats

  // En partie, les attributs s'appliquent quand le mythique est équipé
  const boss = await game(page, async ({ state, storage, inventory }) => {
    const { applyEquipment } = await import("/src/systems/equipment.js");
    storage.account.items.nova.affixes = ["power", "hunter"];
    inventory.equip("nova");
    state.resetPlayer(1);
    const before = { attack: state.player.attack, boss: state.player.bossDamage };
    applyEquipment();
    return { before, boss: state.player.bossDamage };
  });
  expect(boss.boss).toBeCloseTo(boss.before.boss + 0.12);
});

test("démantèlement : rien à démanteler sans doublon légendaire ; jamais d'objet non légendaire", async ({
  page,
}) => {
  await withSave(page, {
    items: { blaster: { level: 1, prestige: 1, copies: 0 }, smg: { level: 1, prestige: 1, copies: 3 } },
  });
  await page.goto("/");
  await page.locator("#btnInventory").click();
  await expect(page.locator("#forgePanel .dismantle-empty")).toBeVisible();
  const gained = await game(page, ({ inventory, storage }) => ({
    gained: inventory.dismantle("smg"),
    copies: storage.account.items.smg.copies,
  }));
  expect(gained).toEqual({ gained: 0, copies: 3 });
});
