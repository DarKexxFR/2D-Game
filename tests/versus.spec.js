// Duel 1 contre 1 sur le même écran : 3 vies chacun, 3 améliorations à chaque mort.
// (le duel en ligne est testé dans versus-online.spec.js)
import { expect, test } from "./fixtures.js";

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

async function openDuel(page) {
  await page.goto("/");
  await page.locator("#btnVersus").click();
  await page.locator("#btnDuelLocal").click();
  await expect(page.locator("#versusHud")).toBeVisible();
}

/** Tue un joueur (balle fatale de l'adversaire, bouclier et dash ignorés). */
async function kill(page, i) {
  await duel(
    page,
    (v, i) => {
      const f = v.versus.fighters[i];
      f.buffs.shield = 0;
      f.isDashing = false;
      v.hitFighter(v.versus.fighters[1 - i], f, 1e9);
    },
    i,
  );
}

/** Choisit les 3 améliorations proposées après une mort. */
async function pickThree(page, name) {
  for (let n = 1; n <= 3; n++) {
    await expect(page.locator("#upgradeTitle")).toHaveText(name);
    await expect(page.locator("#upgradeSubtitle")).toHaveText(`Amélioration ${n}/3`);
    await page.locator(".upgrade-option").first().click();
  }
  await expect(page.locator("#upgradeMenu")).toBeHidden();
}

test("duel : deux joueurs, 3 vies chacun, tir automatique vers l'adversaire", async ({ page }) => {
  await openDuel(page);
  await expect(page.locator("#ui")).toBeHidden(); // pas le HUD du mode survie
  await expect(page.locator("#vsLives1")).toHaveText("♥♥♥");
  await expect(page.locator("#vsLives2")).toHaveText("♥♥♥");

  // Les balles touchent l'adversaire (on retire le bouclier de départ éventuel)
  await expect
    .poll(() =>
      duel(page, (v) => {
        const [a, b] = v.versus.fighters;
        a.buffs.shield = b.buffs.shield = 0;
        return a.health < a.maxHealth && b.health < b.maxHealth;
      }),
    )
    .toBe(true);
});

test("duel : chaque joueur a ses touches (ZQSD pour J1, flèches pour J2)", async ({ page, isMobile }) => {
  test.skip(isMobile, "clavier");
  await openDuel(page);
  const pos = () => duel(page, (v) => v.versus.fighters.map((f) => [f.worldX, f.worldY]));
  const [[x1], [x2]] = await pos();
  await page.keyboard.down("d");
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(400);
  await page.keyboard.up("d");
  await page.keyboard.up("ArrowLeft");
  const [[nx1], [nx2]] = await pos();
  expect(nx1).toBeGreaterThan(x1 + 20);
  expect(nx2).toBeLessThan(x2 - 20);
});

test("duel : à chaque mort, le joueur perd une vie et choisit 3 améliorations", async ({ page }) => {
  await openDuel(page);
  await kill(page, 1);
  await expect(page.locator("#vsLives2")).toHaveText("♥♥♡");
  await pickThree(page, "JOUEUR 2");
  const after = await duel(page, (v) => {
    const f = v.versus.fighters[1];
    return {
      upgrades: Object.values(f.inventory).reduce((a, b) => a + b, 0),
      alive: f.alive,
      full: f.health === f.maxHealth || f.buffs.shield > 0,
      p1: Object.keys(v.versus.fighters[0].inventory).length,
    };
  });
  expect(after).toEqual({ upgrades: 3, alive: true, full: true, p1: 0 });
  await expect(page.locator("#vsUpgrades2")).toHaveText("3");
});

test("duel : les cartes inutiles contre un joueur ne sont jamais proposées", async ({ page }) => {
  await openDuel(page);
  const offered = new Set();
  for (let round = 0; round < 2; round++) {
    await kill(page, 0);
    for (let n = 0; n < 3; n++) {
      await expect(page.locator("#upgradeMenu")).toBeVisible();
      for (const t of await page.locator(".upgrade-option h4").allTextContents()) offered.add(t);
      await page.locator(".upgrade-option").first().click();
    }
    await expect(page.locator("#upgradeMenu")).toBeHidden();
  }
  const names = [...offered].join(" | ");
  for (const banned of ["Aimant", "Avidité", "Exécution", "Explosion"]) expect(names).not.toContain(banned);
});

test("duel : 3 morts = défaite, revanche puis retour au menu, sans gain pour le compte", async ({ page }) => {
  await openDuel(page);
  const gold = await page.evaluate(async () => (await import("/src/services/storage.js")).account.gold);
  for (let death = 1; death <= 2; death++) {
    await kill(page, 0);
    await pickThree(page, "JOUEUR 1");
  }
  await kill(page, 0);
  await expect(page.locator("#versusOver")).toBeVisible();
  await expect(page.locator("#versusWinner")).toHaveText("JOUEUR 2 GAGNE !");
  await expect(page.locator("#versusScore")).toContainText("0 - 3");
  expect(await page.evaluate(async () => (await import("/src/services/storage.js")).account.gold)).toBe(gold);

  await page.locator("#btnVersusReplay").click();
  await expect(page.locator("#versusHud")).toBeVisible();
  await expect(page.locator("#vsLives1")).toHaveText("♥♥♥");
  expect(await duel(page, (v) => v.versus.fighters.map((f) => Object.keys(f.inventory).length))).toEqual([
    0, 0,
  ]);

  await page.keyboard.press("Escape");
  await expect(page.locator("#pauseMenu")).toBeVisible();
  await page.locator("#btnQuit").click();
  await expect(page.locator("#mainMenu")).toBeVisible();
  await expect(page.locator("#versusHud")).toBeHidden();
});

test("duel puis partie normale : le mode survie repart normalement", async ({ page }) => {
  await openDuel(page);
  await page.keyboard.press("Escape");
  await page.locator("#btnQuit").click();
  await page.locator("#btnPlay").click();
  await expect(page.locator("#ui")).toBeVisible();
  await expect(page.locator("#versusHud")).toBeHidden();
  expect(await duel(page, (v) => v.versus.active)).toBe(false);
});

test("duel sur mobile : une moitié d'écran par joueur, toucher = dash", async ({ page, isMobile }) => {
  test.skip(!isMobile, "tactile");
  await openDuel(page);
  await expect(page.locator("#versusTouch")).toBeVisible();
  await expect(page.locator("#touchControls")).toBeHidden();
  // Portrait : J1 en bas, J2 en haut ; on glisse vers la droite dans la moitié du bas
  const box = await page.locator("#vsZone1").boundingBox();
  const x0 = await duel(page, (v) => v.versus.fighters[0].worldX);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.locator("#vsZone1").dispatchEvent("pointerdown", { pointerId: 7, clientX: cx, clientY: cy });
  await page
    .locator("#vsZone1")
    .dispatchEvent("pointermove", { pointerId: 7, clientX: cx + 60, clientY: cy });
  await page.waitForTimeout(300);
  await page.locator("#vsZone1").dispatchEvent("pointerup", { pointerId: 7, clientX: cx + 60, clientY: cy });
  expect(await duel(page, (v) => v.versus.fighters[0].worldX)).toBeGreaterThan(x0 + 20);

  // Touche rapide dans la moitié du haut : dash du joueur 2
  const top = await page.locator("#vsZone2").boundingBox();
  const tx = top.x + top.width / 2;
  const ty = top.y + top.height / 2;
  await page.locator("#vsZone2").dispatchEvent("pointerdown", { pointerId: 8, clientX: tx, clientY: ty });
  await page.locator("#vsZone2").dispatchEvent("pointerup", { pointerId: 8, clientX: tx, clientY: ty });
  await expect.poll(() => duel(page, (v) => v.versus.fighters[1].dashCooldownTimer > 0)).toBe(true);
});
