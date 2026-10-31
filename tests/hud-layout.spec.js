// Panneau en jeu (ui/hud.js, css/hud.css) : rien ne déborde ni ne se chevauche, même dans le pire cas
// (Endless Pulse, gros compteurs, nom de compétence le plus long, compétence prête).
import { expect, game, startGame, test, withSave } from "./fixtures.js";

/** Rectangle de chaque élément, tel que dessiné à l'écran. */
async function boxes(page, ids) {
  return page.evaluate(
    (list) =>
      Object.fromEntries(
        list.map((id) => {
          const node = /** @type {HTMLElement} */ (document.getElementById(id));
          const r = node.getBoundingClientRect();
          return [
            id,
            {
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
              clipped: node.scrollWidth > node.clientWidth + 1,
            },
          ];
        }),
      ),
    ids,
  );
}

test("panneau en jeu : la vague, la pulsation et les compteurs tiennent sans se chevaucher", async ({
  page,
}) => {
  await withSave(page, { tutorialDone: true, lastFreeChest: Date.now() });
  await page.goto("/");
  await startGame(page, { invincible: true });
  await game(page, ({ state }) => {
    state.game.wave = 48;
    state.game.endless = { depth: 12, stacks: {} };
    state.game.kills = 123456;
    state.game.runGold = 987654;
    state.player.hero = { ...state.player.hero, skill: "judgment" };
    state.player.ultCharge = state.player.maxUltCharge;
    state.player.isUltReady = true;
    state.player.health = 761;
    state.player.maxHealth = 1519;
  });
  await expect(page.locator("#uiPulse")).toHaveText("ENDLESS · PULSE 12");
  await expect(page.locator("#healthText")).toHaveText("761/1519");

  const b = await boxes(page, [
    "ui",
    "uiWave",
    "wave",
    "waveLabel",
    "kills",
    "uiRunGold",
    "uiPulse",
    "healthText",
  ]);
  const panel = b.ui;
  // Tout reste dans le panneau
  for (const id of ["wave", "kills", "uiRunGold", "uiPulse"]) {
    expect(b[id].left, id).toBeGreaterThanOrEqual(panel.left);
    expect(b[id].right, id).toBeLessThanOrEqual(panel.right + 0.5);
  }
  // La vague finit avant les compteurs, et rien n'est coupé
  expect(b.wave.right).toBeLessThanOrEqual(b.kills.left);
  for (const id of ["uiWave", "kills", "uiRunGold", "uiPulse"]) expect(b[id].clipped, id).toBe(false);
  // La pulsation a sa propre ligne, sous l'en-tête
  expect(b.uiPulse.top).toBeGreaterThanOrEqual(b.kills.bottom - 1);
});

test("panneau en jeu : gros compteurs abrégés, et rien ne sort même avec une police plus large", async ({
  page,
}) => {
  await withSave(page, { tutorialDone: true, lastFreeChest: Date.now() });
  await page.goto("/");
  await startGame(page, { invincible: true });
  const short = await page.evaluate(async () => {
    const { shortNumber } = await import("/src/ui/hud.js");
    return [0, 9999, 10543, 99999, 312761, 999999, 1234567].map((n) => shortNumber(n));
  });
  expect(short).toEqual(["0", "9999", "10,5k", "99,9k", "312k", "999k", "1,2M"]);

  // Cas signalé : vague 31, 10543 éliminations, 312761 d'or
  await game(page, ({ state }) => {
    state.game.wave = 31;
    state.game.kills = 10543;
    state.game.runGold = 312761;
  });
  await expect(page.locator("#kills")).toHaveText("10,5k");
  await expect(page.locator("#uiRunGold")).toHaveText("312k");

  // Polices plus larges qu'Orbitron (autre appareil, police pas encore chargée, texte agrandi)
  for (const [font, size] of [
    ["Orbitron", ""],
    ["'Press Start 2P'", ""],
    ["monospace", "20px"],
  ]) {
    await page.evaluate(
      ([f, s]) => {
        const header = /** @type {HTMLElement} */ (document.querySelector(".ui-header"));
        header.style.fontFamily = f;
        header.style.fontSize = s;
      },
      [font, size],
    );
    const b = await boxes(page, ["ui", "uiWave", "kills", "uiRunGold"]);
    for (const id of ["uiWave", "kills", "uiRunGold"]) {
      expect(b[id].left, `${id} (${font})`).toBeGreaterThanOrEqual(b.ui.left);
      expect(b[id].right, `${id} (${font})`).toBeLessThanOrEqual(b.ui.right + 0.5);
      expect(b[id].clipped, `${id} (${font})`).toBe(false);
    }
  }
});
