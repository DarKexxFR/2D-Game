// Musiques synthétisées (data/music.js) : partitions valides, rendu audible sans saturation, et choix
// de la musique selon le moment de la partie (biome, boss, boss final, Endless Pulse).
import { expect, game, startGame, test } from "./fixtures.js";

test("musiques : partitions valides et rendu sans saturation", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await page.goto("/");
  const report = await page.evaluate(async () => {
    const { SONGS, LAYERS } = await import("/src/data/music.js");
    const { BIOMES } = await import("/src/data/biomes.js");
    const { MusicSequencer, compileSong, createMusicBus } = await import("/src/services/musicSequencer.js");
    const { MUSIC } = await import("/src/config.js");
    const problems = [];
    for (const biome of BIOMES) if (!SONGS[biome.id]) problems.push(`biome ${biome.id} sans musique`);
    for (const theme of ["boss", "final", "endless"]) if (!SONGS[theme]) problems.push(`${theme} absent`);
    const levels = {};
    for (const [id, song] of Object.entries(SONGS)) {
      const c = compileSong(song); // accord inconnu = exception
      for (const [layer, bars] of Object.entries(song.patterns)) {
        if (layer !== "fill" && !LAYERS.includes(layer)) problems.push(`${id} : couche ${layer} inconnue`);
        for (const bar of Array.isArray(bars) ? bars : [bars])
          if (bar.length !== 16) problems.push(`${id} ${layer} : « ${bar} » n'a pas 16 pas`);
      }
      if (Array.isArray(song.patterns.lead) && song.patterns.lead.length !== c.bars)
        problems.push(`${id} : mélodie de ${song.patterns.lead.length} mesures pour ${c.bars} accords`);
      // Deux mesures du passage complet, à travers la même chaîne que dans le jeu (toutes les couches), rendues hors temps réel
      const rate = 22050;
      const seconds = c.stepTime * 32;
      const ctx = new OfflineAudioContext(1, Math.ceil(rate * seconds), rate);
      const bus = createMusicBus(ctx, ctx.destination);
      bus.gain.value = MUSIC.synthVolume; // volume de la musique au maximum
      const seq = new MusicSequencer(ctx, bus, song);
      seq.step = 16 * (c.bars * 2 - 2); // deux dernières mesures du 2e passage : fill compris
      seq.start(0);
      seq.schedule(seconds);
      const data = (await ctx.startRendering()).getChannelData(0);
      let peak = 0;
      let sum = 0;
      for (const v of data) {
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      levels[id] = { peak, rms: Math.sqrt(sum / data.length) };
    }
    return { problems, levels };
  });
  expect(report.problems).toEqual([]);
  for (const [id, { peak, rms }] of Object.entries(report.levels)) {
    expect(rms, `${id} audible`).toBeGreaterThan(0.02);
    expect(peak, `${id} sans saturation`).toBeLessThan(1);
  }
});

test("musiques : la musique suit la partie", async ({ page, isMobile }) => {
  test.skip(isMobile, "une seule plateforme suffit");
  await page.goto("/");
  const themes = await page.evaluate(async () => {
    const { musicThemeFor } = await import("/src/services/audio.js");
    const run = { started: true, running: true, over: false, wave: 1, pendingBosses: [] };
    const boss = (type) => ({ type, dead: false, template: { isBoss: true } });
    const mob = { type: "normal", dead: false, template: {} };
    return [
      musicThemeFor({ ...run }, [mob]),
      musicThemeFor({ ...run, wave: 8 }, []),
      musicThemeFor({ ...run, wave: 26 }, []),
      musicThemeFor({ ...run, pendingBosses: [{ type: "colossus" }] }, []),
      musicThemeFor({ ...run, wave: 30 }, [boss("pulse_core"), boss("hacker")]),
      musicThemeFor({ ...run, endless: { depth: 1 } }, []),
      musicThemeFor({ ...run, rush: { stage: 1 } }, []),
      musicThemeFor({ ...run, over: true }, []),
    ];
  });
  expect(themes).toEqual(["neon", "desert", "station", "boss", "final", "endless", "boss", null]);

  // En partie (après une interaction, exigée par les navigateurs) : musique du biome, puis du boss
  await startGame(page, { invincible: true });
  await page.mouse.click(5, 5);
  const music = () => page.evaluate(async () => (await import("/src/services/audio.js")).currentMusic());
  await expect.poll(music).toBe("neon");
  await game(page, ({ state, spawner }) => {
    state.game.spawnTimer = 1e9;
    spawner.spawnEnemy("colossus", state.player.worldX + 400, state.player.worldY);
  });
  await expect.poll(music).toBe("boss");
  // Volume de la musique à 0 : plus rien n'est joué
  await game(page, ({ settings }) => settings.updateSettings({ musicVolume: 0 }));
  await expect.poll(music).toBe(null);
});
