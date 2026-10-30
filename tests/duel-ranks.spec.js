// Rangs du duel classé (Bronze → Prédateur, data/duelRanks.js) : paliers, badge de l'accueil, carte de l'écran
// Duel, emblèmes du classement DUEL ELO. Le duel classé lui-même est testé dans versus-online.spec.js.
import { expect, game, logIn, test } from "./fixtures.js";

const rated = (name, rating, wins = 1, losses = 0) => ({ name, rating, wins, losses });

test("paliers d'ELO : rang, palier suivant, promotion et retour en arrière", async ({ page }) => {
  await page.goto("/");
  const res = await game(page, async () => {
    const { duelRankOf } = await import("/src/services/duelRanking.js");
    const { rankChangeText } = await import("/src/ui/duelRank.js");
    const at = (r) => {
      const { rank, next, progress } = duelRankOf(r);
      return [rank.name, next?.name ?? null, Math.round(progress * 100)];
    };
    return {
      ranks: [900, 1000, 1050, 1100, 1249, 1250, 1450, 1699, 1700, 2400].map(at),
      up: rankChangeText(1090, 1106),
      down: rankChangeText(1102, 1086),
      same: rankChangeText(1000, 1016),
      first: rankChangeText(null, 1016),
    };
  });
  expect(res.ranks).toEqual([
    ["Bronze", "Argent", 0],
    ["Bronze", "Argent", 0],
    ["Bronze", "Argent", 50],
    ["Argent", "Or", 0],
    ["Argent", "Or", 99],
    ["Or", "Diamant", 0],
    ["Diamant", "Prédateur", 0],
    ["Diamant", "Prédateur", 100],
    ["Prédateur", null, 100],
    ["Prédateur", null, 100],
  ]);
  expect(res).toMatchObject({ up: "PROMU ARGENT !", down: "Retour en Bronze", same: "", first: "" });
});

test("rang visible : accueil, écran Duel, classement DUEL ELO et caché sans duel compté", async ({
  page,
  supabase,
}) => {
  // Sans compte : aucun rang
  await page.goto("/");
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#homeRank")).toBeHidden();

  supabase.duel.ratings["moi@test.fr"] = rated("Moi", 1460, 12, 4);
  supabase.duel.ratings["top@test.fr"] = rated("Top", 1720, 30, 2);
  supabase.duel.ratings["neuf@test.fr"] = rated("Neuf", 1000, 0, 0); // aucun duel compté : hors classement
  await logIn(page, "moi@test.fr");
  await page.reload();

  // Badge de l'accueil : emblème Diamant, ouvre l'onglet DUEL ELO
  await expect(page.locator("#homeRank")).toBeVisible();
  await expect(page.locator("#homeRank")).toHaveAttribute("title", "Rang de duel : Diamant · 1460 ELO");
  await page.locator("#homeRank").click();
  await expect(page.locator("#leaderboardMenu")).toBeVisible();
  await expect(page.locator("#lbTabDuel")).toHaveClass(/active/);
  await expect(page.locator("#lbContent tr")).toHaveCount(2);
  await expect(page.locator("#lbContent tr").first().locator(".rank-predator")).toBeVisible();
  await expect(page.locator("#lbContent tr").nth(1).locator(".rank-diamond")).toBeVisible();
  await expect(page.locator("#lbMe")).toHaveText("Ta place : #2 · Diamant · 1460 ELO · 12 V / 4 D");

  // Écran Duel : carte du rang avec l'avancée vers le palier suivant (relue à l'ouverture)
  supabase.duel.ratings["moi@test.fr"].rating = 1690;
  await page.locator("#btnLeaderboardBack").click();
  await page.locator("#btnVersus").click();
  await expect(page.locator("#duelRankCard")).toBeVisible();
  await expect(page.locator("#duelRankName")).toHaveText("DIAMANT");
  await expect(page.locator("#duelRankElo")).toHaveText("1690 ELO");
  await expect(page.locator("#duelRankNext")).toHaveText("Encore 10 ELO pour Prédateur");

  // Un compte sans duel compté n'affiche pas de rang
  await logIn(page, "neuf@test.fr");
  await page.goto("/");
  await expect(page.locator("#mainMenu")).toBeVisible();
  await page.locator("#btnVersus").click();
  await expect(page.locator("#duelMenu")).toBeVisible();
  await expect(page.locator("#duelRankCard")).toBeHidden();
});
