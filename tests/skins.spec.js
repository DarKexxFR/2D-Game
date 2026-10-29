// Skins : personnalisation du vaisseau (forme, couleurs du vaisseau, des tirs et de la traînée).
import { expect, game, killPlayer, startGame, test, withSave } from "./fixtures.js";

const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("survivor_save_v11")));

test("choisir des couleurs, essayer puis acheter une forme", async ({ page }) => {
  await withSave(page, { gold: 2000, lastFreeChest: Date.now() });
  await page.goto("/");
  await page.locator("#btnSkins").click();
  await expect(page.locator("#skinMenu")).toBeVisible();
  await expect(page).toHaveURL(/#modal=skins$/);
  await expect(page.locator("#skinGoldDisplay")).toHaveText("2000");

  // Couleur offerte : appliquée et sauvegardée tout de suite
  await page.locator('[data-part="ship"] [data-value="#ff2a6d"]').click();
  await page.locator('[data-part="shot"] [data-value="#00ff88"]').click();
  await page.locator('[data-part="trail"] [data-value="ribbon"]').click();
  await expect(page.locator('[data-part="ship"] [data-value="#ff2a6d"]')).toHaveClass(/\bon\b/);
  expect((await saved(page)).skin).toMatchObject({ ship: "#ff2a6d", shot: "#00ff88", trail: "ribbon" });

  // Forme payante : à l'essai dans l'aperçu, rien n'est dépensé avant l'achat
  const phoenix = page.locator('[data-part="hull"] [data-value="phoenix"]');
  await expect(phoenix).toHaveClass(/locked/);
  await phoenix.click();
  await expect(phoenix).toHaveClass(/trial/);
  await expect(page.locator("#skinBuyBar")).toBeVisible();
  expect((await saved(page)).skin.hull).toBe("hero");
  await page.locator("#btnSkinBuy").click();
  await expect(page.locator("#skinBuyBar")).toBeHidden();
  await expect(page.locator("#skinGoldDisplay")).toHaveText("500");
  await expect(phoenix).toHaveClass(/\bon\b/);
  const s = await saved(page);
  expect(s.skin.hull).toBe("phoenix");
  expect(s.skinsOwned).toEqual(["hull:phoenix"]);
  expect(s.gold).toBe(500);

  // Pas assez d'or : bouton désactivé, et l'essai est oublié en quittant
  await page.locator('[data-part="trail"] [data-value="flames"]').click();
  await expect(page.locator("#btnSkinBuy")).toBeDisabled();
  await expect(page.locator("#btnSkinBuy")).toContainText("IL MANQUE 500");
  await page.locator("#btnSkinsBack").click();
  await expect(page.locator("#mainMenu")).toBeVisible();
  expect((await saved(page)).skin.trail).toBe("ribbon");
  await expect(page.locator("#acGoldDisplay")).toHaveText("500");
});

test("le skin s'applique en partie : tirs colorés et traînée", async ({ page }) => {
  await withSave(page, {
    lastFreeChest: Date.now(),
    skin: { hull: "star", ship: "#ffd700", shot: "rainbow", trail: "sparks", trailColor: "#ff00ff" },
    skinsOwned: ["hull:star", "rainbow", "trail:sparks"],
  });
  await page.goto("/");
  await startGame(page);
  await game(page, ({ state }) => (state.player.autoShoot = true));
  await page.keyboard.down("ArrowRight");
  // Lu d'un seul tenant : la traînée s'efface au fil des ticks
  await expect
    .poll(() => game(page, ({ state }) => (state.world.trail.length > 3 ? state.world.trail[0] : null)), {
      timeout: 10_000,
    })
    .toMatchObject({ style: "sparks", color: "#ff00ff" });
  await page.keyboard.up("ArrowRight");
  // Arc-en-ciel : chaque tir prend une teinte du cycle (et jamais la couleur de l'arme). Tirs lancés à la
  // main d'un seul tenant : en jeu, un ennemi collé au vaisseau prend chaque tir dans le tick même où il part
  const colors = await game(page, ({ state, spawner, combat }) => {
    const p = state.player;
    spawner.spawnEnemy("tank", p.worldX + 300, p.worldY);
    combat.rebuildEnemyGrid();
    const out = [];
    for (let i = 0; i < 3; i++) {
      p.lastAttack = -1e9;
      const before = state.world.projectiles.length;
      combat.shoot();
      out.push(...state.world.projectiles.slice(before).map((pr) => pr.color));
    }
    return out;
  });
  expect(colors.length).toBeGreaterThan(0);
  for (const c of colors) {
    expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(c).not.toBe("#ffff00");
  }
  await killPlayer(page);
});

test("une option non achetée ou invalide reprend sa valeur par défaut", async ({ page }) => {
  await withSave(page, {
    lastFreeChest: Date.now(),
    skin: { hull: "phoenix", ship: "pas une couleur", shot: "#123456", trail: "inconnue" },
  });
  await page.goto("/");
  const look = await page.evaluate(async () => {
    const skins = await import("/src/services/skins.js");
    const { HEROES } = await import("/src/data/items.js");
    return { skin: skins.currentSkin(), look: skins.shipLook(HEROES.pilot) };
  });
  // La forme Phénix n'a pas été achetée : retour à la forme du héros
  expect(look.skin).toEqual({ hull: "hero", ship: null, shot: "#123456", trail: "none", trailColor: null });
  expect(look.look).toMatchObject({ hull: "arrow", color: "#00ccff", trail: "none" });
});

test("un lien ouvre l'écran des skins", async ({ page }) => {
  await page.goto("/#modal=skins");
  await expect(page.locator("#skinMenu")).toBeVisible();
  await expect(page.locator('[data-part="hull"] .skin-chip')).toHaveCount(17);
  await page.goBack();
  await expect(page.locator("#mainMenu")).toBeVisible();
});
