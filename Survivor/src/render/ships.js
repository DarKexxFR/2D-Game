// Vaisseaux des héros : chaque coque est composée de plusieurs couches (fuselage, ailes, plaques,
// canons, cockpit) dessinées une seule fois dans un canvas hors écran, plus quelques pièces animées
// tracées à chaque image sans ombre floue (anneaux qui tournent, feux qui clignotent, auréole...).
// Orientation : nez vers la droite (angle 0), unités en rayons du vaisseau.
// Module sans dépendance au canvas du jeu : menus, carte de score et aperçus s'en servent aussi.

import { gfx } from "../core/gfx.js";
import { glow, neonBody, noGlow, polygon, shade } from "./neon.js";

const TAU = Math.PI * 2;
const RES = 2; // résolution du cache (net sur écrans haute densité)
const CACHE_MAX = 96; // coques en cache au plus (couleur arc-en-ciel = une couleur par image)
const PINK = "#ff2a6d";
const VIOLET = "#aa66ff";
const CYAN = "#00ffff";
const GOLD = "#ffd700";

/** @typedef {{ canvas: HTMLCanvasElement, half: number }} ShipSprite */
/** @type {Map<string, ShipSprite>} */
const cache = new Map();

/** Couleur sûre pour `shade` (qui attend #rrggbb). */
const hex = (color) => (/^#[0-9a-f]{6}$/i.test(color) ? color : "#00ccff");

/** Coque au fond sombre teinté et au contour lumineux. */
function plate(c, points, color, line = 2, blur = 10) {
  neonBody(c, () => polygon(c, points), color, line, blur);
}

/** Même forme des deux côtés de l'axe (y → -y). */
function mirror(points) {
  return points.map(([x, y]) => [x, -y]);
}

function line(c, color, width, ...pts) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
}

function cockpit(c, x, y, rx, ry, color) {
  glow(c, color, 8);
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  c.fill();
  noGlow(c);
  c.fillStyle = color;
  c.globalAlpha = 0.45;
  c.beginPath();
  c.ellipse(x - rx * 0.25, y, rx * 0.6, ry * 0.6, 0, 0, TAU);
  c.fill();
  c.globalAlpha = 1;
}

/** Petit feu de position (fixe, dans le cache). */
function light(c, x, y, s, color) {
  glow(c, color, 6);
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, s, 0, TAU);
  c.fill();
  noGlow(c);
}

/**
 * Plans des coques. `body(c, r, color)` : couches fixes (mises en cache) ; `engines` : réacteurs
 * [x, y, largeur] en rayons ; `live(c, r, color, now)` : pièces animées (sans shadowBlur).
 * @type {Record<string, { body: Function, engines: number[][], live?: Function }>}
 */
const DESIGNS = {
  /** Pilote : chasseur en delta, ailes en flèche filetées de rose, canons au bout des ailes. */
  arrow: {
    engines: [
      [-0.78, -0.2, 0.13],
      [-0.78, 0.2, 0.13],
    ],
    body(c, r, color) {
      for (const s of [-1, 1]) {
        const wing = [
          [0.4, 0.22 * s],
          [-0.3, 1.12 * s],
          [-0.62, 1.12 * s],
          [-0.5, 0.3 * s],
        ].map(([x, y]) => [x * r, y * r]);
        plate(c, wing, color, 2, 8);
        line(c, PINK, 1.4, [0.15 * r, 0.38 * s * r], [-0.42 * r, 0.98 * s * r]);
        // Canon au bout de l'aile
        line(c, color, 1.6, [-0.52 * r, 1.12 * s * r], [0.2 * r, 1.12 * s * r]);
        light(c, 0.22 * r, 1.12 * s * r, r * 0.07, PINK);
        // Dérive
        plate(
          c,
          [
            [-0.45 * r, 0.12 * s * r],
            [-0.85 * r, 0.42 * s * r],
            [-0.8 * r, 0.14 * s * r],
          ],
          color,
          1.5,
          6,
        );
      }
      const fuselage = [
        [1.38, 0],
        [0.75, -0.2],
        [-0.55, -0.26],
        [-0.82, -0.14],
        [-0.82, 0.14],
        [-0.55, 0.26],
        [0.75, 0.2],
      ].map(([x, y]) => [x * r, y * r]);
      plate(c, fuselage, color, 2.4, 12);
      line(c, PINK, 1.2, [-0.5 * r, 0], [0.15 * r, 0]);
      cockpit(c, 0.55 * r, 0, r * 0.3, r * 0.12, color);
    },
    live(c, r, color, now) {
      // Feux des canons qui clignotent
      c.globalAlpha *= 0.5 + 0.5 * Math.sin(now / 160);
      c.fillStyle = "#ffffff";
      for (const s of [-1, 1]) c.fillRect(0.2 * r - 1.5, 1.12 * s * r - 1.5, 3, 3);
    },
  },

  /** Ninja : pointe de flèche en lames superposées, chevrons violets. */
  dart: {
    engines: [
      [-0.45, 0, 0.12],
      [-0.72, -0.5, 0.08],
      [-0.72, 0.5, 0.08],
    ],
    body(c, r, color) {
      for (const s of [-1, 1]) {
        plate(
          c,
          [
            [0.15 * r, 0.42 * s * r],
            [-0.35 * r, 1.25 * s * r],
            [-0.15 * r, 0.62 * s * r],
          ],
          VIOLET,
          1.5,
          6,
        );
      }
      const outer = [
        [1.45, 0],
        [-0.9, -0.95],
        [-0.42, 0],
        [-0.9, 0.95],
      ].map(([x, y]) => [x * r, y * r]);
      plate(c, outer, color, 2.4, 14);
      c.strokeStyle = VIOLET;
      c.lineWidth = 1.6;
      for (const k of [1, 0.62]) {
        polygon(c, [
          [1.0 * k * r, 0],
          [-0.42 * k * r, -0.52 * k * r],
          [-0.12 * k * r, 0],
          [-0.42 * k * r, 0.52 * k * r],
        ]);
        c.stroke();
      }
      cockpit(c, 0.45 * r, 0, r * 0.24, r * 0.08, color);
    },
    live(c, r, color, now) {
      // Reflet qui court le long des lames
      c.strokeStyle = "#ffffff";
      c.globalAlpha *= 0.55;
      c.lineWidth = 1.2;
      c.setLineDash([r * 0.5, r * 2.2]);
      c.lineDashOffset = -now / 25;
      polygon(c, [
        [1.45 * r, 0],
        [-0.9 * r, -0.95 * r],
        [-0.42 * r, 0],
        [-0.9 * r, 0.95 * r],
      ]);
      c.stroke();
      c.setLineDash([]);
    },
  },

  /** Titan : forteresse en plaques blindées, panneaux violets, deux canons doubles. */
  heavy: {
    engines: [
      [-0.95, -0.62, 0.2],
      [-0.95, 0.62, 0.2],
    ],
    body(c, r, color) {
      for (const s of [-1, 1]) {
        // Canons doubles sur les flancs
        for (const off of [0.98, 1.16])
          line(c, color, 2.2, [-0.25 * r, off * s * r], [0.72 * r, off * s * r]);
        // Nacelles des réacteurs
        plate(
          c,
          [
            [0.45 * r, 0.42 * s * r],
            [0.3 * r, 0.95 * s * r],
            [-0.8 * r, 0.95 * s * r],
            [-0.95 * r, 0.8 * s * r],
            [-0.95 * r, 0.42 * s * r],
          ],
          color,
          2,
          8,
        );
        plate(
          c,
          [
            [0.15 * r, 0.55 * s * r],
            [-0.6 * r, 0.55 * s * r],
            [-0.6 * r, 0.82 * s * r],
            [0.05 * r, 0.82 * s * r],
          ],
          VIOLET,
          1.2,
          0,
        );
      }
      const core = [
        [0.95, -0.25],
        [0.95, 0.25],
        [0.7, 0.48],
        [-0.85, 0.48],
        [-1.0, 0.3],
        [-1.0, -0.3],
        [-0.85, -0.48],
        [0.7, -0.48],
      ].map(([x, y]) => [x * r, y * r]);
      plate(c, core, color, 2.6, 12);
      // Plaques de blindage
      c.strokeStyle = color;
      c.lineWidth = 1.2;
      c.globalAlpha = 0.7;
      for (const x of [-0.55, -0.15]) {
        c.beginPath();
        c.moveTo(x * r, -0.48 * r);
        c.lineTo(x * r, 0.48 * r);
        c.stroke();
      }
      c.globalAlpha = 1;
      cockpit(c, 0.5 * r, 0, r * 0.22, r * 0.2, color);
    },
    live(c, r, color, now) {
      // Évents qui rougeoient
      c.fillStyle = PINK;
      c.globalAlpha *= 0.45 + 0.4 * Math.sin(now / 220);
      for (const y of [-0.3, -0.1, 0.1, 0.3]) c.fillRect(-0.8 * r, y * r - 1, r * 0.18, 2);
    },
  },

  /** Mage : orbe runique, anneau de glyphes qui tourne et trois gemmes en orbite. */
  orb: {
    engines: [[-0.62, 0, 0.18]],
    body(c, r, color) {
      for (const s of [-1, 1]) {
        plate(
          c,
          [
            [0.1 * r, 0.5 * s * r],
            [-0.55 * r, 0.95 * s * r],
            [-0.5 * r, 0.42 * s * r],
          ],
          color,
          1.5,
          6,
        );
      }
      neonBody(
        c,
        () => {
          c.beginPath();
          c.arc(0, 0, r * 0.62, 0, TAU);
        },
        color,
        2.4,
        14,
      );
      // Hexagramme
      c.strokeStyle = VIOLET;
      c.lineWidth = 1.2;
      for (const rot of [0, Math.PI / 3]) {
        c.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = rot + (i * TAU) / 3;
          const x = Math.cos(a) * r * 0.45;
          const y = Math.sin(a) * r * 0.45;
          if (i) c.lineTo(x, y);
          else c.moveTo(x, y);
        }
        c.closePath();
        c.stroke();
      }
      light(c, 0, 0, r * 0.16, "#ffffff");
    },
    live(c, r, color, now) {
      c.strokeStyle = color;
      c.lineWidth = 1.5;
      c.globalAlpha *= 0.8;
      c.setLineDash([r * 0.18, r * 0.14]);
      c.lineDashOffset = now / 40;
      c.beginPath();
      c.arc(0, 0, r * 0.88, 0, TAU);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = CYAN;
      for (let i = 0; i < 3; i++) {
        const a = now / 600 + (i * TAU) / 3;
        const x = Math.cos(a) * r * 1.12;
        const y = Math.sin(a) * r * 1.12;
        c.beginPath();
        c.moveTo(x + r * 0.12, y);
        c.lineTo(x, y + r * 0.08);
        c.lineTo(x - r * 0.12, y);
        c.lineTo(x, y - r * 0.08);
        c.closePath();
        c.fill();
      }
    },
  },

  /** Pirate : galion de l'espace, pont en planches, trois canons par flanc, pavillon qui flotte. */
  corsair: {
    engines: [[-0.95, 0, 0.2]],
    body(c, r, color) {
      for (const s of [-1, 1]) {
        for (const x of [-0.45, -0.05, 0.35]) {
          plate(
            c,
            [
              [x * r, 0.52 * s * r],
              [(x + 0.18) * r, 0.52 * s * r],
              [(x + 0.16) * r, 0.75 * s * r],
              [(x + 0.02) * r, 0.75 * s * r],
            ],
            PINK,
            1.2,
            4,
          );
        }
      }
      const hull = [
        [1.35, 0],
        [0.9, -0.42],
        [-0.65, -0.58],
        [-0.95, -0.32],
        [-0.95, 0.32],
        [-0.65, 0.58],
        [0.9, 0.42],
      ].map(([x, y]) => [x * r, y * r]);
      plate(c, hull, color, 2.4, 12);
      c.strokeStyle = color;
      c.lineWidth = 1;
      c.globalAlpha = 0.45;
      for (const y of [-0.25, 0, 0.25]) {
        c.beginPath();
        c.moveTo(-0.8 * r, y * r);
        c.lineTo(0.85 * r, y * r);
        c.stroke();
      }
      c.globalAlpha = 1;
      // Mâts et voiles
      c.strokeStyle = CYAN;
      c.lineWidth = 1.6;
      for (const x of [0.45, -0.2]) {
        c.beginPath();
        c.moveTo(x * r, -0.62 * r);
        c.quadraticCurveTo((x + 0.22) * r, 0, x * r, 0.62 * r);
        c.stroke();
      }
      light(c, 0.95 * r, 0, r * 0.1, "#ffffff");
    },
    live(c, r, color, now) {
      // Pavillon à l'arrière
      c.strokeStyle = PINK;
      c.lineWidth = 2;
      c.beginPath();
      for (let k = 0; k <= 4; k++) {
        const x = (-0.95 - k * 0.12) * r;
        const y = Math.sin(now / 120 + k) * r * 0.08 * (k / 4);
        if (k) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.stroke();
    },
  },

  /** Ingénieur : coque hexagonale à bras-outils, engrenage qui tourne à l'arrière, antenne. */
  engineer: {
    engines: [
      [-0.78, -0.32, 0.12],
      [-0.78, 0.32, 0.12],
    ],
    body(c, r, color) {
      for (const s of [-1, 1]) {
        line(c, color, 2, [0.1 * r, 0.55 * s * r], [0.55 * r, 1.0 * s * r], [0.95 * r, 0.95 * s * r]);
        light(c, 0.98 * r, 0.95 * s * r, r * 0.09, GOLD);
      }
      const hull = [
        [1.1, 0],
        [0.6, -0.62],
        [-0.55, -0.62],
        [-0.8, 0],
        [-0.55, 0.62],
        [0.6, 0.62],
      ].map(([x, y]) => [x * r, y * r]);
      plate(c, hull, color, 2.4, 12);
      plate(
        c,
        [
          [0.55, -0.3],
          [-0.3, -0.3],
          [-0.3, 0.3],
          [0.55, 0.3],
        ].map(([x, y]) => [x * r, y * r]),
        CYAN,
        1.2,
        0,
      );
      cockpit(c, 0.62 * r, 0, r * 0.22, r * 0.14, color);
    },
    live(c, r, color, now) {
      // Engrenage
      c.save();
      c.translate(-0.15 * r, 0);
      c.rotate(now / 500);
      c.strokeStyle = GOLD;
      c.lineWidth = 1.4;
      c.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i * TAU) / 16;
        const rr = (i % 2 ? 0.2 : 0.27) * r;
        if (i) c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.closePath();
      c.stroke();
      c.restore();
    },
  },

  /** Spectre : dague effilée, cape translucide qui ondule derrière. */
  spectre: {
    engines: [[-0.55, 0, 0.1]],
    body(c, r, color) {
      for (const s of [-1, 1]) {
        plate(
          c,
          [
            [0.25 * r, 0.22 * s * r],
            [-0.55 * r, 0.95 * s * r],
            [-0.35 * r, 0.3 * s * r],
          ],
          VIOLET,
          1.4,
          8,
        );
      }
      const blade = [
        [1.45, 0],
        [0.25, -0.3],
        [-0.65, -0.18],
        [-0.45, 0],
        [-0.65, 0.18],
        [0.25, 0.3],
      ].map(([x, y]) => [x * r, y * r]);
      plate(c, blade, color, 2.2, 14);
      line(c, "#ffffff", 1, [1.2 * r, 0], [-0.3 * r, 0]);
      cockpit(c, 0.35 * r, 0, r * 0.2, r * 0.09, color);
    },
    live(c, r, color, now) {
      c.strokeStyle = color;
      c.lineWidth = 1.5;
      const alpha = c.globalAlpha;
      for (let i = -1; i <= 1; i++) {
        c.globalAlpha = alpha * 0.3;
        c.beginPath();
        for (let k = 0; k <= 6; k++) {
          const x = (-0.5 - k * 0.16) * r;
          const y = (i * 0.4 + Math.sin(now / 140 + k * 0.8 + i) * 0.12 * (k / 6)) * r;
          if (k) c.lineTo(x, y);
          else c.moveTo(x, y);
        }
        c.stroke();
      }
    },
  },

  /** Archange : ailes de plumes cyan et roses filetées d'or, auréole qui tourne. */
  seraph: {
    engines: [
      [-0.72, -0.18, 0.11],
      [-0.72, 0.18, 0.11],
    ],
    body(c, r, color) {
      for (const s of [-1, 1]) {
        // Trois rangs de plumes, du plus long au plus court
        const feathers = [
          { col: CYAN, span: 1.35, back: 0.15 },
          { col: PINK, span: 1.05, back: -0.05 },
          { col: GOLD, span: 0.75, back: -0.2 },
        ];
        for (const { col, span, back } of feathers) {
          plate(
            c,
            [
              [0.2 * r, 0.2 * s * r],
              [(0.05 + back) * r, span * s * r],
              [(-0.35 + back) * r, span * 0.92 * s * r],
              [-0.35 * r, 0.28 * s * r],
            ],
            col,
            1.4,
            8,
          );
        }
      }
      const body = [
        [1.3, 0],
        [0.55, -0.24],
        [-0.7, -0.2],
        [-0.85, 0],
        [-0.7, 0.2],
        [0.55, 0.24],
      ].map(([x, y]) => [x * r, y * r]);
      plate(c, body, color, 2.4, 14);
      c.fillStyle = PINK;
      polygon(c, [
        [0.3 * r, 0],
        [0.05 * r, -0.1 * r],
        [-0.2 * r, 0],
        [0.05 * r, 0.1 * r],
      ]);
      c.fill();
      cockpit(c, 0.7 * r, 0, r * 0.22, r * 0.1, color);
    },
    live(c, r, color, now) {
      c.strokeStyle = GOLD;
      c.lineWidth = 1.4;
      c.globalAlpha *= 0.85;
      c.setLineDash([r * 0.12, r * 0.1]);
      c.lineDashOffset = -now / 50;
      c.beginPath();
      c.ellipse(0.15 * r, 0, r * 0.42, r * 0.42, 0, 0, TAU);
      c.stroke();
      c.setLineDash([]);
    },
  },
};

/** La coque a-t-elle un plan détaillé ? (sinon : silhouette simple de render/entities.js) */
export function hasShipDesign(shape) {
  return shape in DESIGNS;
}

/** Couches fixes de la coque, dessinées une fois par (forme, taille, couleur). */
function bodySprite(shape, r, color) {
  const key = `${shape}|${r}|${color}|${gfx.shadows}`;
  let s = cache.get(key);
  if (s) return s;
  const half = Math.ceil(r * 1.6 + 14);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.ceil(half * 2 * RES);
  const c = canvas.getContext("2d");
  c.scale(RES, RES);
  c.translate(half, half);
  c.lineJoin = "round";
  c.lineCap = "round";
  DESIGNS[shape].body(c, r, color);
  s = { canvas, half };
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, s);
  return s;
}

/** Flammes des réacteurs (dégradé blanc → couleur → transparent). */
function drawEngines(c, engines, r, color, now) {
  for (const [ex, ey, w] of engines) {
    const len = r * (0.75 + Math.sin(now / 30 + ey * 7) * 0.2) * (w / 0.15);
    const x = ex * r;
    const y = ey * r;
    const flame = c.createLinearGradient(x, 0, x - len, 0);
    flame.addColorStop(0, "#ffffff");
    flame.addColorStop(0.3, color);
    flame.addColorStop(1, "rgba(0, 0, 0, 0)");
    c.fillStyle = flame;
    c.beginPath();
    c.moveTo(x, y - w * r);
    c.lineTo(x - len, y);
    c.lineTo(x, y + w * r);
    c.closePath();
    c.fill();
  }
}

/**
 * Dessine un vaisseau de héros détaillé centré en (x, y), tourné de `angle`.
 * @param {CanvasRenderingContext2D} c
 */
export function drawDesignedShip(c, x, y, r, angle, color, thrust, now, shape) {
  const design = DESIGNS[shape];
  const tint = hex(color);
  const radius = Math.max(4, Math.round(r));
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  if (r !== radius) c.scale(r / radius, r / radius);
  if (thrust) drawEngines(c, design.engines, radius, tint, now);
  const sprite = bodySprite(shape, radius, tint);
  c.drawImage(sprite.canvas, -sprite.half, -sprite.half, sprite.half * 2, sprite.half * 2);
  if (design.live) {
    c.lineCap = "round";
    design.live(c, radius, tint, now);
  }
  c.restore();
}

/** Nombre de coques en cache (tests : le cache reste borné, même en arc-en-ciel). */
export function shipCacheSize() {
  return cache.size;
}
