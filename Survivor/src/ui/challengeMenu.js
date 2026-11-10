// Écran « Défi entre amis » (#modal=defi-ami) : créer un défi, relever celui d'un ami (code ou lien),
// revoir ses défis récents. Règles et stockage dans services/friendChallenge.js.

import { HEROES, WEAPONS } from "../data/items.js";
import {
  challengeLink,
  challengeRules,
  findChallenge,
  isBetter,
  newChallengeCode,
  normalizeCode,
  rememberChallenge,
  savedChallenges,
} from "../services/friendChallenge.js";
import { $, el, setClass, setText } from "./dom.js";
import { icon } from "./icons.js";
import { getPseudo } from "./mainMenu.js";
import { showScreen } from "./screens.js";

/** Code du défi choisi (celui que JOUER et REJOUER lancent). */
let current = "";
let returnTo = "dailyMenu";

/** Défi en cours de sélection (main.js le lit pour lancer la partie). */
export function currentChallenge() {
  return current;
}

/** @param {{ onPlay: () => void, onBack: (screen: string) => void }} handlers */
export function initChallengeMenu({ onPlay, onBack }) {
  $("btnChallenges").addEventListener("click", () => openChallenges({ from: "dailyMenu" }));
  $("btnChallengeNew").addEventListener("click", () => select(newChallengeCode(), {}));
  $("btnChallengeJoin").addEventListener("click", join);
  $("challengeCode").addEventListener("keydown", (e) => {
    if (e.key === "Enter") join();
  });
  $("btnChallengePlay").addEventListener("click", () => {
    if (current) onPlay();
  });
  $("btnChallengeShare").addEventListener("click", () => share(current));
  $("btnChallengeBack").addEventListener("click", () => onBack(returnTo));
}

/**
 * Ouvre l'écran ; `link` = défi reçu par un lien (#defi=...), choisi d'office.
 * @param {{ from?: string, link?: { code: string, from: string, target: any } | null }} [opts]
 */
export function openChallenges({ from = "mainMenu", link = null } = {}) {
  returnTo = from;
  setText("challengeError", "");
  setText("challengeShareStatus", "");
  if (link) select(link.code, link);
  else renderCard();
  renderList();
  showScreen("challengeMenu");
}

function join() {
  const input = /** @type {HTMLInputElement} */ ($("challengeCode"));
  const code = normalizeCode(input.value);
  if (!code) {
    setText("challengeError", "Code invalide : 6 lettres ou chiffres, comme K7Q2M9.");
    return;
  }
  input.value = "";
  select(code, {});
}

/** Choisit un défi (et le retient dans la liste). */
function select(code, link) {
  current = code;
  setText("challengeError", "");
  setText("challengeShareStatus", "");
  rememberChallenge(code, link);
  renderCard();
  renderList();
}

function renderCard() {
  const entry = current ? findChallenge(current) : null;
  setClass("challengeCard", "open", !!entry);
  if (!entry) return;
  const rules = challengeRules(entry.code);
  setText("challengeCurrent", entry.code);
  rule(
    "challengeHero",
    icon(HEROES[rules.hero].icon, HEROES[rules.hero].color),
    "Héros",
    HEROES[rules.hero].name,
  );
  const weapon = WEAPONS[rules.weapon];
  rule("challengeWeapon", icon(weapon.icon, weapon.color), "Arme", weapon.name);
  rule("challengeModifier", icon("warning", "#ff2a6d"), rules.modifier.name, rules.modifier.desc);
  setText("challengeTarget", entry.target ? `À battre : ${who(entry)} · ${scoreText(entry.target)}` : "");
  setText("challengeBest", entry.best ? `Ton record : ${scoreText(entry.best)}` : "Pas encore joué");
}

function rule(id, ico, title, text) {
  $(id).replaceChildren(ico, el("strong", "", title), el("span", "", text));
}

function renderList() {
  const list = savedChallenges();
  if (list.length === 0) {
    $("challengeList").replaceChildren(el("li", "empty", "Crée un défi ou entre le code d'un ami."));
    return;
  }
  $("challengeList").replaceChildren(
    ...list.map((c) => {
      const btn = el("button");
      btn.classList.toggle("current", c.code === current);
      btn.classList.toggle("won", !!c.target && isBetter(c.best, c.target));
      const label = c.target ? `vs ${who(c)} · ${scoreText(c.target)}` : "Défi créé";
      btn.append(
        el("span", "code", c.code),
        el("span", "", label),
        el("span", "score", c.best ? scoreText(c.best) : "—"),
      );
      btn.addEventListener("click", () => select(c.code, {}));
      const li = el("li");
      li.append(btn);
      return li;
    }),
  );
}

const who = (entry) => entry.from || "Un ami";
export const scoreText = (s) => `vague ${s.wave} · ${Math.floor(s.xp)} XP`;

/**
 * Partage le lien du défi (avec son meilleur score) : partage natif, sinon presse-papiers.
 * @param {string} code
 * @param {string} [statusId] élément où afficher le résultat
 */
export async function share(code, statusId = "challengeShareStatus") {
  if (!code) return;
  const entry = findChallenge(code);
  const url = challengeLink(code, entry?.best || null, getPseudo());
  const text = entry?.best
    ? `Bats mon score sur Last Pulse : ${scoreText(entry.best)} ! Défi ${code}`
    : `Relève mon défi sur Last Pulse : ${code}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "Last Pulse · Défi entre amis", text, url });
      setText(statusId, "Défi partagé !");
      return;
    }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    setText(statusId, "Lien copié : envoie-le à ton ami !");
  } catch (err) {
    if (err?.name === "AbortError") return; // partage annulé par le joueur
    setText(statusId, `Code du défi : ${code}`);
  }
}
