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

- **40 vagues, 7 biomes** : Cité néon, Désert rouge, Toundra, Jungle toxique, Station orbitale (6 vagues
  chacun), puis **Faille quantique** (31 à 35) et **Noyau stellaire** (36 à 40) ; au-delà, les biomes reviennent
  en boucle. Chacun a ses ennemis : 20 types (porte-bouclier, essaim, soigneur, aimant, spores, téléporteurs,
  **Déphaseur** qui devient intouchable par moments, **Réplicateur** qui se copie, **Fusionneurs** qui s'unissent
  en un plus fort, **Nova** qui charge puis explose...). Élites dès la vague 8, difficulté qui devient
  exponentielle après la vague 10 (réglée pour qu'un très bon build tienne jusqu'à la vague 40).
- **Boss** à attaques annoncées (zones, lasers, ondes de choc) et phase de furie : Roi Slime, Titan de l'orage,
  Sentinelle prismatique, Kraken, Jumeaux de feu et de glace, Colosse de givre, Faucheur du vide... Pendant un
  boss l'arène se resserre et les petits ennemis disparaissent ; les boss ne peuvent pas être repoussés.
  Un boss vaincu lâche un coffre d'augmentation.
- **Boss des vagues tardives** : **Ver des sables** (vague 17 : anneaux à briser un par un, plongée sous terre,
  éruption sous le joueur, sables mouvants), **Mère-Ruche** (vague 19 : fleurs toxiques dont le poison s'étend
  et qui lui donnent une carapace, pollen à tête chercheuse), **Chronophage** (vague 23 : bulles où les tirs
  ralentissent, cadran, pendule, retour 3 s en arrière, il rembobine sa vie si on ne frappe pas assez fort),
  **Hacker** (vague 29 : commandes inversées, pare-feu à traverser au dash, zones qui coupent le tir, clones
  holographiques en furie) et le **Cœur du Pulse** (vague 30 : attaques en rythme sur ses battements, trois
  phases, l'arène se resserre à chaque phase).
- **Boss de la fin** : **Forgeronne stellaire** (vague 32 : enclumes, drones soudés en colosse, étincelles),
  **Le Reflet** (vague 35 : copie les dashs et les armes d'appoint du joueur, en miroir), **Tisseuse du vide**
  (vague 37 : ancres reliées par des fils laser, une cage qui laisse toujours une sortie, une ancre détruite
  l'étourdit) et le boss final **L'Architecte** (vague 40 : quatre phases qui reprennent les attaques des boss
  précédents, l'arène se resserre à chaque phase).
- **Endless Pulse** : vaincre l'Architecte lance l'**Endless Pulse** sans arrêter la partie (une simple
  annonce) : chaque nouvelle vague (« pulsation ») ajoute une mutation aux
  ennemis (blindage, rage, hâte, nuée, élites, qui se cumulent) et augmente l'XP et l'or gagnés. Classement
  Endless à part et succès dédiés.
- **Armes d'appoint** : jusqu'à 3 armes en plus de l'arme équipée, trouvées dans les cartes « Arme » (missiles
  chercheurs, mines à plasma, foudre céleste, onde pulsée, faisceau rotatif, fouet laser). Chacune a 5 niveaux et
  une évolution (niveau 5 + carte partenaire : Essaim de missiles, Champ nucléaire, Jugement, Écho sismique,
  Prisme, Fouet vampire). **Fusion** : deux armes au niveau 5 se combinent avec une carte « Fusion » en une seule
  arme plus forte qui garde les deux effets et libère un emplacement (Frappe orbitale, Tapis sismique,
  Lame-prisme, Bombes à fragmentation, Arc Tesla, Cyclone). Le panneau en jeu les montre avec leur niveau.
- **Bestiaire** : la page [`bestiaire.html`](Survivor/bestiaire.html), façon wiki, a une fiche par ennemi et boss
  (53 fiches : capacités, statistiques, où le trouver, astuce, nombre éliminés). Une fiche se débloque en
  éliminant l'ennemi en jeu ; des succès récompensent 10, 25 et toutes les fiches.
- **Pouvoirs** à chaque niveau : **8 emplacements** au plus, chaque pouvoir monte jusqu'au niveau 5 (3 pour
  Berserker et Exécution, 4 pour Multi-Tir) et chaque niveau compte. Emplacements pleins = seules les cartes des
  pouvoirs possédés reviennent ; tout au maximum = cartes de secours (Réparation, Butin). Pouvoirs dont Givre,
  Ricochet, Bouclier d'énergie, Dash explosif, Arc électrique, Pulsar, Surtension ; **évolutions** (armes et compétences, dont Zéro absolu et Tempête stellaire), **cartes corrompues** (gros bonus
  contre un malus), **sanctuaires maudits** (défi à tenir 5 s pour une carte rare), **événements de carte**
  (astéroïdes, pluie acide, trou noir, pluie d'étoiles), boîte mystère, Voleur doré.
- **Anomalies de biome** : le terrain change avec le biome, pendant toutes ses vagues. Toundra de glace :
  plaques de verglas (vitesse +30 % mais le vaisseau glisse). Station orbitale : tourelles neutres à pirater
  en restant 3 s à côté (elles tirent ensuite 15 s sur les ennemis). Faille quantique : un portail dans chaque
  coin, qui envoie au coin opposé. Pendant un boss, les anomalies se replacent dans l'arène.
- **Marchand Noir** : apparaît parfois à la place d'un sanctuaire maudit (dès la vague 5). Pas d'or : il
  échange une carte déjà prise (ses effets sont retirés) ou 20 % des PV max contre une carte légendaire ou
  corrompue garantie. Une seule affaire, puis il disparaît.
- **Pause** : le build complet de la partie (armes et leur niveau, évolutions, chaque pouvoir avec son
  icône à la couleur de sa rareté, son niveau en pastilles et son effet, emplacements libres). Les fenêtres de partie (pause, choix, revivre,
  fin) ont un style néon commun.
- **Tirs alliés lisibles** : un curseur dans les Options (20 à 100 %) rend les tirs du joueur plus transparents ;
  tirs ennemis et attaques de boss restent à 100 %.
- **Renaissance** : Seconde chance, Phénix ou pub déclenchent une onde de choc autour du vaisseau.
- **Fin de partie** : statistiques détaillées, build en icônes, **ralenti de la mort** (« REVOIR MA MORT », avec « TUÉ PAR » et REJOUER sans attendre la fin)
  et **carte de score à partager** (image 1080×1350 avec vague, build et coupable, à partager depuis le
  téléphone, copier pour Discord ou télécharger).

**Modes**

- Survie en **Facile / Normal / Cauchemar** (Cauchemar débloqué à la vague 10, classement à part).
- **Défi du jour** (même partie pour tout le monde), **Boss Rush**.
- **Duel 1 contre 1** : sur un écran (écran scindé) ou en ligne (code de salon, connexion directe WebRTC).
  Les éliminations envoient des ennemis et des sorts à l'adversaire ; le gagnant empoche l'XP et l'or des deux
  parties. **Classement ELO** pour les joueurs connectés, avec des **rangs** visibles (Bronze, Argent, Or, Diamant,
  Prédateur) sur l'accueil, l'écran Duel, face à l'adversaire et dans le classement.
- **Amis** : ajout par pseudo ou code ami, présence en ligne et défi direct en duel classé.

**Progression**

- **Équipement** en 5 emplacements (héros, familier, arme, armure, module), raretés commun → légendaire puis
  **mythique** (coffre mythique), niveaux, prestige ★1 à ★5, effets ★3, panoplies, synergies familier + arme,
  3 équipements enregistrés, offre du jour en boutique. **Forge** : 3 objets en double d'une rareté + de l'or
  donnent un objet de la rareté au-dessus (jusqu'au légendaire). **Démantèlement** : un doublon légendaire = des
  Éclats de Pulse, qui relancent (au hasard) ou ciblent (au choix) les 2 **attributs de Pulse** d'un objet mythique.
- **Synergies familier + arme** : une par familier (8), et chaque arme a au moins un familier partenaire (Givre
  brisé, Souffle ardent, Moissonneuse d'âmes, Tir de barrage, Attraction fatale, Courant vital, Rempart offensif,
  Cendres ardentes).
- **Cœur Cybernétique** (écran Talents, débloqué au niveau de compte 20 ou après la vague 30) : 4 branches de 3
  passifs achetés une fois avec de l'or, au plus 3 actifs à la fois (ex. tir manuel +25 % de dégâts, arme
  d'appoint au départ contre -20 % d'or, sanctuaires maudits tenus en 3 s).
- Talents, succès avec récompenses, **quêtes hebdomadaires**, **série de connexion** sur 7 jours, **skins** du
  vaisseau (forme, couleurs, traînée), tutoriel de première partie.
- **Saison mensuelle** et son **passe gratuit** : 30 paliers (or, coffres jusqu'au mythique, une traînée et une
  coque exclusives par saison) gagnés avec l'XP de saison (parties terminées, première partie du jour, quêtes).
  Une saison = un mois, avec un thème et son classement remis à zéro le 1er ; les récompenses oubliées sont
  données d'office au changement de mois.
- **Nouveautés** : après une mise à jour, une fenêtre présente les nouvelles fonctionnalités au retour du
  joueur (à revoir dans les Options).
- **Compte facultatif** (Google, Discord ou code par e-mail) pour retrouver sa progression sur tous ses appareils.

**Application**

- **Référencement** (moteurs de recherche et IA) : phrase de présentation dans le HTML de l'accueil (lisible
  sans JavaScript, affichée pendant le chargement), données structurées schema.org `VideoGame`, résumé
  [`llms.txt`](Survivor/llms.txt), `robots.txt` et `sitemap.xml`.
- **Musique** : une piste par biome (synthwave pour la Cité néon, gamme orientale pour le Désert rouge, cloches
  aériennes pour la Toundra, percussions tribales pour la Jungle, arpèges spatiaux pour la Station, rythme déphasé
  pour la Faille quantique, nappes immenses pour le Noyau stellaire), une pour les boss (dès l'alerte), une pour le
  Cœur du Pulse (battements de cœur), une pour l'Architecte et une pour l'Endless Pulse. Composées en
  données et synthétisées en direct (Web Audio) : aucun fichier à télécharger, enchaînements en fondu calés sur
  le temps, volume baissé en pause. Les pistes de l'accueil restent des fichiers. Volume et coupure dans les Options.
- **Reprendre une partie** : quitter depuis la pause, fermer l'onglet ou mettre le téléphone en veille sauvegarde
  la partie en cours sur l'appareil (et toutes les 15 secondes de jeu) ; le bouton **REPRENDRE** de l'accueil la
  recharge telle quelle, en pause (ennemis, boss, build, choix d'amélioration en attente compris). Une mort
  efface la sauvegarde ; « Abandonner » (pause ou accueil) la jette. Pas en duel.
- **Écran de chargement** au lancement : barre de progression (fichiers du jeu, polices, images, compte en
  ligne), l'accueil n'apparaît qu'une fois tout prêt ; en cas de coupure, un bouton « RÉESSAYER ».
- **Installable** sans boutique d'applications (PWA) : icône sur l'écran d'accueil, plein écran, jouable hors
  connexion, 500 or offerts à la première ouverture depuis l'icône (bouton « Installer » de l'accueil, marche à
  suivre sur iPhone).
- **Statistiques anonymes** (désactivables dans les Options) : nombre de joueurs, temps passé, parties, sur
  la page [`stats.html`](Survivor/stats.html) réservée aux administrateurs. Mise en place :
  [`supabase/STATISTIQUES.md`](supabase/STATISTIQUES.md).
- **Journal de diagnostic** : le jeu note ce qui se passe (écrans, vague, boss, erreurs, images lentes) ; une
  erreur ou un gel part en rapport anonyme vers la partie « Erreurs du jeu » de `stats.html` (pile d'appels, état
  de la partie, dernières actions, appareil, version). Le joueur peut aussi copier son journal dans les Options.
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
├── bestiaire.html        # Bestiaire (wiki des ennemis, script src/bestiary/page.js)
├── llms.txt              # Résumé du jeu pour les IA (référencement)
├── robots.txt, sitemap.xml # Référencement : pages à explorer (stats.html exclue)
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
    ├── services/         # Sauvegarde, compte, Supabase, duel en ligne, amis, saison, statistiques, diagnostic, sons et musique, pubs
    ├── stats/            # Page des statistiques (tableau de bord, graphiques)
    └── utils/            # Maths, grille spatiale
tests/                    # Tests Playwright (un fichier *.spec.js par fonctionnalité)
supabase/                 # Schéma, guides (connexion, notifications, statistiques), fonction d'envoi des notifications
```

### Ajouter du contenu

- **Un ennemi** : une entrée **en fin** de `ENEMY_TYPES` (le duel en ligne repère les types par leur rang),
  puis dans une table d'apparition ou un biome (`src/data/enemies.js`, `src/data/biomes.js`), son comportement
  dans `MOB_BEHAVIORS` (`src/systems/enemies.js`, par exemple `src/systems/riftFoes.js`), son apparence dans
  `src/render/enemyLooks.js` et sa fiche dans `src/data/bestiary.js`.
- **Un biome** : une entrée dans `BIOMES` (`src/data/biomes.js`, vagues `from` / `to`).
- **Un boss** : son fichier dans `src/systems/bosses/` (outils dans `kit.js`), une entrée dans `index.js`,
  dans `ENEMY_TYPES` (en fin), `ENEMY_NAMES`, `BOSS_WAVES` (ou `FINALE_WAVES` pour les vagues 31 à 40) et
  `BOSS_RUSH` (`src/data/enemies.js`), ses réglages dans `src/data/bosses.js`, son sprite dans
  `src/render/bossShapes.js` ou `src/render/finaleShapes.js`, son succès
  (`kill_<type>`) et ses tests.
- **Une arme d'appoint** : une entrée dans `SIDE_WEAPONS` (`src/data/sideWeapons.js` : 5 niveaux, évolution)
  et son comportement dans `BEHAVIORS` (`src/systems/sideWeapons.js`) ; la carte et l'évolution se créent seules.
- **Une fusion d'armes** : une entrée dans `SIDE_FUSIONS` (`src/data/sideWeapons.js`, deux armes `parts`) et son
  effet combiné dans `src/systems/sideWeapons.js` ; la carte « Fusion » se crée seule.
- **Une fiche du bestiaire** : obligatoire pour chaque nouvel ennemi (`src/data/bestiary.js`, vérifié par
  `tests/bestiary.spec.js`).
- **Un pouvoir** : un objet `{ name, rarity, icon, desc, max?, canApply?, apply }` dans `UPGRADES`
  (`src/data/upgrades.js`) ; `apply` donne **un niveau**, `max` vaut `POWER_RULES.maxLevel` par défaut, les
  emplacements sont gérés seuls (effets en combat dans `src/systems/cardEffects.js`, réglages dans `src/data/cardEffects.js`).
- **Une mise à jour** : une entrée en tête de `CHANGELOG` (`src/data/changelog.js`, `id` nouveau) pour la
  fenêtre « Nouveautés ».
- **Un objet** : `src/data/items.js` (effets ★3 et panoplies dans `src/data/perks.js`).
- **Une mutation Endless Pulse** : une entrée dans `PULSE_MUTATORS` (`src/data/endless.js`).
- **Une saison** : les thèmes tournent tout seuls (`SEASON_THEMES` dans `src/data/season.js`, avec leur coque
  et leur traînée exclusives `season: true` dans `src/data/skins.js`) ; paliers dans `tierReward`.
- **Une musique** : une entrée dans `SONGS` (`src/data/music.js` : tempo, gamme, accords, motifs de 16 pas,
  sons), et une règle dans `musicThemeFor` (`src/services/audio.js`) si elle accompagne un nouveau moment.
- **Équilibrage** : `src/config.js` et `src/data/`, jamais en dur dans la logique.
