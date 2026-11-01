// Manette (Gamepad API) : branchement / débranchement, déplacement au stick, boutons d'action,
// navigation dans les menus (A / B / Start), vibrations, une manette par joueur en duel sur un écran.
// Les manettes sont simulées : navigator.getGamepads renvoie de fausses manettes pilotées par le test.
import { expect, game, startGame, test } from "./fixtures.js";

const XBOX = "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 02fd)";
const B = { A: 0, B: 1, X: 2, Y: 3, START: 9, DOWN: 13 };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = /** @type {any} */ (window);
    w.__pads = [null, null, null, null];
    w.__rumbles = [];
    const make = (index, id) => ({
      index,
      id,
      connected: true,
      mapping: "standard",
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      vibrationActuator: {
        playEffect: (type, params) => {
          w.__rumbles.push({ index, type, ...params });
          return Promise.resolve("complete");
        },
      },
    });
    w.__pad = {
      connect: (i, id) => (w.__pads[i] = make(i, id)),
      disconnect: (i) => (w.__pads[i] = null),
      set: (i, b, down) => (w.__pads[i].buttons[b] = { pressed: down, touched: down, value: down ? 1 : 0 }),
      axes: (i, axes) => (w.__pads[i].axes = axes),
    };
    Object.defineProperty(navigator, "getGamepads", { value: () => [...w.__pads], configurable: true });
  });
});

/** Attend `n` images (les manettes sont relues à chaque image). */
function frames(page, n = 3) {
  return page.evaluate(
    (n) =>
      new Promise((resolve) => {
        const step = (k) => (k ? requestAnimationFrame(() => step(k - 1)) : resolve(undefined));
        step(n);
      }),
    n,
  );
}

const pad = (page, method, ...args) =>
  page.evaluate(([m, a]) => /** @type {any} */ (window).__pad[m](...a), [method, args]);

/**
 * Appui bref sur un bouton de la manette `i` : relâché dans la page à l'image suivante, sans aller-retour
 * avec le test (sur une machine chargée, cet aller-retour durait plusieurs images et une direction tenue
 * se répétait).
 */
async function tap(page, i, button) {
  await page.evaluate(
    ([i, button]) =>
      new Promise((resolve) => {
        const w = /** @type {any} */ (window);
        w.__pad.set(i, button, true);
        requestAnimationFrame(() => {
          w.__pad.set(i, button, false);
          resolve(undefined);
        });
      }),
    [i, button],
  );
  await frames(page);
}

async function connect(page, i = 0, id = XBOX) {
  // Pendant l'écran de chargement, les appuis sont ignorés : sur une machine lente, ils se perdaient
  await expect(page.locator("body")).not.toHaveClass(/booting/);
  await pad(page, "connect", i, id);
  await frames(page);
}

test("branchement annoncé, manette listée dans les Options, débranchement en partie = pause", async ({
  page,
}) => {
  await page.goto("/");
  await connect(page);
  await expect(page.locator("#achievementToast")).toContainText(
    "Manette 1 connectée · Xbox Wireless Controller",
  );

  await page.locator("#btnOptions").click();
  await expect(page.locator("#padList .pad-row")).toHaveText(/J1\s*Xbox Wireless Controller/);
  await expect(page.locator("#padLegend")).toContainText("Dash");
  await expect(page.locator("#padLegend")).toContainText("A / RB / RT");
  await page.locator("#btnOptionsBack").click();

  await startGame(page);
  await pad(page, "disconnect", 0);
  await expect(page.locator("#pauseMenu")).toBeVisible();
  await expect(page.locator("#achievementToast")).toContainText("Manette 1 déconnectée");
});

test("partie : stick gauche pour bouger, A pour le dash, Start pour la pause, B pour reprendre", async ({
  page,
}) => {
  await page.goto("/");
  await connect(page);
  await startGame(page);
  const x0 = await game(page, ({ state }) => state.player.worldX);
  await pad(page, "axes", 0, [1, 0, 0, 0]);
  await expect.poll(() => game(page, ({ state }) => state.player.worldX)).toBeGreaterThan(x0 + 40);
  await pad(page, "axes", 0, [0, 0, 0, 0]);
  // Manette utilisée : les commandes tactiles s'effacent
  await expect(page.locator("body")).toHaveClass(/pad-mode/);
  await expect(page.locator("#touchControls")).toBeHidden();

  await pad(page, "set", 0, B.A, true);
  // Le dash ne dure que quelques ticks : on guette son rechargement, qui démarre avec lui
  await expect.poll(() => game(page, ({ state }) => state.player.dashCooldownTimer > 0)).toBe(true);
  await pad(page, "set", 0, B.A, false);

  await tap(page, 0, B.START);
  await expect(page.locator("#pauseMenu")).toBeVisible();
  await tap(page, 0, B.B);
  await expect(page.locator("#pauseMenu")).toBeHidden();
  expect(await game(page, ({ state }) => state.game.paused)).toBe(false);
});

test("tir auto coupé : le stick droit vise", async ({ page }) => {
  await page.goto("/");
  await connect(page);
  await startGame(page);
  await game(page, ({ state }) => (state.player.autoShoot = false));
  await pad(page, "axes", 0, [0, 0, 0, -1]); // stick droit vers le haut
  await expect
    .poll(() => game(page, ({ state }) => Math.round((state.player.aimAngle ?? 0) * 100) / 100))
    .toBe(-1.57);
});

test("accueil : JOUER sélectionné d'office, la croix déplace la sélection, A valide", async ({ page }) => {
  await page.goto("/");
  await connect(page);
  await tap(page, 0, B.DOWN); // premier appui : montre seulement la sélection
  await expect(page.locator("#btnPlay")).toHaveClass(/pad-focus/);
  await tap(page, 0, B.DOWN);
  await expect(page.locator("#btnPlay")).not.toHaveClass(/pad-focus/);
  await expect(page.locator(".pad-focus")).toHaveCount(1);
  await tap(page, 0, 12); // haut : retour sur JOUER
  await expect(page.locator("#btnPlay")).toHaveClass(/pad-focus/);
  await tap(page, 0, B.A);
  await expect(page.locator("#ui")).toBeVisible();
});

test("menus : B ferme l'écran ouvert, la souris efface la sélection", async ({ page }) => {
  await page.goto("/");
  await connect(page);
  await page.locator("#btnOptions").click();
  await expect(page.locator("#optionsMenu")).toBeVisible();
  await tap(page, 0, B.DOWN);
  await expect(page.locator("#optionsMenu .pad-focus")).toHaveCount(1);
  await tap(page, 0, B.B);
  await expect(page.locator("#optionsMenu")).toBeHidden();
  await expect(page.locator("#mainMenu")).toBeVisible();

  await page.mouse.move(10, 10);
  await page.mouse.move(40, 40);
  await expect(page.locator("body")).not.toHaveClass(/pad-mode/);
});

test("choix d'amélioration : A prend la carte sélectionnée sans déclencher de dash", async ({ page }) => {
  await page.goto("/");
  await connect(page);
  await startGame(page, { levelUps: true });
  await game(page, ({ player }) => player.gainXp(1000));
  await expect(page.locator("#upgradeMenu")).toBeVisible();
  await tap(page, 0, B.DOWN); // montre la sélection (première carte)
  await expect(page.locator(".upgrade-option").first()).toHaveClass(/pad-focus/);
  await page.waitForTimeout(400); // A ignoré juste après l'ouverture
  await pad(page, "set", 0, B.A, true);
  await expect(page.locator("#upgradeMenu")).toBeHidden();
  expect(Object.keys(await game(page, ({ state }) => state.player.inventory))).toHaveLength(1);
  // A toujours enfoncé : il a servi au choix, pas au dash (vérifié sur une vingtaine d'images)
  const dashed = await page.evaluate(async () => {
    const { player } = await import("/src/core/state.js");
    let seen = false;
    for (let k = 0; k < 20; k++) {
      await new Promise((r) => requestAnimationFrame(r));
      seen ||= player.isDashing;
    }
    return seen;
  });
  expect(dashed).toBe(false);
  await pad(page, "set", 0, B.A, false);
});

test("vibrations de la manette : suivent le réglage", async ({ page }) => {
  await page.goto("/");
  await connect(page);
  const buzz = () =>
    page.evaluate(async () => {
      const w = /** @type {any} */ (window);
      w.__rumbles = [];
      (await import("/src/services/sfx.js")).vibrate([60, 40, 60]);
      return w.__rumbles;
    });
  const rumbles = await buzz();
  expect(rumbles).toHaveLength(1);
  expect(rumbles[0]).toMatchObject({ index: 0, type: "dual-rumble", duration: 160 });

  await page.locator("#btnOptions").click();
  await page.locator("#optPadVibration").click();
  await expect(page.locator("#optPadVibration")).toHaveText("DÉSACTIVÉES");
  expect(await buzz()).toHaveLength(0);
});

test("manette désactivée dans les Options : ignorée", async ({ page }) => {
  await page.goto("/");
  await connect(page);
  await page.locator("#btnOptions").click();
  await page.locator("#optGamepad").click();
  await expect(page.locator("#optGamepad")).toHaveText("DÉSACTIVÉE");
  await expect(page.locator("#padList")).toContainText("Manette désactivée");
  await page.locator("#btnOptionsBack").click();
  await startGame(page);
  const x0 = await game(page, ({ state }) => state.player.worldX);
  await pad(page, "axes", 0, [1, 0, 0, 0]);
  await frames(page, 20);
  expect(await game(page, ({ state }) => state.player.worldX)).toBe(x0);
});

test("duel sur un écran : chaque manette commande son joueur", async ({ page }) => {
  await page.goto("/");
  await connect(page, 0);
  await connect(page, 1, "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)");
  await page.locator("#btnVersus").click();
  await page.locator("#btnDuelLocal").click();
  const positions = () =>
    page.evaluate(async () => {
      const { withRun } = await import("/src/systems/versus.js");
      const { player } = await import("/src/core/state.js");
      return [0, 1].map((i) => withRun(i, () => player.worldX));
    });
  const [a0, b0] = await positions();
  await pad(page, "axes", 0, [1, 0, 0, 0]); // manette 1 : J1 vers la droite
  await expect.poll(async () => (await positions())[0]).toBeGreaterThan(a0 + 40);
  expect((await positions())[1]).toBe(b0); // J2 n'a pas bougé
  await pad(page, "axes", 0, [0, 0, 0, 0]);
  await pad(page, "axes", 1, [-1, 0, 0, 0]); // manette 2 : J2 vers la gauche
  await expect.poll(async () => (await positions())[1]).toBeLessThan(b0 - 40);
});
