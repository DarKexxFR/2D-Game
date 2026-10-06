// Classement mondial (Supabase simulé) et envoi des scores.
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

async function finishRun(page, xp) {
  await startGame(page);
  await game(page, ({ state }, xp) => (state.game.totalRunXp = xp), xp);
  await killPlayer(page);
}

test("onglet mondial : affiche les scores en texte (pas de HTML)", async ({ page, supabase }) => {
  supabase.scores = [
    { name: "<b>Hack</b>", wave: 12, xp: 9000, lvl: 20 },
    { name: "Bob", wave: 3, xp: 500, lvl: 4 },
  ];
  await page.goto("/");
  await page.locator("#btnLeaderboard").click();
  await expect(page.locator("#lbContent tr")).toHaveCount(2);
  await expect(page.locator("#lbContent")).toContainText("<b>Hack</b>");
  await page.locator("#lbTabLocal").click();
  await expect(page.locator("#lbContent")).toContainText("Aucun score");
});

test("classement indisponible : message de repli", async ({ page, supabase }) => {
  supabase.mode = "down";
  await page.goto("/");
  await page.locator("#btnLeaderboard").click();
  await expect(page.locator("#lbContent")).toContainText("indisponible");
});

test("envoi des scores selon le pseudo, l'XP et l'anti-spam", async ({ page, supabase }) => {
  await page.goto("/");

  await finishRun(page, 50); // pseudo par défaut
  await expect(page.locator("#onlineStatus")).toContainText("Choisis un pseudo");
  await page.locator("#btnGameOverMenu").click();

  await page.locator("#playerPseudo").fill("Reda");
  await page.locator("#playerPseudo").dispatchEvent("change");
  await finishRun(page, 0); // partie vide
  await expect(page.locator("#onlineStatus")).toHaveText("");
  await page.locator("#btnGameOverMenu").click();

  await finishRun(page, 50);
  await expect(page.locator("#onlineStatus")).toContainText("Score envoyé");
  await page.locator("#btnGameOverMenu").click();

  supabase.mode = "rateLimited";
  await finishRun(page, 50);
  await expect(page.locator("#onlineStatus")).toContainText("trop rapprochées");

  expect(supabase.posts).toHaveLength(2);
  expect(supabase.posts[0]).toMatchObject({ name: "Reda", xp: 50 });
});
