# Statistiques des joueurs : mise en place et lecture

Le jeu envoie des statistiques de fréquentation **anonymes** (combien de joueurs, combien de temps, ce
qu'ils jouent) et la page **`stats.html`** les affiche, réservée aux comptes administrateurs.

## Comment ça marche

```
Jeu (navigateur)                                  Supabase
────────────────                                  ────────
ouverture du jeu ──────────────────────────────► track_session : nouvel appareil ? nouvelle session
toutes les minutes : temps actif / en partie ───► track_session : compteurs (ne font que monter)
fin de partie, victoire ou abandon ─────────────► track_run : mode, vague, durée, héros, arme, « tué par »

stats.html (connecté, compte admin) ────────────► admin_stats(jours) : tout le tableau de bord en un appel
```

- **Anonyme** : un identifiant tiré au hasard par navigateur (`survivor_app` → `analytics.id`), jamais relié
  au pseudo ni au compte. On sait seulement si un compte est connecté (oui / non). Pas d'adresse IP.
- **Désactivable** par le joueur dans les Options (« Statistiques anonymes »). Les CGU le décrivent
  (`Survivor/legal.html`, section 10).
- **Temps « actif »** : onglet visible et joueur présent (en partie, ou un clic / une touche depuis moins de
  2 minutes). **Temps « en partie »** : partie en cours, hors pause. Un appareil = un « joueur ».
- **Sécurité** : les tables `analytics_*` ne sont lisibles par personne (ni `anon` ni `authenticated`) ; le
  jeu n'écrit que par `track_session` / `track_run`, qui bornent les valeurs (pas plus vite que le temps
  réel, 30 sessions par appareil et par heure, une partie toutes les 5 s au plus). Seule `admin_stats` lit,
  et seulement pour un compte présent dans `analytics_admins`.
- Les sessions venues de `localhost` (développement) sont ignorées dans les chiffres.

## Mise en place (une fois)

1. **Schéma** : Supabase → SQL Editor → coller tout `supabase/schema.sql` → Run (le script se relance sans
   risque, il ajoute aussi les colonnes et vues des classements Saison et Endless).
2. **Se déclarer administrateur** : se connecter une fois dans le jeu avec son compte (Google, Discord ou
   e-mail), puis dans SQL Editor :

   ```sql
   insert into public.analytics_admins (user_id)
   select id from auth.users where email = 'ton-adresse@exemple.fr';
   ```

   (La page `stats.html` affiche aussi la ligne exacte à copier quand le compte n'est pas encore admin.)

3. **Nettoyage automatique** (facultatif, conseillé) : les données de plus de 13 mois sont supprimées par
   `analytics_purge()`. Avec pg_cron (déjà utilisé pour les notifications) :

   ```sql
   select cron.schedule('analytics-purge', '30 3 * * *', 'select public.analytics_purge()');
   ```

## Lire les statistiques

Ouvrir **https://last-pulse.com/stats.html** dans le navigateur où l'on est connecté au jeu. La page se met à
jour toute seule chaque minute ; période 7, 30 ou 90 jours ; jours comptés à l'heure de Paris.

| Chiffre                          | Ce que c'est                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| En ligne maintenant              | Appareils actifs dans les 2 dernières minutes                                                                            |
| Joueurs aujourd'hui / 7 j / 30 j | Appareils différents venus sur la période (DAU / WAU / MAU)                                                              |
| Nouveaux joueurs                 | Appareils venus pour la première fois                                                                                    |
| Session moyenne / médiane        | Temps actif d'une ouverture du jeu                                                                                       |
| Temps par joueur et par jour     | Temps actif moyen d'un joueur un jour où il vient                                                                        |
| Heures de jeu                    | Temps total passé en partie                                                                                              |
| Rétention J1 / J7 / J30          | Part des nouveaux joueurs revenus 1, 7 ou 30 jours après leur premier jour                                               |
| Mobile · appli · compte          | Part des sessions sur mobile, depuis l'application installée, avec un compte                                             |
| Graphiques et tableaux           | Joueurs et temps par jour, heure d'arrivée, durée des sessions, vagues, modes, ennemis qui tuent le plus, héros et armes |

Pour une question précise, les tables se lisent aussi directement dans SQL Editor
(`analytics_sessions`, `analytics_runs`, `analytics_devices`).
