// Armes d'appoint : armes ramassées en partie avec les cartes, en plus de l'arme équipée.
//
// Chaque arme a 5 niveaux (une carte par niveau) et une évolution : niveau 5 + carte partenaire.
// Les dégâts sont des multiplicateurs de l'attaque du joueur ; les durées sont en ticks (60 par seconde) ;
// les rayons et portées grandissent avec la taille des tirs (carte Singularité).
// Le comportement de chaque arme vit dans systems/sideWeapons.js (une fonction par `id`).

/** Armes d'appoint portées en même temps au plus, et niveau maximum de chacune. */
export const SIDE_WEAPON_RULES = { slots: 3, maxLevel: 5 };

/**
 * @typedef {Record<string, number>} SideStats
 * @typedef {{ id: string, name: string, desc: string, partner: string, stats: SideStats }} SideEvolution
 * @typedef {{
 *   name: string, icon: string, color: string, desc: string, tip: string,
 *   levels: { desc: string, stats: SideStats }[], evolution: SideEvolution,
 * }} SideWeapon
 */

/** @type {Record<string, SideWeapon>} */
export const SIDE_WEAPONS = {
  missiles: {
    name: "Missiles chercheurs",
    icon: "missile",
    color: "#ff8a3d",
    desc: "Des missiles qui poursuivent les ennemis et explosent à l'impact.",
    tip: "Parfait contre les ennemis rapides : les missiles ne ratent jamais leur cible.",
    levels: [
      { desc: "1 missile toutes les 1,5 s", stats: { cooldown: 90, count: 1, damage: 1.4, explosion: 40 } },
      { desc: "+1 missile", stats: { cooldown: 90, count: 2, damage: 1.4, explosion: 40 } },
      {
        desc: "+25% dégâts, explosions plus larges",
        stats: { cooldown: 90, count: 2, damage: 1.75, explosion: 50 },
      },
      { desc: "+1 missile", stats: { cooldown: 85, count: 3, damage: 1.75, explosion: 50 } },
      {
        desc: "+25% dégâts, tirs plus fréquents",
        stats: { cooldown: 75, count: 3, damage: 2.2, explosion: 55 },
      },
    ],
    evolution: {
      id: "missileSwarm",
      name: "Essaim de missiles",
      desc: "Six missiles par salve, plus fréquents, aux explosions bien plus larges.",
      partner: "Multi-Tir",
      stats: { cooldown: 65, count: 6, damage: 2.4, explosion: 75 },
    },
  },
  mines: {
    name: "Mines à plasma",
    icon: "mine",
    color: "#ff2a6d",
    desc: "Pose des mines derrière vous qui explosent au contact des ennemis.",
    tip: "Tournez autour des groupes : les mines posées sur votre passage font le ménage.",
    levels: [
      { desc: "1 mine toutes les 1,25 s", stats: { cooldown: 75, max: 4, damage: 3, radius: 70 } },
      { desc: "+30% dégâts", stats: { cooldown: 75, max: 4, damage: 3.9, radius: 70 } },
      {
        desc: "Explosions plus larges, +2 mines en place",
        stats: { cooldown: 70, max: 6, damage: 3.9, radius: 85 },
      },
      { desc: "+30% dégâts", stats: { cooldown: 65, max: 6, damage: 5, radius: 85 } },
      {
        desc: "Explosions plus larges, +2 mines en place",
        stats: { cooldown: 60, max: 8, damage: 5, radius: 100 },
      },
    ],
    evolution: {
      id: "nuclearField",
      name: "Champ nucléaire",
      desc: "Mines posées deux fois plus vite, aux explosions immenses.",
      partner: "Explosion",
      stats: { cooldown: 40, max: 10, damage: 7, radius: 160 },
    },
  },
  lightning: {
    name: "Foudre céleste",
    icon: "bolt",
    color: "#ffe14d",
    desc: "La foudre frappe au hasard les ennemis autour de vous.",
    tip: "Frappe partout à la fois : idéal pour nettoyer les nuées sans viser.",
    levels: [
      {
        desc: "1 éclair toutes les 1,6 s",
        stats: { cooldown: 100, strikes: 1, damage: 2.5, radius: 40, chain: 0 },
      },
      { desc: "+1 éclair", stats: { cooldown: 100, strikes: 2, damage: 2.5, radius: 40, chain: 0 } },
      {
        desc: "+20% dégâts, plus fréquent",
        stats: { cooldown: 85, strikes: 2, damage: 3, radius: 45, chain: 0 },
      },
      { desc: "+1 éclair", stats: { cooldown: 85, strikes: 3, damage: 3, radius: 45, chain: 0 } },
      {
        desc: "+1 éclair, +15% dégâts",
        stats: { cooldown: 75, strikes: 4, damage: 3.5, radius: 50, chain: 0 },
      },
    ],
    evolution: {
      id: "judgement",
      name: "Jugement",
      desc: "Six éclairs par salve, plus forts, qui rebondissent sur deux ennemis voisins.",
      partner: "Sniper",
      stats: { cooldown: 65, strikes: 6, damage: 4.5, radius: 60, chain: 2 },
    },
  },
  pulse: {
    name: "Onde pulsée",
    icon: "pulse",
    color: "#00ffff",
    desc: "Une onde part de votre vaisseau, blesse et repousse les ennemis proches.",
    tip: "Votre bouée de secours : l'onde éloigne ceux qui vous encerclent (les boss ne bougent pas).",
    levels: [
      {
        desc: "1 onde toutes les 2,5 s",
        stats: { cooldown: 150, radius: 140, damage: 1.5, push: 14, stun: 0 },
      },
      { desc: "Onde plus large", stats: { cooldown: 150, radius: 170, damage: 1.5, push: 14, stun: 0 } },
      { desc: "+35% dégâts", stats: { cooldown: 135, radius: 170, damage: 2, push: 16, stun: 0 } },
      { desc: "Onde plus large", stats: { cooldown: 125, radius: 200, damage: 2, push: 16, stun: 0 } },
      {
        desc: "+25% dégâts, plus fréquente",
        stats: { cooldown: 110, radius: 220, damage: 2.5, push: 18, stun: 0 },
      },
    ],
    evolution: {
      id: "seismicEcho",
      name: "Écho sismique",
      desc: "Deux ondes de suite, immenses, qui étourdissent les ennemis touchés.",
      partner: "Recul",
      stats: { cooldown: 100, radius: 280, damage: 3, push: 20, stun: 40, echo: 1 },
    },
  },
  beam: {
    name: "Faisceau rotatif",
    icon: "beam",
    color: "#aa66ff",
    desc: "Un rayon laser tourne autour de vous et brûle tout ce qu'il traverse.",
    tip: "Restez au milieu des ennemis : le faisceau ne s'arrête jamais.",
    levels: [
      { desc: "1 rayon", stats: { beams: 1, length: 180, spin: 0.03, damage: 0.6 } },
      { desc: "Rayon plus long", stats: { beams: 1, length: 220, spin: 0.033, damage: 0.6 } },
      { desc: "+1 rayon", stats: { beams: 2, length: 220, spin: 0.036, damage: 0.7 } },
      { desc: "+30% dégâts", stats: { beams: 2, length: 240, spin: 0.04, damage: 0.9 } },
      { desc: "Rayons plus longs et plus rapides", stats: { beams: 2, length: 260, spin: 0.045, damage: 1 } },
    ],
    evolution: {
      id: "prism",
      name: "Prisme",
      desc: "Quatre rayons plus longs et plus forts.",
      partner: "Perçage",
      stats: { beams: 4, length: 300, spin: 0.05, damage: 1.3 },
    },
  },
  whip: {
    name: "Fouet laser",
    icon: "whip",
    color: "#00ff88",
    desc: "Fouette les ennemis devant puis derrière vous.",
    tip: "Courte portée mais gros dégâts : restez près de vos cibles.",
    levels: [
      {
        desc: "1 coup toutes les 1,2 s",
        stats: { cooldown: 70, range: 130, arc: 1.4, damage: 2, both: 0, heal: 0 },
      },
      { desc: "+25% dégâts", stats: { cooldown: 70, range: 140, arc: 1.4, damage: 2.5, both: 0, heal: 0 } },
      {
        desc: "Plus long et plus large",
        stats: { cooldown: 65, range: 160, arc: 1.7, damage: 2.5, both: 0, heal: 0 },
      },
      {
        desc: "+20% dégâts, plus rapide",
        stats: { cooldown: 55, range: 170, arc: 1.7, damage: 3, both: 0, heal: 0 },
      },
      {
        desc: "Plus long, +15% dégâts",
        stats: { cooldown: 50, range: 190, arc: 1.8, damage: 3.4, both: 0, heal: 0 },
      },
    ],
    evolution: {
      id: "vampireWhip",
      name: "Fouet vampire",
      desc: "Frappe des deux côtés à la fois, plus fort, et chaque coup vous soigne un peu.",
      partner: "Vampirisme",
      // heal : part des PV max rendue par ennemi touché, au plus `healCap` par coup
      stats: { cooldown: 50, range: 220, arc: 2, damage: 4, both: 1, heal: 0.004, healCap: 0.02 },
    },
  },
};

export const SIDE_WEAPON_IDS = Object.keys(SIDE_WEAPONS);

/**
 * Arme d'appoint `id` du joueur, ou undefined s'il ne l'a pas.
 * @param {any} p joueur
 * @param {string} id
 */
export const sideWeaponOf = (p, id) => p.sideWeapons.find((w) => w.id === id);

/**
 * Statistiques actuelles d'une arme d'appoint (son niveau, ou son évolution).
 * @param {{ id: string, level: number }} w
 * @param {any} p joueur
 */
export function sideStats(w, p) {
  const def = SIDE_WEAPONS[w.id];
  return p.evolutions[def.evolution.id] ? def.evolution.stats : def.levels[w.level - 1].stats;
}

/** Nom affiché (celui de l'évolution une fois obtenue). */
export function sideName(id, p) {
  const def = SIDE_WEAPONS[id];
  return p.evolutions[def.evolution.id] ? def.evolution.name : def.name;
}
