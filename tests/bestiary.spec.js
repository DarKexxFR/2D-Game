// Bestiaire : fiches débloquées en éliminant chaque type d'ennemi, page wiki à part (bestiaire.html).
import { expect, game, killPlayer, startGame, test, withSave } from "./fixtures.js";

test("chaque type d'ennemi a sa fiche, avec un lieu d'apparition", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await page.goto("/");
  const check = await page.evaluate(async () => {
    const { BESTIARY, BESTIARY_TYPES, whereText } = await import("/src/data/bestiary.js");
    const { ENEMY_NAMES, ENEMY_TYPES } = await import("/src/data/enemies.js");
    const { ENEMY_LOOKS } = await import("/src/render/enemyLooks.js");
    return {
      missing: Object.keys(ENEMY_TYPES).filter((t) => !BESTIARY[t]),
      unknown: BESTIARY_TYPES.filter((t) => !ENEMY_TYPES[t] || !ENEMY_NAMES[t] || !ENEMY_LOOKS[t]),
      noWhere: BESTIARY_TYPES.filter((t) => !whereText(t)),
      incomplete: BESTIARY_TYPES.filter(
        (t) => !BESTIARY[t].desc || !BESTIARY[t].tip || !BESTIARY[t].skills.length,
      ),
    };
  });
  expect(check).toEqual({ missing: [], unknown: [], noWhere: [], incomplete: [] });
});

test("éliminer un nouveau type débloque sa fiche (notification, compteur, succès)", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  const result = await game(page, async ({ state, combat, spawner, storage }) => {
    state.game.spawnTimer = 1e9;
    state.game.modifier.mobCount = 0;
    storage.account.bestiary = {};
    spawner.spawnEnemy("scorpion", state.player.worldX + 300, state.player.worldY);
    combat.killEnemy(state.world.enemies[state.world.enemies.length - 1]);
    return { ...storage.account.bestiary };
  });
  expect(result).toEqual({ scorpion: 1 });
  await expect(page.locator("#achievementToast")).toContainText("Scorpion");
  await expect(page.locator("#achievementToast")).toContainText("fiche 1/");

  // 10 fiches : succès « Naturaliste »
  const unlocked = await game(page, ({ state, combat, spawner, storage }) => {
    for (const type of [
      "normal",
      "fast",
      "tank",
      "ranged",
      "kamikaze",
      "shield",
      "golem",
      "spore",
      "bomber",
    ]) {
      spawner.spawnEnemy(type, state.player.worldX + 300, state.player.worldY);
      combat.killEnemy(state.world.enemies[state.world.enemies.length - 1]);
    }
    return storage.account.achievements.includes("bestiary_10");
  });
  expect(unlocked).toBe(true);
  await killPlayer(page);
});

test("une ancienne sauvegarde retrouve les boss déjà vaincus", async ({ page }) => {
  await withSave(page, { level: 3, achievementStats: { kills: 50, kill_boss: 2, kill_goblin: 1 } });
  await page.goto("/");
  const bestiary = await game(page, ({ storage }) => storage.account.bestiary);
  expect(bestiary).toEqual({ normal: 1, boss: 2, goblin: 1 });
});

test("la page du bestiaire montre les fiches débloquées et cache les autres", async ({ page }) => {
  await withSave(page, { level: 3, bestiary: { normal: 12, slime_boss: 1 } });
  await page.goto("/bestiaire.html");
  await expect(page.locator("#bsFound")).toHaveText("2");
  await expect(page.locator(".bs-card")).toHaveCount(
    await page.evaluate(async () => (await import("/src/data/bestiary.js")).BESTIARY_TYPES.length),
  );
  await expect(page.locator(".bs-card.locked")).toHaveCount((await page.locator(".bs-card").count()) - 2);
  await expect(page.locator('.bs-card[data-type="normal"]')).toContainText("Drone-insecte");
  await expect(page.locator('.bs-card[data-type="normal"]')).toContainText("12 éliminés");
  await expect(page.locator('.bs-card[data-type="kraken"]')).toContainText("???");

  // Fiche débloquée : statistiques, capacités et astuce ; l'adresse permet d'y revenir
  await page.locator('.bs-card[data-type="slime_boss"]').click();
  const entry = page.locator("#bsEntry");
  await expect(entry).toBeVisible();
  await expect(entry).toContainText("Roi Slime");
  await expect(entry).toContainText("Capacités");
  await expect(entry).toContainText("Astuce");
  await expect(entry).toContainText("Vagues 8, 16");
  expect(page.url()).toContain("#fiche-slime_boss");
  await page.locator(".bs-close").click();
  await expect(entry).toBeHidden();

  // Fiche verrouillée : où le trouver, mais ni nom ni capacités
  await page.locator('.bs-card[data-type="kraken"]').click();
  await expect(entry).toContainText("Fiche verrouillée");
  await expect(entry).toContainText("Vagues 11");
  await expect(entry).not.toContainText("Capacités");
  await page.keyboard.press("Escape");

  // Filtre et recherche
  await page.locator(".bs-chip", { hasText: "Boss" }).first().click();
  await expect(page.locator(".bs-group")).toHaveCount(1);
  await page.locator(".bs-chip", { hasText: "Tous" }).click();
  await page.locator("#bsSearch").fill("insecte");
  await expect(page.locator(".bs-card")).toHaveCount(1);
  await page.locator("#bsSearch").fill("scorpion"); // fiche verrouillée : introuvable par son nom
  await expect(page.locator(".bs-empty")).toBeVisible();

  // Lien direct vers une fiche
  await page.goto("/bestiaire.html#fiche-normal");
  await expect(page.locator("#bsEntry")).toContainText("Drone-insecte");
});

test("lien vers le bestiaire depuis l'accueil et les succès", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".home-bestiary")).toHaveAttribute("href", "bestiaire.html");
  await page.locator("#btnAchievements").click();
  await expect(page.locator("#btnBestiary")).toBeVisible();
  await expect(page.locator("#bestiaryCount")).toHaveText(/^\d+\/\d+ fiches$/);
});
