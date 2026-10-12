# Déménager le jeu sur last-pulse.com

Objectif : servir le jeu sur **https://last-pulse.com** sans que personne ne perde sa progression.

La progression est enregistrée dans le navigateur, et chaque domaine a la sienne. L'ancienne
adresse (`darkexxfr.github.io/2D-Game/Survivor/`) devient donc une **passerelle** : elle emporte
la progression du joueur vers last-pulse.com (`Survivor/src/transfer.js`), une seule fois.

- **last-pulse.com** : servi par **Netlify** (gratuit), relié à ce dépôt, mis à jour à chaque
  fusion sur `main` (réglages dans `netlify.toml`).
- **GitHub Pages** reste activé sur l'ancienne adresse, **sans domaine personnalisé** : sinon GitHub
  redirigerait lui-même vers last-pulse.com, avant que la passerelle ait pu emporter les données.

## 1. Netlify

1. Créer un compte sur [netlify.com](https://www.netlify.com) avec « Sign up with GitHub ».
2. **Add new site → Import an existing project → GitHub** → choisir `DarKexxFR/2D-Game`.
3. Branche `main`. Les réglages sont lus dans `netlify.toml` (dossier publié : `Survivor`, aucune
   commande de build) : laisser les champs tels quels → **Deploy**.
4. Vérifier que le jeu marche sur l'adresse provisoire `https://<nom>.netlify.app`.

## 2. Domaine dans Netlify (Netlify DNS)

**Domain management → Add a domain** → `last-pulse.com` → confirmer, puis **Set up Netlify DNS**.
Netlify gère alors tous les enregistrements (`@`, `www`) et affiche 4 serveurs de noms
(`dns1.p06.nsone.net` … `dns4.p06.nsone.net`).

## 3. Serveurs de noms chez IONOS

IONOS → **Domaines & SSL** → `last-pulse.com` → **Serveurs de noms** → utiliser des serveurs de
noms personnalisés → saisir les 4 serveurs affichés par Netlify → enregistrer.

Attendre la propagation (de quelques minutes à 48 h). Pendant ce temps le navigateur peut afficher
« Non sécurisé » : c'est normal. Netlify crée ensuite le certificat **HTTPS** tout seul
(**Domain management → HTTPS** ; sinon « Verify DNS configuration » puis « Provision
certificate ») ; cocher « Force HTTPS ».

Des e-mails en `@last-pulse.com` chez IONOS demanderaient de recréer leurs enregistrements `MX`
dans la zone DNS de Netlify.

## 4. Connexion (Supabase et Google)

- Supabase → **Authentication → URL Configuration** : **Site URL** = `https://last-pulse.com/` ;
  **Redirect URLs** : ajouter `https://last-pulse.com/` et `https://www.last-pulse.com/`.
- Google Cloud → client OAuth → **Origines JavaScript autorisées** : ajouter
  `https://last-pulse.com`. L'URI de redirection (celle de Supabase) ne change pas.

## 5. Activer la passerelle

Quand https://last-pulse.com affiche le jeu, demander à Claude d'**activer la redirection** :
`REDIRECT_ENABLED = true` dans `Survivor/src/transfer.js`, et mise à jour des adresses dans le
README, `CLAUDE.md` et les CGU. Après fusion, chaque visite de l'ancienne adresse emmène le joueur
sur last-pulse.com avec sa progression.

Garder GitHub Pages activé tant que d'anciens joueurs peuvent revenir par l'ancienne adresse
(favoris, liens partagés) : idéalement, pour toujours.
