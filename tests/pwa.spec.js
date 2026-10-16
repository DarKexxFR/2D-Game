// Application installable (PWA) : manifeste, service worker (jeu hors connexion), installation
// (Chrome / Android et iPhone), cadeau de première ouverture et notifications.
import { expect, game, test, withSave } from "./fixtures.js";

// Ce fichier est le seul où le service worker tourne (bloqué ailleurs, voir playwright.config.js)
test.use({ serviceWorkers: "allow" });

// Clé publique VAPID de test (format réel) : les notifications ne s'allument qu'avec une clé
const VAPID = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM";
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/appareil-de-test";

/** Jour local décalé de `offset` jours (AAAA-MM-JJ), comme services/loginStreak.js. */
function dayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Sauvegarde d'un joueur qui a déjà joué (série du jour déjà récupérée : pas de fenêtre à l'arrivée). */
const regular = (extra = {}) => ({
  achievementStats: { runs: 1 },
  loginStreak: { day: dayKey(), count: 1 },
  ...extra,
});

/** Sert config.js avec la clé VAPID voulue (aussi aux requêtes du service worker). */
async function withPushKey(context, key = VAPID) {
  await context.route("**/src/config.js", async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).replace(/vapidPublicKey: "[^"]*"/, `vapidPublicKey: "${key}"`);
    await route.fulfill({ response: res, body });
  });
}

/**
 * Notifications simulées : accord du navigateur (`answer`, demandé au clic) et abonnement du
 * service de notification (Chromium sans tête ne peut pas joindre celui de Google).
 */
async function fakePushService(page, answer = "granted") {
  await page.addInitScript(
    ({ answer, endpoint }) => {
      let permission = "default";
      Object.defineProperty(Notification, "permission", { get: () => permission });
      Notification.requestPermission = async () => (permission = answer);
      let sub = null;
      const make = () => ({
        endpoint,
        toJSON: () => ({ endpoint, keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) } }),
        unsubscribe: async () => ((sub = null), true),
      });
      PushManager.prototype.subscribe = async () => (sub = make());
      PushManager.prototype.getSubscription = async () => sub;
    },
    { answer, endpoint: ENDPOINT },
  );
}

/** Événement d'installation de Chrome / Android, simulé (il arrive quand le navigateur le décide). */
function offerInstall(page, outcome = "accepted") {
  return page.evaluate((outcome) => {
    const e = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(e, {
      prompt: async () => ((window.__installPrompted = true), undefined),
      userChoice: Promise.resolve({ outcome }),
    });
    window.dispatchEvent(e);
  }, outcome);
}

test("manifeste : nom, icônes (dont masquables) et raccourcis valides", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "manifest.webmanifest");
  const manifest = await page.evaluate(async () => (await fetch("manifest.webmanifest")).json());
  expect(manifest).toMatchObject({ name: "Last Pulse", start_url: "./", scope: "./", display: "fullscreen" });
  expect(manifest.icons.some((i) => i.purpose === "maskable" && i.sizes === "512x512")).toBe(true);
  expect(manifest.icons.some((i) => i.purpose === "any" && i.sizes === "512x512")).toBe(true);
  // Chaque image existe et a la taille annoncée
  const images = [...manifest.icons, ...manifest.screenshots];
  const sizes = await page.evaluate(
    (srcs) =>
      Promise.all(
        srcs.map(
          (src) =>
            new Promise((resolve) => {
              const img = new Image();
              img.onload = () => resolve(`${img.naturalWidth}x${img.naturalHeight}`);
              img.onerror = () => resolve("introuvable");
              img.src = src;
            }),
        ),
      ),
    images.map((i) => i.src),
  );
  expect(sizes).toEqual(images.map((i) => i.sizes));
  // Les raccourcis ouvrent des écrans qui ont leur adresse (voir ui/router.js)
  expect(manifest.shortcuts.map((s) => s.url)).toEqual(["./#modal=defi", "./#modal=quetes", "./#modal=duel"]);
});

test("hors connexion : le jeu se recharge et se lance quand même", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.locator("#mainMenu")).toBeVisible();
  // Le service worker a gardé les fichiers déjà chargés (message « warm »)
  await expect
    .poll(() => page.evaluate(async () => (await import("/src/services/pwa.js")).offline.ready))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#mainMenu")).toBeVisible();
  await page.locator("#btnPlay").click();
  await expect(page.locator("#ui")).toBeVisible();
  await context.setOffline(false);
});

test("installation sur Chrome / Android : bouton de l'accueil, fenêtre du navigateur", async ({ page }) => {
  await withSave(page, regular());
  await page.goto("/");
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#btnInstall")).toBeHidden(); // le navigateur n'a encore rien proposé
  await offerInstall(page);
  await expect(page.locator("#btnInstall")).toBeVisible();
  await expect(page.locator("#installBadge")).toHaveText("+500");

  await page.locator("#btnInstall").click();
  await expect(page.locator("#installMenu")).toBeVisible();
  await expect(page).toHaveURL(/#modal=installer$/);
  await expect(page.locator("#installReward")).toHaveText("+500 or");
  await expect(page.locator("#installIos")).toBeHidden();
  await page.locator("#btnInstallNow").click();
  await expect(page.locator("#installDone")).toBeVisible();
  expect(await page.evaluate(() => window.__installPrompted)).toBe(true);

  await page.locator("#btnInstallBack").click();
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#btnInstall")).toBeHidden();
});

test("un tout nouveau joueur ne voit pas encore le bouton Installer", async ({ page }) => {
  await page.goto("/");
  await offerInstall(page);
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#btnInstall")).toBeHidden();
  // ... mais l'installation reste possible depuis les Options
  await page.locator("#btnOptions").click();
  await expect(page.locator("#btnOptionsInstall")).toHaveText("INSTALLER");
  await page.locator("#btnOptionsInstall").click();
  await expect(page.locator("#installMenu")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#optionsMenu")).toBeVisible(); // le retour ramène aux Options
});

test.describe("iPhone", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  });

  test("marche à suivre : Partager puis « Sur l'écran d'accueil »", async ({ page }) => {
    await withSave(page, regular());
    await page.goto("/");
    await page.locator("#btnInstall").click();
    await expect(page.locator("#installIos")).toBeVisible();
    await expect(page.locator("#installIos")).toContainText("Sur l'écran d'accueil");
    await expect(page.locator("#installPrompt")).toBeHidden();
  });
});

test("première ouverture depuis l'icône : +500 or, une seule fois", async ({ page }) => {
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q) =>
      q === "(display-mode: fullscreen)" ? /** @type {any} */ ({ matches: true }) : real(q);
  });
  await withSave(page, regular({ gold: 100 }));
  await page.goto("/");
  await expect(page.locator("#achievementToast")).toContainText(
    "Merci d'avoir installé Last Pulse : +500 or",
  );
  await expect(page.locator("#acGoldDisplay")).toHaveText("600");
  await expect(page.locator("#btnInstall")).toBeHidden();
  await page.reload();
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#acGoldDisplay")).toHaveText("600");
  await page.locator("#btnOptions").click();
  await expect(page.locator("#btnOptionsInstall")).toHaveText("INSTALLÉ");
  await expect(page.locator("#btnOptionsInstall")).toBeDisabled();
});

test("rappels calculés à l'heure locale du joueur", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const { account } = await import("/src/services/storage.js");
    const { buildReminders } = await import("/src/services/notifications.js");
    const { localDayKey } = await import("/src/services/loginStreak.js");
    const all = { streak: true, quests: true, friends: true, comeback: true };
    const local = (list) =>
      Object.fromEntries(
        list.map((x) => {
          const d = new Date(x.at);
          return [x.kind, [d.getMonth() + 1, d.getDate(), d.getHours(), x.data]];
        }),
      );
    const wed = new Date(2026, 9, 14, 15); // mercredi 14 octobre, 15 h
    account.achievementStats.runs = 0;
    const newbie = buildReminders(wed, all);
    account.achievementStats.runs = 4;
    account.achievementStats.bestWave = 12;
    account.loginStreak = { day: localDayKey(wed), count: 3 };
    const claimedToday = local(buildReminders(wed, all));
    // Série récupérée hier, il est 20 h : trop tard pour un rappel aujourd'hui (19 h)
    account.loginStreak = { day: localDayKey(new Date(2026, 9, 13, 12)), count: 3 };
    const late = local(buildReminders(new Date(2026, 9, 14, 20), all));
    const noStreakTopic = local(buildReminders(wed, { ...all, streak: false, comeback: false }));
    const monday = local(buildReminders(new Date(2026, 9, 19, 8), all)); // lundi 8 h
    return { newbie, claimedToday, late, noStreakTopic, monday };
  });
  expect(r.newbie).toEqual([]);
  expect(r.claimedToday).toEqual({
    streak: [10, 15, 19, { day: 4, gold: 300 }],
    quests: [10, 19, 10, {}],
    comeback1: [10, 17, 18, { best: 12 }],
    comeback2: [10, 24, 18, { best: 12 }],
  });
  expect(r.late.streak).toBeUndefined();
  expect(Object.keys(r.noStreakTopic)).toEqual(["quests"]);
  expect(r.monday.quests).toEqual([10, 19, 10, {}]); // lundi avant 10 h : aujourd'hui même
});

test("notifications : activer, choisir les thèmes, couper", async ({ page, context, supabase }) => {
  await withPushKey(context);
  await fakePushService(page);
  await withSave(page, { achievementStats: { runs: 3 }, loginStreak: { day: dayKey(), count: 2 } });
  await page.goto("/");
  await page.locator("#btnOptions").click();
  await expect(page.locator("#optPushSection")).toBeVisible();
  await expect(page.locator("#optPush")).toHaveText("DÉSACTIVÉES");
  await expect(page.locator("#pushTopics")).toBeHidden();

  await page.locator("#optPush").click();
  await expect(page.locator("#optPush")).toHaveText("ACTIVÉES");
  await expect(page.locator(".push-topic.on")).toHaveCount(4);
  await expect.poll(() => supabase.push.length).toBe(1);
  const first = supabase.push[0];
  expect(first.rpc).toBe("push_subscribe");
  expect(first.args).toMatchObject({
    p_endpoint: ENDPOINT,
    p_topics: ["streak", "quests", "friends", "comeback"],
  });
  expect(first.args.p_reminders.map((x) => x.kind)).toEqual(["streak", "quests", "comeback1", "comeback2"]);
  expect(first.args.p_reminders[0].data).toEqual({ day: 3, gold: 200 });

  // Thème coupé : renvoyé sans ses rappels (regroupé, après un court délai)
  await page.locator('.push-topic[data-topic="streak"]').click();
  await expect(page.locator('.push-topic[data-topic="streak"]')).not.toHaveClass(/on/);
  await expect.poll(() => supabase.push.length, { timeout: 8000 }).toBe(2);
  expect(supabase.push[1].args.p_topics).not.toContain("streak");
  expect(supabase.push[1].args.p_reminders.map((x) => x.kind)).not.toContain("streak");

  // Couper : l'appareil est désabonné sur le serveur
  await page.locator("#optPush").click();
  await expect(page.locator("#optPush")).toHaveText("DÉSACTIVÉES");
  await expect.poll(() => supabase.push.at(-1)?.rpc).toBe("push_unsubscribe");
  expect(supabase.push.at(-1).args).toEqual({ p_endpoint: ENDPOINT });
});

test("notifications refusées par le navigateur : expliqué, pas de nouvelle demande", async ({
  page,
  context,
  supabase,
}) => {
  await withPushKey(context);
  await fakePushService(page, "denied");
  await page.goto("/");
  await page.locator("#btnOptions").click();
  await page.locator("#optPush").click();
  await expect(page.locator("#pushHint")).toContainText("Bloquées par le navigateur");
  await expect(page.locator("#optPush")).toBeDisabled();
  expect(supabase.push).toEqual([]);
});

test("sans clé VAPID, rien n'apparaît (notifications pas encore configurées)", async ({ page, context }) => {
  await withPushKey(context, "");
  await page.goto("/");
  await page.locator("#btnOptions").click();
  await expect(page.locator("#optionsMenu")).toBeVisible();
  await expect(page.locator("#optPushSection")).toBeHidden();
});

test("proposé juste après la série du jour, puis plus avant longtemps", async ({
  page,
  context,
  supabase,
}) => {
  await withPushKey(context);
  await fakePushService(page);
  await withSave(page, { achievementStats: { runs: 3 }, loginStreak: { day: dayKey(-1), count: 2 } });
  await page.goto("/");
  await expect(page.locator("#pushAsk")).toBeHidden();
  await page.locator("#btnStreakClaim").click();
  await expect(page.locator("#pushAsk")).toBeVisible();
  await page.locator("#btnPushAskNo").click();
  await expect(page.locator("#pushAsk")).toBeHidden();
  // Retour d'une partie : déjà proposé récemment, on ne redemande pas
  await page.locator("#btnPlay").click();
  await expect(page.locator("#ui")).toBeVisible();
  await page.evaluate(() => history.back()); // met en pause
  await expect(page.locator("#pauseMenu")).toBeVisible();
  await page.locator("#btnQuit").click();
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#pushAsk")).toBeHidden();
  expect(supabase.push).toEqual([]);
});

test("« OUI » à la proposition : notifications activées en un clic", async ({ page, context, supabase }) => {
  await withPushKey(context);
  await fakePushService(page);
  await withSave(page, { achievementStats: { runs: 3 }, loginStreak: { day: dayKey(-1), count: 5 } });
  await page.goto("/");
  await page.locator("#btnStreakClaim").click();
  await page.locator("#btnPushAskYes").click();
  await expect(page.locator("#achievementToast")).toContainText("Notifications activées");
  await expect.poll(() => supabase.push.length).toBe(1);
  expect(supabase.push[0].args.p_reminders[0]).toMatchObject({
    kind: "streak",
    data: { day: 7, gold: 1200 },
  });
});
