// Cœur Cybernétique (data/cyberCore.js) : débloqué au niveau de compte 20 ou après la vague 30, nœuds achetés
// une fois avec de l'or, au plus 3 actifs, effets appliqués en début de partie (jamais en défi du jour).
import { expect, game, killPlayer, startGame, test, withSave } from "./fixtures.js";

const OWNED = ["manualAim", "overdrive", "glassCannon", "ritualist"];

test("verrouillé avant le niveau 20 ou la vague 30 : rien à acheter", async ({ page }) => {
  await withSave(page, { level: 5, gold: 1e6, achievementStats: { bestWave: 12 } });
  await page.goto("/");
  await page.locator("#btnTalents").click();
  await page.locator("#btnCyberCore").click();
  await expect(page).toHaveURL(/#modal=coeur/);
  await expect(page.locator("#coreStatus")).toContainText("Verrouillé");
  await expect(page.locator('.core-node[data-node="manualAim"] button')).toBeDisabled();
  await page.locator("#btnCoreBack").click();
  await expect(page.locator("#talentMenu")).toBeVisible();
});

test("achat en or, palier précédent requis, 3 nœuds actifs au plus", async ({ page }) => {
  await withSave(page, { level: 3, gold: 20000, achievementStats: { bestWave: 31 } }); // vague 30 battue
  await page.goto("/#modal=coeur");
  const node = (id) => page.locator(`.core-node[data-node="${id}"] button`);
  await expect(page.locator("#coreStatus")).toContainText("Nœuds actifs : 0/3");
  // Les succès de vague versent de l'or au chargement : on repart d'un montant connu
  await game(page, ({ storage }) => (storage.account.gold = 20000));
  await page.locator("#btnCoreBack").click();
  await page.locator("#btnCyberCore").click();
  await expect(node("overdrive")).toBeDisabled(); // palier 1 pas encore acheté
  await node("manualAim").click(); // 4000
  await expect(node("manualAim")).toHaveText("ACTIVER");
  await node("overdrive").click(); // 8000
  await node("ritualist").click(); // 4000
  await expect(node("glassCannon")).toBeDisabled(); // 4000 or restant < 15000
  for (const id of ["manualAim", "overdrive", "ritualist"]) await node(id).click();
  await expect(page.locator("#coreStatus")).toContainText("Nœuds actifs : 3/3");
  const acc = await game(page, ({ storage }) => ({
    gold: storage.account.gold,
    core: storage.account.cyberCore,
  }));
  expect(acc.gold).toBe(4000);
  expect(acc.core.active).toEqual(["manualAim", "overdrive", "ritualist"]);
  // Un quatrième nœud acheté ne peut pas s'activer tant que 3 le sont
  await game(page, ({ storage }) => storage.account.cyberCore.owned.push("nanoRegen"));
  await page.locator("#btnCoreBack").click();
  await page.locator("#btnCyberCore").click();
  await expect(node("nanoRegen")).toBeDisabled();
  await node("manualAim").click(); // désactive
  await expect(node("nanoRegen")).toBeEnabled();
});

test("en partie : tir manuel +25 %, cadence, sanctuaire en 3 s ; rien en défi du jour", async ({ page }) => {
  await withSave(page, {
    level: 20,
    cyberCore: { owned: OWNED, active: ["manualAim", "overdrive", "ritualist"] },
  });
  await page.goto("/");
  await startGame(page);
  const run = await game(page, async ({ state, combat }) => {
    const { shrineHold } = await import("/src/systems/cyberCore.js");
    const p = state.player;
    p.critChance = 0;
    const shot = (auto) => {
      p.autoShoot = auto;
      p.lastAttack = -1e9;
      state.world.projectiles.length = 0;
      state.world.enemies.length = 0;
      combat.shoot();
      return state.world.projectiles[0]?.damage;
    };
    return { manual: shot(false), core: p.core.nodes, hold: shrineHold(300), speed: p.baseSpeed };
  });
  expect(run.core).toEqual(["manualAim", "overdrive", "ritualist"]);
  expect(run.hold).toBe(180);
  const base = await game(page, async ({ state }) => {
    const { coreShotMult } = await import("/src/systems/cyberCore.js");
    return { manual: coreShotMult(true), auto: coreShotMult(false), attack: state.player.attack };
  });
  expect(base.manual).toBeCloseTo(1.25);
  expect(base.auto).toBe(1);
  expect(run.manual).toBeCloseTo(base.attack * 1.25); // Blaster : dégâts = attaque
  await killPlayer(page);
});

test("Arsenal de départ : une arme d'appoint dès le début, moins d'or ; Canon de verre : moins de PV", async ({
  page,
}) => {
  await withSave(page, {
    level: 25,
    cyberCore: { owned: [...OWNED, "arsenal"], active: ["arsenal", "glassCannon"] },
  });
  await page.goto("/");
  const plain = await game(page, async ({ state }) => {
    const { applyEquipment } = await import("/src/systems/equipment.js");
    state.resetPlayer(25);
    applyEquipment();
    return { hp: state.player.maxHealth, gold: state.player.goldBonus };
  });
  await startGame(page, { invincible: false });
  const p = await game(page, ({ state }) => ({
    side: state.player.sideWeapons.length,
    hp: state.player.maxHealth,
    gold: state.player.goldBonus,
  }));
  expect(p.side).toBe(1);
  expect(p.hp).toBe(Math.round(plain.hp * 0.75));
  expect(p.gold).toBeCloseTo(plain.gold - 0.2);
  await killPlayer(page);
});
