// Sprites néon dessinés en code puis mis en cache dans des canvas hors écran :
// chaque forme (lueur comprise) n'est tracée qu'une fois, ensuite un simple
// drawImage suffit, ce qui reste rapide même avec des centaines d'ennemis.

import { gfx } from "../core/canvas.js";

const TAU = Math.PI * 2;
const RES = 2; // résolution des sprites (net sur écrans haute densité)
const cache = new Map();

/**
 * Renvoie un sprite en cache : canvas carré centré, dessiné en unités logiques
 * par `draw(c, r, color)` (r = rayon de l'entité). `pad` laisse la place à la lueur.
 */
export function getSprite(kind, r, color, variant = "") {
  const key = `${kind}|${r}|${color}|${variant}|${gfx.shadows}`;
  let s = cache.get(key);
  if (s) return s;

  const pad = Math.ceil(r * 0.6) + 14;
  const half = r + pad;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.ceil(half * 2 * RES);
  const c = canvas.getContext("2d");
  c.scale(RES, RES);
  c.translate(half, half);
  c.lineJoin = "round";
  c.lineCap = "round";
  SHAPES[kind](c, r, color);

  if (variant === "flash") {
    // Silhouette blanche (ennemi touché)
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = "source-atop";
    c.fillStyle = "rgba(255, 255, 255, 0.85)";
    c.fillRect(0, 0, canvas.width, canvas.height);
  }
  s = { canvas, half };
  cache.set(key, s);
  return s;
}

/** Dessine un sprite centré en (x, y), avec rotation et échelle facultatives. */
export function drawSprite(ctx, sprite, x, y, angle = 0, sx = 1, sy = sx) {
  const h = sprite.half;
  if (angle === 0 && sx === 1 && sy === 1) {
    ctx.drawImage(sprite.canvas, x - h, y - h, h * 2, h * 2);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  ctx.scale(sx, sy);
  ctx.drawImage(sprite.canvas, -h, -h, h * 2, h * 2);
  ctx.restore();
}

// --- OUTILS DE TRACÉ ---

function glow(c, color, blur) {
  if (!gfx.shadows) return;
  c.shadowColor = color;
  c.shadowBlur = blur;
}

function noGlow(c) {
  c.shadowBlur = 0;
}

/** Corps néon : intérieur sombre teinté + contour lumineux. */
function neonBody(c, path, color, line = 2.5, blur = 12) {
  c.fillStyle = shade(color, 0.22);
  path();
  c.fill();
  glow(c, color, blur);
  c.strokeStyle = color;
  c.lineWidth = line;
  path();
  c.stroke();
  noGlow(c);
}

function polygon(c, points) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
}

function regular(c, sides, r, rot = 0) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (TAU * i) / sides;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  polygon(c, pts);
}

function dot(c, x, y, r, color, blur = 8) {
  glow(c, color, blur);
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
  noGlow(c);
}

/** Œil lumineux : pupille blanche entourée de la couleur. */
function eye(c, x, y, r, color) {
  dot(c, x, y, r, color, 10);
  dot(c, x + r * 0.25, y, r * 0.5, "#ffffff", 0);
}

/** Assombrit une couleur hexadécimale (#rrggbb) : k = 0 → noir, 1 → identique. */
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r}, ${g}, ${b})`;
}

// --- FORMES (orientées vers la droite : angle 0 = vers la cible) ---

const SHAPES = {
  /** Drone-insecte : carapace, mandibules, deux yeux. */
  normal(c, r, color) {
    c.strokeStyle = color;
    c.lineWidth = 2;
    glow(c, color, 6);
    for (const s of [-1, 1]) {
      // Pattes
      for (const k of [-0.5, 0, 0.5]) {
        c.beginPath();
        c.moveTo(k * r, s * r * 0.6);
        c.lineTo(k * r - r * 0.25, s * r * 1.15);
        c.stroke();
      }
      // Mandibules
      c.beginPath();
      c.moveTo(r * 0.75, s * r * 0.3);
      c.quadraticCurveTo(r * 1.25, s * r * 0.35, r * 1.2, s * r * 0.05);
      c.stroke();
    }
    noGlow(c);
    neonBody(
      c,
      () => {
        c.beginPath();
        c.ellipse(0, 0, r * 0.95, r * 0.75, 0, 0, TAU);
      },
      color,
    );
    c.strokeStyle = shade(color, 0.7);
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-r * 0.8, 0);
    c.lineTo(r * 0.2, 0);
    c.stroke();
    eye(c, r * 0.5, -r * 0.28, r * 0.18, "#ff2a6d");
    eye(c, r * 0.5, r * 0.28, r * 0.18, "#ff2a6d");
  },

  /** Éclaireur : fléchette effilée avec réacteurs. */
  fast(c, r, color) {
    const path = () =>
      polygon(c, [
        [r * 1.3, 0],
        [-r * 0.6, -r * 0.85],
        [-r * 0.25, 0],
        [-r * 0.6, r * 0.85],
      ]);
    neonBody(c, path, color);
    dot(c, -r * 0.55, -r * 0.55, r * 0.15, "#ffffff", 10);
    dot(c, -r * 0.55, r * 0.55, r * 0.15, "#ffffff", 10);
    eye(c, r * 0.45, 0, r * 0.2, "#ffee00");
  },

  /** Blindé : octogone à plaques avec noyau. */
  tank(c, r, color) {
    neonBody(c, () => regular(c, 8, r, TAU / 16), color, 3, 14);
    c.strokeStyle = shade(color, 0.75);
    c.lineWidth = 2;
    regular(c, 8, r * 0.7, TAU / 16);
    c.stroke();
    // Rivets
    for (let i = 0; i < 8; i++) {
      const a = TAU / 16 + (TAU * i) / 8;
      dot(c, Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85, 1.6, color, 0);
    }
    neonBody(c, () => regular(c, 4, r * 0.38, TAU / 8), "#ff2a6d", 2, 10);
    dot(c, 0, 0, r * 0.14, "#ffffff", 8);
  },

  /** Tourelle : anneau, canon et viseur. */
  ranged(c, r, color) {
    neonBody(
      c,
      () => {
        c.beginPath();
        c.rect(r * 0.3, -r * 0.22, r * 1.05, r * 0.44);
      },
      color,
      2,
      8,
    );
    neonBody(
      c,
      () => {
        c.beginPath();
        c.arc(0, 0, r * 0.85, 0, TAU);
      },
      color,
    );
    c.strokeStyle = shade(color, 0.7);
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, 0, r * 0.55, 0, TAU);
    c.stroke();
    eye(c, 0, 0, r * 0.28, "#ff0040");
  },

  /** Scorpion du désert : corps segmenté, pinces et dard recourbé. */
  scorpion(c, r, color) {
    c.strokeStyle = color;
    c.lineWidth = 2;
    glow(c, color, 6);
    for (const s of [-1, 1]) {
      // Pattes
      for (const k of [-0.4, 0, 0.4]) {
        c.beginPath();
        c.moveTo(k * r, s * r * 0.4);
        c.lineTo(k * r - r * 0.2, s * r * 0.95);
        c.stroke();
      }
      // Pinces
      c.beginPath();
      c.moveTo(r * 0.5, s * r * 0.3);
      c.quadraticCurveTo(r * 1.1, s * r * 0.75, r * 1.3, s * r * 0.35);
      c.lineTo(r * 1.05, s * r * 0.25);
      c.stroke();
    }
    // Queue recourbée au-dessus du dos
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-r * 0.6, 0);
    c.quadraticCurveTo(-r * 1.4, 0, -r * 1.1, -r * 0.7);
    c.quadraticCurveTo(-r * 0.7, -r * 1.1, -r * 0.2, -r * 0.75);
    c.stroke();
    noGlow(c);
    dot(c, -r * 0.2, -r * 0.75, r * 0.15, "#ffee00", 10);
    for (const [x, rr] of [
      [-0.35, 0.38],
      [0.05, 0.45],
      [0.45, 0.4],
    ]) {
      neonBody(
        c,
        () => {
          c.beginPath();
          c.ellipse(x * r, 0, r * 0.28, r * rr, 0, 0, TAU);
        },
        color,
        2,
        8,
      );
    }
    eye(c, r * 0.6, -r * 0.14, r * 0.1, "#ffee00");
    eye(c, r * 0.6, r * 0.14, r * 0.1, "#ffee00");
  },

  /** Golem de glace : bloc de roche hérissé de cristaux. */
  golem(c, r, color) {
    // Cristaux sur le dos
    for (const [a, len] of [
      [-2.3, 1.35],
      [-1.6, 1.5],
      [-0.9, 1.3],
      [2.4, 1.25],
    ]) {
      neonBody(
        c,
        () =>
          polygon(c, [
            [Math.cos(a - 0.18) * r * 0.75, Math.sin(a - 0.18) * r * 0.75],
            [Math.cos(a) * r * len, Math.sin(a) * r * len],
            [Math.cos(a + 0.18) * r * 0.75, Math.sin(a + 0.18) * r * 0.75],
          ]),
        "#e8fbff",
        1.5,
        10,
      );
    }
    neonBody(
      c,
      () =>
        polygon(c, [
          [r * 0.95, -r * 0.3],
          [r * 0.85, r * 0.45],
          [r * 0.3, r * 0.95],
          [-r * 0.55, r * 0.85],
          [-r * 0.95, r * 0.2],
          [-r * 0.8, -r * 0.6],
          [-r * 0.1, -r * 0.95],
          [r * 0.6, -r * 0.75],
        ]),
      color,
      3,
      14,
    );
    // Fissures
    c.strokeStyle = shade(color.startsWith("#") ? color : "#7fdfff", 0.75);
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-r * 0.5, -r * 0.3);
    c.lineTo(-r * 0.1, r * 0.1);
    c.lineTo(-r * 0.3, r * 0.5);
    c.moveTo(r * 0.1, -r * 0.6);
    c.lineTo(r * 0.2, -r * 0.2);
    c.stroke();
    eye(c, r * 0.55, -r * 0.22, r * 0.13, "#00e5ff");
    eye(c, r * 0.55, r * 0.22, r * 0.13, "#00e5ff");
  },

  /** Kamikaze : boule à pointes autour d'un cœur instable. */
  kamikaze(c, r, color) {
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const rr = i % 2 ? r * 0.6 : r * 1.15;
      const a = (TAU * i) / 16;
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    neonBody(c, () => polygon(c, pts), color, 2, 14);
    dot(c, 0, 0, r * 0.38, "#ffcc00", 14);
    dot(c, 0, 0, r * 0.16, "#ffffff", 0);
  },

  /** Mini-boss : crabe blindé à trois canons. */
  miniboss(c, r, color) {
    c.strokeStyle = color;
    c.lineWidth = 3;
    glow(c, color, 8);
    for (const s of [-1, 1]) {
      // Pinces
      c.beginPath();
      c.moveTo(r * 0.3, s * r * 0.6);
      c.quadraticCurveTo(r * 1.1, s * r * 1.1, r * 1.25, s * r * 0.45);
      c.stroke();
      c.beginPath();
      c.moveTo(r * 1.25, s * r * 0.45);
      c.lineTo(r * 0.95, s * r * 0.4);
      c.stroke();
    }
    noGlow(c);
    for (const off of [-0.35, 0, 0.35]) {
      neonBody(
        c,
        () => {
          c.beginPath();
          c.rect(r * 0.4, off * r - r * 0.09, r * 0.75, r * 0.18);
        },
        "#ffdd55",
        1.5,
        6,
      );
    }
    neonBody(c, () => regular(c, 6, r * 0.8), color, 3, 16);
    neonBody(c, () => regular(c, 6, r * 0.45), "#aa6600", 1.5, 0);
    eye(c, r * 0.25, -r * 0.2, r * 0.12, "#ff0040");
    eye(c, r * 0.25, r * 0.2, r * 0.12, "#ff0040");
  },

  /** Boss : couronne de pointes et grand œil central (tourne sur lui-même). */
  boss(c, r, color) {
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const rr = i % 2 ? r * 0.8 : r * 1.05;
      const a = (TAU * i) / 24;
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    neonBody(c, () => polygon(c, pts), color, 3, 22);
    c.strokeStyle = color;
    c.lineWidth = 2;
    glow(c, color, 10);
    c.beginPath();
    c.arc(0, 0, r * 0.62, 0, TAU);
    c.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (TAU * i) / 6;
      c.beginPath();
      c.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
      c.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
      c.stroke();
    }
    noGlow(c);
    // Œil
    c.fillStyle = "#12001a";
    c.beginPath();
    c.ellipse(0, 0, r * 0.45, r * 0.3, 0, 0, TAU);
    c.fill();
    glow(c, "#ff0040", 16);
    c.strokeStyle = "#ff0040";
    c.lineWidth = 2.5;
    c.stroke();
    noGlow(c);
    dot(c, 0, 0, r * 0.17, "#ff0040", 14);
    c.fillStyle = "#000";
    c.beginPath();
    c.ellipse(0, 0, r * 0.05, r * 0.14, 0, 0, TAU);
    c.fill();
  },

  /** Slime : goutte gélatineuse, reflet et yeux (déformée à l'affichage). */
  slime(c, r, color) {
    const path = () => {
      c.beginPath();
      c.moveTo(-r, r * 0.55);
      c.bezierCurveTo(-r * 1.1, -r * 0.4, -r * 0.5, -r, 0, -r);
      c.bezierCurveTo(r * 0.5, -r, r * 1.1, -r * 0.4, r, r * 0.55);
      c.quadraticCurveTo(0, r * 0.85, -r, r * 0.55);
      c.closePath();
    };
    c.globalAlpha = 0.85;
    neonBody(c, path, color, 2.5, 16);
    c.globalAlpha = 1;
    c.fillStyle = "rgba(255, 255, 255, 0.35)";
    c.beginPath();
    c.ellipse(-r * 0.4, -r * 0.5, r * 0.18, r * 0.1, -0.6, 0, TAU);
    c.fill();
    dot(c, -r * 0.3, -r * 0.05, r * 0.14, "#ffffff", 0);
    dot(c, r * 0.3, -r * 0.05, r * 0.14, "#ffffff", 0);
    dot(c, -r * 0.27, -r * 0.03, r * 0.07, "#002200", 0);
    dot(c, r * 0.33, -r * 0.03, r * 0.07, "#002200", 0);
  },

  /** Roi slime : slime avec couronne. */
  slime_king(c, r, color) {
    SHAPES.slime(c, r, color);
    neonBody(
      c,
      () =>
        polygon(c, [
          [-r * 0.45, -r * 0.85],
          [-r * 0.5, -r * 1.3],
          [-r * 0.22, -r * 1.08],
          [0, -r * 1.4],
          [r * 0.22, -r * 1.08],
          [r * 0.5, -r * 1.3],
          [r * 0.45, -r * 0.85],
        ]),
      "#ffd700",
      2.5,
      14,
    );
  },

  /** Nécro-Hydre : corps hérissé avec un cœur pulsant (les têtes sont dessinées à part). */
  hydra(c, r, color) {
    const pts = [];
    for (let i = 0; i < 14; i++) {
      const rr = i % 2 ? r * 0.75 : r * 0.98;
      const a = (TAU * i) / 14;
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    neonBody(c, () => polygon(c, pts), color, 3, 20);
    c.strokeStyle = shade(color, 0.7);
    c.lineWidth = 2;
    for (const k of [0.55, 0.35]) {
      c.beginPath();
      c.arc(0, 0, r * k, 0, TAU);
      c.stroke();
    }
    dot(c, 0, 0, r * 0.2, "#39ff14", 16);
    dot(c, 0, 0, r * 0.08, "#ffffff", 0);
  },

  /** Tête de l'hydre : crâne de serpent, crocs et yeux verts. */
  hydraHead(c, r, color) {
    const path = () =>
      polygon(c, [
        [r * 1.2, 0],
        [r * 0.4, -r * 0.7],
        [-r * 0.7, -r * 0.6],
        [-r * 0.9, 0],
        [-r * 0.7, r * 0.6],
        [r * 0.4, r * 0.7],
      ]);
    neonBody(c, path, color, 2.5, 12);
    c.strokeStyle = "#ffffff";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(r * 1.05, -r * 0.2);
    c.lineTo(r * 1.3, -r * 0.05);
    c.moveTo(r * 1.05, r * 0.2);
    c.lineTo(r * 1.3, r * 0.05);
    c.stroke();
    eye(c, r * 0.35, -r * 0.3, r * 0.16, "#39ff14");
    eye(c, r * 0.35, r * 0.3, r * 0.16, "#39ff14");
  },

  /** Colosse de givre : bloc massif, épaules de cristal, cœur gelé. */
  colossus(c, r, color) {
    // Épaules et pics de glace
    for (const s of [-1, 1]) {
      for (const [a, len] of [
        [1.1, 1.45],
        [1.6, 1.3],
        [2.1, 1.4],
      ]) {
        const ang = s * a;
        neonBody(
          c,
          () =>
            polygon(c, [
              [Math.cos(ang - 0.15) * r * 0.8, Math.sin(ang - 0.15) * r * 0.8],
              [Math.cos(ang) * r * len, Math.sin(ang) * r * len],
              [Math.cos(ang + 0.15) * r * 0.8, Math.sin(ang + 0.15) * r * 0.8],
            ]),
          "#e8fbff",
          2,
          12,
        );
      }
    }
    neonBody(c, () => regular(c, 8, r * 0.95, TAU / 16), color, 4, 22);
    c.strokeStyle = shade(color, 0.7);
    c.lineWidth = 2;
    regular(c, 8, r * 0.65, TAU / 16);
    c.stroke();
    // Bras-marteaux
    for (const s of [-1, 1]) {
      neonBody(
        c,
        () => {
          c.beginPath();
          c.roundRect(r * 0.35, s * r * 0.95 - r * 0.2, r * 0.75, r * 0.4, r * 0.1);
        },
        "#bdf3ff",
        2.5,
        12,
      );
    }
    neonBody(c, () => regular(c, 4, r * 0.32, 0), "#00e5ff", 2.5, 18);
    dot(c, 0, 0, r * 0.12, "#ffffff", 14);
    eye(c, r * 0.55, -r * 0.2, r * 0.09, "#00e5ff");
    eye(c, r * 0.55, r * 0.2, r * 0.09, "#00e5ff");
  },

  /** Faucheur du vide : capuche, faux géante et yeux rouges. */
  void_reaper(c, r, color) {
    // Faux
    c.strokeStyle = "#dddddd";
    c.lineWidth = 3;
    glow(c, "#ffffff", 8);
    c.beginPath();
    c.moveTo(-r * 0.9, r * 0.9);
    c.lineTo(r * 1.1, -r * 0.9);
    c.stroke();
    noGlow(c);
    neonBody(
      c,
      () => {
        c.beginPath();
        c.moveTo(r * 1.1, -r * 0.9);
        c.quadraticCurveTo(r * 0.4, -r * 1.6, -r * 0.6, -r * 1.2);
        c.quadraticCurveTo(r * 0.3, -r * 1.15, r * 0.95, -r * 0.7);
        c.closePath();
      },
      color,
      2.5,
      16,
    );
    // Capuche / manteau en lambeaux
    const pts = [[r * 0.9, 0]];
    for (let i = 1; i < 12; i++) {
      const a = (TAU * i) / 12;
      const rr = i % 2 ? r * 0.75 : r * 1.0;
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    neonBody(c, () => polygon(c, pts), color, 3, 22);
    c.fillStyle = "#08000a";
    c.beginPath();
    c.ellipse(r * 0.2, 0, r * 0.5, r * 0.42, 0, 0, TAU);
    c.fill();
    eye(c, r * 0.4, -r * 0.16, r * 0.1, "#ff0040");
    eye(c, r * 0.4, r * 0.16, r * 0.1, "#ff0040");
  },

  /** Titan de l'orage : carapace hexagonale, bobines sur les épaules, éclair au cœur. */
  storm_titan(c, r, color) {
    // Bobines électriques
    for (const s of [-1, 1]) {
      c.save();
      c.translate(-r * 0.15, s * r * 0.95);
      neonBody(c, () => regular(c, 6, r * 0.32, 0), "#9be7ff", 2, 12);
      dot(c, 0, 0, r * 0.1, "#ffffff", 12);
      c.restore();
    }
    neonBody(c, () => regular(c, 6, r * 0.9, TAU / 12), color, 4, 22);
    c.strokeStyle = shade(color, 0.7);
    c.lineWidth = 2;
    regular(c, 6, r * 0.6, TAU / 12);
    c.stroke();
    // Éclair au centre
    neonBody(
      c,
      () =>
        polygon(c, [
          [r * 0.12, -r * 0.5],
          [-r * 0.2, r * 0.05],
          [r * 0.02, r * 0.05],
          [-r * 0.12, r * 0.5],
          [r * 0.22, -r * 0.08],
          [r * 0.0, -r * 0.08],
        ]),
      "#ffffff",
      1.5,
      14,
    );
    eye(c, r * 0.62, -r * 0.2, r * 0.09, "#9be7ff");
    eye(c, r * 0.62, r * 0.2, r * 0.09, "#9be7ff");
  },

  /** Sentinelle prismatique : triangle de cristal, facettes et cœur qui réfracte. */
  prism(c, r, color) {
    neonBody(c, () => regular(c, 3, r * 1.05, 0), color, 3.5, 22);
    neonBody(c, () => regular(c, 3, r * 0.62, Math.PI), "#ff4dd2", 2.5, 16);
    c.strokeStyle = shade(color, 0.75);
    c.lineWidth = 1.5;
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (TAU * i) / 3;
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05);
    }
    c.stroke();
    dot(c, 0, 0, r * 0.2, "#b07dff", 16);
    dot(c, 0, 0, r * 0.09, "#ffffff", 0);
  },

  /** Kraken : manteau bulbeux, gros yeux et couronne de bras repliés (tête tournée vers la droite). */
  kraken(c, r, color) {
    // Bras repliés derrière la tête
    c.strokeStyle = color;
    c.lineWidth = r * 0.14;
    glow(c, color, 10);
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 0.62 + (Math.PI * 0.76 * i) / 5;
      c.beginPath();
      c.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
      c.quadraticCurveTo(
        Math.cos(a - 0.35) * r * 1.15,
        Math.sin(a - 0.35) * r * 1.15,
        Math.cos(a + 0.15) * r * 1.4,
        Math.sin(a + 0.15) * r * 1.4,
      );
      c.stroke();
    }
    noGlow(c);
    neonBody(
      c,
      () => {
        c.beginPath();
        c.ellipse(-r * 0.05, 0, r * 0.95, r * 0.78, 0, 0, TAU);
      },
      color,
      3.5,
      22,
    );
    // Taches du manteau
    for (const [x, y, rr] of [
      [-r * 0.45, -r * 0.3, 0.12],
      [-r * 0.5, r * 0.28, 0.1],
      [-r * 0.15, 0, 0.09],
    ]) {
      dot(c, x, y, r * rr, shade(color, 0.6), 0);
    }
    eye(c, r * 0.45, -r * 0.32, r * 0.17, "#ffd700");
    eye(c, r * 0.45, r * 0.32, r * 0.17, "#ffd700");
  },

  /** Tentacule du Kraken : bras courbé couvert de ventouses, qui sort d'un trou dans le sol. */
  tentacle(c, r, color) {
    dot(c, 0, 0, r * 0.75, "#05010d", 0);
    c.strokeStyle = shade(color, 0.6);
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, r * 0.8, 0, TAU);
    c.stroke();
    const path = () => {
      c.beginPath();
      c.moveTo(-r * 0.1, -r * 0.45);
      c.quadraticCurveTo(r * 0.9, -r * 0.8, r * 1.35, -r * 0.05);
      c.quadraticCurveTo(r * 1.1, r * 0.2, r * 0.75, -r * 0.05);
      c.quadraticCurveTo(r * 0.5, r * 0.35, -r * 0.1, r * 0.45);
      c.closePath();
    };
    neonBody(c, path, color, 2.5, 14);
    for (const [x, y] of [
      [r * 0.25, r * 0.05],
      [r * 0.6, -r * 0.15],
      [r * 0.95, -r * 0.2],
    ]) {
      dot(c, x, y, r * 0.09, "#ffd0ff", 4);
    }
  },

  /** Jumeau de feu : étoile de flammes autour d'un cœur ardent. */
  twin_fire(c, r, color) {
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (TAU * i) / 16;
      const rr = i % 2 ? r * 0.62 : r * (i % 4 ? 1.0 : 1.2);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    neonBody(c, () => polygon(c, pts), color, 3, 22);
    neonBody(c, () => regular(c, 8, r * 0.48, TAU / 16), "#ffd23d", 2, 14);
    dot(c, 0, 0, r * 0.2, "#fff2b0", 16);
  },

  /** Jumeau de glace : flocon hexagonal autour d'un cristal. */
  twin_ice(c, r, color) {
    neonBody(c, () => regular(c, 6, r * 0.95, 0), color, 3, 22);
    c.strokeStyle = "#e8fbff";
    c.lineWidth = 2;
    glow(c, color, 8);
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (TAU * i) / 6;
      const [x, y] = [Math.cos(a), Math.sin(a)];
      c.moveTo(0, 0);
      c.lineTo(x * r * 0.85, y * r * 0.85);
      // Petites branches du flocon
      for (const s of [-1, 1]) {
        c.moveTo(x * r * 0.5, y * r * 0.5);
        c.lineTo(
          x * r * 0.5 + Math.cos(a + s * 0.8) * r * 0.22,
          y * r * 0.5 + Math.sin(a + s * 0.8) * r * 0.22,
        );
      }
    }
    c.stroke();
    noGlow(c);
    neonBody(c, () => regular(c, 6, r * 0.3, TAU / 12), "#bdf3ff", 2, 12);
    dot(c, 0, 0, r * 0.12, "#ffffff", 12);
  },

  /** Spore de la jungle : boule bosselée hérissée de pustules (éclate en sporelets). */
  spore(c, r, color) {
    const bumps = 9;
    const path = () => {
      c.beginPath();
      for (let k = 0; k <= bumps * 2; k++) {
        const a = (TAU * k) / (bumps * 2);
        const rr = r * (k % 2 ? 0.82 : 1);
        c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.closePath();
    };
    neonBody(c, path, color, 2, 12);
    for (const [x, y, rr] of [
      [0.35, -0.3, 0.2],
      [-0.3, 0.35, 0.18],
      [-0.25, -0.35, 0.14],
      [0.3, 0.38, 0.12],
    ]) {
      dot(c, x * r, y * r, rr * r, "#eaff9a", 8);
    }
    eye(c, r * 0.1, 0, r * 0.2, "#ff2a6d");
  },

  /** Poseur de mines : scarabée blindé qui porte une mine sur le dos. */
  bomber(c, r, color) {
    c.strokeStyle = color;
    c.lineWidth = 2;
    glow(c, color, 6);
    for (const s of [-1, 1]) {
      for (const k of [-0.45, 0, 0.45]) {
        c.beginPath();
        c.moveTo(k * r, s * r * 0.5);
        c.lineTo(k * r + r * 0.15, s * r * 1.05);
        c.stroke();
      }
    }
    noGlow(c);
    neonBody(
      c,
      () => {
        c.beginPath();
        c.ellipse(0, 0, r, r * 0.75, 0, 0, TAU);
      },
      color,
      2.5,
      10,
    );
    c.strokeStyle = shade(color, 0.6);
    c.beginPath();
    c.moveTo(-r * 0.9, 0);
    c.lineTo(r * 0.55, 0);
    c.stroke();
    dot(c, -r * 0.25, 0, r * 0.32, "#ff3300", 12);
    dot(c, -r * 0.25, 0, r * 0.12, "#ffee00", 6);
    eye(c, r * 0.75, -r * 0.2, r * 0.11, "#ffffff");
    eye(c, r * 0.75, r * 0.2, r * 0.11, "#ffffff");
  },

  /** Téléporteur : losange à facettes avec un cœur qui scintille. */
  blinker(c, r, color) {
    neonBody(
      c,
      () =>
        polygon(c, [
          [r * 1.15, 0],
          [0, -r * 0.85],
          [-r * 1.15, 0],
          [0, r * 0.85],
        ]),
      color,
      2.5,
      14,
    );
    c.strokeStyle = shade(color, 0.7);
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(r * 1.15, 0);
    c.lineTo(-r * 1.15, 0);
    c.moveTo(0, -r * 0.85);
    c.lineTo(0, r * 0.85);
    c.stroke();
    dot(c, 0, 0, r * 0.28, "#ffffff", 14);
  },

  /** Drone laser : soucoupe à canon, lentille rose. */
  laser_drone(c, r, color) {
    neonBody(c, () => c.rect(r * 0.2, -r * 0.18, r * 1.1, r * 0.36), color, 2, 8);
    neonBody(c, () => regular(c, 6, r * 0.9, TAU / 12), color, 2.5, 12);
    c.strokeStyle = shade(color, 0.7);
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, 0, r * 0.55, 0, TAU);
    c.stroke();
    dot(c, r * 1.3, 0, r * 0.14, "#ffffff", 12);
    eye(c, 0, 0, r * 0.26, "#ff4fd8");
  },

  /** Spectre (sbire du Faucheur) : petit fantôme. */
  phantom(c, r, color) {
    const path = () => {
      c.beginPath();
      c.moveTo(r, 0);
      c.quadraticCurveTo(r, -r, 0, -r);
      c.quadraticCurveTo(-r * 0.9, -r, -r * 0.9, -r * 0.3);
      c.lineTo(-r * 1.3, -r * 0.5);
      c.lineTo(-r * 1.05, 0);
      c.lineTo(-r * 1.3, r * 0.5);
      c.lineTo(-r * 0.9, r * 0.3);
      c.quadraticCurveTo(-r * 0.9, r, 0, r);
      c.quadraticCurveTo(r, r, r, 0);
      c.closePath();
    };
    c.globalAlpha = 0.85;
    neonBody(c, path, color, 2, 14);
    c.globalAlpha = 1;
    dot(c, r * 0.4, -r * 0.3, r * 0.15, "#ffffff", 6);
    dot(c, r * 0.4, r * 0.3, r * 0.15, "#ffffff", 6);
  },

  /** Porte-bouclier : petit corps blindé derrière un large bouclier courbe (face avant). */
  shield(c, r, color) {
    neonBody(c, () => regular(c, 6, r * 0.7, 0), color, 2, 8);
    eye(c, r * 0.15, 0, r * 0.18, "#ffffff");
    const path = () => {
      c.beginPath();
      c.arc(0, 0, r * 1.15, -1.1, 1.1);
      c.arc(0, 0, r * 0.85, 1.1, -1.1, true);
      c.closePath();
    };
    neonBody(c, path, "#bfe3ff", 2.5, 16);
    c.strokeStyle = color;
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, 0, r, -0.9, 0.9);
    c.stroke();
  },

  /** Essaim : minuscule drone triangulaire aux ailes vibrantes. */
  swarm(c, r, color) {
    c.strokeStyle = shade(color, 0.7);
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-r * 0.2, -r * 0.4);
    c.lineTo(-r * 0.7, -r * 1.2);
    c.moveTo(-r * 0.2, r * 0.4);
    c.lineTo(-r * 0.7, r * 1.2);
    c.stroke();
    neonBody(
      c,
      () =>
        polygon(c, [
          [r * 1.1, 0],
          [-r * 0.8, -r * 0.7],
          [-r * 0.4, 0],
          [-r * 0.8, r * 0.7],
        ]),
      color,
      1.5,
      8,
    );
    dot(c, r * 0.25, 0, r * 0.22, "#ffffff", 6);
  },

  /** Soigneur : orbe flottant marqué d'une croix lumineuse. */
  healer(c, r, color) {
    neonBody(
      c,
      () => {
        c.beginPath();
        c.arc(0, 0, r, 0, TAU);
      },
      color,
      2.5,
      14,
    );
    c.strokeStyle = shade(color, 0.6);
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, 0, r * 0.7, 0, TAU);
    c.stroke();
    glow(c, "#ffffff", 10);
    c.fillStyle = "#eafff4";
    c.fillRect(-r * 0.14, -r * 0.5, r * 0.28, r);
    c.fillRect(-r * 0.5, -r * 0.14, r, r * 0.28);
    noGlow(c);
  },

  /** Aimant : aimant en fer à cheval, pôles tournés vers le joueur. */
  magnet(c, r, color) {
    const path = () => {
      c.beginPath();
      c.moveTo(r, -r * 0.85);
      c.lineTo(0, -r * 0.85);
      c.arc(0, 0, r * 0.85, -Math.PI / 2, Math.PI / 2, true);
      c.lineTo(r, r * 0.85);
      c.lineTo(r, r * 0.4);
      c.lineTo(0, r * 0.4);
      c.arc(0, 0, r * 0.4, Math.PI / 2, -Math.PI / 2);
      c.lineTo(r, -r * 0.4);
      c.closePath();
    };
    neonBody(c, path, color, 2.5, 12);
    c.fillStyle = "#ffffff";
    glow(c, "#9fd8ff", 10);
    c.fillRect(r * 0.65, -r * 0.85, r * 0.35, r * 0.45);
    c.fillRect(r * 0.65, r * 0.4, r * 0.35, r * 0.45);
    noGlow(c);
    eye(c, -r * 0.55, 0, r * 0.16, "#ffffff");
  },

  /** Voleur doré : petit sac d'or sur pattes, scintillant. */
  goblin(c, r, color) {
    neonBody(
      c,
      () => {
        c.beginPath();
        c.ellipse(-r * 0.2, 0, r * 0.85, r * 0.75, 0, 0, TAU);
      },
      color,
      2.5,
      18,
    );
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-r * 0.95, -r * 0.35);
    c.lineTo(-r * 1.3, -r * 0.6);
    c.moveTo(-r * 0.95, r * 0.35);
    c.lineTo(-r * 1.3, r * 0.6);
    c.stroke();
    c.font = `900 ${r * 1.1}px Orbitron`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "#fff6b0";
    c.fillText("$", -r * 0.2, r * 0.05);
    eye(c, r * 0.55, -r * 0.25, r * 0.13, "#ffffff");
    eye(c, r * 0.55, r * 0.25, r * 0.13, "#ffffff");
  },

  /** Coffre de boss : coffre doré cerclé, serrure lumineuse. */
  bossChest(c, r, color) {
    neonBody(
      c,
      () => {
        c.beginPath();
        c.roundRect(-r, -r * 0.35, r * 2, r * 1.1, r * 0.15);
      },
      color,
      3,
      18,
    );
    neonBody(
      c,
      () => {
        c.beginPath();
        c.moveTo(-r, -r * 0.35);
        c.lineTo(-r, -r * 0.55);
        c.quadraticCurveTo(0, -r * 1.25, r, -r * 0.55);
        c.lineTo(r, -r * 0.35);
        c.closePath();
      },
      color,
      3,
      18,
    );
    c.strokeStyle = shade("#ffd700", 0.7);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-r * 0.55, -r * 0.9);
    c.lineTo(-r * 0.55, r * 0.75);
    c.moveTo(r * 0.55, -r * 0.9);
    c.lineTo(r * 0.55, r * 0.75);
    c.stroke();
    dot(c, 0, -r * 0.2, r * 0.2, "#ffffff", 16);
  },

  /** Tourelle de l'Ingénieur. */
  turret(c, r, color) {
    neonBody(
      c,
      () => {
        c.beginPath();
        c.rect(r * 0.2, -r * 0.2, r * 1.1, r * 0.4);
      },
      color,
      2,
      8,
    );
    neonBody(c, () => regular(c, 6, r * 0.8), color, 2.5, 12);
    dot(c, 0, 0, r * 0.25, "#ffffff", 8);
  },

  /** Disque laser : anneau à dents. */
  disc(c, r, color) {
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const rr = i % 2 ? r * 0.75 : r * 1.05;
      const a = (TAU * i) / 12;
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    neonBody(c, () => polygon(c, pts), color, 2, 14);
    dot(c, 0, 0, r * 0.3, "#ffffff", 8);
  },

  /** Faux du Faucheur : lame en croissant. */
  scythe(c, r, color) {
    neonBody(
      c,
      () => {
        c.beginPath();
        c.arc(0, 0, r, -1.9, 1.9);
        c.arc(-r * 0.35, 0, r * 0.8, 1.6, -1.6, true);
        c.closePath();
      },
      color,
      2.5,
      14,
    );
  },

  /** Projectile : halo + cœur blanc. */
  bullet(c, r, color) {
    glow(c, color, r * 3);
    c.fillStyle = color;
    c.beginPath();
    c.arc(0, 0, r, 0, TAU);
    c.fill();
    noGlow(c);
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(0, 0, r * 0.5, 0, TAU);
    c.fill();
  },

  /** Gemme d'expérience. */
  gem(c, r, color) {
    const path = () =>
      polygon(c, [
        [0, -r * 1.2],
        [r * 0.8, 0],
        [0, r * 1.2],
        [-r * 0.8, 0],
      ]);
    neonBody(c, path, color, 1.5, 10);
    c.fillStyle = "rgba(255, 255, 255, 0.7)";
    polygon(c, [
      [0, -r * 0.9],
      [r * 0.35, -r * 0.1],
      [0, 0],
    ]);
    c.fill();
  },

  /** Caisse de butin. */
  crate(c, r, color) {
    neonBody(
      c,
      () => {
        c.beginPath();
        c.roundRect(-r, -r, r * 2, r * 2, r * 0.3);
      },
      color,
      2,
      14,
    );
    c.strokeStyle = color;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-r, -r * 0.2);
    c.lineTo(r, -r * 0.2);
    c.moveTo(0, -r);
    c.lineTo(0, r);
    c.stroke();
  },
};
