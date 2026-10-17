// Saison mensuelle et passe gratuit (services/season.js, data/season.js) : XP de saison, paliers,
// skins exclusifs, changement de mois et classement de la saison.
import { expect, game, killPlayer, startGame, test, withSave } from "./fixtures.js";

const OCT_20 = new Date(Date.UTC(2026, 9, 20, 12, 0)); // saison 1 (octobre 2026)
const NOV_2 = new Date(Date.UTC(2026, 10, 2, 12, 0)); // saison 2

test("une saison par mois UTC, numéro et thème à tour de rôle", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const s = await import("/src/services/season.js");
    return {
      key: s.seasonKey(new Date(Date.UTC(2026, 9, 31, 23, 59))),
      next: s.seasonKey(new Date(Date.UTC(2026, 10, 1, 0, 0))),
      numbers: ["2026-10", "2026-11", "2027-02"].map(s.seasonNumber),
      themes: ["2026-10", "2026-11", "2027-02"].map((k) => s.seasonTheme(k).name),
      left: s.seasonTimeLeft(new Date(Date.UTC(2026, 9, 31, 23, 0))),
    };
  });
  expect(r.key).toBe("2026-10");
  expect(r.next).toBe("2026-11");
  expect(r.numbers).toEqual([1, 2, 5]);
  expect(r.themes).toEqual(["Néon", "Brasier", "Néon"]);
  expect(r.left).toBe(3_600_000);
});

test("une partie terminée donne de l'XP de saison, avec le bonus de la première du jour", async ({
  page,
}) => {
  await page.clock.setFixedTime(OCT_20);
  await withSave(page, { tutorialDone: true, lastFreeChest: Date.now() });
  await page.goto("/");
  await expect(page.locator("#homeSeasonName")).toHaveText("SAISON 1 · NÉON");
  await expect(page.locator("#homeSeasonTier")).toHaveText("Palier 0 / 30");

  const play = async () => {
    await startGame(page);
    await game(page, ({ state }) => {
      state.game.wave = 10;
      state.game.kills = 200;
      state.game.stats.bosses = 2;
    });
    await killPlayer(page);
  };
  await play();
  // 10 vagues × 10 + 2 boss × 30 + 200 × 0,05 = 170, + 150 (première partie du jour)
  await expect(page.locator("#runSeasonGain")).toHaveText("+320 XP de saison · bonus 1re partie du jour");
  await page.locator("#btnGameOverMenu").click();
  await play();
  await expect(page.locator("#runSeasonGain")).toHaveText("+170 XP de saison");
  const season = await game(page, ({ storage }) => storage.account.season);
  expect(season).toMatchObject({ id: "2026-10", xp: 490, claimed: [] });
  await page.locator("#btnGameOverMenu").click();
  await expect(page.locator("#homeSeasonTier")).toHaveText("Récompense à récupérer !");
});

test("écran du passe : paliers atteints, tout récupérer, skin exclusif débloqué", async ({ page }) => {
  await page.clock.setFixedTime(OCT_20);
  await withSave(page, {
    gold: 0,
    tutorialDone: true,
    lastFreeChest: Date.now(),
    season: { id: "2026-10", xp: 10 * 400 + 150, claimed: [], firstRunDay: "" },
  });
  await page.goto("/");
  await expect(page.locator("#btnSeason")).toHaveClass(/has-new/);
  await page.locator("#btnSeason").click();
  await expect(page.locator("#seasonMenu")).toBeVisible();
  await expect(page).toHaveURL(/#modal=saison$/);
  await expect(page.locator("#seasonTitle")).toHaveText("SAISON 1 · NÉON");
  await expect(page.locator("#seasonTier")).toHaveText("10");
  await expect(page.locator("#seasonXpText")).toHaveText("150 / 400 XP vers le palier 11");
  await expect(page.locator(".season-tier")).toHaveCount(30);
  await expect(page.locator(".season-tier.ready")).toHaveCount(10);

  // Un palier seul, puis tous les autres
  await page.locator(".season-tier.ready .season-claim").first().click();
  await expect(page.locator(".season-tier.claimed")).toHaveCount(1);
  await expect(page.locator("#seasonClaimMsg")).toContainText("or");
  await page.locator("#btnSeasonClaimAll").click();
  await expect(page.locator(".season-tier.claimed")).toHaveCount(10);
  await expect(page.locator("#btnSeasonClaimAll")).toBeDisabled();
  await expect(page.locator("#seasonClaimMsg")).toContainText("Traînée Comète débloquée");
  const account = await game(page, ({ storage }) => ({
    owned: storage.account.skinsOwned,
    gold: storage.account.gold,
    items: Object.keys(storage.account.items).length,
  }));
  expect(account.owned).toContain("trail:comet");
  expect(account.gold).toBeGreaterThan(0);

  // Le skin de saison se choisit dans l'écran Skins ; celui du palier 30 reste exclusif, pas à vendre
  await page.goto("/#modal=skins");
  await page.locator('[data-part="trail"] [data-value="comet"]').click();
  await expect(page.locator('[data-part="trail"] [data-value="comet"]')).toHaveClass(/on/);
  await page.locator('[data-part="hull"] [data-value="nova"]').click();
  await expect(page.locator("#skinBuyText")).toContainText("exclusive du passe de saison");
  await expect(page.locator("#btnSkinBuy")).toBeDisabled();
});

test("nouveau mois : récompenses oubliées données d'office, passe remis à zéro", async ({ page }) => {
  await page.clock.setFixedTime(NOV_2);
  await withSave(page, {
    gold: 0,
    tutorialDone: true,
    lastFreeChest: Date.now(),
    season: { id: "2026-10", xp: 3 * 400, claimed: [1], firstRunDay: "" },
  });
  await page.goto("/");
  await expect(page.locator("#achievementToast")).toContainText("Saison 1 terminée : 2 récompense(s)");
  await expect(page.locator("#homeSeasonName")).toHaveText("SAISON 2 · BRASIER");
  const account = await game(page, ({ storage }) => ({
    season: storage.account.season,
    gold: storage.account.gold,
    chests: storage.account.achievementStats.chests,
  }));
  expect(account.season).toMatchObject({ id: "2026-11", xp: 0, claimed: [] });
  expect(account.gold).toBe(100); // palier 2 : 100 or (le palier 3 est un coffre)
  expect(account.chests).toBe(1);
});

test("une quête récupérée rapporte de l'XP de saison", async ({ page }) => {
  await page.clock.setFixedTime(OCT_20);
  await withSave(page, { tutorialDone: true, lastFreeChest: Date.now() });
  await page.goto("/");
  const xp = await page.evaluate(async () => {
    const q = await import("/src/services/quests.js");
    const { account } = await import("/src/services/storage.js");
    const { quests } = q.getWeeklyQuests();
    for (const s of account.weekly.quests) s.progress = 1e9;
    q.claimQuest(quests[0].id);
    const one = account.season.xp;
    q.claimQuest(quests[1].id);
    q.claimQuest(quests[2].id); // les trois : bonus de la semaine
    return [one, account.season.xp];
  });
  expect(xp).toEqual([200, 900]);
});

test("classement : onglets Saison et Endless", async ({ page, supabase }) => {
  await page.clock.setFixedTime(OCT_20);
  supabase.scores = [{ name: "Ace", wave: 33, xp: 9000, lvl: 40, pulse: 3, nightmare: true }];
  await page.goto("/");
  await page.locator("#btnLeaderboard").click();
  await page.locator("#lbTabSeason").click();
  await expect(page.locator("#lbMe")).toContainText("Saison 1 · remise à zéro dans 11j");
  await expect(page.locator("#lbContent")).toContainText("Ace");
  await page.locator("#lbTabEndless").click();
  await expect(page.locator("#leaderboardMenu #lbCol3")).toHaveText("PULSE");
  await expect(page.locator("#lbContent tr").first()).toContainText("Ace ☠");
  await expect(page.locator("#lbContent tr td").nth(2)).toHaveText("3");
});
