// Fenêtre « Nouveautés » : après une mise à jour, un joueur qui revient voit une fois ce qui a changé
// (entrées de data/changelog.js publiées depuis sa dernière visite, `account.newsSeen`, synchronisé avec
// le compte). Un nouveau joueur ne la voit pas. « NOUVEAUTÉS » dans les Options la rouvre.

import { CHANGELOG, NEWS_MAX } from "../data/changelog.js";
import { account, saveAccount } from "../services/storage.js";
import { $, el } from "./dom.js";
import { icon } from "./icons.js";
import { showScreen } from "./screens.js";

let onDone = () => {};

export function initNewsMenu() {
  $("btnNewsClose").addEventListener("click", closeNews);
}

/** Entrées pas encore vues (les plus récentes d'abord). */
export function unseenNews() {
  const seen = CHANGELOG.findIndex((n) => n.id === account.newsSeen);
  return CHANGELOG.slice(0, seen === -1 ? CHANGELOG.length : seen).slice(0, NEWS_MAX);
}

/** Tout est vu : la fenêtre ne reviendra qu'à la prochaine mise à jour. */
function markSeen() {
  if (!CHANGELOG.length || account.newsSeen === CHANGELOG[0].id) return;
  account.newsSeen = CHANGELOG[0].id;
  saveAccount();
}

/**
 * À l'arrivée sur l'accueil : ouvre la fenêtre s'il y a des nouveautés pour ce joueur (renvoie true).
 * Un tout nouveau joueur n'a rien à découvrir : tout est marqué vu d'office.
 * @param {() => void} then appelé à la fermeture
 */
export function offerNews(then) {
  if (account.achievementStats.runs === 0) {
    markSeen();
    return false;
  }
  const entries = unseenNews();
  if (entries.length === 0) return false;
  openNews(then, entries);
  return true;
}

/**
 * Ouvre la fenêtre (Options : les dernières nouveautés, même déjà vues).
 * @param {() => void} then appelé à la fermeture
 */
export function openNews(then, entries = CHANGELOG.slice(0, 1)) {
  onDone = then;
  $("newsList").replaceChildren(...entries.map(newsEntry));
  showScreen("newsMenu");
}

export function closeNews() {
  markSeen();
  onDone();
}

function newsEntry(entry) {
  const box = el("section", "news-entry");
  box.append(el("h3", "news-title", entry.title), el("p", "news-date", entry.date));
  const list = el("div", "news-items");
  for (const it of entry.items) {
    const row = el("div", "news-item");
    row.style.setProperty("--c", it.color);
    const ico = el("div", "news-icon");
    ico.append(icon(it.icon, it.color));
    const text = el("div", "news-text");
    text.append(el("b", "", it.title), el("p", "", it.text));
    row.append(ico, text);
    list.append(row);
  }
  box.append(list);
  return box;
}
