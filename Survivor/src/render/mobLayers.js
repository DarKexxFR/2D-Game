// Pièces animées des ennemis ordinaires, par-dessus leur sprite en cache : ailes qui battent, rotors,
// mèches, yeux qui clignotent... Une ou deux formes par ennemi, en traits fins sans halo ni shadowBlur
// (ils sont des dizaines à l'écran). Plafonné à `VISUAL_FX.mobLayers.max` par image et coupé en qualité
// basse : au-delà, l'ennemi garde son sprite seul. Les boss ont les leurs (render/bossLayers.js).

import { VISUAL_FX } from "../config.js";
import { ctx } from "../core/canvas.js";
import { gfx } from "../core/gfx.js";
import { player } from "../core/state.js";
import { TAU, charge, diamondPath, polyPath, thinStroke } from "./layerKit.js";

const MAX = VISUAL_FX.mobLayers.max;
let drawn = 0;

/** Angle de l'ennemi vers le joueur (ou son orientation propre). */
const facing = (e) => e.facing ?? Math.atan2(player.worldY - e.y, player.worldX - e.x);

/** Point plein. */
function dot(x, y, r, color, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** Deux traits de part et d'autre (ailes, pinces...) : repère tourné vers `a`. */
function withFacing(e, a, fn) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(a);
  fn();
  ctx.restore();
}

/** Traînée de vitesse derrière l'ennemi. */
function streaks(e, now, color, n = 2) {
  const r = e.size;
  withFacing(e, facing(e), () => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const y = (i - (n - 1) / 2) * r * 0.5;
      const len = r * (0.6 + 0.3 * Math.sin(now / 60 + i * 2));
      ctx.moveTo(-r * 1.1, y);
      ctx.lineTo(-r * 1.1 - len, y);
    }
    thinStroke(color, 1.2, 0.55);
  });
}

/** Rotor : deux pales qui tournent vite. */
function rotor(e, now, color, k = 1.15) {
  const r = e.size;
  const a = now / 40;
  ctx.beginPath();
  for (const off of [0, Math.PI / 2]) {
    ctx.moveTo(e.x + Math.cos(a + off) * r * k, e.y + Math.sin(a + off) * r * k);
    ctx.lineTo(e.x - Math.cos(a + off) * r * k, e.y - Math.sin(a + off) * r * k);
  }
  thinStroke(color, 1, 0.35);
}

/** Anneau qui pulse (soigneur, ancre, nova...). */
function pulseRing(e, now, color, period, from = 1.1, to = 1.6) {
  const t = (now / period) % 1;
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.size * (from + (to - from) * t), 0, TAU);
  thinStroke(color, 1.2, 0.6 * (1 - t));
}

/** @type {Record<string, (e: any, now: number) => void>} */
const MOB_PARTS = {
  /** Drone-insecte : ailes qui battent. */
  normal(e, now) {
    const r = e.size;
    const flap = Math.sin(now / 35 + e.x) * 0.5;
    withFacing(e, facing(e), () => {
      ctx.beginPath();
      for (const side of [-1, 1]) {
        ctx.moveTo(-r * 0.1, side * r * 0.5);
        ctx.lineTo(-r * 0.7, side * r * (1.1 + flap * 0.3));
      }
      thinStroke("#e2b6ff", 1.4, 0.6);
    });
  },
  /** Éclaireur : traînée de vitesse. */
  fast(e, now) {
    streaks(e, now, e.color);
  },
  /** Blindé : tourelle qui suit le joueur, plaques en pointillés qui tournent. */
  tank(e, now) {
    const r = e.size;
    ctx.setLineDash([r * 0.5, r * 0.35]);
    ctx.lineDashOffset = now / 60;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 1.12, 0, TAU);
    thinStroke(e.color, 1.5, 0.5);
    ctx.setLineDash([]);
  },
  /** Tourelle : anneau qui se resserre avant le tir. */
  ranged(e, now) {
    const t = (now / 900 + e.y * 0.01) % 1;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size * (1.6 - t * 0.6), 0, TAU);
    thinStroke(e.color, 1, 0.15 + 0.5 * t);
  },
  /** Kamikaze : voyant qui clignote de plus en plus vite près du joueur. */
  kamikaze(e, now) {
    const d = Math.hypot(player.worldX - e.x, player.worldY - e.y);
    const period = d < 250 ? 60 : d < 500 ? 140 : 260;
    if (Math.floor(now / period) % 2) dot(e.x, e.y, e.size * 0.35, "#ffffff", 0.9);
  },
  /** Gros slime : bulle qui remonte dans la gelée. */
  slime_big(e, now) {
    const t = (now / 1100 + e.x * 0.01) % 1;
    dot(
      e.x + Math.sin(now / 400) * e.size * 0.3,
      e.y + e.size * (0.4 - t * 0.8),
      e.size * 0.12,
      "#e6ffe6",
      0.5 * Math.sin(t * Math.PI),
    );
  },
  /** Scorpion : dard qui se balance au-dessus de lui. */
  scorpion(e, now) {
    const r = e.size;
    const sway = Math.sin(now / 160 + e.x) * 0.5;
    withFacing(e, facing(e), () => {
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, 0);
      ctx.quadraticCurveTo(-r * 1.6, sway * r, -r * 0.9 + Math.cos(sway) * r * 0.2, (sway - 0.9) * r * 0.6);
      thinStroke("#ffd27a", 1.6, 0.8);
    });
  },
  /** Golem de glace : deux blocs de glace qui gravitent. */
  golem(e, now) {
    const r = e.size;
    ctx.beginPath();
    for (const off of [0, Math.PI]) {
      const a = now / 900 + off;
      diamondPath(e.x + Math.cos(a) * r * 1.3, e.y + Math.sin(a) * r * 1.3, a, r * 0.2, r * 0.1);
    }
    thinStroke("#c8f4ff", 1.2, 0.7);
  },
  /** Spore : cils qui ondulent. */
  spore(e, now) {
    const r = e.size;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6 + Math.sin(now / 300 + i) * 0.2;
      ctx.moveTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r);
      ctx.lineTo(e.x + Math.cos(a + 0.2) * r * 1.4, e.y + Math.sin(a + 0.2) * r * 1.4);
    }
    thinStroke(e.color, 1, 0.55);
  },
  /** Bombardier : mèche qui crépite. */
  bomber(e, now) {
    const r = e.size;
    const a = facing(e) + Math.PI;
    const x = e.x + Math.cos(a) * r * 1.1;
    const y = e.y + Math.sin(a) * r * 1.1;
    dot(x, y, 2 + Math.abs(Math.sin(now / 50)) * 2, "#ffe14d", 0.9);
  },
  /** Téléporteur : anneau qui clignote avant de disparaître. */
  blinker(e, now) {
    const k = e.blinkTo ? 1 : 0.3;
    ctx.setLineDash([3, 5]);
    ctx.lineDashOffset = -now / 20;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size * 1.3, 0, TAU);
    thinStroke(e.color, 1.2, k);
    ctx.setLineDash([]);
  },
  /** Drone laser : rotor, viseur qui s'allume avant le tir. */
  laser_drone(e, now) {
    rotor(e, now, e.color, 1.25);
    const k = charge(e);
    if (k > 0) dot(e.x, e.y, e.size * 0.25, "#ffffff", k);
  },
  /** Fantôme : traîne ondulante. */
  phantom(e, now) {
    const r = e.size;
    withFacing(e, facing(e), () => {
      ctx.beginPath();
      for (let k = 0; k <= 5; k++) {
        const x = -r * (0.8 + k * 0.25);
        const y = Math.sin(now / 110 + k) * r * 0.12 * k;
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      thinStroke(e.color, 1.6, 0.5);
    });
  },
  /** Voleur doré : éclats d'or qui scintillent autour de lui. */
  goblin(e, now) {
    for (let i = 0; i < 3; i++) {
      const t = (now / 600 + i / 3) % 1;
      const a = i * 2.1 + now / 900;
      dot(e.x + Math.cos(a) * e.size * 1.3, e.y + Math.sin(a) * e.size * 1.3, 1.6, "#ffd700", 1 - t);
    }
  },
  /** Porte-bouclier : reflet qui court sur le bouclier. */
  shield(e, now) {
    const a = e.facing ?? facing(e);
    const t = Math.sin(now / 300) * 0.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size * 1.25, a + t - 0.2, a + t + 0.2);
    thinStroke("#ffffff", 2, 0.7);
  },
  /** Essaim : petites ailes qui vibrent. */
  swarm(e, now) {
    const r = e.size;
    const w = Math.floor(now / 30) % 2 ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(e.x - r * 1.2 * w, e.y - r * 0.5);
    ctx.lineTo(e.x + r * 1.2 * w, e.y - r * 0.5);
    thinStroke("#fff6b0", 1, 0.5);
  },
  /** Soigneur : croix qui pulse et anneau de soin. */
  healer(e, now) {
    pulseRing(e, now, "#00ff88", 1200, 1.1, 2.2);
  },
  /** Aimant : lignes de champ entre ses pôles. */
  magnet(e, now) {
    const r = e.size;
    const k = e.magnetWarn > 0 || e.pulling > 0 ? 1 : 0.35;
    withFacing(e, facing(e), () => {
      ctx.beginPath();
      for (const d of [1.2, 1.5]) {
        ctx.moveTo(r * 0.6, -r * 0.6);
        ctx.quadraticCurveTo(r * d * 1.4, 0, r * 0.6, r * 0.6);
      }
      ctx.setLineDash([3, 4]);
      ctx.lineDashOffset = -now / 25;
      thinStroke("#ff99aa", 1.2, k);
      ctx.setLineDash([]);
    });
  },
  /** Déphaseur : anneaux décalés qui glissent l'un sur l'autre. */
  phaser(e, now) {
    const off = Math.sin(now / 200) * e.size * 0.25;
    ctx.beginPath();
    ctx.arc(e.x + off, e.y, e.size * 1.15, 0, TAU);
    thinStroke("#ff3bf0", 1, 0.4);
    ctx.beginPath();
    ctx.arc(e.x - off, e.y, e.size * 1.15, 0, TAU);
    thinStroke("#00ffff", 1, 0.4);
  },
  /** Réplicateur : membrane qui se pince comme une cellule qui se divise. */
  replicator(e, now) {
    const r = e.size;
    const pinch = (e.replicateWarn > 0 ? 0.5 : 0.15) * Math.abs(Math.sin(now / 250));
    withFacing(e, now / 1500, () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.25, r * (1.1 - pinch), 0, 0, TAU);
      thinStroke(e.color, 1, 0.45);
    });
  },
  /** Fusionneur : deux noyaux en orbite l'un autour de l'autre. */
  fuser(e, now) {
    const a = now / 220;
    const d = e.size * 0.5;
    dot(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, e.size * 0.16, "#ffe0a0", 0.8);
    dot(e.x - Math.cos(a) * d, e.y - Math.sin(a) * d, e.size * 0.16, "#ffe0a0", 0.8);
  },
  /** Nova : cœur qui gonfle, anneau qui se resserre pendant la charge. */
  nova(e, now) {
    pulseRing(e, now, "#ffb38a", e.charging > 0 ? 250 : 700, 1.8, 1.05);
  },
  /** Tentacule du Kraken : ventouses qui luisent à tour de rôle. */
  kraken_tentacle(e, now) {
    const r = e.size;
    withFacing(e, facing(e), () => {
      for (let i = 0; i < 3; i++) {
        const lit = Math.floor(now / 150) % 3 === i;
        dot(r * (0.6 - i * 0.5), 0, r * 0.12, "#7fe8ff", lit ? 0.9 : 0.3);
      }
    });
  },
  /** Anneau du Ver : arête dorsale qui scintille. */
  sandworm_segment(e, now) {
    const t = Math.floor(now / 200 + e.x * 0.02) % 2;
    dot(e.x, e.y, e.size * 0.18, "#ffd27a", t ? 0.7 : 0.3);
  },
  /** Fleur de la Ruche : pétales qui se balancent. */
  hive_flower(e, now) {
    const r = e.size;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * TAU) / 5 + Math.sin(now / 500) * 0.15;
      ctx.moveTo(e.x + Math.cos(a) * r * 0.9, e.y + Math.sin(a) * r * 0.9);
      ctx.quadraticCurveTo(
        e.x + Math.cos(a + 0.3) * r * 1.5,
        e.y + Math.sin(a + 0.3) * r * 1.5,
        e.x + Math.cos(a + 0.6) * r * 0.95,
        e.y + Math.sin(a + 0.6) * r * 0.95,
      );
    }
    thinStroke("#c8ff5a", 1, 0.55);
  },
  /** Clone du Hacker : double décalé qui grésille. */
  hacker_clone(e, now) {
    if (Math.floor(now / 80) % 3) return;
    const off = ((Math.floor(now / 80) % 5) - 2) * 2;
    ctx.beginPath();
    ctx.rect(e.x - e.size + off, e.y - e.size * 0.2, e.size * 2, e.size * 0.4);
    thinStroke("#00ff88", 1, 0.6);
  },
  /** Drone de forge : rotor. */
  forge_drone(e, now) {
    rotor(e, now, "#ffb347");
  },
  /** Colosse de forge : foyer qui rougeoie au rythme d'un soufflet. */
  forge_golem(e, now) {
    dot(e.x, e.y, e.size * (0.25 + 0.06 * Math.sin(now / 180)), "#ff7a1a", 0.6);
  },
  /** Écho du Reflet : reflet qui passe sur la surface. */
  mirror_echo(e, now) {
    const a = (now / 600) % TAU;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size * 1.05, a, a + 0.7);
    thinStroke("#ffffff", 1.6, 0.6);
  },
  /** Ancre de la Tisseuse : sceau à six côtés et onde qui pulse. */
  weaver_anchor(e, now) {
    ctx.beginPath();
    polyPath(e.x, e.y, 6, e.size * 1.3, -now / 1500);
    thinStroke("#aa66ff", 1, 0.45);
    pulseRing(e, now, "#aa66ff", 1400, 1.3, 1.9);
  },
};

// Mêmes pièces pour les variantes
MOB_PARTS.slime_small = MOB_PARTS.slime_big;
MOB_PARTS.sporeling = MOB_PARTS.spore;
MOB_PARTS.hydra_spawn = MOB_PARTS.fast;

/** Remet à zéro le compteur de l'image (appelé en tête de `drawEnemies`). */
export function beginMobLayers() {
  drawn = 0;
}

/** Pièces animées d'un ennemi ordinaire, si la qualité et le budget de l'image le permettent. */
export function drawMobLayers(e, now) {
  const part = MOB_PARTS[e.type];
  if (!part || !gfx.fx || drawn >= MAX) return;
  drawn++;
  const alpha = ctx.globalAlpha;
  ctx.lineCap = "round";
  part(e, now);
  ctx.globalAlpha = alpha;
}

/** Types qui ont des pièces animées (tests : chaque ennemi ordinaire en a). */
export function mobLayerTypes() {
  return Object.keys(MOB_PARTS);
}

/** Pièces dessinées pendant l'image en cours (tests : le plafond est respecté). */
export function mobLayersDrawn() {
  return drawn;
}
