// Musique de fond : enchaîne des pistes aléatoires de la playlist.

import { MUSIC } from "../config.js";
import { randomItem } from "../utils/math.js";

const bgMusic = new Audio();
bgMusic.volume = MUSIC.volume;
bgMusic.addEventListener("ended", playRandomMusic);

export function playRandomMusic() {
  if (MUSIC.tracks.length === 0) return;
  bgMusic.src = MUSIC.dir + randomItem(MUSIC.tracks);
  // Le navigateur peut bloquer la lecture tant qu'il n'y a pas eu d'interaction.
  bgMusic.play().catch(() => {});
}

export function stopMusic() {
  bgMusic.pause();
}
