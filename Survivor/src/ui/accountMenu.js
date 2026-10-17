// Fenêtre « Connexion » (écran `loginMenu`) : connexion facultative (Google, Discord ou code par
// e-mail), état de la synchronisation et choix de la progression à garder en cas de conflit.
// Ouverte depuis le bouton « Se connecter » de l'accueil ou depuis les Options.

import {
  currentUser,
  initAuth,
  onAuthChange,
  sendEmailCode,
  signInWith,
  signOut,
  verifyEmailCode,
} from "../services/auth.js";
import {
  accountSync,
  deleteAccountProgress,
  initAccountSync,
  onAccountSyncChange,
  resolveConflict,
  syncAccount,
} from "../services/accountSync.js";
import { isOnlineEnabled } from "../services/supabase.js";
import { $, el, setText, setVisible } from "./dom.js";
import { setLoading } from "./loadingScreen.js";
import { showScreen } from "./screens.js";

const STATUS = {
  checking: "Vérification de ta progression...",
  syncing: "Synchronisation...",
  synced: "Progression sauvegardée sur ton compte",
  error: "Hors ligne : touche SYNCHRONISER pour réessayer",
  conflict: "",
  off: "",
};
const PROVIDERS = { google: "Google", discord: "Discord", email: "e-mail" };

let pendingEmail = "";
let onConflict = () => {};
let isPlaying = () => false;
let checkAfterRun = false; // vérification remise au retour à l'accueil (partie en cours)
let returnTo = "mainMenu";

/** Ouvre la fenêtre de connexion ; RETOUR ramène à l'écran `from`. */
export function openLogin(from = "mainMenu") {
  returnTo = from;
  showScreen("loginMenu");
}

/** Ferme la fenêtre de connexion et revient à l'écran d'où elle a été ouverte. */
export function closeLogin() {
  showScreen(returnTo);
}

/**
 * Au démarrage : session (retour de Google / Discord compris), puis comparaison avec le compte.
 * `onConflictFound` ouvre la fenêtre de connexion quand le joueur doit choisir entre deux progressions.
 * `playing` dit si une partie est en cours : ni rechargement ni fenêtre pendant une partie (la
 * vérification reprend au retour à l'accueil, voir resumeAccountCheck). L'écran de chargement attend
 * la promesse renvoyée, pour que le joueur n'entre pas dans le jeu avec une progression périmée.
 */
export async function initAccount({ onConflictFound, playing }) {
  onConflict = onConflictFound;
  isPlaying = playing;
  $("btnLoginBack").addEventListener("click", closeLogin);
  if (!isOnlineEnabled()) {
    // Sans serveur, pas de compte : les boutons d'accès disparaissent
    $("btnLogin").style.display = "none";
    $("optAccountRow").style.display = "none";
    return;
  }
  $("btnLogin").addEventListener("click", () => openLogin("mainMenu"));
  $("btnOptionsAccount").addEventListener("click", () => openLogin("optionsMenu"));
  initAccountSync();
  onAuthChange(render);
  onAccountSyncChange(render);
  bindButtons();
  await initAuth();
  render();
  if (currentUser()) await runSync();
}

async function runSync() {
  const result = await syncAccount({ canRestore: () => !isPlaying() });
  if (result === "restored") {
    setText("accountMessage", "Progression du compte récupérée ! Rechargement...");
    setLoading(1, "Progression du compte récupérée, rechargement...");
    location.reload();
    return new Promise(() => {}); // la page se recharge : l'accueil ne doit pas s'ouvrir entre-temps
  } else if (result === "busy" || (result === "conflict" && isPlaying())) {
    checkAfterRun = true;
  } else if (result === "conflict") {
    onConflict();
  }
}

/**
 * Retour à l'accueil après une partie : reprend la vérification du compte si elle avait été remise
 * (réponse du serveur arrivée en pleine partie, après la fin de l'écran de chargement).
 */
export function resumeAccountCheck() {
  if (!checkAfterRun) return;
  checkAfterRun = false;
  runSync();
}

function bindButtons() {
  $("btnGoogle").addEventListener("click", () => signInWith("google"));
  $("btnDiscord").addEventListener("click", () => signInWith("discord"));
  $("btnEmailCode").addEventListener("click", askCode);
  $("btnEmailVerify").addEventListener("click", verifyCode);
  $("accountCode").addEventListener("keydown", (e) => e.key === "Enter" && verifyCode());
  $("accountEmail").addEventListener("keydown", (e) => e.key === "Enter" && askCode());
  $("btnAccountSync").addEventListener("click", runSync);
  $("btnSignOut").addEventListener("click", async () => {
    await signOut();
    setText("accountMessage", "Déconnecté. Ta progression reste sur cet appareil.");
  });
  $("btnKeepLocal").addEventListener("click", () => choose("local"));
  $("btnKeepRemote").addEventListener("click", () => choose("remote"));
  $("btnDeleteOnline").addEventListener("click", async () => {
    if (
      !confirm(
        "Supprimer la sauvegarde de ton compte et ton classement en duel ? La progression de cet appareil est conservée.",
      )
    ) {
      return;
    }
    const ok = await deleteAccountProgress();
    if (ok) await signOut();
    setText("accountMessage", ok ? "Sauvegarde en ligne supprimée." : "Suppression impossible, réessaie.");
  });
}

async function askCode() {
  const email = $("accountEmail").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setText("accountMessage", "Adresse e-mail invalide.");
    return;
  }
  $("btnEmailCode").disabled = true;
  setText("accountMessage", "Envoi du code...");
  try {
    await sendEmailCode(email);
    pendingEmail = email;
    setText("accountMessage", `Code envoyé à ${email} (pense à regarder dans les spams).`);
    render();
    $("accountCode").focus();
  } catch (err) {
    console.warn("Envoi du code impossible :", err);
    setText("accountMessage", "Envoi impossible pour le moment, réessaie dans quelques minutes.");
  }
  $("btnEmailCode").disabled = false;
}

async function verifyCode() {
  const code = $("accountCode").value.replace(/\D/g, "");
  if (code.length !== 6) {
    setText("accountMessage", "Le code fait 6 chiffres.");
    return;
  }
  $("btnEmailVerify").disabled = true;
  try {
    await verifyEmailCode(pendingEmail, code);
    pendingEmail = "";
    $("accountCode").value = "";
    setText("accountMessage", "");
    await runSync();
  } catch (err) {
    console.warn("Code refusé :", err);
    setText("accountMessage", "Code incorrect ou expiré.");
  }
  $("btnEmailVerify").disabled = false;
}

async function choose(choice) {
  const result = await resolveConflict(choice);
  if (result === "restored") {
    setText("accountMessage", "Progression du compte récupérée ! Rechargement...");
    location.reload();
  } else if (result === "error") {
    setText("accountMessage", "Serveur indisponible, réessaie.");
  }
}

/** Carte d'une progression dans le choix en cas de conflit. */
function fillConflictCard(id, title, s) {
  $(id).replaceChildren(
    el("b", "", title),
    el("span", "", `Niveau ${s.level} · ${s.gold} or`),
    el("span", "", `${s.items} objets · record vague ${s.bestWave}`),
  );
}

function render() {
  const user = currentUser();
  // Accès depuis l'accueil et les Options : « Se connecter », ou « Compte » une fois connecté
  setText("btnLoginLabel", user ? "COMPTE" : "SE CONNECTER");
  setText("btnOptionsAccount", user ? "MON COMPTE" : "SE CONNECTER");
  $("btnLogin").classList.toggle("connected", !!user);
  $("btnLogin").setAttribute("aria-label", user ? "Mon compte" : "Se connecter");
  setText("loginTitle", user ? "MON COMPTE" : "CONNEXION");
  setVisible("accountOut", !user);
  setVisible("accountIn", !!user);
  setVisible("emailStep", !user && !pendingEmail);
  setVisible("codeStep", !user && !!pendingEmail);
  if (!user) return;
  setText(
    "accountWho",
    user.email ? `${user.email} (${PROVIDERS[user.provider] || user.provider})` : "compte",
  );
  setText("accountStatus", STATUS[accountSync.status] ?? "");
  const conflict = accountSync.status === "conflict" ? accountSync.conflict : null;
  setVisible("accountConflict", !!conflict);
  if (conflict) {
    fillConflictCard("btnKeepLocal", "CET APPAREIL", conflict.local);
    fillConflictCard("btnKeepRemote", "MON COMPTE", conflict.remote);
  }
}
