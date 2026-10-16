// Retour à la vie (Seconde chance, Phénix, pub) : animation de renaissance et onde de choc qui tue
// les ennemis au corps à corps ; les boss perdent de la vie mais ne meurent pas et ne sont pas repoussés.
import { expect, game, killPlayer, startGame, test } from "./fixtures.js";

/** Place un ennemi de chaque sorte autour du joueur puis encaisse un coup fatal. */
async function dieWithFoes(page, setup) {
  return game(
    page,
    ({ state, spawner, player }, setup) => {
      const { world } = state;
      const p = state.player;
      world.enemies.length = 0;
      state.game.spawnTimer = 1e9;
      Object.assign(p, setup);
      spawner.spawnEnemy("boss", p.worldX + 60, p.worldY);
      spawner.spawnEnemy("tank", p.worldX - 40, p.worldY);
      spawner.spawnEnemy("normal", p.worldX, p.worldY + 220);
      spawner.spawnEnemy("normal", p.worldX, p.worldY - 900);
      const [boss, near, mid, far] = world.enemies;
      const bossX = boss.x;
      player.takeDamage(1e12);
      const fx = world.visualEffects.find((e) => e.type === "rebirth");
      return {
        over: state.game.over,
        hp: p.health / p.maxHealth,
        shield: p.buffs.shield,
        phoenixLeft: p.phoenixRevive,
        nearDead: near.dead,
        boss: { dead: boss.dead, hurt: boss.health < boss.maxHealth, moved: boss.x !== bossX },
        midDist: Math.hypot(mid.x - p.worldX, mid.y - p.worldY),
        midDead: mid.dead,
        farDead: far.dead,
        fx: fx && { kind: fx.kind, color: fx.color },
        texts: world.floatingTexts.map((t) => t.text),
      };
    },
    setup,
  );
}

test("Seconde chance : renaissance et onde de choc au corps à corps", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  const r = await dieWithFoes(page, { revives: 1, phoenixRevive: false });
  expect(r.over).toBe(false);
  expect(r.hp).toBeCloseTo(0.5);
  expect(r.shield).toBeGreaterThan(0);
  expect(r.nearDead).toBe(true);
  expect(r.boss).toEqual({ dead: false, hurt: true, moved: false });
  expect(r.midDead).toBe(false);
  expect(r.midDist).toBeGreaterThanOrEqual(299);
  expect(r.farDead).toBe(false);
  expect(r.fx).toEqual({ kind: "talent", color: "#00ffcc" });
  expect(r.texts).toContain("SECONDE CHANCE !");
  await page.waitForTimeout(300); // l'animation se dessine sans erreur
  await killPlayer(page);
});

test("Phénix : sa résurrection passe en premier, avec des ailes de feu", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await page.goto("/");
  await startGame(page);
  const r = await dieWithFoes(page, { revives: 2, phoenixRevive: true });
  expect(r.over).toBe(false);
  expect(r.phoenixLeft).toBe(false);
  expect(r.nearDead).toBe(true);
  expect(r.fx.kind).toBe("phoenix");
  expect(r.texts).toContain("RENAISSANCE DU PHÉNIX !");
  // La suivante est la Seconde chance habituelle
  const r2 = await dieWithFoes(page, {});
  expect(r2.fx).toBeTruthy();
  expect(r2.texts).toContain("SECONDE CHANCE !");
  await killPlayer(page);
});

test("l'animation de renaissance reste légère (pas de lueur floue en mode « lighter »)", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "une seule plateforme suffit");
  // Chrome recalcule une ombre sur tout le canvas pour chaque dessin flou en mode « lighter » :
  // une douzaine par image suffisait à figer le jeu après une Seconde chance.
  await page.addInitScript(() => {
    window.__slowDraws = 0;
    const P = CanvasRenderingContext2D.prototype;
    for (const name of ["fillRect", "fill", "stroke", "strokeRect", "drawImage"]) {
      const orig = P[name];
      P[name] = function (...args) {
        if (this.globalCompositeOperation !== "source-over" && this.shadowBlur > 0) window.__slowDraws++;
        return orig.apply(this, args);
      };
    }
  });
  await page.goto("/");
  await startGame(page);
  await game(page, ({ state, player }) => {
    state.player.revives = 2;
    state.player.phoenixRevive = true;
    player.takeDamage(1e12);
    player.takeDamage(1e12); // Phénix puis Seconde chance coup sur coup
  });
  expect(await game(page, ({ state }) => state.world.visualEffects.some((e) => e.type === "rebirth"))).toBe(
    true,
  );
  await page.waitForTimeout(300); // quelques images dessinées avec l'animation
  expect(await page.evaluate(() => window.__slowDraws)).toBe(0);
  await killPlayer(page);
});
