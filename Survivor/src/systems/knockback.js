/**
 * Recul et attraction des ennemis : seul point d'entrée pour déplacer un ennemi de force
 * (tirs, orbes, compétences, familiers, effets, contact, onde de choc…).
 * Les boss n'y sont jamais sensibles (choix du propriétaire) : seuls leurs propres
 * mouvements (sauts, charges, téléportations) les déplacent.
 */

/** Un ennemi peut-il être poussé ou attiré par le joueur ? */
export function canBePushed(e) {
  return !e.template.isBoss;
}

/** Décale l'ennemi de (dx, dy) ; sans effet sur un boss. Renvoie vrai si l'ennemi a bougé. */
export function pushEnemy(e, dx, dy) {
  if (!canBePushed(e)) return false;
  e.x += dx;
  e.y += dy;
  return true;
}

/** Repousse l'ennemi de `force` dans la direction `angle` (radians). */
export function knockEnemy(e, angle, force) {
  return pushEnemy(e, Math.cos(angle) * force, Math.sin(angle) * force);
}

/** Attire l'ennemi vers (x, y) d'une fraction `pull` de la distance. */
export function pullEnemy(e, x, y, pull) {
  return pushEnemy(e, (x - e.x) * pull, (y - e.y) * pull);
}
