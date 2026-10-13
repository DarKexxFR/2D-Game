// Duel en ligne : deux navigateurs, un salon avec code (Supabase Realtime simulé ici),
// puis connexion directe (WebRTC) ou, à défaut, messages relayés par Supabase.
import { expect, test } from "./fixtures.js";

// Chromium masque les adresses locales derrière des noms « .local » : inutile entre deux onglets
// de la même machine, et parfois impossible à résoudre dans la CI.
test.use({ launchOptions: { args: ["--disable-features=WebRtcHideLocalIpsWithMdns"] } });

/**
 * Faux serveur Supabase Realtime (protocole Phoenix) partagé par les pages du test :
 * rejoint les canaux et retransmet les diffusions aux autres membres du canal.
 */
function fakeRealtime() {
  const rooms = new Map(); // topic → Set de connexions
  return async (page) => {
    await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
      const topics = new Set();
      const reply = (msg, status = "ok") =>
        ws.send(
          JSON.stringify({
            topic: msg.topic,
            event: "phx_reply",
            payload: { status, response: {} },
            ref: msg.ref,
          }),
        );
      ws.onMessage((raw) => {
        const msg = JSON.parse(raw);
        if (msg.event === "phx_join") {
          if (!rooms.has(msg.topic)) rooms.set(msg.topic, new Set());
          rooms.get(msg.topic).add(ws);
          topics.add(msg.topic);
          reply(msg);
        } else if (msg.event === "heartbeat") reply(msg);
        else if (msg.event === "phx_leave") rooms.get(msg.topic)?.delete(ws);
        else if (msg.event === "broadcast") {
          for (const other of rooms.get(msg.topic) || []) {
            if (other !== ws)
              other.send(JSON.stringify({ topic: msg.topic, event: "broadcast", payload: msg.payload }));
          }
        }
      });
      ws.onClose(() => {
        for (const t of topics) rooms.get(t)?.delete(ws);
      });
    });
  };
}

/** Exécute `fn(versusModule, arg)` dans la page. */
function duel(page, fn, arg) {
  return page.evaluate(
    async ({ src, arg }) => {
      const v = await import("/src/systems/versus.js");
      // eslint-disable-next-line no-new-func
      return new Function("v", "arg", `return (${src})(v, arg)`)(v, arg);
    },
    { src: fn.toString(), arg },
  );
}

/** Ouvre l'écran Duel avec un pseudo ; `net` ajuste la configuration réseau (délais, relais forcé). */
async function openDuelMenu(page, realtime, pseudo, net = {}) {
  await realtime(page);
  await page.goto("/");
  await page.evaluate(async (net) => {
    const { NET } = await import("/src/config.js");
    Object.assign(NET, { iceServers: [] }, net); // pas de STUN : les deux pages sont sur la même machine
  }, net);
  await page.locator("#playerPseudo").fill(pseudo);
  await page.locator("#playerPseudo").dispatchEvent("change");
  await page.locator("#btnVersus").click();
  await expect(page.locator("#duelMenu")).toBeVisible();
}

/** Crée la partie chez l'hôte, la rejoint chez l'invité ; renvoie la page de l'invité. */
async function connect(page, browser, net = {}, realtime = fakeRealtime()) {
  await openDuelMenu(page, realtime, "Hote", net);
  await page.locator("#btnDuelHost").click();
  await expect(page.locator("#duelRoomCode")).toHaveText(/^[A-Z2-9]{4}$/);
  const code = await page.locator("#duelRoomCode").textContent();

  const guest = await (await browser.newContext()).newPage();
  const errors = [];
  guest.on("pageerror", (e) => errors.push(e.message));
  await guest.route("https://*.supabase.co/rest/**", (r) => r.fulfill({ status: 200, body: "[]" }));
  await openDuelMenu(guest, realtime, "Invite", net);
  await guest.locator("#duelCode").fill(code.toLowerCase()); // le code est remis en majuscules
  await guest.locator("#btnDuelJoin").click();

  for (const p of [page, guest]) {
    await expect(p.locator("#versusHud")).toBeVisible({ timeout: 15_000 });
    await expect(p.locator("#vsName1")).toHaveText("Hote");
    await expect(p.locator("#vsName2")).toHaveText("Invite");
  }
  return { guest, errors, code };
}

for (const [mode, net] of [
  ["connexion directe", {}],
  ["relais par Supabase", { disableP2P: true, p2pTimeoutMs: 200 }],
]) {
  test(`duel en ligne (${mode}) : salon, déplacements, améliorations, victoire, revanche`, async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "deux joueurs au clavier");
    test.setTimeout(60_000);
    const { guest, errors } = await connect(page, browser, net);
    const usesRelay = () => page.evaluate(async () => (await import("/src/services/netplay.js")).net.relay);
    expect(await usesRelay()).toBe(!!net.disableP2P);

    // L'invité pilote le vaisseau rose (J2) chez lui ; l'hôte voit le déplacement
    const x0 = await duel(page, (v) => v.versus.fighters[1].worldX);
    await guest.keyboard.down("ArrowLeft");
    await guest.waitForTimeout(500);
    await guest.keyboard.up("ArrowLeft");
    await expect.poll(() => duel(page, (v) => v.versus.fighters[1].worldX)).toBeLessThan(x0 - 30);
    // L'hôte, lui, ne fait pas bouger le vaisseau rose
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(300);
    await page.keyboard.up("ArrowRight");
    expect(await duel(page, (v) => v.versus.fighters[1].worldX)).toBeLessThan(x0 - 30);

    // L'invité meurt : il choisit ses 3 améliorations chez lui, l'hôte attend
    await duel(page, (v) => {
      const [a, b] = v.versus.fighters;
      b.buffs.shield = 0;
      v.hitFighter(a, b, 1e9);
    });
    await expect(guest.locator("#vsLives2")).toHaveText("♥♥♡");
    for (let n = 1; n <= 3; n++) {
      await expect(guest.locator("#upgradeSubtitle")).toHaveText(`Amélioration ${n}/3`);
      await expect(page.locator("#versusHint")).toHaveText("Invite choisit ses améliorations…");
      await guest.locator(".upgrade-option").first().click();
    }
    await expect(guest.locator("#vsUpgrades2")).toHaveText("3");
    await expect(page.locator("#vsUpgrades2")).toHaveText("3");
    await expect(page.locator("#upgradeMenu")).toBeHidden(); // rien à choisir chez l'hôte

    // Dernière vie de l'invité : les deux voient le vainqueur
    await duel(page, (v) => {
      const [a, b] = v.versus.fighters;
      v.versus.lives[1] = 1;
      b.buffs.shield = 0;
      v.hitFighter(a, b, 1e9);
    });
    for (const p of [page, guest]) await expect(p.locator("#versusWinner")).toHaveText("Hote GAGNE !");

    // Revanche demandée par l'invité : tout recommence chez les deux
    await guest.locator("#btnVersusReplay").click();
    for (const p of [page, guest]) {
      await expect(p.locator("#versusHud")).toBeVisible();
      await expect(p.locator("#vsLives2")).toHaveText("♥♥♥");
    }
    expect(await duel(guest, (v) => Object.keys(v.versus.fighters[1].inventory).length)).toBe(0);

    // L'hôte quitte : l'invité est prévenu
    page.once("dialog", (d) => d.accept());
    await page.keyboard.press("Escape");
    await expect(page.locator("#mainMenu")).toBeVisible();
    await expect(guest.locator("#versusWinner")).toHaveText("CONNEXION PERDUE");
    await expect(guest.locator("#btnVersusReplay")).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test("duel en ligne : un code inconnu est signalé", async ({ page }) => {
  await openDuelMenu(page, fakeRealtime(), "Seul", { joinTimeoutMs: 800 });
  await page.locator("#duelCode").fill("ZZZZ");
  await page.locator("#btnDuelJoin").click();
  await expect(page.locator("#duelStatus")).toHaveText(/Aucune partie avec ce code/);
});

test("duel en ligne : une partie complète refuse un troisième joueur", async ({
  page,
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "deux joueurs au clavier");
  const realtime = fakeRealtime();
  const { code } = await connect(page, browser, {}, realtime);
  const third = await (await browser.newContext()).newPage();
  await third.route("https://*.supabase.co/rest/**", (r) => r.fulfill({ status: 200, body: "[]" }));
  await openDuelMenu(third, realtime, "Trois");
  await third.locator("#duelCode").fill(code);
  await third.locator("#btnDuelJoin").click();
  await expect(third.locator("#duelStatus")).toHaveText("Cette partie a déjà deux joueurs.");
});
