// Nouveautés affichées une fois par compte après une mise à jour (fenêtre « Nouveautés », ui/newsMenu.js).
// Une mise à jour = une entrée EN TÊTE de liste, avec un `id` nouveau (jamais réutilisé) : les joueurs
// qui reviennent voient toutes les entrées publiées depuis leur dernière visite (au plus `NEWS_MAX`).
// Faits exacts seulement, comme pour llms.txt.

/**
 * @typedef {{ icon: string, color: string, title: string, text: string }} NewsItem
 * @typedef {{ id: string, date: string, title: string, items: NewsItem[] }} NewsEntry
 * @type {NewsEntry[]}
 */
export const CHANGELOG = [
  {
    id: "2026-10-rangs-duel",
    date: "Octobre 2026",
    title: "Rangs de duel",
    items: [
      {
        icon: "rankDiamond",
        color: "#00ffff",
        title: "Bronze, Argent, Or, Diamant, Prédateur",
        text: "Chaque duel classé fait monter (ou descendre) votre ELO, et votre rang suit. Promotion annoncée en fin de duel.",
      },
      {
        icon: "rankPredator",
        color: "#ff2a6d",
        title: "Votre emblème partout",
        text: "Sur l'accueil, l'écran Duel, face à votre adversaire, dans le classement DUEL ELO et la liste d'amis.",
      },
    ],
  },
  {
    id: "2026-10-reprendre",
    date: "Octobre 2026",
    title: "Reprenez votre partie plus tard",
    items: [
      {
        icon: "save",
        color: "#00ff88",
        title: "Partie sauvegardée",
        text: "QUITTER dans la pause, fermer l'onglet ou mettre le téléphone en veille garde votre partie en cours sur cet appareil.",
      },
      {
        icon: "play",
        color: "#00ffff",
        title: "Bouton REPRENDRE",
        text: "Sur l'accueil, REPRENDRE recharge la partie là où vous l'avez laissée, en pause. ABANDONNER la jette pour de bon.",
      },
    ],
  },
  {
    id: "2026-10-vague-40",
    date: "Octobre 2026",
    title: "L'aventure continue jusqu'à la vague 40",
    items: [
      {
        icon: "infinity",
        color: "#ffe9a8",
        title: "Dix vagues de plus",
        text: "Le Cœur du Pulse ouvre la Faille quantique et le Noyau stellaire. Le boss final, l'Architecte, attend à la vague 40 avant l'Endless Pulse.",
      },
      {
        icon: "crown",
        color: "#ff2a6d",
        title: "4 nouveaux boss",
        text: "La Forgeronne stellaire, le Reflet (il copie vos armes), la Tisseuse du vide et l'Architecte.",
      },
      {
        icon: "skull",
        color: "#ff3bf0",
        title: "4 nouveaux ennemis",
        text: "Déphaseur, Réplicateur, Fusionneur et Nova : leurs fiches sont dans le bestiaire.",
      },
      {
        icon: "atom",
        color: "#ff8cf8",
        title: "Fusion d'armes",
        text: "Deux armes d'appoint au niveau 5 fusionnent en une seule arme renforcée : un emplacement se libère.",
      },
      {
        icon: "wrench",
        color: "#ffd27a",
        title: "La Forge",
        text: "Dans l'équipement : 3 doublons de même rareté donnent un objet de la rareté au-dessus.",
      },
      {
        icon: "sparkle",
        color: "#00e5ff",
        title: "12 nouvelles augmentations",
        text: "Ricochet, Givre, Arc électrique, Surtension… plus 2 évolutions et 2 cartes corrompues.",
      },
      {
        icon: "music",
        color: "#aa66ff",
        title: "Musiques",
        text: "Une musique pour chaque biome, les combats de boss, le Cœur du Pulse, l'Architecte et l'Endless Pulse.",
      },
    ],
  },
];

/** Entrées montrées d'un coup au plus (un joueur absent longtemps ne voit que les plus récentes). */
export const NEWS_MAX = 3;
