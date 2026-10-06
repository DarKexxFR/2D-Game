# Survivor — Neon Edition

Jeu de survie 2D en vagues (style *Vampire Survivors*) en JavaScript pur, rendu sur `<canvas>`.

## Lancer le jeu

**Jouer en ligne :** https://darkexxfr.github.io/2D-Game/Survivor/

**En local :** le code utilise des **modules ES**, il faut donc passer par un petit
serveur local (ouvrir `index.html` en double-cliquant ne fonctionne pas)

```bash
cd Survivor
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Alternatives : `npx serve Survivor`, ou l'extension **Live Server** de VS Code.

## Contrôles

| Touche | Action |
| --- | --- |
| Souris | Viser |
| ZQSD / WASD | Se déplacer |
| Espace | Dash |
| R | Ultime |
| E | Ouvrir la boîte mystère |
| A | Activer / désactiver le tir automatique |
| P / Échap | Pause |

**Sur mobile / tablette** : joystick virtuel sur la moitié gauche de l'écran (posez le doigt n'importe où),
boutons **DASH** et **ULT** à droite, bouton **📦** quand vous êtes près de la boîte mystère, **II** pour la pause.
Le tir est automatique (vise l'ennemi le plus proche). La vue est dézoomée sur petit écran
pour voir autant de terrain que sur PC ; portrait et paysage sont tous deux jouables.

## Équipement et coffres

Dans la **Boutique**, l'or du compte permet d'ouvrir des **coffres** (basique, premium, légendaire)
qui donnent une **arme** ou une **armure** selon des probabilités de rareté.

- **Armes** (remplacent le tir) : Blaster, Mitrailleur, Fusil à pompe, Railgun, Lance-roquettes, Canon plasma.
- **Armures** (bonus de stats) : Gilet tactique, Combinaison légère, Armure renforcée, Cuirasse lourde, Cape spectrale, Exosquelette.
- **Niveau** : amélioré avec de l'or (+2 % de puissance par niveau).
- **Prestige ★1 → ★5** : obtenu en consommant des **doublons** (1, 2, 3 puis 5). Chaque étoile ajoute
  10 niveaux maximum, +15 % de puissance et rend l'objet plus imposant en jeu
  (canon plus long et lumineux, armure plus épaisse, pointes en orbite dès ★3, halo doré à ★5).
- Un doublon d'un objet déjà ★5 est converti en or.

Tout l'équilibrage se trouve dans [`Survivor/src/data/items.js`](Survivor/src/data/items.js).

## Classement mondial (Supabase)

Les scores de fin de partie sont envoyés à une base [Supabase](https://supabase.com) gratuite.
Sans configuration, le jeu fonctionne normalement avec le classement local uniquement.

1. Dans Supabase, ouvrir **SQL Editor → New query**, coller le contenu de
   [`supabase/schema.sql`](supabase/schema.sql) puis cliquer sur **Run**.
2. Dans **Project Settings → API**, copier l'**URL du projet** et la clé **anon public**.
3. Les coller dans `ONLINE` en bas de [`Survivor/src/config.js`](Survivor/src/config.js).

La clé *anon* est faite pour être publique : les règles de sécurité de la base autorisent
seulement la lecture et l'ajout de scores (pas de modification ni de suppression), avec des
limites de valeurs et un envoi maximum toutes les 10 secondes par pseudo.

## Structure du projet

```
Survivor/
├── index.html              # Structure HTML (aucun script ni style inline)
├── assets/audio/           # Musiques
├── css/
│   ├── base.css            # Reset, polices, boutons, utilitaires
│   ├── hud.css             # Interface en jeu
│   ├── menus.css           # Menus / boutique / classement / pause / fin
│   ├── inventory.css       # Coffres et écran Équipement
│   ├── touch.css           # Commandes tactiles + petits écrans
│   └── animations.css      # @keyframes
└── src/
    ├── main.js             # Point d'entrée : cycle de vie d'une partie + boucle principale
    ├── config.js           # Toutes les constantes d'équilibrage
    ├── core/
    │   ├── canvas.js       # Canvas, vue logique (zoom mobile, écrans haute densité)
    │   ├── input.js        # Clavier / souris
    │   ├── events.js       # Bus d'événements (systèmes -> UI)
    │   └── state.js        # État de la partie (game, player, world...) + reset
    ├── data/
    │   ├── enemies.js      # Types d'ennemis, tables d'apparition, vagues de boss
    │   ├── items.js        # Armes, armures, coffres, règles de niveau / prestige
    │   └── upgrades.js     # Améliorations de montée de niveau
    ├── systems/            # Logique de jeu (aucun accès au DOM)
    │   ├── player.js       # Déplacement, dash, vie, XP, ultime
    │   ├── combat.js       # Tirs, dégâts, mort des ennemis, aura, orbes, ultime
    │   ├── enemies.js      # IA des ennemis et des boss, projectiles ennemis
    │   ├── spawner.js      # Vagues, apparitions, sanctuaires
    │   ├── pickups.js      # Gemmes, soins, sanctuaires
    │   ├── mysteryBox.js   # Boîte mystère
    │   ├── pet.js          # Drone de combat
    │   ├── equipment.js    # Applique l'arme / l'armure équipées au joueur
    │   └── effects.js      # Particules, textes flottants, ondes
    ├── render/             # Dessin sur le canvas (lecture seule de l'état)
    │   ├── renderer.js     # Ordre des couches
    │   ├── world.js        # Grille, bordure, boîte, sanctuaires, butin
    │   ├── entities.js     # Joueur, drone, ennemis, projectiles
    │   ├── effects.js      # Particules, ondes, textes
    │   └── draw.js         # Primitives de dessin
    ├── ui/                 # Tout ce qui touche au DOM
    │   ├── dom.js          # Cache d'éléments + écritures uniquement si changement
    │   ├── screens.js      # Affichage d'un menu à la fois
    │   ├── hud.js          # Interface en jeu
    │   ├── mainMenu.js     # Menu principal, boutique
    │   ├── leaderboardMenu.js # Classement mondial / local
    │   ├── chestMenu.js    # Coffres de la boutique + ouverture
    │   ├── inventoryMenu.js # Écran Équipement
    │   ├── itemView.js     # Étoiles, stats et rareté des objets
    │   ├── upgradeMenu.js  # Choix d'amélioration
    │   ├── pauseMenu.js    # Pause + inventaire
    │   ├── gameOverScreen.js
    │   └── touchControls.js # Joystick et boutons tactiles
    ├── services/
    │   ├── storage.js      # Sauvegarde (compte, pseudo, classement local)
    │   ├── onlineLeaderboard.js # Classement mondial (Supabase)
    │   ├── inventory.js    # Coffres, niveau, prestige, équipement
    │   └── audio.js        # Musique
    └── utils/
        ├── math.js         # clamp, distance, tirage pondéré...
        └── spatialHash.js  # Grille spatiale pour les collisions
```

### Ajouter du contenu

- **Un ennemi** : ajouter une entrée dans `ENEMY_TYPES` puis dans une `SPAWN_TABLES` (`src/data/enemies.js`).
  Un comportement spécial se branche dans `BOSS_BEHAVIORS` (`src/systems/enemies.js`).
- **Une amélioration** : ajouter un objet `{ name, rarity, icon, desc, canApply?, apply }` dans `src/data/upgrades.js`.
- **Une récompense de boîte mystère** : ajouter une entrée dans `REWARDS` (`src/systems/mysteryBox.js`).
- **Équilibrage** : `src/config.js`.
