# Last Pulse

Jeu de survie 2D en vagues (style _Vampire Survivors_), style néon / cyber, en JavaScript pur (modules ES),
rendu sur `<canvas>`. Le jeu n'a aucune dépendance : npm ne sert qu'aux outils (Prettier, TypeScript pour
vérifier les types, Playwright pour les tests).

## Jouer

- **En ligne** : https://last-pulse.com (hébergé chez IONOS, voir [`HEBERGEMENT.md`](HEBERGEMENT.md)).
  L'ancienne adresse https://darkexxfr.github.io/2D-Game/Survivor/ reste en place et transfère la progression.
- **En local** : les modules ES demandent un petit serveur (ouvrir `index.html` en double-cliquant ne marche pas).

```bash
npm start   # sert Survivor/ sur http://localhost:8000
```

## Contrôles

| Touche      | Action                             |
| ----------- | ---------------------------------- |
| Souris      | Viser                              |
| ZQSD / WASD | Se déplacer                        |
| Espace      | Dash                               |
| R           | Compétence du héros                |
| E           | Ouvrir la boîte mystère            |
| T           | Tir automatique (actif par défaut) |
| F           | Lancer un sort (duel)              |
| P / Échap   | Pause                              |
| 1 / 2 / 3   | Choisir une amélioration           |

Toutes les touches se changent dans les **Options**. **Sur mobile** : joystick sur la moitié gauche de l'écran,
boutons DASH et compétence à droite, tir automatique ; portrait et paysage sont jouables.

## Contenu du jeu

**Partie**

- **5 biomes** de 6 vagues (Cité néon, Désert rouge, Toundra, Jungle toxique, Station orbitale), chacun avec
  ses ennemis ; 16 types d'ennemis (porte-bouclier, essaim, soigneur, aimant, spores, téléporteurs...), élites
  dès la vague 8, difficulté qui devient exponentielle après la vague 10.
- **Boss** à attaques annoncées (zones, lasers, ondes de choc) et phase de furie : Roi Slime, Titan de l'orage,
  Sentinelle prismatique, Kraken, Jumeaux de feu et de glace, Colosse de givre, Faucheur du vide... Pendant un
  boss l'arène se resserre et les petits ennemis disparaissent ; les boss ne peuvent pas être repoussés.
  Un boss vaincu lâche un coffre d'augmentation.
- **Boss des vagues tardives** : **Ver des sables** (vague 17 : anneaux à briser un par un, plongée sous terre,
  éruption sous le joueur, sables mouvants), **Mère-Ruche** (vague 19 : fleurs toxiques dont le poison s'étend
  et qui lui donnent une carapace, pollen à tête chercheuse), **Chronophage** (vague 23 : bulles où les tirs
  ralentissent, cadran, pendule, retour 3 s en arrière, il rembobine sa vie si on ne frappe pas assez fort),
  **Hacker** (vague 29 : commandes inversées, pare-feu à traverser au dash, zones qui coupent le tir, clones
  holographiques en furie) et le boss final **Cœur du Pulse** (vague 30 : attaques en rythme sur ses
  battements, trois phases, l'arène se resserre à chaque phase).
- **Victoire et Endless Pulse** : vaincre le Cœur du Pulse gagne la partie (+2 000 or). Au choix, on termine sur
  une victoire ou on continue en **Endless Pulse** : chaque nouvelle vague (« pulsation ») ajoute une mutation aux
  ennemis (blindage, rage, hâte, nuée, élites, qui se cumulent) et augmente l'XP et l'or gagnés. Classement
  Endless à part et succès dédiés.
- **Améliorations** à chaque niveau, **évolutions** (armes et compétences), **cartes corrompues** (gros bonus
  contre un malus), **sanctuaires maudits** (défi à tenir 5 s pour une carte rare), **événements de carte**
  (astéroïdes, pluie acide, trou noir, pluie d'étoiles), boîte mystère, Voleur doré.
- **Renaissance** : Seconde chance, Phénix ou pub déclenchent une onde de choc autour du vaisseau.
- **Fin de partie** : statistiques détaillées, **ralenti de la mort** (« REVOIR MA MORT », avec « TUÉ PAR »)
  et **carte de score à partager** (image 1080×1350 avec vague, build et coupable, à partager depuis le
  téléphone, copier pour Discord ou télécharger).

**Modes**

- Survie en **Facile / Normal / Cauchemar** (Cauchemar débloqué à la vague 10, classement à part).
- **Défi du jour** (même partie pour tout le monde), **Boss Rush**.
- **Duel 1 contre 1** : sur un écran (écran scindé) ou en ligne (code de salon, connexion directe WebRTC).
  Les éliminations envoient des ennemis et des sorts à l'adversaire ; le gagnant empoche l'XP et l'or des deux
  parties. **Classement ELO** pour les joueurs connectés.
- **Amis** : ajout par pseudo ou code ami, présence en ligne et défi direct en duel classé.

**Progression**

- **Équipement** en 5 emplacements (héros, familier, arme, armure, module), raretés commun → légendaire puis
  **mythique** (coffre mythique), niveaux, prestige ★1 à ★5, effets ★3, panoplies, synergies familier + arme,
  3 équipements enregistrés, offre du jour en boutique.
- Talents, succès avec récompenses, **quêtes hebdomadaires**, **série de connexion** sur 7 jours, **skins** du
  vaisseau (forme, couleurs, traînée), tutoriel de première partie.
- **Saison mensuelle** et son **passe gratuit** : 30 paliers (or, coffres jusqu'au mythique, une traînée et une
  coque exclusives par saison) gagnés avec l'XP de saison (parties terminées, première partie du jour, quêtes).
  Une saison = un mois, avec un thème et son classement remis à zéro le 1er ; les récompenses oubliées sont
  données d'office au changement de mois.
- **Compte facultatif** (Google, Discord ou code par e-mail) pour retrouver sa progression sur tous ses appareils.

**Application**

- **Écran de chargement** au lancement : barre de progression (fichiers du jeu, polices, images, compte en
  ligne), l'accueil n'apparaît qu'une fois tout prêt ; en cas de coupure, un bouton « RÉESSAYER ».
- **Installable** sans boutique d'applications (PWA) : icône sur l'écran d'accueil, plein écran, jouable hors
  connexion, 500 or offerts à la première ouverture depuis l'icône (bouton « Installer » de l'accueil, marche à
  suivre sur iPhone).
- **Statistiques anonymes** (désactivables dans les Options) : nombre de joueurs, temps passé, parties, sur
  la page [`stats.html`](Survivor/stats.html) réservée aux administrateurs. Mise en place :
  [`supabase/STATISTIQUES.md`](supabase/STATISTIQUES.md).
- **Notifications** facultatives : série de connexion en danger, nouvelles quêtes du lundi, demandes d'ami,
  rappels après une absence. Thèmes réglables dans les Options. Mise en place :
  [`supabase/NOTIFICATIONS.md`](supabase/NOTIFICATIONS.md).

## Développement

```bash
npm install
npm run lint         # Prettier (largeur 110) + vérification de syntaxe
npm run format       # corrige le formatage
npm run typecheck    # types vérifiés par TypeScript sur le JavaScript (JSDoc + checkJs)
npx playwright test  # tests de bout en bout, PC et mobile (Pixel 7)
```

Le jeu reste en JavaScript sans compilation : TypeScript ne fait que vérifier les types écrits en commentaires
JSDoc (`jsconfig.json`). Chromium doit être disponible pour Playwright (`npx playwright install chromium`).

**GitHub Actions** : [`tests.yml`](.github/workflows/tests.yml) lance lint, typecheck et tous les tests sur
chaque PR ; [`deploy.yml`](.github/workflows/deploy.yml) envoie `Survivor/` chez IONOS (SFTP) à chaque push
sur `main`. En cas d'échec, le rapport Playwright (captures, traces) est dans l'onglet **Actions** → le run →
**Artifacts**.

Les règles du projet et les pièges connus sont dans [`CLAUDE.md`](CLAUDE.md).

## Services en ligne (Supabase)

Classements mondiaux (Normal, saison, Cauchemar, Endless, défi du jour, duel ELO), comptes, sauvegarde, amis,
salons de duel et statistiques passent par [Supabase](https://supabase.com). Sans Supabase, le jeu fonctionne avec le classement local.

- Schéma complet (tables, vues, RPC, règles anti-spam) : [`supabase/schema.sql`](supabase/schema.sql), à
  exécuter dans **SQL Editor** après chaque changement.
- Connexion Google / Discord / e-mail : [`supabase/CONNEXION.md`](supabase/CONNEXION.md).
- Notifications (clés VAPID, fonction Edge `send-push`, envoi planifié) :
  [`supabase/NOTIFICATIONS.md`](supabase/NOTIFICATIONS.md).
- Statistiques des joueurs (compte administrateur, page `stats.html`) :
  [`supabase/STATISTIQUES.md`](supabase/STATISTIQUES.md).
- Seule la clé publique `sb_publishable_…` va dans `Survivor/src/config.js`, jamais une clé secrète.

Publicités récompensées (revivre, coffre bonus) : démo interne pour l'instant, AdSense en préparation
(voir [`PUBS.md`](PUBS.md)).

## Structure

```
Survivor/
├── index.html            # Structure HTML
├── manifest.webmanifest  # Application installable : nom, icônes, raccourcis
├── sw.js                 # Service worker : jeu hors connexion et notifications
├── legal.html            # CGU et confidentialité
├── stats.html            # Statistiques des joueurs (administrateurs, voir supabase/STATISTIQUES.md)
├── assets/               # Logo, icônes, musiques
├── css/                  # Un fichier par écran (base, hud, menus, home, inventory, versus...)
└── src/
    ├── boot.js           # Écran de chargement (avant les modules), puis main.js prend le relais
    ├── main.js           # Point d'entrée : cycle de vie d'une partie et boucle à 60 ticks/s
    ├── config.js         # Constantes et équilibrage
    ├── core/             # État global, canvas, entrées, bus d'événements
    ├── data/             # Données pures : ennemis, objets, améliorations, biomes, succès, quêtes, icônes
    ├── systems/          # Logique par tick : joueur, ennemis, combat, boss, duel, événements...
    │   └── bosses/       # Un fichier par boss récent (+ kit.js : outils communs à tous les boss)
    ├── render/           # Dessin sur le canvas (sprites néon en cache, ralenti de la mort, carte de score)
    ├── ui/               # Menus DOM (un écran visible à la fois, adresse #modal=... par écran)
    ├── services/         # Sauvegarde, compte, Supabase, duel en ligne, amis, saison, statistiques, sons, pubs
    ├── stats/            # Page des statistiques (tableau de bord, graphiques)
    └── utils/            # Maths, grille spatiale
tests/                    # Tests Playwright (un fichier *.spec.js par fonctionnalité)
supabase/                 # Schéma, guides (connexion, notifications, statistiques), fonction d'envoi des notifications
```

### Ajouter du contenu

- **Un ennemi** : une entrée **en fin** de `ENEMY_TYPES` (le duel en ligne repère les types par leur rang),
  puis dans une table d'apparition ou un biome (`src/data/enemies.js`, `src/data/biomes.js`).
- **Un boss** : son fichier dans `src/systems/bosses/` (outils dans `kit.js`), une entrée dans `index.js`,
  dans `ENEMY_TYPES` (en fin), `ENEMY_NAMES`, `BOSS_WAVES` et `BOSS_RUSH` (`src/data/enemies.js`), ses
  réglages dans `src/data/bosses.js`, son sprite dans `src/render/bossShapes.js`, son succès
  (`kill_<type>`) et ses tests.
- **Une amélioration** : un objet `{ name, rarity, icon, desc, canApply?, apply }` dans `src/data/upgrades.js`.
- **Un objet** : `src/data/items.js` (effets ★3 et panoplies dans `src/data/perks.js`).
- **Une mutation Endless Pulse** : une entrée dans `PULSE_MUTATORS` (`src/data/endless.js`).
- **Une saison** : les thèmes tournent tout seuls (`SEASON_THEMES` dans `src/data/season.js`, avec leur coque
  et leur traînée exclusives `season: true` dans `src/data/skins.js`) ; paliers dans `tierReward`.
- **Équilibrage** : `src/config.js` et `src/data/`, jamais en dur dans la logique.
