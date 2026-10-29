// Statistiques de fréquentation anonymes (services/analytics.js) et page de suivi stats.html.
import { expect, game, killPlayer, logIn, startGame, test, withSave } from "./fixtures.js";

const calls = (supabase, rpc) => supabase.analytics.filter((c) => c.rpc === rpc).map((c) => c.args);

test("session anonyme à l'ouverture, une ligne par partie (fin et abandon)", async ({ page, supabase }) => {
  await withSave(page, { tutorialDone: true, lastFreeChest: Date.now() });
  await page.goto("/");
  await expect.poll(() => calls(supabase, "track_session").length).toBeGreaterThan(0);
  const [first] = calls(supabase, "track_session");
  expect(first.p_device).toMatch(/^[0-9a-f-]{36}$/);
  expect(first.p_session).toMatch(/^[0-9a-f-]{36}$/);
  expect(first.p_host).toBe("localhost");
  expect(first).not.toHaveProperty("p_name"); // ni pseudo ni compte
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("survivor_app")).analytics.id);
  expect(stored).toBe(first.p_device);

  await startGame(page);
  await game(page, ({ state }) => (state.game.wave = 7));
  await killPlayer(page);
  await expect.poll(() => calls(supabase, "track_run").length).toBe(1);
  expect(calls(supabase, "track_run")[0]).toMatchObject({
    p_session: first.p_session,
    p_device: first.p_device,
    p_mode: "normal",
    p_difficulty: "normal",
    p_wave: 7,
    p_victory: false,
  });

  // Abandonner une partie en cours compte comme un abandon (QUITTER la sauvegarde : rien n'est compté)
  await page.locator("#btnReplay").click();
  await expect(page.locator("#ui")).toBeVisible();
  await page.keyboard.press("Escape");
  page.once("dialog", (d) => d.accept());
  await page.locator("#btnAbandon").click();
  await expect.poll(() => calls(supabase, "track_run").length).toBe(2);
  expect(calls(supabase, "track_run")[1].p_killer).toBe("abandon");

  // Même appareil au rechargement : même identifiant, nouvelle session
  await page.reload();
  await expect
    .poll(() => calls(supabase, "track_session").filter((c) => c.p_session !== first.p_session).length)
    .toBeGreaterThan(0);
  const again = calls(supabase, "track_session").find((c) => c.p_session !== first.p_session);
  expect(again.p_device).toBe(first.p_device);
});

test("statistiques désactivées dans les Options : plus aucun envoi", async ({ page, supabase }) => {
  await withSave(page, { tutorialDone: true, lastFreeChest: Date.now() });
  await page.goto("/");
  await page.locator("#btnOptions").click();
  await expect(page.locator("#optAnalytics")).toHaveText("ACTIVÉES");
  await page.locator("#optAnalytics").click();
  await expect(page.locator("#optAnalytics")).toHaveText("DÉSACTIVÉES");
  await page.locator("#btnOptionsBack").click();
  await page.reload();
  await expect(page.locator("#mainMenu")).toBeVisible();
  const before = supabase.analytics.length;
  await startGame(page);
  await killPlayer(page);
  await page.waitForTimeout(500);
  expect(supabase.analytics.length).toBe(before);
});

const STATS = {
  generated_at: "2026-10-17T12:00:00Z",
  days: 30,
  timezone: "Europe/Paris",
  online_now: 3,
  players_today: 42,
  players_7d: 120,
  players_30d: 300,
  players_period: 300,
  players_total: 512,
  new_today: 9,
  new_period: 210,
  sessions_period: 900,
  avg_session_minutes: 12.5,
  median_session_minutes: 8,
  play_hours_period: 140.2,
  avg_daily_minutes_per_player: 18.4,
  share_mobile: 61,
  share_installed: 12,
  share_logged: 25,
  runs_period: 2500,
  victories_period: 4,
  best_pulse_period: 7,
  abandons: 300,
  retention: { d1: 31.5, d7: 12, d30: null },
  daily: [
    {
      day: "2026-10-16",
      players: 30,
      new_players: 10,
      sessions: 50,
      active_minutes: 600,
      play_minutes: 400,
      runs: 90,
    },
    {
      day: "2026-10-17",
      players: 42,
      new_players: 9,
      sessions: 60,
      active_minutes: 700,
      play_minutes: 500,
      runs: 110,
    },
  ],
  hours: [{ hour: 20, sessions: 40 }],
  session_lengths: [{ label: "1-5 min", sessions: 20 }],
  modes: [{ mode: "normal", runs: 2000, avg_wave: 9.5, avg_minutes: 7 }],
  difficulties: [{ difficulty: "nightmare", runs: 100 }],
  waves: [{ label: "1-5", runs: 800 }],
  killers: [{ name: "Kamikaze", runs: 400 }],
  heroes: [{ name: "pilot", runs: 900 }],
  weapons: [{ name: "blaster", runs: 1200 }],
};

test("page des statistiques : connexion demandée, compte non admin, tableau de bord", async ({
  page,
  supabase,
}) => {
  await page.goto("/stats.html");
  await expect(page.locator("#stMessage")).toHaveText("Page privée. Se connecter");
  await expect(page.locator("#stContent")).toBeHidden();

  // Compte connecté mais pas administrateur : refus, sans aucun détail ni chiffre
  await logIn(page, "reda@test.fr");
  await page.reload();
  await expect(page.locator("#stMessage")).toHaveText("Page privée : accès refusé pour ce compte.");
  await expect(page.locator("#stContent")).toBeHidden();

  supabase.adminStats = STATS;
  await page.reload();
  await expect(page.locator("#stContent")).toBeVisible();
  await expect(page.locator(".st-kpi").first()).toContainText("3");
  await expect(page.locator("#stKpis")).toContainText("Joueurs aujourd'hui");
  await expect(page.locator("#stKpis")).toContainText("31,5% · 12% · —");
  await expect(page.locator("#tbModes")).toContainText("Survie");
  await expect(page.locator("#tbKillers")).toContainText("Kamikaze");
  await expect(page.locator("#tbHeroes")).toContainText("Pilote");
  await expect(page.locator("#tbWeapons")).toContainText("Blaster");
});

test("page des statistiques : erreurs du jeu, détail d'un rapport, marquée corrigée", async ({
  page,
  supabase,
}) => {
  supabase.adminStats = STATS;
  const at = Date.parse("2026-10-20T20:00:00Z");
  supabase.adminErrors = [
    {
      fingerprint: "a1b2c3d4",
      kind: "error",
      message: "TypeError: Cannot read properties of undefined (reading 'x')",
      first_seen: "2026-10-19T10:00:00Z",
      last_seen: "2026-10-20T20:00:00Z",
      occurrences: 12,
      reports: 4,
      devices: 3,
      first_build: "abc1234",
      last_build: "def5678",
      resolved_at: null,
      regressed_at: "2026-10-20T20:00:00Z",
    },
    {
      fingerprint: "ffff0000",
      kind: "freeze",
      message: "Boucle du jeu arrêtée depuis 5 s",
      first_seen: "2026-10-18T10:00:00Z",
      last_seen: "2026-10-18T10:00:00Z",
      occurrences: 1,
      reports: 1,
      devices: 1,
      first_build: "abc1234",
      last_build: "abc1234",
      resolved_at: "2026-10-19T08:00:00Z",
      regressed_at: null,
    },
  ];
  supabase.errorReports.a1b2c3d4 = [
    {
      id: "r1",
      created_at: "2026-10-20T20:00:01Z",
      occurred_at: new Date(at).toISOString(),
      kind: "error",
      message: "TypeError: Cannot read properties of undefined (reading 'x')",
      stack: "TypeError: ...\n    at updateEnemyProjectiles (/src/systems/enemies.js:120:9)",
      build: "def5678",
      count: 2,
      context: { mode: "normal", wave: 17, bosses: "Ver des sables" },
      journal: [
        [at - 3200, "boss", "Ver des sables"],
        [at, "erreur", "error : TypeError"],
      ],
      device_info: { browser: "Chrome 141", os: "Android 14" },
    },
  ];
  await logIn(page, "reda@test.fr");
  await page.goto("/stats.html");
  await expect(page.locator("#stErrorsInfo")).toHaveText("1 à corriger · 1 corrigée(s) · 30 derniers jours");
  const rows = page.locator(".st-error-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("revenue");
  await expect(rows.nth(1)).toHaveClass(/resolved/);

  await rows.first().click();
  const detail = page.locator("#stErrorDetail");
  await expect(detail).toContainText("vue 12 fois sur 3 appareil(s)");
  await expect(detail.locator("pre")).toContainText(
    "at updateEnemyProjectiles (/src/systems/enemies.js:120:9)",
  );
  await expect(detail.locator("pre")).toContainText("wave=17");
  await expect(detail.locator("pre")).toContainText("-3.2 s  [boss] Ver des sables");
  await expect(detail.locator("pre")).toContainText("os=Android 14");

  await detail.getByRole("button", { name: "MARQUER CORRIGÉE" }).click();
  await expect(rows.first()).toHaveClass(/resolved/);
  await expect(page.locator("#stErrorsInfo")).toHaveText("0 à corriger · 2 corrigée(s) · 30 derniers jours");
  await expect(detail.getByRole("button", { name: "ROUVRIR" })).toBeVisible();
});
