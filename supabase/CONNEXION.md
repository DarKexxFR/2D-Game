# Activer la connexion (Google et e-mail)

La connexion est facultative : tant que ces étapes ne sont pas faites, le jeu marche comme
avant, et seuls les boutons de connexion échouent (« Envoi impossible pour le moment »).

## 1. Base de données

Dans Supabase → **SQL Editor**, exécuter `supabase/schema.sql` (ou seulement la partie
« Sauvegarde liée au compte »). Elle crée la table `account_saves` et les fonctions
`save_account_progress`, `load_account_progress` et `delete_account_progress`.

## 2. Adresses autorisées

Supabase → **Authentication → URL Configuration** :

- **Site URL** : `https://last-pulse.com/`
- **Redirect URLs** : ajouter `https://last-pulse.com/`, `https://www.last-pulse.com/`,
  `https://darkexxfr.github.io/2D-Game/Survivor/` (ancienne adresse, le temps du déménagement)
  et `http://localhost:8000/` pour tester en local.

## 3. Connexion par e-mail (code à 6 chiffres)

Supabase → **Authentication → Providers → Email** : activé (c'est le cas par défaut).

Supabase → **Authentication → Emails → Magic Link** : le jeu demande un **code**, donc le
modèle doit l'afficher. Exemple de modèle :

```html
<h2>Ton code Last Pulse</h2>
<p>Saisis ce code dans le jeu pour te connecter :</p>
<p style="font-size: 28px; letter-spacing: 6px"><b>{{ .Token }}</b></p>
<p>Si tu n'as rien demandé, ignore cet e-mail.</p>
```

**Important** : le service d'e-mail intégré à Supabase n'envoie que **quelques e-mails par
heure**, pour tout le projet. Pour de vrais joueurs, brancher un SMTP (Resend, Brevo, etc.) dans
**Project Settings → Authentication → SMTP Settings**.

## 4. Connexion Google

1. [Google Cloud Console](https://console.cloud.google.com/) → créer un projet.
2. **APIs & Services → OAuth consent screen** : type « Externe », nom de l'app « Last Pulse »,
   adresse d'assistance, lien vers `https://last-pulse.com/legal.html` comme règles de confidentialité. Portées : `email`,
   `profile`, `openid` seulement.
3. **Credentials → Create credentials → OAuth client ID** → « Web application » :
   - **Authorized JavaScript origins** : `https://last-pulse.com` et `https://darkexxfr.github.io`
   - **Authorized redirect URIs** : l'adresse de rappel affichée par Supabase dans
     **Authentication → Providers → Google** (du type `https://<projet>.supabase.co/auth/v1/callback`).
4. Copier le **Client ID** et le **Client secret** dans Supabase → **Authentication → Providers →
   Google**, puis activer.

Le _Client secret_ Google reste dans Supabase : il ne doit **jamais** être mis dans le dépôt.

## 5. Vérifier

Ouvrir le jeu → Options → Compte → « Continuer avec Google » (ou recevoir un code par e-mail).
Une fois connecté, « Progression sauvegardée sur ton compte » s'affiche, et la ligne apparaît dans
la table `account_saves`.
