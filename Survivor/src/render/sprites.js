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
