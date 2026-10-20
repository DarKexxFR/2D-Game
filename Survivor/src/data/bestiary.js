// Bestiaire : une fiche par type d'ennemi (page bestiaire.html, fiches débloquées en jeu par services/bestiary.js).
// Les chiffres (PV, dégâts, vitesse, XP, or) et les lieux d'apparition sont lus dans data/enemies.js et
// data/biomes.js ; ici seulement les textes. Nouveau type d'ennemi = une fiche de plus (tests/bestiary.spec.js).
//
// group : "mob" (ennemis ordinaires, même tardifs), "biome" (propres à un biome), "boss", "minion" (créatures des boss).
// `from` (créatures de boss) : le boss qui les fait apparaître.

import { BIOMES, BIOME_LENGTH } from "./biomes.js";
import { BOSS_RUSH, BOSS_WAVES, ENEMY_NAMES, GOBLIN, SPAWN_TABLES } from "./enemies.js";

export const BESTIARY_GROUPS = [
  { id: "mob", name: "Ennemis", color: "#00ffff" },
  { id: "biome", name: "Ennemis des biomes", color: "#00ff88" },
  { id: "boss", name: "Boss", color: "#ff2a6d" },
  { id: "minion", name: "Créatures de boss", color: "#aa66ff" },
];

/**
 * `where` remplace la phrase calculée par `whereText` quand elle ne suffit pas.
 * @typedef {{ group: string, desc: string, skills: string[], tip: string, from?: string, where?: string }} BestiaryEntry
 * @type {Record<string, BestiaryEntry>}
 */
export const BESTIARY = {
  // --- ENNEMIS ---
  normal: {
    group: "mob",
    desc: "Le soldat de base de la nuée : un insecte mécanique qui fonce droit sur vous.",
    skills: ["Contact : dégâts au toucher"],
    tip: "Seul il ne fait pas peur, mais il arrive par dizaines : gardez toujours une sortie.",
  },
  fast: {
    group: "mob",
    desc: "Un petit vaisseau très rapide qui rattrape même un pilote en fuite.",
    skills: ["Très rapide", "Contact : dégâts au toucher"],
    tip: "Impossible à semer : éliminez-le avant qu'il n'arrive, le tir automatique s'en charge.",
  },
  tank: {
    group: "mob",
    desc: "Une carcasse blindée, lente mais très solide, qui frappe fort.",
    skills: ["Beaucoup de PV", "Contact : gros dégâts"],
    tip: "Les armes perçantes (Railgun, Perçage) le traversent sans s'arrêter sur lui.",
  },
  ranged: {
    group: "mob",
    desc: "Une tourelle mobile qui garde ses distances et vous tire dessus.",
    skills: ["Tir à distance", "Reste à portée"],
    tip: "Ses tirs sont lents : un petit pas de côté suffit, puis foncez-lui dessus.",
  },
  kamikaze: {
    group: "mob",
    desc: "Une charge explosive qui fonce sur vous et saute au contact.",
    skills: ["Très rapide", "Explose au contact (gros dégâts)", "1 PV"],
    tip: "Un seul tir le détruit : ne le laissez jamais toucher, le dash vous sauve s'il est trop près.",
  },

  // --- ENNEMIS DES BIOMES ---
  shield: {
    group: "biome",
    desc: "Un fantassin de la Cité néon derrière un bouclier d'énergie qui pivote lentement.",
    skills: ["Bloque les tirs de face", "Le bouclier tourne lentement vers vous"],
    tip: "Contournez-le : de côté ou de dos, il n'a aucune protection.",
  },
  swarm: {
    group: "biome",
    desc: "De minuscules drones de la Cité néon qui arrivent toujours en nuée de six.",
    skills: ["Arrive en groupe de 6", "Très fragile"],
    tip: "Une aura, une explosion ou une onde nettoie toute la nuée d'un coup.",
  },
  scorpion: {
    group: "biome",
    desc: "Un chasseur du Désert rouge qui bondit brusquement quand vous êtes à portée.",
    skills: ["Bond soudain à courte distance"],
    tip: "Gardez vos distances : son bond est court, et il est vulnérable juste après.",
  },
  golem: {
    group: "biome",
    desc: "Un bloc de glace vivant de la Toundra, lent et massif.",
    skills: ["Beaucoup de PV", "Son contact vous gèle (ralenti)"],
    tip: "Ne vous laissez jamais toucher : le gel vous ralentit au pire moment.",
  },
  spore: {
    group: "biome",
    desc: "Une plante de la Jungle toxique qui éclate en sporelets quand on la détruit.",
    skills: ["Se divise en sporelets à sa mort"],
    tip: "Tuez-la à distance : ses sporelets naissent là où elle meurt.",
  },
  sporeling: {
    group: "biome",
    where: "Naît de la mort d'une Spore (jungle toxique)",
    desc: "Un éclat de spore, rapide et fragile, né de la mort d'une Spore.",
    skills: ["Rapide", "Très fragile"],
    tip: "Une aura de feu ou des orbes les détruisent avant qu'ils ne vous touchent.",
  },
  bomber: {
    group: "biome",
    desc: "Un drone de la Jungle toxique qui sème des mines autour de vous.",
    skills: ["Pose des mines (zones annoncées au sol)"],
    tip: "Le cercle au sol annonce l'explosion : sortez-en avant la fin du compte à rebours.",
  },
  blinker: {
    group: "biome",
    desc: "Un ennemi de la Station orbitale qui se téléporte juste à côté de vous.",
    skills: ["Téléportation annoncée près du joueur"],
    tip: "Des particules marquent son point d'arrivée : éloignez-vous avant qu'il surgisse.",
  },
  laser_drone: {
    group: "biome",
    desc: "Un drone de la Station orbitale qui charge un long laser dans votre direction.",
    skills: ["Laser annoncé par une ligne"],
    tip: "Quand la ligne apparaît, sortez de son axe : le laser part juste après.",
  },
  healer: {
    group: "mob",
    desc: "Un soutien qui soigne régulièrement les ennemis autour de lui.",
    skills: ["Soigne les ennemis proches"],
    tip: "Priorité absolue : tant qu'il vit, les autres ne meurent pas.",
  },
  magnet: {
    group: "mob",
    desc: "Une machine qui vous attire vers elle après une courte annonce.",
    skills: ["Attire le joueur (anneau d'annonce)"],
    tip: "Le dash vous libère de l'attraction.",
  },
  goblin: {
    group: "mob",
    desc: "Un voleur cousu d'or qui fuit dès qu'il vous voit, puis disparaît.",
    skills: ["Fuit le joueur", "Lâche de l'or à chaque coup", "Disparaît au bout d'un moment"],
    tip: "Une flèche dorée indique où il se cache : chaque tir qui le touche rapporte de l'or.",
  },

  // --- BOSS ---
  miniboss: {
    group: "boss",
    desc: "Un crabe cuirassé qui alterne tirs en éventail et charges en ligne droite.",
    skills: ["Tirs en éventail", "Charge annoncée", "Les petits ennemis restent pendant le combat"],
    tip: "Pendant sa charge, il ne tourne plus : un pas de côté suffit.",
  },
  boss: {
    group: "boss",
    desc: "Un œil géant venu du néant qui couvre l'arène de tirs.",
    skills: ["Spirale de tirs", "Lasers en éventail", "Onde de choc", "Appelle des kamikazes"],
    tip: "Pendant la spirale, tournez autour de lui dans le même sens que les tirs.",
  },
  storm_titan: {
    group: "boss",
    desc: "Un colosse électrique qui étourdit ceux qui restent dans ses zones.",
    skills: ["Frappes de foudre annoncées", "Orbes électriques", "Éclairs en chaîne", "Surcharge (étourdit)"],
    tip: "Étourdi, vous ne pouvez plus bouger ni dasher : sortez toujours des zones annoncées.",
  },
  slime_boss: {
    group: "boss",
    desc: "Le roi des slimes, une gelée géante qui saute, crache et absorbe ses petits.",
    skills: [
      "Saut annoncé",
      "Pluie de slime collante",
      "Absorbe ses petits pour se soigner",
      "Se divise à sa mort",
    ],
    tip: "Tuez ses petits avant qu'il ne les absorbe, et préparez-vous à sa division finale.",
  },
  prism: {
    group: "boss",
    desc: "Une sentinelle de cristal qui découpe l'arène avec des lasers tournants.",
    skills: ["Lasers tournants", "Éclats de cristal", "Grille de lasers"],
    tip: "Suivez la rotation des lasers plutôt que d'essayer de les traverser.",
  },
  colossus: {
    group: "boss",
    desc: "Un géant de glace qui frappe le sol et fait jaillir des pics.",
    skills: ["Frappe au sol", "Éclats de glace", "Pics de glace"],
    tip: "Les pics sortent là où vous étiez : ne restez jamais immobile.",
  },
  kraken: {
    group: "boss",
    desc: "Un monstre des profondeurs, caché sous l'eau tant que ses tentacules tiennent.",
    skills: ["Sous l'eau : intouchable", "Tentacules", "Tourbillon qui vous aspire", "Expose sa tête"],
    tip: "Coupez ses tentacules d'abord : c'est la seule façon de faire remonter sa tête.",
  },
  hydra: {
    group: "boss",
    desc: "Une hydre nécrotique à plusieurs têtes qui crache de l'acide.",
    skills: ["Salves des têtes", "Pluie d'acide (flaques)", "Invoque des rejetons à mi-vie"],
    tip: "Gardez de la place pour fuir les flaques d'acide, qui restent au sol.",
  },
  twin_fire: {
    group: "boss",
    desc: "Les Jumeaux : un frère de feu et un frère de glace reliés par un lien qui blesse.",
    skills: [
      "Lien qui blesse entre les deux",
      "Feu : mur de feu, nova",
      "Glace : prison de glace, vague de givre",
      "Éclipse : lasers croisés",
      "Le survivant se venge",
    ],
    tip: "Abattez-les presque ensemble : bonus d'or « SYNCHRO » et pas de vengeance.",
  },
  void_reaper: {
    group: "boss",
    desc: "Une faucheuse du vide qui lance ses faux et se téléporte autour de vous.",
    skills: ["Faux tournoyantes", "Téléportation", "Invoque des spectres", "Nova du vide"],
    tip: "Après une téléportation, éloignez-vous : la nova suit souvent.",
  },
  sandworm: {
    group: "boss",
    desc: "Un ver colossal qui serpente dans l'arène et plonge sous terre.",
    skills: ["Corps en anneaux", "Plongée sous terre", "Chaque anneau détruit l'affaiblit"],
    tip: "Visez les anneaux : chacun détruit retire une part de la vie de la tête.",
  },
  hive_queen: {
    group: "boss",
    desc: "La reine de la Jungle toxique, protégée par sa carapace et ses fleurs.",
    skills: ["Carapace (dégâts réduits)", "Fleurs toxiques", "Poison qui s'étend"],
    tip: "Détruisez ses fleurs : elles nourrissent sa carapace et son poison.",
  },
  chronophage: {
    group: "boss",
    desc: "Un dévoreur de temps qui ralentit vos tirs et remonte le temps.",
    skills: ["Bulles qui ralentissent vos tirs", "Retour en arrière", "Rembobinage", "Écho en furie"],
    tip: "Tirez hors de ses bulles temporelles, sinon vos tirs se traînent.",
  },
  hacker: {
    group: "boss",
    desc: "Une intelligence pirate qui brouille vos commandes et, en furie, se cache parmi ses clones.",
    skills: ["Commandes inversées", "Zones de brouillage (tir coupé)", "Clones trompeurs"],
    tip: "Sortez des zones de brouillage pour pouvoir tirer à nouveau.",
  },
  pulse_core: {
    group: "boss",
    desc: "Le boss final : le cœur de l'onde, qui bat de plus en plus vite en trois phases.",
    skills: ["Battements (ondes de choc)", "Trois phases", "L'arène se resserre"],
    tip: "Le vaincre lance l'Endless Pulse : gardez vos forces pour la suite.",
  },

  // --- CRÉATURES DE BOSS ---
  slime_big: {
    group: "minion",
    from: "slime_boss",
    desc: "Un morceau du Roi Slime qui se détache à sa mort.",
    skills: ["Se divise à son tour"],
    tip: "Une explosion de zone en vient vite à bout.",
  },
  slime_small: {
    group: "minion",
    from: "slime_boss",
    desc: "Un petit slime rapide, que le Roi peut absorber pour se soigner.",
    skills: ["Rapide", "Absorbé par le Roi Slime"],
    tip: "Tuez-les vite pendant le combat, sinon le Roi récupère des PV.",
  },
  hydra_spawn: {
    group: "minion",
    from: "hydra",
    desc: "Un rejeton invoqué par la Nécro-Hydre quand elle passe sous la moitié de sa vie.",
    skills: ["Très rapide"],
    tip: "Ils arrivent tous ensemble : un dash au bon moment évite l'encerclement.",
  },
  phantom: {
    group: "minion",
    from: "void_reaper",
    desc: "Un spectre appelé par le Faucheur du vide, qui apparaît autour de vous.",
    skills: ["Apparaît en cercle autour du joueur", "Rapide"],
    tip: "Ils apparaissent en cercle : foncez à travers le plus faible point du cercle.",
  },
  kraken_tentacle: {
    group: "minion",
    from: "kraken",
    desc: "Un tentacule du Kraken, planté dans l'arène, qui protège sa tête.",
    skills: ["Immobile", "Garde le Kraken sous l'eau"],
    tip: "La cible prioritaire du combat : sans tentacules, le Kraken doit remonter.",
  },
  twin_ice: {
    group: "minion",
    from: "twin_fire",
    where: "Arrive avec le Jumeau de feu : combat des Jumeaux",
    desc: "Le frère de glace des Jumeaux, qui arrive avec son frère de feu.",
    skills: ["Prison de glace (une seule sortie)", "Vague de givre"],
    tip: "Dans la prison de glace, cherchez tout de suite la sortie.",
  },
  sandworm_segment: {
    group: "minion",
    from: "sandworm",
    desc: "Un anneau du corps du Ver des sables.",
    skills: ["Suit la tête", "Chaque anneau détruit affaiblit le ver"],
    tip: "Les anneaux sont plus faciles à toucher que la tête.",
  },
  hive_flower: {
    group: "minion",
    from: "hive_queen",
    desc: "Une fleur toxique plantée par la Mère-Ruche, entourée d'un poison qui grandit.",
    skills: ["Poison qui s'étend", "Renforce la carapace de la reine"],
    tip: "Détruisez-les tôt, avant que leur poison ne couvre l'arène.",
  },
  hacker_clone: {
    group: "minion",
    from: "hacker",
    desc: "Une copie holographique du Hacker en furie, avec la même allure et la même barre de vie.",
    skills: [
      "Imite le Hacker",
      "Tire des paquets de données (moitié moins forts)",
      "Échange sa place avec le vrai",
    ],
    tip: "Le vrai Hacker tire les plus grosses salves : les clones n'envoient qu'une ligne de paquets.",
  },
};

export const BESTIARY_TYPES = Object.keys(BESTIARY);

const LAST_WAVE = 60; // au-delà, les boss reviennent dans le même ordre

/** Vagues (jusqu'à LAST_WAVE) où le boss `type` arrive (même règle que systems/spawner.js). */
export function bossWaves(type) {
  const waves = [];
  for (let w = 2; w <= LAST_WAVE; w++)
    if (BOSS_WAVES.find((b) => w % b.every === 0)?.type === type) waves.push(w);
  return waves;
}

/** Première vague où l'ennemi ordinaire `type` peut apparaître (tables de systems/spawner.js), sinon null. */
function firstMobWave(type) {
  let from = 1;
  for (const t of SPAWN_TABLES) {
    if (t.weights[type]) return from;
    from = t.untilWave;
  }
  return null;
}

/** Où et quand rencontrer l'ennemi `type`, en une phrase (lue dans les tables du jeu). */
export function whereText(type) {
  const entry = BESTIARY[type];
  if (entry.where) return entry.where;
  if (entry.group === "boss") {
    const waves = bossWaves(type);
    const list = waves.length > 3 ? `${waves.slice(0, 3).join(", ")}…` : waves.join(", ");
    const rush = BOSS_RUSH.order.some((b) => b.type === type) ? " · Boss Rush" : "";
    return `${waves.length > 1 ? "Vagues" : "Vague"} ${list}${rush}`;
  }
  if (type === "goblin") return `Dès la vague ${GOBLIN.fromWave}, au début de certaines vagues sans boss`;
  const biome = BIOMES.findIndex((b) => b.enemies.some((e) => e.type === type));
  const parts = [];
  if (entry.from) parts.push(`Appelé par : ${ENEMY_NAMES[entry.from]}`);
  if (biome >= 0) {
    const first = biome * BIOME_LENGTH + 1;
    parts.push(`${BIOMES[biome].name.toLowerCase()} (vagues ${first} à ${first + BIOME_LENGTH - 1})`);
  }
  const wave = firstMobWave(type);
  if (wave) parts.push(`partout dès la vague ${wave}`);
  const text = parts.join(" · ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
