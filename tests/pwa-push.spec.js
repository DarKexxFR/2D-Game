// Notification reçue par le service worker (sw.js) : envoyée comme le ferait le service de notification
// du navigateur, elle s'affiche avec le texte écrit par le serveur et ouvre le bon écran.
import { expect, test } from "./fixtures.js";

// Service worker actif ; Chromium complet (sans fenêtre) : le « headless shell » refuse les notifications
test.use({ serviceWorkers: "allow", channel: "chromium" });

test("notification affichée par le service worker avec son texte et son lien", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await page.goto("/");
  await expect
    .poll(() => page.evaluate(async () => (await import("/src/services/pwa.js")).offline.ready))
    .toBe(true);
  // Message envoyé par le protocole de Chromium, comme le ferait le service de notification
  const cdp = await context.newCDPSession(page);
  const registration = new Promise((resolve) =>
    cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
      const reg = registrations.find((r) => !r.isDeleted);
      if (reg) resolve(reg.registrationId);
    }),
  );
  await cdp.send("ServiceWorker.enable");
  const origin = new URL(page.url()).origin;
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin,
    registrationId: await registration,
    data: JSON.stringify({
      title: "🔥 Ne perds pas ta série !",
      body: "Jour 4",
      tag: "streak",
      url: "./#modal=quetes",
    }),
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const reg = await navigator.serviceWorker.ready;
        return (await reg.getNotifications()).map((n) => [
          n.title,
          n.body,
          n.tag,
          n.data.url.split("/").pop(),
        ]);
      }),
    )
    .toEqual([["🔥 Ne perds pas ta série !", "Jour 4", "streak", "#modal=quetes"]]);
});
