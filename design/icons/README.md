# Icônes de Last Pulse

Toutes les icônes du jeu sont dessinées à la main dans Figma, dans le fichier
[« Last Pulse — Icônes »](https://www.figma.com/design/V8VvI1sIbnJX7RJFbtDteG) (page « Icônes », un composant par icône).
Ce dossier contient leur export SVG ; le jeu lit la version convertie `Survivor/src/data/iconPaths.js`.

## Règles de dessin

- Composant de **24 × 24**, nommé comme l'icône dans le jeu (`sword`, `heartPlus`…).
- **Trait de 2**, bouts et angles **arrondis**, sans remplissage : c'est le style néon des menus.
- Petits détails pleins (yeux, points, gemmes) : **remplissage** sans trait.
- Couleur indifférente (le jeu applique la sienne) ; garder une marge d'environ 2 px.
- Pas de rotation ni de groupe transformé à l'export : si besoin, « Aplatir » (Flatten) dans Figma.

## Modifier ou ajouter une icône

1. Dessiner ou retoucher le composant dans Figma.
2. L'exporter en **SVG** (panneau Export, « SVG ») et enregistrer le fichier ici sous `<nom>.svg`.
3. Lancer `npm run icons` : réécrit `Survivor/src/data/iconPaths.js`.
4. L'utiliser dans le jeu : `<i data-icon="nom"></i>` dans le HTML, `icon("nom", couleur)` en JS.

`npm run lint` refuse un `iconPaths.js` qui ne correspond pas aux SVG, et `tests/icons.spec.js` vérifie que chaque
icône citée par le jeu existe.
