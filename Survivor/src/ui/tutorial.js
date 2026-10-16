// Tutoriel de la première partie : quelques bulles (se déplacer, tir auto, dash, niveaux,
// compétence, boîte mystère) qui avancent quand le joueur fait l'action demandée.
// Facultatif : bouton « PASSER », rejouable depuis les Options. Fait ou passé, il ne revient
// plus (`account.tutorialDone`, sauvegardé avec le compte).

import { TUTORIAL } from "../config.js";
import { on } from "../core/events.js";
import { bindingsOf, keyLabel } from "../core/input.js";
import { game, mysteryBox, player } from "../core/state.js";
import { account, saveAccount } from "../services/storage.js";
import { isPlayerNearBox } from "../systems/mysteryBox.js";
import { heroSkill } from "../systems/skills.js";
import { $, setText, setVisible } from "./dom.js";
import { isTouchDevice } from "./touchControls.js";

const key = (action) => keyLabel(bindingsOf(action)[0]);

/**
 * Étapes dans l'ordre. `ready` : l'étape peut s'afficher (sinon elle attend, sans bloquer
 * les étapes « bonus ») ; `done` : le joueur a fait l'action.
 */
const STEPS = [
  {
    id: "move",
    text: () =>
      isTouchDevice
        ? "Pose le pouce sur la moitié gauche de l'écran et glisse pour te déplacer."
        : `Déplace-toi avec ${["up", "left", "down", "right"].map(key).join(" ")} ou les flèches.`,
    done: (t) => Math.hypot(player.worldX - t.startX, player.worldY - t.startY) > TUTORIAL.moveDistance,
  },
  {
    id: "fire",
    text: () =>
      `Ton vaisseau tire tout seul sur l'ennemi le plus proche : détruis-en ${TUTORIAL.kills} !` +
      (isTouchDevice ? "" : ` (${key("autoShoot")} coupe le tir auto pour viser à la souris)`),
    done: () => game.kills >= TUTORIAL.kills,
  },
  {
    id: "dash",
    text: () =>
      isTouchDevice
        ? "Touche DASH pour une courte ruée : idéal pour sortir d'un encerclement."
        : `${key("dash")} : dash, une courte ruée pour sortir d'un encerclement.`,
    done: () => player.isDashing,
  },
  {
    id: "xp",
    text: () => "Ramasse les cristaux d'XP : à chaque niveau, tu choisis une amélioration.",
    done: () => player.level > 1,
  },
  {
    id: "skill",
    // La jauge se remplit en détruisant des ennemis : la bulle attend qu'elle soit pleine
    ready: () => player.isUltReady,
    text: () =>
      `Ta compétence ${heroSkill().name.toUpperCase()} est chargée : ` +
      (isTouchDevice ? "touche ULT pour la lancer !" : `appuie sur ${key("skill")} pour la lancer !`),
    // Ses éliminations peuvent remplir de nouveau la jauge aussitôt : le lancement suffit
    done: (t) => t.skillUsed || !player.isUltReady,
  },
];

// Conseil bonus, montré seulement si le joueur passe près de la boîte pendant le tutoriel
const BOX_TIP = {
  id: "box",
  ready: () => mysteryBox.state === "IDLE" && isPlayerNearBox(),
  text: () =>
    "Boîte mystère : " +
    (isTouchDevice ? "touche le bouton coffre" : `appuie sur ${key("box")}`) +
    " pour l'ouvrir contre de l'or (récompense au hasard).",
  done: () => !isPlayerNearBox(),
};

const tutorial = {
  active: false,
  step: 0, // prochaine étape obligatoire
  shown: null, // étape affichée
  shownFor: 0, // ticks depuis son affichage
  boxSeen: false,
  skillUsed: false, // compétence lancée pendant que sa bulle est affichée
  endTimer: 0, // ticks du message de fin
  startX: 0,
  startY: 0,
};

export function initTutorial() {
  on("skillUsed", () => {
    if (tutorial.active && tutorial.shown?.id === "skill") tutorial.skillUsed = true;
  });
  $("btnTutorialSkip").addEventListener("click", (e) => {
    e.currentTarget.blur(); // ESPACE (dash) ne doit pas recliquer le bouton
    finish();
  });
}

/** Lance le tutoriel au début d'une partie normale, si le joueur ne l'a jamais fait. */
export function startTutorial() {
  Object.assign(tutorial, {
    active: !account.tutorialDone,
    step: 0,
    shown: null,
    shownFor: 0,
    boxSeen: false,
    skillUsed: false,
    endTimer: 0,
    startX: player.worldX,
    startY: player.worldY,
  });
  render();
}

/** Coupe le tutoriel sans l'enregistrer (fin de partie, duel, retour au menu). */
export function stopTutorial() {
  tutorial.active = false;
  render();
}

/** Le tutoriel sera proposé à la prochaine partie (bouton des Options). */
export function replayTutorial() {
  account.tutorialDone = false;
  saveAccount();
}

/** Un tick de partie. */
export function updateTutorial() {
  if (!tutorial.active) return;
  if (tutorial.endTimer > 0) {
    if (--tutorial.endTimer === 0) stopTutorial();
    return;
  }
  const current = pickStep();
  if (current !== tutorial.shown) {
    tutorial.shown = current;
    tutorial.shownFor = 0;
    render();
  }
  if (!current) return;
  // Chaque bulle reste lisible un instant, même si l'action est déjà faite
  if (++tutorial.shownFor < TUTORIAL.minTicks || !current.done(tutorial)) return;
  if (current === BOX_TIP) tutorial.boxSeen = true;
  else tutorial.step++;
  if (tutorial.step >= STEPS.length) {
    finish();
    tutorial.active = true; // garde le message de fin quelques secondes
    tutorial.endTimer = TUTORIAL.endTicks;
    render("Tutoriel terminé : survis le plus longtemps possible !");
  }
}

function pickStep() {
  if (!tutorial.boxSeen && (tutorial.shown === BOX_TIP || BOX_TIP.ready())) return BOX_TIP;
  const step = STEPS[tutorial.step];
  // Une étape déjà affichée le reste jusqu'au bout (la compétence ne disparaît pas si on la lance)
  return step && (tutorial.shown === step || !step.ready || step.ready()) ? step : null;
}

/** Fait ou passé : le tutoriel ne reviendra plus. */
function finish() {
  tutorial.active = false;
  account.tutorialDone = true;
  saveAccount();
  render();
}

function render(endText) {
  const text = endText || (tutorial.active && tutorial.shown?.text());
  setVisible("tutorialBubble", !!text);
  if (!text) return;
  setText("tutorialText", text);
  setVisible("btnTutorialSkip", !endText);
}
