// Musique de fond : enchaîne des pistes aléatoires de la playlist.

import { MUSIC } from "../config.js";
import { randomItem } from "../utils/math.js";
import { onSettingsChange } from "./settings.js";

const bgMusic = new Audio();
bgMusic.addEventListener("ended", playRandomMusic);
onSettingsChange((s) => (bgMusic.volume = s.musicVolume));

export function playRandomMusic() {
  if (MUSIC.tracks.length === 0) return;
  bgMusic.src = MUSIC.dir + randomItem(MUSIC.tracks);
  // Le navigateur peut bloquer la lecture tant qu'il n'y a pas eu d'interaction.
  bgMusic.play().catch(() => {});
}

export function stopMusic() {
  bgMusic.pause();
}
