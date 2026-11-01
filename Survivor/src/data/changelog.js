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
    id: "2026-11-rendu-neon",
    date: "Novembre 2026",
    title: "Un néon plus vivant",
    items: [
      {
        icon: "wave",
        color: "#aa66ff",
        title: "La grille réagit",
        text: "Le sol ondule sous les explosions, s'enroule vers les trous noirs, s'assombrit quand un boss prépare une attaque et bat au rythme du Cœur du Pulse.",
      },
      {
        icon: "sparkle",
        color: "#00ffff",
        title: "Plus de lumière, plus d'impact",
        text: "Halo néon, tirs qui s'additionnent vers le blanc, étincelles, ennemis qui flashent quand ils sont touchés, dash étiré et tirs ennemis cerclés de noir pour rester lisibles. Chaque effet se règle dans les Options.",
      },
      {
        icon: "ship",
        color: "#ff2a6d",
        title: "Vaisseaux et boss redessinés",
        text: "Les 8 vaisseaux de héros ont de nouvelles coques détaillées (ailes, canons, auréole de l'Archange, orbe du Mage...). Les boss s'animent avec des anneaux et des plaques qui tournent, et leurs repères s'allument juste avant une attaque. Illustrations dans les fiches d'équipement et du bestiaire.",
      },
    ],
  },
  {
    id: "2026-11-coop-en-ligne",
    date: "Novembre 2026",
    title: "Coop en ligne, jusqu'à 4 joueurs",
    items: [
      {
        icon: "coop",
        color: "#00ff88",
        title: "Survivez ensemble",
        text: "Bouton COOP de l'accueil : crée un salon, donne le code, et jouez à 2, 3 ou 4 dans la même partie. La carte, les boss et les ennemis s'adaptent au nombre de joueurs.",
      },
      {
        icon: "heartPlus",
        color: "#ff2a6d",
        title: "Relève tes coéquipiers",
        text: "Un joueur à terre se relève si un coéquipier reste à côté de lui. XP partagée, et chacun repart avec l'XP et l'or de la partie.",
      },
    ],
  },
  {
    id: "2026-11-manette",
    date: "Novembre 2026",
    title: "Jouable à la manette",
    items: [
      {
        icon: "gamepad",
        color: "#00ffff",
        title: "Branche ta manette",
        text: "Xbox, PlayStation ou Switch Pro, sur PC comme sur mobile : stick gauche pour bouger, stick droit pour viser, A pour le dash, X pour la compétence. Tous les menus se parcourent à la croix (A valide, B revient).",
      },
      {
        icon: "friends",
        color: "#00ff88",
        title: "Une manette par joueur",
        text: "En duel sur un écran, la première manette branchée commande le joueur 1, la suivante le joueur 2. Vibrations et réglages dans les Options.",
      },
    ],
  },
  {
    id: "2026-10-anomalies-marchand",
    date: "Octobre 2026",
    title: "Anomalies de biome et Marchand Noir",
    items: [
      {
        icon: "snowflake",
        color: "#bff4ff",
        title: "Le terrain s'en mêle",
        text: "Verglas en Toundra (plus rapide, mais ça glisse), tourelles à pirater dans la Station orbitale, portails aux quatre coins de la Faille quantique.",
      },
      {
        icon: "coin",
        color: "#aa66ff",
        title: "Marchand Noir",
        text: "Il remplace parfois un sanctuaire maudit : rends-lui une carte ou 20 % de tes PV max, repars avec une carte légendaire ou corrompue.",
      },
    ],
  },
  {
    id: "2026-10-coeur-cybernetique",
    date: "Octobre 2026",
    title: "Synergies, recyclage mythique et Cœur Cybernétique",
    items: [
      {
        icon: "paw",
        color: "#00ff88",
        title: "Une synergie pour chaque familier",
        text: "Moissonneuse d'âmes, Tir de barrage, Attraction fatale, Courant vital, Rempart offensif, Cendres ardentes : chaque arme a désormais son familier partenaire.",
      },
      {
        icon: "gem",
        color: "#ff3b30",
        title: "Démantèlement à la Forge",
        text: "Vos doublons légendaires deviennent des Éclats de Pulse, pour relancer ou cibler les deux attributs de vos objets mythiques.",
      },
      {
        icon: "cpu",
        color: "#ff2a6d",
        title: "Cœur Cybernétique",
        text: "Au niveau de compte 20 ou après la vague 30 : 12 passifs à débloquer avec votre or, 3 actifs à la fois (dont +25 % de dégâts en tir manuel).",
      },
    ],
  },
  {
    id: "2026-10-tirs-allies",
    date: "Octobre 2026",
    title: "Plus lisible en fin de partie",
    items: [
      {
        icon: "eye",
        color: "#00ffff",
        title: "Opacité des tirs alliés",
        text: "Options > Tirs alliés : de 20 à 100 %. Vos tirs s'effacent, les tirs ennemis et attaques de boss restent nets.",
      },
      {
        icon: "repeat",
        color: "#00ff88",
        title: "Rejouer depuis le ralenti",
        text: "Pendant « Revoir ma mort », le bouton REJOUER relance aussitôt une partie.",
      },
    ],
  },
  {
    id: "2026-10-pouvoirs-limites",
    date: "Octobre 2026",
    title: "Pouvoirs limités, mais plus forts",
    items: [
      {
        icon: "sparkle",
        color: "#ffd700",
        title: "8 emplacements de pouvoir",
        text: "Plus question d'empiler tous les pouvoirs : choisissez-en 8, puis faites-les monter jusqu'au niveau 5.",
      },
      {
        icon: "sword",
        color: "#00ffff",
        title: "Chaque niveau compte",
        text: "Les pouvoirs sont plus puissants à chaque niveau. Tout au maximum ? Des cartes Réparation et Butin prennent le relais.",
      },
    ],
  },
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
