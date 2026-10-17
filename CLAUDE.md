# CLAUDE.md — Last Pulse

Mémo pour Claude (et tout contributeur) : comment le projet est organisé, les règles à
respecter et les pièges déjà rencontrés. À lire avant toute modification, à tenir à jour
quand une règle change.

## Le projet

**Last Pulse** : jeu de survie 2D en vagues (style _Vampire Survivors_), style néon / cyber,
en JavaScript pur (modules ES), rendu sur `<canvas>`. Aucune dépendance côté jeu ; npm ne
sert qu'aux outils (Prettier, Playwright).

- En ligne (GitHub Pages) : https://darkexxfr.github.io/2D-Game/Survivor/
- Déménagement en cours vers **https://last-pulse.com**, hébergé chez **IONOS** (envoi SFTP par
  `.github/workflows/deploy.yml` à chaque push sur `main`, cache réglé dans `Survivor/.htaccess`) : voir
  `HEBERGEMENT.md`. L'ancienne adresse devient une passerelle (`src/transfer.js`, activée par
  `REDIRECT_ENABLED`) qui emporte la progression du navigateur. **Ne jamais** mettre le domaine
  personnalisé dans les réglages GitHub Pages : GitHub redirigerait avant le transfert.
- Le dossier du jeu s'appelle encore `Survivor/` (ancien nom) : **ne pas le renommer**,
  l'URL GitHub Pages en dépend.
- Langue : interface, commentaires, messages de commit, titres et descriptions de PR en
  **français**. Le propriétaire (DarKexxFR) échange en français.

## Commandes

```bash
npm start            # sert le jeu sur http://localhost:8000 (python3 http.server)
npm run lint         # Prettier (largeur 110) + vérification de syntaxe (scripts/check-syntax.mjs)
npm run format       # corrige le formatage
npm run typecheck    # vérifie les types (TypeScript sur le JavaScript, via JSDoc + checkJs ; sw.js à part)
npx playwright test  # tests de bout en bout (projets « desktop » et « mobile » Pixel 7)
npx playwright test tests/home.spec.js --project=mobile --repeat-each=5   # traquer un test instable
```

La CI GitHub (`.github/workflows/tests.yml`) lance `npm run lint`, `npm run typecheck` puis tous les tests
Playwright sur chaque PR. Toujours lancer les trois en local avant de pousser.

## Architecture (`Survivor/src/`)

| Dossier      | Rôle                                                                                                                                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config.js`  | Constantes et équilibrage (`STORAGE_KEYS`, `TICK_MS`, `MAP_BOUNDS`, `PLAYER_DEFAULTS`, config Supabase…)                                                                                                                                                                                                     |
| `core/`      | `state.js` (état global : `game`, `player`, `world`, `camera`, `pet`), `canvas.js` (`ctx`, `view`, qualité), `input.js` (actions clavier/souris/tactile), `events.js` (bus `emit` / `on`)                                                                                                                    |
| `data/`      | Données pures : `items.js` (armes, armures, HEROES, PETS, CHESTS), `upgrades.js` (+ EVOLUTIONS), `enemies.js`, `biomes.js`, `talents.js`, `achievements.js`, `icons.js` (tracés SVG)                                                                                                                         |
| `systems/`   | Logique de jeu par tick : `player`, `enemies`, `combat`, `spawner`, `pickups`, `skills`, `pet`, `equipment`, `effects`, `mysteryBox`, `hazards` (attaques de zone des boss)                                                                                                                                  |
| `render/`    | Dessin : `renderer.js` (ordre des couches), `entities.js`, `world.js`, `effects.js`, `sprites.js` (sprites néon en cache), `menuScene.js` (scène animée de l'accueil)                                                                                                                                        |
| `services/`  | Persistance et réseau : `storage.js` (compte), `settings.js`, `inventory.js`, `supabase.js`, `onlineLeaderboard.js`, `cloudSave.js` (code secret), `auth.js` (connexion Google / Discord / e-mail), `accountSync.js` (sauvegarde du compte), `daily.js`, `ads.js` (pubs récompensées), `audio.js` / `sfx.js` |
| `ui/`        | Menus DOM : `screens.js` (un seul écran visible), `mainMenu.js`, `hud.js`, `dom.js` (écritures DOM en cache), `icons.js`…                                                                                                                                                                                    |
| `main.js`    | Point d'entrée : initialisation et boucle principale                                                                                                                                                                                                                                                         |
| `../assets/` | Logo (`logo-mark.svg` = symbole en favicon ; `logo-wordmark.svg` = logo texte, non utilisé : le titre de l'accueil reste en texte, au choix du propriétaire), favicons, icône d'app, musiques                                                                                                                |

Principes :

- **Pas fixe à 60 Hz** (`TICK_MS`) : la logique avance en ticks, le rendu suit le
  `requestAnimationFrame`. Les durées de jeu sont en ticks, pas en millisecondes.
- **Grille spatiale** `enemyGrid` reconstruite à chaque tick (et dans `activateSkill`) pour
  les collisions : toute recherche d'ennemis proches passe par elle.
- **Écritures DOM en cache** : utiliser `setText`, `setVisible`, `setClass`, `setWidth` de
  `ui/dom.js` (évite de réécrire le DOM chaque frame). `setVisible` met `display: block`.
- **Panneau en jeu** (`#ui`, `ui/hud.js`, `css/hud.css`) : vague + éliminations + or, minuteur, vie, jauges
  dash / compétence, stats ; sur téléphone seulement les trois premières lignes. **Aucune aide des touches
  à l'écran** (choix du propriétaire) : les touches se voient dans les Options et le tutoriel.
- **Sprites** : dessinés une fois dans des canvas hors écran (`getSprite` / `drawSprite`).
  Lueur via `shadowBlur` ; la qualité basse la coupe.
- **Icônes** : `<i data-icon="nom">` dans le HTML (remplacé par `hydrateIcons`), ou
  `icon(nom, couleur)` en JS. Taille = `font-size`, couleur = `color`.
- **Équilibrage** : les valeurs vivent dans `config.js` ou `data/`, jamais en dur dans la logique.
- **Pubs récompensées** : `services/ads.js` → `showRewardedAd(placement)` renvoie `true` si la pub
  est vue en entier. Régie choisie par `ADS.provider` dans `config.js` (`"demo"` = fausse pub
  interne, `"adsense"` = AdSense H5 Games Ads, `"none"` = désactivé) ; une vraie régie = un adaptateur
  de plus dans `PROVIDERS`. AdSense : étapes et conditions dans `PUBS.md` (bêta fermée, domaine
  last-pulse.com, `Survivor/ads.txt`).
  Utilisées pour revivre (1 fois par partie, jamais en défi du jour) et le coffre bonus (limité par jour).
  Dans les tests, `killPlayer` / `declineRevive` refusent l'offre « revivre ».
- **Pages légales** : `Survivor/legal.html` (CGU + confidentialité). À mettre à jour à chaque nouvelle
  donnée collectée ou nouvelle régie pub. Éditeur : pseudo DarKexxFR (site non commercial) ;
  contact choisi par le propriétaire. À repasser en version professionnelle (identité, statut)
  si le jeu génère des revenus (vraie régie pub).
- **Boss** : chaque boss enchaîne un cycle d'attaques **annoncées** (`systems/hazards.js` : zone ronde,
  laser, onde de choc ; le dash et le bouclier protègent) et passe en « furie » sous 50 % de vie.
  `e.rooted` immobilise un boss pendant une attaque. Le Roi Slime est volontairement laissé tel quel.
  Le **Titan de l'orage** étourdit le joueur (option `stun` des attaques, `stunPlayer` dans
  `systems/player.js`, réglages `STUN` dans `config.js` : ni déplacement, ni dash, ni compétence, puis
  courte insensibilité). La **Sentinelle prismatique** utilise des lasers tournants (option `spin`).
  Le **Kraken** reste sous l'eau (`e.submerged` : ni touché, ni visé, ni dans la grille) tant que ses
  tentacules (`kraken_tentacle`) tiennent, aspire le joueur (tourbillon), puis expose sa tête (`KRAKEN`).
  Les **Jumeaux** (`twin_fire` fait apparaître `twin_ice`) sont reliés par un lien qui blesse, se croisent
  (« ciseaux »), lancent ensemble « Éclipse » (lasers tournants en sens contraires), le lien soigne le plus
  abîmé (« Lien vital »), furie commune sous 50 % de vie à eux deux ; feu : mur de feu, nova ; glace : prison de glace
  (une sortie), vague de givre. Le survivant se venge ; un seul coffre, bonus « SYNCHRO » si tués presque ensemble (`TWINS`).
  Un boss vaincu lâche un **coffre d'augmentation** (`chest` dans `data/enemies.js`) : choix d'une
  amélioration rare+ et or (`BOSS_CHEST` dans `config.js`). Le **Voleur doré** fuit et lâche de l'or.
  Combat de boss : à l'arrivée d'un boss les petits ennemis disparaissent et plus aucun n'apparaît tant
  qu'il vit (`BOSS_ARENA` dans `data/enemies.js`, sauf le Crabe blindé ; choix du propriétaire). Comme ils
  combattent seuls, les boss sont renforcés (`BOSS_POWER` : PV, dégâts, taille ; PV en plus à chaque vague).
  **Roi Slime** : saut annoncé (enchaîné en furie), pluie de slime collante, absorbe ses petits pour se soigner,
  « mitose » en furie, se divise à sa mort (`SLIME_KING`).
  Vitesse de déplacement du joueur plafonnée à `STAT_CAPS.speed` (tous bonus compris).
  **Les boss ne se poussent pas** : tout recul ou attraction d'ennemi passe par `systems/knockback.js`
  (`knockEnemy`, `pullEnemy`, `pushEnemy`), qui ignore les boss (choix du propriétaire) ; seuls leurs
  propres mouvements (sauts, charges, téléportations) les déplacent.
- **Difficulté** : linéaire jusqu'à la vague 10, puis PV / dégâts ennemis exponentiels
  (`WAVE_SCALING.rampFrom`), élites dès la vague 8 (`ELITE`), défense en % et soins corrompus après
  la vague 12 (`SURVIVAL` dans `config.js`) ; cœur fissuré violet `#healCorruption` près de la barre de vie
  (% au survol) et rappel dans la Pause. Objectif : même le meilleur build finit par mourir
  (vers la vague 30). Mesuré avec un banc d'essai (build fixe, morts par minute selon la vague).
- **Succès** : `data/achievements.js` (catégorie, statistique suivie, seuil, or gagné) ; les statistiques
  se mettent à jour via `addStat` / `recordBest` / `recordKill` de `services/achievements.js`.
- **Menus** : en-tête commun `.menu-head` (titre, sous-titre `.menu-sub`, `.gold-pill`) et
  `.menu-wide` pour les écrans larges (boutique, équipement, talents, succès), sur le modèle du défi du jour.
- **Adresse de la page** (`ui/router.js`) : `showScreen` met l'adresse à jour (`#modal=option`,
  `#modal=boutique`… ; `#jeu` en partie ; rien sur l'accueil). Le retour du navigateur ferme l'écran
  ouvert (`navigate` dans `main.js` ; en partie il met en pause, jamais ne quitte). Un lien vers un
  menu de l'accueil l'ouvre ; un rechargement revient à l'accueil. Nouvel écran = une entrée dans
  `ROUTES` (et dans `MENUS` de `main.js` s'il doit s'ouvrir par lien).
- **Compte (facultatif)** : connexion Google, Discord ou code à 6 chiffres par e-mail, via l'API REST
  d'authentification de Supabase (pas de bibliothèque). Fenêtre `loginMenu` (`ui/accountMenu.js`,
  `openLogin`), ouverte par le bouton « Se connecter » de l'accueil ou depuis les Options. `accountSync.js` ne doit **jamais** écraser
  une progression en silence : il retient la dernière version échangée par appareil
  (`survivor_account_sync`) et demande au joueur de choisir quand l'appareil et le compte ont tous
  deux avancé. Réglages côté Google / Discord / Supabase : `supabase/CONNEXION.md`. Les tests simulent
  l'authentification dans `fixtures.js` (`EMAIL_CODE`, `GOOGLE_EMAIL`, `DISCORD_EMAIL`).
- **Duel** (`systems/versus.js`, bouton « DUEL 1V1 ») : chaque joueur joue sa propre partie de survie
  (règles normales, équipement et talents du compte) ; le premier mort perd et le gagnant empoche l'XP et
  l'or des **deux** parties (choix du propriétaire). Pas d'offre « revivre » en duel. Réglages : `VERSUS`
  dans `config.js`.
  - **Attaques** (`systems/duelAttacks.js`, réglages `VERSUS.attack` / `VERSUS.spell`, choix du propriétaire :
    les deux) : chaque élimination remplit une jauge d'attaque (pleine = ennemis envoyés chez l'adversaire,
    marqués `sent` ; un boss tué envoie des élites) et une jauge de sort. Pleine, celle-ci tire au hasard
    un sort (ralenti, brouillard, tir coupé) que le joueur lance à la main (J1 F, J2 Ctrl / 2, en ligne
    l'action `spell` = F ou le bouton SORT). Sort subi = `game.hex`, qui s'estompe tout seul.
  - **Récap de fin** (`ui/duelRecap.js`, canvas `#versusChart`) : courbe de vie des deux joueurs (un point par
    seconde dans `game.duelLog`, celle de l'adversaire en ligne dans `rival.log` à partir de ses statistiques)
    avec les attaques (▲, ◆ élites) et sorts (●) envoyés, plus « Attaques envoyées » / « Sorts lancés » au tableau.
  - **Sur un écran** : écran scindé (côte à côte, ou J1 en bas en portrait). Le moteur n'a qu'un état
    global : la partie de l'autre joueur est rangée de côté et échangée le temps de la faire avancer ou de
    la dessiner (`withRun(i, fn)` : échange `game`, `player`, `world`, `pet`, `camera`, `mysteryBox`,
    `trailState`, réduit `view` à la moitié d'écran et branche les touches du joueur via
    `useInputProfile`). Tout nouvel état de partie au niveau d'un module doit vivre dans ces objets
    (sinon il fuit d'une partie à l'autre). J1 ZQSD + Espace (dash) + E / R (compétence), J2 flèches +
    Entrée / 0 + Maj / 1 ; en tactile une moitié d'écran chacun (toucher = dash, bouton de compétence).
    Montée de niveau : choix dans la moitié du joueur (`ui/duelPicks.js`), seule sa partie s'arrête, choix
    automatique au bout de `VERSUS.pickSeconds`. Bandeaux dessinés sur le canvas (`render/versus.js`).
    Pas de boîte mystère (pas de touche libre).
  - **En ligne** (écran « Duel » → créer / rejoindre avec un code) : `services/realtime.js` (client
    Supabase Realtime minimal, sans bibliothèque) sert de salon et de signalisation, `services/netplay.js`
    ouvre une connexion directe WebRTC, ou relaie les messages par Supabase si elle échoue (`NET` dans
    `config.js`). Chaque appareil fait tourner sa partie et envoie ses statistiques (`systems/versusOnline.js`) ;
    panneau de l'adversaire `#duelRival`. **Partie de l'adversaire en direct** en haut à droite
    (`render/rivalView.js`) : chaque appareil envoie sa scène (`t: "vw"`, vaisseau + ennemis proches avec un
    `id` stable, `NET.viewPerSecond`) et l'autre la redessine avec les vrais sprites, mouvements lissés. Deux morts qui se croisent : meilleur score, puis XP, puis l'hôte.
    Quitter = abandon. Pas de pause ; choix d'amélioration automatique au bout de `VERSUS.pickSeconds`.
    **Classement ELO** (`services/duelRanking.js`, onglet « DUEL ELO » du classement) : joueurs connectés
    seulement, départ 1000, K = 32. L'hôte tire un identifiant de duel (`match`) ; chaque joueur le
    déclare avec `report_duel` et le serveur ne compte le duel que si les deux déclarations concordent
    (jamais sur la parole d'un seul client). Quitter un duel classé = défaite déclarée. Anti-farm : plus de
    points après 5 duels comptés entre les deux mêmes joueurs en 24 h. Tests : faux RPC dans `fixtures.js`.
    Les tests simulent Realtime avec `routeWebSocket` (`tests/versus-online.spec.js`). Choix du
    propriétaire : du **duel** en ligne, pas de coop.
  - **Amis** (`services/friends.js`, écran `ui/friendsMenu.js` ouvert par le bouton « AMIS » de l'accueil, avec amis en ligne et demandes reçues, ou par « MES AMIS » de l'écran Duel ; RETOUR ramène à l'écran d'origine) : joueurs
    connectés seulement. Ajout par pseudo (s'il est unique) ou code ami, demande à accepter (tables
    `player_profiles` / `friendships`, RPC `friends_sync` / `friend_request` / `friend_respond` / `friend_remove`).
    Présence : `friends_sync` toutes les `FRIENDS.syncMs` (en ligne = vu depuis moins de 75 s, statut menu / jeu /
    duel). Chaque joueur écoute son canal Realtime `amis-<id>` : « DÉFIER » crée une partie de duel et y envoie
    le code, l'ami accepte (fenêtre `#friendInvite`) et rejoint ; duel en ligne habituel, donc classé ELO avec
    les mêmes règles anti-abus. En partie, un défi reçu est refusé « occupé ». Tests : faux RPC dans `fixtures.js`.
- **Choix d'amélioration** (`ui/upgradeMenu.js`) : aussi au clavier (1 / 2 / 3, flèches ou ZQSD +
  Entrée / Espace, carte surlignée) ; Entrée / Espace sont ignorés juste après
  l'ouverture pour qu'un dash ne valide pas une carte. Le tir auto est actif par défaut (T le coupe).
- **Boss Rush** : `game.rush` (sinon `null`), ordre et réglages dans `BOSS_RUSH` (`data/enemies.js`).
  Pas de petits ennemis ni de minuteur ; `game.wave` prend la vague habituelle du boss (PV, biome).
  Record = statistique de succès `bestBossRush` ; hors classements.
- **Skins** (`data/skins.js`, `services/skins.js`, écran `ui/skinMenu.js`) : forme de coque, couleur du
  vaisseau, des tirs et de la traînée (`systems/trail.js` + `render/trail.js`), couleur libre ou
  arc-en-ciel. Formes et traînées payantes en or (`account.skinsOwned`), à l'essai dans l'aperçu avant
  l'achat. Purement cosmétique, ignoré en duel (chaque joueur garde sa couleur).
- **Évolutions d'armes** (`WEAPON_EVOLUTIONS` dans `data/upgrades.js`) : arme équipée + carte partenaire
  (ex. Blaster + Force Brute ×3 → Blaster solaire) ; l'arme garde sa couleur.
  Une carte qui rapproche une évolution dont l'autre ingrédient est déjà possédé affiche l'évolution visée
  en bas (`evolutionsFor` / `evolutionHint`).
- **Quêtes hebdomadaires** (`data/quests.js`, `services/quests.js`, écran `ui/questMenu.js`) : 3 quêtes
  par semaine, les mêmes pour tous (tirage à graine sur la semaine), renouvelées le lundi à 0 h (heure
  locale). Elles suivent les statistiques des succès (`trackQuest` / `trackQuestBest` appelés par
  `services/achievements.js`) ; « atteindre » = record de la semaine. Or à récupérer à la main, bonus quand
  les 3 sont récupérées (`WEEKLY` dans `config.js`). État dans `account.weekly`, donc synchronisé avec le compte.
- **Tutoriel** (`ui/tutorial.js`, réglages `TUTORIAL` dans `config.js`) : bulles pendant la première partie
  normale (se déplacer, tir auto, dash, XP, compétence quand la jauge est pleine, boîte mystère si on passe
  à côté), qui avancent quand le joueur fait l'action ; textes PC ou tactile, touches lues dans les réglages.
  Bouton « PASSER » ; fait ou passé = `account.tutorialDone` (synchronisé avec le compte ; vrai d'office
  pour une ancienne sauvegarde qui a déjà des parties). « REVOIR » dans les Options le repropose.
- **Équipement** (`data/items.js`, `services/inventory.js`, écran `ui/inventoryMenu.js`) : 5 emplacements
  (héros, familier, arme, armure, **module** = puce de bonus). Raretés commun → légendaire, puis **mythique**
  (rouge `#ff3b30`) : uniquement dans le **coffre mythique** (5 %, choix du propriétaire : très rare mais très
  fort), toutes catégories. **Effet ★3** par objet et **panoplies** arme + armure (`data/perks.js`, comportements
  dans `systems/perks.js`, état sur `player` pour le duel). Fiche d'objet : comparaison avec l'objet équipé,
  3 équipements enregistrés (`account.loadouts`). Boutique : **offre du jour** (`dailyOffer`, jamais mythique,
  une fois par jour, `account.dailyOffer`).
- **Niveaux de difficulté** (`DIFFICULTIES` dans `config.js`, `services/difficulty.js`, choix sous JOUER) :
  Facile / Normal / Cauchemar, partie normale seulement (défi du jour, Boss Rush et duel restent en Normal).
  Appliqués via `game.modifier` (`enemyHealth`, `enemyDamage`, `enemySpeed`, `eliteShift`, `enemyXp`,
  `goldMult`) ; choix dans `account.difficulty`. Cauchemar débloqué au record de vague 10, classement mondial
  à part (table `nightmare_scores`, onglet « CAUCHEMAR »), succès dédiés ; Facile hors classements.
- **Biomes** (`data/biomes.js`) : 5 biomes de 6 vagues (Cité néon, Désert rouge, Toundra, Jungle toxique,
  Station orbitale), chacun ajoute ses ennemis (`enemies`). Cité néon : porte-bouclier (bloque les tirs de
  face, pivote lentement), essaim (nuée de 6, `group`) ; jungle : spore (se divise en sporelets), poseur de
  mines ; station : téléporteur, drone laser. Partout : soigneur dès la vague 10, aimant (attire le joueur, le
  dash libère) dès la vague 12 (`SPAWN_TABLES`). Réglages `BIOME_FOES` dans `data/enemies.js`. Nouveau type
  d'ennemi = toujours en fin de `ENEMY_TYPES` (le duel en ligne repère les types par leur rang).
- **Série de connexion** (`services/loginStreak.js`, `ui/streakMenu.js`, `LOGIN_STREAK` dans `config.js`) :
  or chaque jour d'affilée (jour local), cycle de 7 jours, un jour manqué = retour au jour 1. Fenêtre proposée
  au chargement de l'accueil, sauf à un joueur sans partie terminée. État dans `account.loginStreak`.
- **Cartes « Corrompues »** (`CORRUPTED_UPGRADES` dans `data/upgrades.js`, rareté `corrupted`) : gros bonus
  contre un malus (`malus`, affiché en rouge), une fois par partie chacune ; jamais dans un coffre de boss ni
  un sanctuaire maudit. Surcharge moteur, Singularité, Pacte de sang, Cœur de verre, Fièvre de l'or.
- **Sanctuaires maudits** (`systems/cursedShrines.js`, `CURSED_SHRINE` dans `config.js`) : totem rouge dès la
  vague 3 ; entrer dans le cercle lance le défi (élites en deux salves), tenir 5 s = carte rare / épique
  (`showShrineReward`, choix « shrine ») ou or. Jamais pendant un boss ni en Boss Rush.
- **Synergies familier + arme** (`SYNERGIES` dans `data/perks.js`, `player.synergy`) : Cristal de givre +
  Railgun (éclats de glace sur les ennemis gelés), Dragonnet + Lance-flammes (aura et portée +20 %).
  Affichées dans l'équipement (bandeau et fiche) et annoncées en début de partie.
- **Renaissance** (`rebirth` dans `systems/player.js`, réglages `REVIVE` dans `config.js`) : chaque retour à la vie
  (Seconde chance, Phénix consommé en premier avec ses ailes de feu, Renaissance céleste, pub) joue une animation
  (effet `rebirth` dans `render/effects.js`) et une onde de choc : ennemis tués au corps à corps, boss et tentacules
  seulement blessés (ni tués ni repoussés), les autres proches repoussés, tirs ennemis effacés.
- **Ralenti de la mort** (`systems/killCam.js` enregistre, `render/killCam.js` rejoue, réglages `KILL_CAM`) :
  les 4 dernières secondes (vaisseau, ennemis, tirs, attaques de zone autour du vaisseau) sont gardées dans
  `game.killCam` ; « REVOIR MA MORT » sur l'écran de fin les rejoue façon cinéma (ralenti et zoom sur la fin,
  explosion, « TUÉ PAR » + viseur sur le coupable). `takeDamage(montant, source)` : source = l'ennemi, son type
  ou un événement de carte ; sans source, c'est le boss en vie. Pas en duel.
- **Carte de score** (`render/shareCard.js` dessine, `ui/shareMenu.js` écran `shareMenu`, `#modal=partage`) :
  bouton « PARTAGER » de l'écran de fin ; image 1080×1350 (vague, stats, build, « tué par ») tirée d'un
  résumé figé par `showGameOver` (`runSummary`). Partage natif si le navigateur sait partager un fichier,
  COPIER (presse-papiers, pour Discord) et TÉLÉCHARGER (PNG). Pas en duel.
- **Application installable (PWA)** : `Survivor/manifest.webmanifest`, `Survivor/sw.js` (service worker),
  `services/pwa.js` (enregistrement, installation, cadeau `PWA.installReward` à la première ouverture depuis
  l'icône = `account.appInstalled`), écran `ui/appMenu.js` (`installMenu`, `#modal=installer`, bouton
  `#btnInstall` de l'accueil après une partie terminée, marche à suivre sur iPhone). Pas de boutique
  d'applications (choix du propriétaire : gratuit). Cache du service worker : **réseau d'abord** pour le
  code (jamais de mélange d'anciens et de nouveaux modules), cache d'abord pour images / sons / polices ;
  aucune liste de fichiers à tenir à jour. Ne changer `VERSION` dans `sw.js` que si son comportement change.
- **Notifications (Web Push)** : `services/notifications.js` calcule les rappels à l'heure locale
  (`buildReminders` : série le lendemain à 19 h, quêtes le lundi, retours après 3 et 10 jours, réglages `PUSH`)
  et les envoie avec l'abonnement (RPC `push_subscribe`, seulement si quelque chose a changé). Le serveur ne fait
  qu'expédier : fonction Edge `supabase/functions/send-push` (textes des notifications, lots `push_claim` /
  `push_report`, `for update skip locked`), planifiée par pg_cron ; demandes d'ami par déclencheur SQL.
  État propre à l'appareil dans `survivor_app` (`services/appState.js`), jamais dans la sauvegarde du compte.
  Clé publique VAPID dans `PUSH.vapidPublicKey` (vide = notifications masquées) ; la clé privée ne va que
  dans les secrets Supabase. Mise en place : `supabase/NOTIFICATIONS.md`. Proposition « Être prévenu ? »
  (`maybeAskPush`) après la série du jour ou au retour d'une partie, jamais redemandée avant 14 jours.
- **Défi du jour** : `Math.random` est remplacé par un RNG à graine pendant la partie
  (`useSeed` / `restoreRandom` dans `services/daily.js`).

## Règles importantes

- **Sauvegardes** : ne jamais renommer les clés `survivor_*` de `STORAGE_KEYS` (les joueurs
  perdraient leur progression). Un changement de format = migration dans `storage.js`.
- **Supabase** : seule la clé publique `sb_publishable_…` (dans `config.js`) a sa place dans
  le code. **Jamais** de clé secrète (`sb_secret_…`, JWT service_role) dans le dépôt, les
  commits ou les messages. Le schéma (tables, vues, RPC, triggers anti-spam) est dans
  `supabase/schema.sql` ; le propriétaire l'exécute lui-même dans Supabase. Supabase
  n'est pas joignable depuis l'environnement de Claude : les tests le simulent.
- **Types (JSDoc + checkJs)** : le jeu reste en JavaScript, sans compilation (le dossier `Survivor/` est
  envoyé tel quel). TypeScript ne sert qu'à vérifier le code (`jsconfig.json`, mode non strict). Préciser
  les types en commentaires JSDoc (`@param`, `@type`, `@typedef`, conversion `/** @type {HTMLElement} */ (x)`) ;
  les globales (`window.…`) se déclarent dans `types/globals.d.ts`. Ne pas passer en `.ts`.
- **Formatage** : Prettier, largeur 110 (`.prettierrc`). Lancer `npm run format` après édition.
- **Styles** : couleurs néon (cyan `#00ffff`, rose `#ff2a6d`, violet `#aa66ff`, vert
  `#00ff88`, or `#ffd700`), polices Orbitron et « Press Start 2P ». `base.css` contient
  `* { overflow: hidden }` : penser à `overflow: visible` pour les lueurs et badges qui débordent.
- **Performances** : pas de `shadowBlur` pour ce qui se dessine par dizaines à chaque image (explosions,
  textes de dégâts, éclairs, étincelles) : il gelait le jeu sur téléphone à forte cadence de tir. Lueur =
  forme plus large et transparente dessous ; le flou reste réservé aux sprites en cache. Effets plafonnés
  (`LIMITS` dans `config.js`), au plus `LIMITS.ticksPerFrame` ticks rattrapés par image (`tests/performance.spec.js`).
- **Effets de survol** : uniquement sous `@media (hover: hover)`. Sur écran tactile le
  survol reste « collé » ; un bouton qui bouge au survol tremble en boucle (cassait la CI). Les boutons ne se
  déplacent plus au survol (un pointeur posé sur leur bord les faisait trembler).

## Tests (`tests/`)

- `fixtures.js` simule Supabase (classement, RPC `save_progress` / `load_progress`) et
  fournit : `game(page, fn, arg)` (exécute du code avec les modules du jeu), `withSave(page,
save)` (injecte une sauvegarde avant le chargement), `startGame(page, { invincible,
levelUps })`, `killPlayer(page)`.
- Chaque fonctionnalité a son fichier `*.spec.js`. Ajouter ou mettre à jour un test avec
  chaque changement de comportement.
- Le service worker est bloqué dans les tests (`serviceWorkers: "block"` dans `playwright.config.js`) sauf
  dans `tests/pwa.spec.js` et `tests/pwa-push.spec.js` (Chromium complet : le « headless shell » refuse
  les notifications) : `page.route` ne voit pas les requêtes qu'il sert. Les notifications y sont
  simulées (`fakePushService`, clé VAPID injectée dans `config.js` par `context.route`) ; les RPC de
  notifications du faux Supabase sont dans `supabase.push`.
- Un test instable n'est **jamais** « juste un flake » : reproduire (`--repeat-each`),
  trouver la cause, corriger. Ne jamais désactiver ni sauter un test pour passer au vert.
- Pour vérifier un rendu : capture Playwright (Chromium est préinstallé, ne pas lancer
  `playwright install`), en PC 1366×768, Pixel 7 portrait et paysage, iPhone SE.

## Flux Git

- Branche de travail : `claude/funny-wozniak-g668cx`. Quand la PR précédente est fusionnée,
  repartir de `origin/main` (`git checkout -B claude/funny-wozniak-g668cx origin/main`).
- Ne jamais pousser sur une autre branche (dont celles du propriétaire) sans son accord explicite.
- Ouvrir une PR **seulement** quand le propriétaire le demande (« envoie la PR »), puis
  surveiller la CI et la corriger jusqu'au vert.
- Ne jamais mettre d'identifiant de modèle dans les commits, PR ou fichiers.

## Feuille de route

Fait : classement mondial, mobile + tir auto, coffres / équipement / prestige, coffre
gratuit, options, succès, refonte néon, héros / familiers / Nécro-Hydre, sauvegarde en
ligne, évolutions, biomes, compétences de héros, défi du jour, talents, stats de fin,
touches configurables, nouvel accueil, logo officiel, pubs récompensées (démo), CGU, refonte des menus
(boutique, équipement), nouveaux équipements, boss revus + Colosse de givre et Faucheur du vide,
coffres de boss, 34 succès avec récompenses, Voleur doré, difficulté croissante (élites,
montée exponentielle), connexion facultative Google / Discord / e-mail, duel (deux parties de survie, écran scindé ou en ligne, le gagnant empoche tout),
Titan de l'orage (étourdit) et Sentinelle prismatique, mode Boss Rush, skins personnalisables,
évolutions d'armes (une par arme), quêtes hebdomadaires, tutoriel de première partie,
Kraken et Jumeaux, arène vidée pendant les boss, rareté Mythique (coffre mythique seulement), effets ★3, panoplies, modules, Archange et Phénix,
équipements enregistrés, offre du jour, événements de carte et arène de boss réduite, niveaux de difficulté (Facile / Normal / Cauchemar),
biomes Jungle toxique et Station orbitale, série de connexion quotidienne, amis et défis en duel classé,
nouveaux mobs (porte-bouclier, essaim, soigneur, aimant), cartes corrompues, sanctuaires maudits,
synergies familier + arme, ralenti de la mort (replay « TUÉ PAR »), carte de score à partager,
application installable (PWA, hors connexion) et notifications (série, quêtes, amis, retour).

Pubs : régie choisie = AdSense H5 Games Ads (adaptateur prêt, en attente de l'accord de Google, voir `PUBS.md`).

Autres idées en attente : sons et musique, manette.
