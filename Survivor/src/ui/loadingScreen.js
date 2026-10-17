// Écran de chargement, côté modules : prend le relais de src/boot.js (qui a affiché la barre pendant
// le téléchargement) et l'avance étape par étape jusqu'à l'accueil.

/** @typedef {{ label: string, run: () => Promise<unknown> }} LoadingStep */

const START = 0.7; // boot.js réserve 70 % de la barre au téléchargement des modules

/** Avance la barre (0 à 1) avec un texte. */
export function setLoading(progress, label) {
  window.__boot?.progress(progress, label);
}

/**
 * Lance les étapes en parallèle (aucune n'attend les autres) ; la barre avance à chaque étape
 * terminée et affiche celle qui reste. Renvoie quand toutes sont finies (ou ont abandonné).
 * @param {LoadingStep[]} steps
 */
export async function runLoadingSteps(steps) {
  const waiting = new Set(steps);
  let done = 0;
  const show = () => {
    const next = [...waiting][0];
    setLoading(START + ((1 - START) * done) / (steps.length + 1), next ? next.label : "Presque prêt...");
  };
  show();
  await Promise.all(
    steps.map(async (step) => {
      try {
        await step.run();
      } catch (err) {
        console.warn(`Chargement : « ${step.label} » a échoué`, err);
      }
      waiting.delete(step);
      done++;
      show();
    }),
  );
}

/** Jeu prêt : l'accueil apparaît. */
export function finishLoading() {
  window.__boot?.done();
}

/** Démarrage impossible : message et bouton RÉESSAYER. */
export function failLoading(message) {
  window.__boot?.fail(message);
}
