// Cœur Cybernétique côté compte : déblocage, achat des nœuds (or) et choix des nœuds actifs.
// Données dans data/cyberCore.js ; effets en partie dans systems/cyberCore.js. État dans
// `account.cyberCore` ({ owned, active }), donc synchronisé avec le compte.

import { CORE_NODE, CYBER_CORE } from "../data/cyberCore.js";
import { getStat } from "./achievements.js";
import { account, saveAccount } from "./storage.js";

/** Le Cœur est-il débloqué (niveau de compte ou record de vague) ? */
export function isCoreUnlocked() {
  const { level, wave } = CYBER_CORE.unlock;
  return account.level >= level || getStat("bestWave") >= wave;
}

export const ownsNode = (id) => account.cyberCore.owned.includes(id);
export const isNodeActive = (id) => account.cyberCore.active.includes(id);

/** Nœuds actifs encore valables (achetés et connus), dans l'ordre de leur activation. */
export function activeNodes() {
  if (!isCoreUnlocked()) return [];
  return account.cyberCore.active
    .filter((id) => CORE_NODE[id] && ownsNode(id))
    .slice(0, CYBER_CORE.activeSlots);
}

/**
 * État d'un nœud pour l'écran : "owned" (acheté), "buyable" (prérequis acheté), "locked" (prérequis manquant).
 * @param {string} id
 */
export function nodeState(id) {
  if (ownsNode(id)) return "owned";
  const req = CORE_NODE[id]?.requires;
  return !req || ownsNode(req) ? "buyable" : "locked";
}

/** Achète un nœud (une fois). Renvoie true si l'achat a réussi. */
export function buyNode(id) {
  const node = CORE_NODE[id];
  if (!node || !isCoreUnlocked() || nodeState(id) !== "buyable" || account.gold < node.cost) return false;
  account.gold -= node.cost;
  account.cyberCore.owned.push(id);
  saveAccount();
  return true;
}

/**
 * Active ou désactive un nœud acheté. Refusé (false) si les `activeSlots` emplacements sont pris.
 * @param {string} id
 */
export function toggleNode(id) {
  if (!ownsNode(id) || !isCoreUnlocked()) return false;
  const active = account.cyberCore.active.filter((a) => CORE_NODE[a] && ownsNode(a));
  if (active.includes(id)) account.cyberCore.active = active.filter((a) => a !== id);
  else if (active.length >= CYBER_CORE.activeSlots) return false;
  else account.cyberCore.active = [...active, id];
  saveAccount();
  return true;
}
