# CLAUDE.md — Last Pulse

Mémo pour Claude (et tout contributeur) : comment le projet est organisé, les règles à
respecter et les pièges déjà rencontrés. À lire avant toute modification, à tenir à jour
quand une règle change.

## Le projet

**Last Pulse** : jeu de survie 2D en vagues (style *Vampire Survivors*), style néon / cyber,
en JavaScript pur (modules ES), rendu sur `<canvas>`. Aucune dépendance côté jeu ; npm ne
sert qu'aux outils (Prettier, Playwright).

- En ligne (GitHub Pages) : https://darkexxfr.github.io/2D-Game/Survivor/
- Le dossier du jeu s'appelle encore `Survivor/` (ancien nom) : **ne pas le renommer**,
  l'URL GitHub Pages en dépend.
- Langue : interface, commentaires, messages de commit, titres et descriptions de PR en
  **français**. Le propriétaire (DarKexxFR) échange en français.

## Commandes

```bash
npm start            # sert le jeu sur http://localhost:8000 (python3 http.server)
npm run lint         # Prettier (largeur 110) + vérification de syntaxe (scripts/check-syntax.mjs)
npm run format       # corrige le formatage
npx playwright test  # tests de bout en bout (projets « desktop » et « mobile » Pixel 7)
npx playwright test tests/home.spec.js --project=mobile --repeat-each=5   # traquer un test instable
```

La CI GitHub (`.github/workflows/tests.yml`) lance `npm run lint` puis tous les tests
Playwright sur chaque PR. Toujours lancer les deux en local avant de pousser.

## Architecture (`Survivor/src/`)

| Dossier | Rôle |
|---|---|
| `config.js` | Constantes et équilibrage (`STORAGE_KEYS`, `TICK_MS`, `MAP_BOUNDS`, `PLAYER_DEFAULTS`, config Supabase…) |
| `core/` | `state.js` (état global : `game`, `player`, `world`, `camera`, `pet`), `canvas.js` (`ctx`, `view`, qualité), `input.js` (actions clavier/souris/tactile), `events.js` (bus `emit` / `on`) |
| `data/` | Données pures : `items.js` (armes, armures, HEROES, PETS, CHESTS), `upgrades.js` (+ EVOLUTIONS), `enemies.js`, `biomes.js`, `talents.js`, `achievements.js`, `icons.js` (tracés SVG) |
| `systems/` | Logique de jeu par tick : `player`, `enemies`, `combat`, `spawner`, `pickups`, `skills`, `pet`, `equipment`, `effects`, `mysteryBox` |
| `render/` | Dessin : `renderer.js` (ordre des couches), `entities.js`, `world.js`, `effects.js`, `sprites.js` (sprites néon en cache), `menuScene.js` (scène animée de l'accueil) |
| `services/` | Persistance et réseau : `storage.js` (compte), `settings.js`, `inventory.js`, `supabase.js`, `onlineLeaderboard.js`, `cloudSave.js`, `daily.js`, `audio.js` / `sfx.js` |
| `ui/` | Menus DOM : `screens.js` (un seul écran visible), `mainMenu.js`, `hud.js`, `dom.js` (écritures DOM en cache), `icons.js`… |
| `main.js` | Point d'entrée : initialisation et boucle principale |
| `../assets/` | Logo (`logo-wordmark.svg` = titre de l'accueil, `logo-mark.svg` = symbole), favicons, icône d'app, musiques |

Principes :

- **Pas fixe à 60 Hz** (`TICK_MS`) : la logique avance en ticks, le rendu suit le
  `requestAnimationFrame`. Les durées de jeu sont en ticks, pas en millisecondes.
- **Grille spatiale** `enemyGrid` reconstruite à chaque tick (et dans `activateSkill`) pour
  les collisions : toute recherche d'ennemis proches passe par elle.
- **Écritures DOM en cache** : utiliser `setText`, `setVisible`, `setClass`, `setWidth` de
  `ui/dom.js` (évite de réécrire le DOM chaque frame). `setVisible` met `display: block`.
- **Sprites** : dessinés une fois dans des canvas hors écran (`getSprite` / `drawSprite`).
  Lueur via `shadowBlur` ; la qualité basse la coupe.
- **Icônes** : `<i data-icon="nom">` dans le HTML (remplacé par `hydrateIcons`), ou
  `icon(nom, couleur)` en JS. Taille = `font-size`, couleur = `color`.
- **Équilibrage** : les valeurs vivent dans `config.js` ou `data/`, jamais en dur dans la logique.
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
- **Formatage** : Prettier, largeur 110 (`.prettierrc`). Lancer `npm run format` après édition.
- **Styles** : couleurs néon (cyan `#00ffff`, rose `#ff2a6d`, violet `#aa66ff`, vert
  `#00ff88`, or `#ffd700`), polices Orbitron et « Press Start 2P ». `base.css` contient
  `* { overflow: hidden }` : penser à `overflow: visible` pour les lueurs et badges qui débordent.
- **Effets de survol** : uniquement sous `@media (hover: hover)`. Sur écran tactile le
  survol reste « collé » ; un bouton qui bouge au survol tremble en boucle (cassait la CI).

## Tests (`tests/`)

- `fixtures.js` simule Supabase (classement, RPC `save_progress` / `load_progress`) et
  fournit : `game(page, fn, arg)` (exécute du code avec les modules du jeu), `withSave(page,
  save)` (injecte une sauvegarde avant le chargement), `startGame(page, { invincible,
  levelUps })`, `killPlayer(page)`.
- Chaque fonctionnalité a son fichier `*.spec.js`. Ajouter ou mettre à jour un test avec
  chaque changement de comportement.
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
touches configurables, nouvel accueil, logo officiel.

En cours de réflexion : **coop en ligne à 2 joueurs**. Plan retenu :

1. Refonte multi-joueurs locale (le code suppose un seul `player` : passer à une liste de
   joueurs ; ennemis qui visent le plus proche, XP partagée, améliorations par joueur,
   réanimation, difficulté adaptée).
2. Salon en ligne avec code de salle (Supabase sert à la mise en relation).
3. Synchronisation : l'hôte fait tourner la simulation, l'invité envoie ses commandes et
   reçoit des instantanés (~15-20/s) interpolés. Transport conseillé : WebRTC (pair à pair),
   Supabase Realtime seulement pour la signalisation (quotas de messages).
4. Finitions : ping, déconnexions, classement coop.

Autres idées en attente : sons et musique, niveaux de difficulté, quêtes hebdomadaires,
skins, PWA installable, tutoriel, manette.
