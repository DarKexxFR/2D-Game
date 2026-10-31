// Fusion d'armes d'appoint (carte « Fusion ») et nouvelles augmentations (data/cardEffects.js).
import { expect, game, startGame, test } from "./fixtures.js";

test.beforeEach(async ({ isMobile }) => test.skip(isMobile, "logique de jeu : une seule plateforme suffit"));

/** Donne au joueur les armes d'appoint `ids` au niveau 5. */
async function maxWeapons(page, ids) {
  await game(
    page,
    ({ state, upgrades }, ids) => {
      for (const id of ids) {
        const card = upgrades.SIDE_WEAPON_CARDS.find((c) => c.sideWeapon === id);
        for (let i = 0; i < 5; i++) upgrades.applyUpgrade(card, state.player);
      }
    },
    ids,
  );
}

test("fusion : deux armes au niveau 5 deviennent une arme, un emplacement se libère", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await game(page, ({ state }) => (state.game.running = false));
  await maxWeapons(page, ["mines", "pulse", "beam"]);
  const r = await game(page, async ({ state, upgrades }) => {
    const p = state.player;
    const { sideWeaponOf, sideWeaponIds } = await import("/src/data/sideWeapons.js");
    const ready = upgrades.availableEvolutions(p).map((e) => e.id);
    const card = upgrades.SIDE_FUSION_CARDS.find((c) => c.id === "seismicCarpet");
    upgrades.applyUpgrade(card, p);
    const freeSlot = upgrades.availableUpgrades(p).some((u) => u.sideWeapon === "missiles");
    return {
      ready,
      side: p.sideWeapons.map((w) => w.id),
      ids: sideWeaponIds(p),
      partFound: sideWeaponOf(p, "mines")?.level,
      again: upgrades.availableEvolutions(p).some((e) => e.id === "seismicCarpet"),
      pulseCardGone: !upgrades.availableUpgrades(p).some((u) => u.sideWeapon === "pulse"),
      freeSlot,
    };
  });
  expect(r.ready).toContain("seismicCarpet");
  expect(r.side).toEqual(["seismicCarpet", "beam"]);
  expect(r.ids).toEqual(["mines", "pulse", "beam"]);
  expect(r.partFound).toBe(5);
  expect(r.again).toBe(false);
  expect(r.pulseCardGone).toBe(true); // une arme fusionnée n'est plus proposée
  expect(r.freeSlot).toBe(true);
  // Le panneau montre la fusion (✦) à la place des deux armes
  await game(page, ({ state }) => (state.game.running = true));
  await expect(page.locator("#uiWeapons .ui-weapon.fusion")).toHaveCount(1);
});

test("fusion « Tapis sismique » : l'onde fait sauter les mines, plus fort qu'avant", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await game(page, ({ state }) => (state.game.running = false));
  await maxWeapons(page, ["mines", "pulse"]);
  const r = await game(page, async ({ state, upgrades, combat }) => {
    const p = state.player;
    const side = await import("/src/systems/sideWeapons.js");
    const { sideWeaponOf } = await import("/src/data/sideWeapons.js");
    const before = side.statsOf(sideWeaponOf(p, "pulse")).damage;
    upgrades.applyUpgrade(
      upgrades.SIDE_FUSION_CARDS.find((c) => c.id === "seismicCarpet"),
      p,
    );
    const after = side.statsOf(sideWeaponOf(p, "pulse")).damage;
    state.world.mines.length = 0;
    state.world.mines.push({
      x: p.worldX + 60,
      y: p.worldY,
      arm: 999,
      life: 999,
      damage: 1,
      radius: 40,
      dead: false,
    });
    const pulse = sideWeaponOf(p, "pulse");
    pulse.timer = 1e9; // l'onde part au prochain tick
    combat.rebuildEnemyGrid();
    side.updateSideWeapons();
    return { stronger: after > before, mines: state.world.mines.length };
  });
  expect(r).toEqual({ stronger: true, mines: 0 });
});

test("augmentations : Ricochet, Bouclier d'énergie, Surtension, Pulsar, Dette de temps", async ({ page }) => {
  await page.goto("/");
  await startGame(page);
  await game(page, ({ state }) => (state.game.running = false));
  const r = await game(page, async ({ state, upgrades, player, combat, spawner }) => {
    const p = state.player;
    const take = (name) => upgrades.applyUpgrade(upgrades.cardByName(name), p);
    for (const n of ["Ricochet", "Bouclier d'énergie", "Surtension", "Pulsar", "Dette de temps"]) take(n);
    // Bouclier d'énergie : le premier coup est bloqué, le suivant passe
    const hp = p.health;
    player.takeDamage(50);
    const blocked = p.health === hp;
    player.takeDamage(50);
    const hurt = p.health < hp;
    // Pulsar : un tir sur 5 est géant
    const sizes = [];
    for (let i = 0; i < 5; i++) {
      p.lastAttack = -1e9;
      spawner.spawnEnemy("tank", p.worldX + 200, p.worldY);
      combat.rebuildEnemyGrid();
      combat.shoot();
      sizes.push(state.world.projectiles.at(-1).giant === true);
    }
    // Surtension : 15 éliminations = une nova
    state.world.enemies.length = 0;
    for (let i = 0; i < 14; i++) {
      spawner.spawnEnemy("normal", p.worldX + 2000, p.worldY);
      combat.killEnemy(state.world.enemies.at(-1));
    }
    spawner.spawnEnemy("tank", p.worldX + 80, p.worldY);
    const near = state.world.enemies.at(-1);
    combat.rebuildEnemyGrid();
    spawner.spawnEnemy("normal", p.worldX + 2000, p.worldY);
    combat.killEnemy(state.world.enemies.at(-1));
    return {
      blocked,
      hurt,
      giant: sizes.filter(Boolean).length,
      bounces: state.world.projectiles.at(-1).bounces,
      surge: near.health < near.maxHealth,
      ultGain: p.ultGain,
    };
  });
  expect(r).toEqual({ blocked: true, hurt: true, giant: 1, bounces: 1, surge: true, ultGain: 2 });
});

test("évolutions et corrompues : Zéro absolu (Givre ×3 + Arc électrique), Furie aveugle", async ({
  page,
}) => {
  await page.goto("/");
  await startGame(page);
  await game(page, ({ state }) => (state.game.running = false));
  const r = await game(page, ({ state, upgrades }) => {
    const p = state.player;
    const take = (name) => upgrades.applyUpgrade(upgrades.cardByName(name), p);
    for (let i = 0; i < 5; i++) take("Givre"); // niveau maximum du pouvoir
    const frostMaxed = !upgrades.availableUpgrades(p).some((u) => u.name === "Givre");
    take("Arc électrique");
    const evo = upgrades.availableEvolutions(p).map((e) => e.id);
    const attack = p.attack;
    take("Furie aveugle");
    return { frostMaxed, evo, blind: p.blind, stronger: p.attack > attack };
  });
  expect(r.frostMaxed).toBe(true);
  expect(r.evo).toContain("absoluteZero");
  expect(r.blind).toBe(true);
  expect(r.stronger).toBe(true);
});
