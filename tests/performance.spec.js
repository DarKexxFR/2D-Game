// Performances : une cadence de tir maximale au milieu d'une horde ne doit pas geler le jeu.
// Le shadowBlur (lueur floue) coûte cher à chaque dessin : on le garde pour les sprites mis en cache,
// pas pour les effets qui se comptent par dizaines (explosions, textes de dégâts, éclairs, élites).
import { expect, game, startGame, test } from "./fixtures.js";

test("cadence de tir maximale : peu de dessins flous et effets plafonnés", async ({ page }) => {
  await page.addInitScript(() => {
    window.__blurDraws = 0;
    window.__frames = 0;
    const P = CanvasRenderingContext2D.prototype;
    for (const name of ["fill", "stroke", "fillRect", "strokeRect", "fillText", "drawImage"]) {
      const orig = P[name];
      P[name] = function (...args) {
        if (this.canvas.id && this.shadowBlur > 0) window.__blurDraws++;
        return orig.apply(this, args);
      };
    }
    const count = () => {
      window.__frames++;
      requestAnimationFrame(count);
    };
    requestAnimationFrame(count);
  });
  await page.goto("/");
  await startGame(page);
  await game(page, ({ state, spawner, items, upgrades }) => {
    const p = state.player;
    // Arme à explosions et éclairs en chaîne, cadence au plafond
    p.weapon = { ...items.WEAPONS.nova, id: "nova" };
    p.attackSpeed = 500 * p.weapon.cooldown;
    const smg = upgrades.UPGRADES.find((u) => u.name === "Mitraillette");
    while (smg.canApply(p)) upgrades.applyUpgrade(smg, p);
    p.attackSpeed = 50; // plafond de cadence (STAT_CAPS.attackSpeed : équipement + talents + cartes)
    state.game.wave = 15; // élites et ennemis solides : beaucoup de coups et de textes de dégâts
    for (let i = 0; i < 120; i++) spawner.spawnEnemy();
  });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.__blurDraws = 0;
    window.__frames = 0;
  });
  await page.waitForTimeout(1500);
  const r = await game(page, ({ state, config }) => ({
    blurPerFrame: window.__blurDraws / Math.max(1, window.__frames),
    shockwaves: state.world.visualEffects.filter((e) => e.type === "shockwave").length,
    texts: state.world.floatingTexts.length,
    bolts: state.world.bolts.length,
    limits: config.LIMITS,
  }));
  expect(r.blurPerFrame).toBeLessThan(15); // avant : plus de 300 dessins flous par image
  expect(r.shockwaves).toBeLessThanOrEqual(r.limits.shockwaves);
  expect(r.texts).toBeLessThanOrEqual(r.limits.floatingTexts);
  expect(r.bolts).toBeLessThanOrEqual(r.limits.bolts);
});

test("appareil débordé : pas plus de LIMITS.ticksPerFrame ticks par image", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  const ticks = await game(page, async ({ state, config }) => {
    // Mesure prise après une image : les ticks de cette image-là (qui peut elle-même arriver en retard
    // sur une machine chargée) ne doivent pas être comptés avec ceux de l'image qui rattrape le blocage
    await new Promise((r) => requestAnimationFrame(r));
    const start = state.game.time;
    // Bloque le fil principal 1 s : sans plafond, l'image suivante rattraperait 15 ticks d'un coup
    const end = performance.now() + 1000;
    while (performance.now() < end);
    await new Promise((r) => requestAnimationFrame(r));
    return { ran: Math.round((state.game.time - start) / config.TICK_MS), max: config.LIMITS.ticksPerFrame };
  });
  expect(ticks.ran).toBeLessThanOrEqual(ticks.max + 2);
});
