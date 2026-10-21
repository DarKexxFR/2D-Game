// « PARTAGER MA PARTIE » (écran de fin) : aperçu de la carte de score (render/shareCard.js), puis
// partage natif (téléphone), copie dans le presse-papiers (Discord sur PC) ou téléchargement en PNG.

import { DIFFICULTIES, RARITIES } from "../config.js";
import { game, pet, player } from "../core/state.js";
import { biomeForWave } from "../data/biomes.js";
import { ITEMS } from "../data/items.js";
import { cardByName, ownedEvolutions } from "../data/upgrades.js";
import { killerLine } from "../render/killCam.js";
import { drawShareCard } from "../render/shareCard.js";
import { currentSkin, shipLook } from "../services/skins.js";
import { $, setText, setVisible } from "./dom.js";
import { formatDuration } from "./runStats.js";
import { showScreen } from "./screens.js";

const FONT_WAIT_MS = 1500; // polices Google pas encore chargées (ou hors ligne) : on dessine quand même

/** @type {import("../render/shareCard.js").RunSummary | null} */
let summary = null;
/** Image PNG de la carte, prête une fois les polices chargées et le dessin fait. @type {Promise<Blob | null> | null} */
let image = null;

/**
 * Résumé de la partie qui vient de se terminer, figé à l'affichage de l'écran de fin.
 * @param {{ pseudo: string, wave: number, valueLabel: string, isNewRecord: boolean }} end
 * @returns {import("../render/shareCard.js").RunSummary}
 */
export function runSummary({ pseudo, wave, valueLabel, isNewRecord }) {
  const diff = DIFFICULTIES[game.difficulty] || DIFFICULTIES.normal;
  const mode = game.rush
    ? { label: "BOSS RUSH", color: "#ffd700" }
    : game.daily
      ? { label: "DÉFI DU JOUR", color: "#00ff88" }
      : { label: `SURVIE · ${diff.name}`, color: diff.color };
  const biome = biomeForWave(game.wave);
  const look = shipLook(player.hero, currentSkin(), 0);
  const cards = Object.entries(player.inventory)
    .map(([name, count]) => ({ def: cardByName(name), name, count }))
    .filter((c) => c.def)
    .sort((a, b) => b.count - a.count)
    .map(({ def, name, count }) => ({
      name,
      icon: def.icon,
      color: RARITIES[def.rarity]?.color || "#aaa",
      count,
    }));
  const evolutions = ownedEvolutions(player).map((e) => ({
    name: e.name,
    icon: e.icon,
    color: RARITIES.evolution.color,
  }));
  const petItem = pet.active ? ITEMS[pet.kind] : null;
  const killer = game.killCam.killer;
  return {
    pseudo: pseudo || "Pilote",
    mode,
    valueLabel,
    value: wave,
    newRecord: !!isNewRecord,
    biome: { name: biome.name, color: biome.color },
    level: player.level,
    duration: formatDuration(game.time),
    kills: Object.values(game.stats.kills).reduce((sum, n) => sum + n, 0),
    bosses: game.stats.bosses,
    combo: game.stats.bestCombo,
    hero: { name: player.hero?.name || "Pilote", color: player.hero?.color || "#00ccff" },
    ship: { color: look.color, hull: look.hull },
    weapon: player.weapon
      ? {
          name: player.weapon.name,
          icon: player.weapon.icon || "blaster",
          color: player.weapon.color || "#00ffff",
        }
      : null,
    pet: petItem ? { name: petItem.name, icon: petItem.icon, color: pet.color } : null,
    cards,
    evolutions,
    killer: killer ? { name: killer.name, line: killerLine(killer) } : null,
    date: new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
  };
}

/** Appelé par l'écran de fin : garde le résumé pour le bouton « PARTAGER ». */
export function setShareSummary(s) {
  summary = s;
  image = null;
}

function waitForFonts() {
  if (!document.fonts?.load) return Promise.resolve();
  const loads = Promise.all([
    document.fonts.load('900 40px "Orbitron"'),
    document.fonts.load('700 20px "Orbitron"'),
    document.fonts.load('20px "Press Start 2P"'),
  ]).catch(() => {});
  return Promise.race([loads, new Promise((r) => setTimeout(r, FONT_WAIT_MS))]);
}

const fileName = () =>
  `last-pulse-${summary.valueLabel === "Vague" ? "vague" : "score"}-${summary.value}.png`;

/** Ouvre l'aperçu et prépare l'image PNG. */
export function openShare() {
  if (!summary) return;
  const canvas = /** @type {HTMLCanvasElement} */ ($("shareCanvas"));
  setText("shareStatus", "");
  showScreen("shareMenu");
  image = waitForFonts().then(() => {
    drawShareCard(canvas, summary);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  });
}

function canShareFiles() {
  try {
    const probe = new File([new Blob()], "x.png", { type: "image/png" });
    return !!navigator.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
}

async function share() {
  const blob = await image;
  if (!blob) return;
  const file = new File([blob], fileName(), { type: "image/png" });
  try {
    await navigator.share({ files: [file], title: "Last Pulse", text: shareText() });
    setText("shareStatus", "Partagé !");
  } catch (e) {
    if (e?.name !== "AbortError") setText("shareStatus", "Partage impossible, essaie TÉLÉCHARGER.");
  }
}

async function copy() {
  if (!image) return;
  try {
    // Promesse passée telle quelle : Safari exige d'appeler write() pendant le clic
    await navigator.clipboard.write([new ClipboardItem({ "image/png": image })]);
    setText("shareStatus", "Image copiée : colle-la dans Discord (Ctrl+V).");
  } catch {
    setText("shareStatus", "Copie impossible, essaie TÉLÉCHARGER.");
  }
}

async function download() {
  const blob = await image;
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName();
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setText("shareStatus", "Image téléchargée.");
}

function shareText() {
  return `${summary.valueLabel} ${summary.value} sur Last Pulse ! Tu fais mieux ? https://last-pulse.com`;
}

export function initShareMenu() {
  setVisible("btnShareNative", canShareFiles());
  setVisible("btnShareCopy", typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write);
  $("btnShareRun").addEventListener("click", openShare);
  $("btnShareNative").addEventListener("click", share);
  $("btnShareCopy").addEventListener("click", copy);
  $("btnShareDownload").addEventListener("click", download);
  $("btnShareBack").addEventListener("click", () => showScreen("gameOver"));
}
