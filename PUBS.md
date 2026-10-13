# Pubs récompensées avec AdSense (H5 Games Ads)

Le jeu propose deux pubs **facultatives** : revivre une fois par partie et un coffre bonus (3 par
jour). Tout passe par `Survivor/src/services/ads.js` ; la régie se choisit avec `ADS.provider` dans
`Survivor/src/config.js` (`"demo"` aujourd'hui).

L'AdSense classique ne permet **pas** les pubs récompensées. Il faut le programme
**H5 Games Ads** (Ad Placement API), en bêta fermée : Google accepte ou non le compte.
Activer l'adaptateur sans cet accord peut mettre le compte AdSense en difficulté.

## Déjà fait dans le code

- Identifiant d'éditeur `ca-pub-8968329181870538` dans `ADS.adsense.client`.
- Balise `<meta name="google-adsense-account">` dans `Survivor/index.html` (vérification du site).
- `Survivor/ads.txt`, servi à la racine de last-pulse.com (dossier publié par Netlify).
- Adaptateur `adsense` : charge le script AdSense, lance `adBreak({ type: "reward" })` quand le joueur
  clique, et ne donne la récompense que si Google confirme la pub vue (`adViewed`). Pas de pub
  disponible, pub fermée ou script bloqué : pas de récompense, le joueur peut réessayer.

## À faire de ton côté

1. Mettre le jeu en ligne sur **last-pulse.com** (voir `HEBERGEMENT.md`). Une adresse en
   `github.io` ne peut pas être validée par AdSense.
2. Dans AdSense → **Sites** : ajouter `last-pulse.com` et lancer la vérification (la balise meta et
   `ads.txt` sont déjà en place). Attendre l'approbation du site.
3. Dans AdSense → **Confidentialité et messages** : activer le message de consentement RGPD
   (obligatoire pour l'Europe). Il s'affiche via le même script, rien à coder.
4. S'inscrire à la bêta H5 Games Ads : https://developers.google.com/ad-placement/docs/beta
5. Une fois accepté : dans `config.js`, mettre `provider: "adsense"` en gardant `testMode: true`,
   vérifier sur last-pulse.com que les pubs de test s'affichent, puis passer `testMode: false`.
6. Mettre à jour `Survivor/legal.html` (section « Publicités récompensées » et cookies) : la page dit
   aujourd'hui qu'aucune régie n'est utilisée.

## Tests

`tests/ads.spec.js` remplace le script AdSense par une fausse régie (pub vue, fermée, indisponible,
script bloqué). Supabase et AdSense ne sont pas joignables depuis les tests.
