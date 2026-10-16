# Déménager le jeu sur last-pulse.com

Objectif : servir le jeu sur **https://last-pulse.com** sans que personne ne perde sa progression.

La progression est enregistrée dans le navigateur, et chaque domaine a la sienne. L'ancienne
adresse (`darkexxfr.github.io/2D-Game/Survivor/`) devient donc une **passerelle** : elle emporte
la progression du joueur vers last-pulse.com (`Survivor/src/transfer.js`), une seule fois.

- **last-pulse.com** : servi par **IONOS** (espace web du pack d'hébergement). À chaque push sur
  `main`, GitHub Actions envoie le dossier `Survivor/` en SFTP (`.github/workflows/deploy.yml`).
  Le cache du navigateur est réglé par `Survivor/.htaccess`. Netlify n'est plus utilisé.
  Le service worker (`Survivor/sw.js`, jeu hors connexion) doit rester servi depuis la racine du jeu et
  toujours revérifié (règle `max-age=0` du `.htaccess`) : sinon les joueurs garderaient une ancienne version.
- **GitHub Pages** reste activé sur l'ancienne adresse, **sans domaine personnalisé** : sinon GitHub
  redirigerait lui-même vers last-pulse.com, avant que la passerelle ait pu emporter les données.

## 1. Accès SFTP dans GitHub

1. IONOS → **Hébergement** → **SFTP & SSH** : noter le serveur (ex. `access-123456.webspace-host.com`)
   et l'utilisateur, créer ou réinitialiser le mot de passe.
2. GitHub → dépôt → **Settings → Secrets and variables → Actions → New repository secret** :
   `SFTP_HOST` (le serveur, sans `sftp://`), `SFTP_USERNAME`, `SFTP_PASSWORD`. Jamais dans le code.
3. Le jeu est envoyé dans le dossier `last-pulse` de l'espace web (IONOS refuse de relier un
   domaine à la racine). Pour un autre dossier : onglet **Variables** → `IONOS_DIR`.
4. **Actions → Déploiement sur IONOS → Run workflow** pour un premier envoi, et vérifier qu'il est vert.

## 2. Domaine chez IONOS

1. Si les serveurs de noms pointent encore vers Netlify (`dns1.p06.nsone.net`…) : IONOS →
   **Domaines & SSL** → `last-pulse.com` → **Serveurs de noms** → revenir aux serveurs de noms IONOS.
2. **Domaines & SSL** → `last-pulse.com` → **Utilisation du domaine** → **Espace web** → choisir le
   dossier `/last-pulse` (créé au premier envoi, ou avec le crayon). Faire de même pour `www`.
3. **Certificat SSL** : activer le certificat inclus pour `last-pulse.com` et `www`, puis
   « Rediriger HTTP vers HTTPS ».

Attendre la propagation (de quelques minutes à 48 h). Une fois le jeu affiché sur
https://last-pulse.com, supprimer le site dans Netlify.

## 3. Connexion (Supabase et Google)

- Supabase → **Authentication → URL Configuration** : **Site URL** = `https://last-pulse.com/` ;
  **Redirect URLs** : ajouter `https://last-pulse.com/` et `https://www.last-pulse.com/`.
- Google Cloud → client OAuth → **Origines JavaScript autorisées** : ajouter
  `https://last-pulse.com`. L'URI de redirection (celle de Supabase) ne change pas.

## 4. Activer la passerelle

Quand https://last-pulse.com affiche le jeu, demander à Claude d'**activer la redirection** :
`REDIRECT_ENABLED = true` dans `Survivor/src/transfer.js`, et mise à jour des adresses dans le
README, `CLAUDE.md` et les CGU. Après fusion, chaque visite de l'ancienne adresse emmène le joueur
sur last-pulse.com avec sa progression.

Garder GitHub Pages activé tant que d'anciens joueurs peuvent revenir par l'ancienne adresse
(favoris, liens partagés) : idéalement, pour toujours.
