// Icônes du jeu : formes pleines tirées de deux banques libres, remplies de la couleur du texte.
// - Papicons (data/papicons.js, licence MIT) pour l'interface : réglages, son, cadenas, cloche…
// - game-icons.net (data/gameIcons.js, licence CC BY 3.0, crédits dans legal.html) pour tout ce qui
//   est propre au jeu : armes, armures, héros, boss, coffres, rangs…
// Utilisées dans les menus (ui/icons.js) et sur le canvas (Path2D) ; `iconGrid` donne la taille de
// leur grille (24 pour Papicons, 512 pour game-icons.net).

import { GAME_ICONS } from "./gameIcons.js";
import { PAPICONS } from "./papicons.js";

/** Nom de l'icône dans le jeu → `p:fichier` (Papicons) ou `g:fichier` (game-icons.net). */
const SOURCES = {
  // --- Armes ---
  blaster: "g:blaster",
  smg: "g:uzi",
  shotgun: "g:sawed-off-shotgun",
  railgun: "g:laser-gun",
  rocket: "g:rocket",
  plasma: "g:plasma-bolt",
  star: "p:star",
  blades: "g:spinning-blades",
  book: "g:black-book",
  // --- Armes d'appoint (data/sideWeapons.js) ---
  missile: "g:missile-swarm",
  mine: "g:land-mine",
  beam: "g:laser-blast",
  whip: "g:whip",
  // --- Armures ---
  vest: "g:kevlar-vest",
  feather: "g:feather",
  shield: "g:bordered-shield",
  helmet: "g:visored-helm",
  ghost: "p:ghost",
  robot: "g:vintage-robot",
  aegis: "g:checked-shield",
  // --- Modules ---
  chip: "g:microchip",
  cpu: "g:cpu",
  blackhole: "g:vortex",
  // --- Héros et familier mythiques ---
  wings: "g:angel-wings",
  phoenix: "g:spiky-wing",
  // --- Coffres et monnaie ---
  chest: "g:chest",
  gem: "g:cut-diamond",
  mythicChest: "g:open-treasure-chest",
  crown: "p:crown",
  coin: "g:two-coins",
  gift: "g:present",
  // --- Améliorations ---
  sword: "g:broadsword",
  heart: "p:heart",
  heartPlus: "g:heart-plus",
  // Cœur fissuré : soins réduits par la corruption (vague 12+)
  heartCrack: "g:broken-heart",
  boot: "g:boots",
  magnet: "g:magnet",
  impact: "g:impact-point",
  flame: "g:flame",
  target: "g:on-target",
  pierce: "g:piercing-sword",
  orbit: "g:orbital",
  kunai: "g:thrown-daggers",
  multishot: "g:striking-arrows",
  thorns: "g:thorny-vine",
  bomb: "g:unlit-bomb",
  drop: "g:drop",
  rage: "g:enrage",
  palette: "p:palette",
  sparkle: "p:sparkles",
  skull: "g:death-skull",
  crossbones: "g:crossed-bones",
  bolt: "g:power-lightning",
  // --- Succès et menus ---
  wave: "g:wave-strike",
  chartUp: "g:growth",
  repeat: "g:cycle",
  quest: "p:tasks",
  lock: "p:lock",
  share: "g:share",
  unknown: "g:uncertainty",
  trophy: "g:trophy-cup",
  medal: "g:medal",
  cog: "p:gears",
  backpack: "g:backpack",
  globe: "p:globe",
  save: "g:save",
  music: "g:musical-notes",
  sound: "p:volume",
  vibrate: "g:vibrating-smartphone",
  monitor: "g:tv",
  play: "p:play",
  cloud: "g:fluffy-cloud",
  warning: "p:alert-triangle",
  // --- Héros, familiers et leurs coffres ---
  ship: "g:spaceship",
  shuriken: "g:shuriken",
  titan: "g:giant",
  mage: "g:wizard-staff",
  anchor: "g:anchor",
  drone: "g:delivery-drone",
  medic: "g:medical-pack",
  scythe: "g:scythe",
  heroChest: "g:locked-chest",
  // --- Nouveautés : armes, armures, héros, familiers ---
  flamer: "g:flamethrower",
  disc: "g:circular-sawblade",
  tesla: "g:tesla-coil",
  atom: "g:atom",
  wrench: "g:wrench",
  spectre: "g:spectre",
  snowflake: "g:snowflake-2",
  guardian: "g:shield-reflect",
  dragon: "g:dragon-head",
  user: "p:user",
  friends: "g:three-friends",
  eye: "g:eyeball",
  paw: "g:paw-print",
  // --- Application (installation, notifications) ---
  download: "p:arrow-down-box",
  bell: "p:bell",
  iosShare: "p:arrow-up-box",
  homeAdd: "p:add",
  // --- Endless Pulse, saison ---
  pulse: "g:heart-beats",
  infinity: "g:infinity",
  // --- Rangs du duel (data/duelRanks.js) ---
  rankBronze: "g:rank-1",
  rankSilver: "g:rank-2",
  rankGold: "g:rank-3",
  rankDiamond: "g:diamond-hard",
  rankPredator: "g:fangs",
  season: "g:flying-flag",
};

/** Tracés des icônes par nom. */
export const ICONS = /** @type {Record<string, string>} */ ({});
/** Taille de la grille de chaque icône. */
const GRID = /** @type {Record<string, number>} */ ({});
for (const [name, source] of Object.entries(SOURCES)) {
  const [bank, file] = source.split(":");
  ICONS[name] = bank === "p" ? PAPICONS[file] : GAME_ICONS[file][1];
  GRID[name] = bank === "p" ? 24 : 512;
}

/** Côté de la grille du tracé de l'icône (son viewBox). */
export function iconGrid(name) {
  return GRID[name] ?? 24;
}
