// Accueil : bouton REPRENDRE de la partie interrompue (voir services/runSave.js), avec où elle en était,
// et petit bouton pour l'abandonner. Lancer une autre partie demande d'abord confirmation.

import { DIFFICULTIES } from "../config.js";
import { HEROES } from "../data/items.js";
import { savedRun } from "../services/runSave.js";
import { $, setClass, setText } from "./dom.js";

const MODE_NAMES = { daily: "Défi du jour", rush: "Boss Rush" };

/** Texte sous REPRENDRE : « Vague 12 · Cauchemar · Pilote · 8 min ». */
export function resumeInfo(meta) {
  const parts = [meta.mode === "rush" ? `${meta.wave} boss vaincus` : `Vague ${meta.wave}`];
  if (meta.pulse > 0) parts.push(`Pulse ${meta.pulse}`);
  if (MODE_NAMES[meta.mode]) parts.push(MODE_NAMES[meta.mode]);
  else if (meta.difficulty && meta.difficulty !== "normal")
    parts.push(DIFFICULTIES[meta.difficulty]?.name ?? meta.difficulty);
  const hero = HEROES[meta.hero]?.name;
  if (hero) parts.push(hero);
  parts.push(`${Math.max(1, Math.round(meta.seconds / 60))} min`);
  return parts.join(" · ");
}

/** Affiche (ou cache) le bouton REPRENDRE selon la partie sauvegardée sur cet appareil. */
export function renderResumeRun() {
  const saved = savedRun();
  setClass("homePlay", "has-resume", !!saved);
  if (saved) setText("resumeRunInfo", resumeInfo(saved.meta));
}

/**
 * Lancer une nouvelle partie remplace la partie interrompue : le joueur confirme d'abord.
 * Renvoie true s'il n'y a rien à perdre ou s'il accepte.
 */
export function confirmDropRun() {
  const saved = savedRun();
  if (!saved) return true;
  return confirm(
    `Une partie est en cours (${resumeInfo(saved.meta)}).\n` +
      "En lancer une nouvelle l'abandonne pour de bon. Continuer ?",
  );
}

/** @param {{ onResume: () => void, onAbandon: () => void }} handlers */
export function initResumeRun({ onResume, onAbandon }) {
  $("btnResumeRun").addEventListener("click", onResume);
  $("btnAbandonRun").addEventListener("click", () => {
    if (!confirm("Abandonner la partie en cours ? Elle ne pourra plus être reprise.")) return;
    onAbandon();
    renderResumeRun();
  });
  renderResumeRun();
}
