// Coques détaillées des skins (formes de data/skins.js) : même principe que les héros de render/ships.js
// (`body` en cache, `engines`, `live` animé sans shadowBlur). La silhouette suit celle de `HULLS` dans
// render/entities.js pour que l'aperçu de la boutique reste fidèle.

import { polygon } from "./neon.js";
import { CYAN, GOLD, ORANGE, PINK, TAU, VIOLET, cockpit, light, line, plate, scaled } from "./shipKit.js";

/** Pointes d'une étoile : `n` branches, rayons extérieur / intérieur. */
function starPoints(n, outer, inner, rot = 0) {
  return Array.from({ length: n * 2 }, (_, i) => {
    const a = rot + (i * Math.PI) / n;
    const k = i % 2 ? inner : outer;
    return [Math.cos(a) * k, Math.sin(a) * k];
  });
}

/** Trait en dents de scie (éclair) de (x0, y0) à (x1, y1), `n` zigzags d'amplitude `amp`. */
function zigzag(c, x0, y0, x1, y1, n, amp, seed = 0) {
  c.beginPath();
  c.moveTo(x0, y0);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const k = (i % 2 ? 1 : -1) * amp * (0.6 + 0.4 * Math.sin(seed + i * 1.7));
    c.lineTo(x0 + dx * t + nx * k, y0 + dy * t + ny * k);
  }
  c.lineTo(x1, y1);
  c.stroke();
}

/** @type {Record<string, { body: Function, engines: number[][], live?: Function }>} */
export const SKIN_DESIGNS = {
  /** Manta : grande aile plate, nervures cyan, queue fouet qui ondule. */
  manta: {
    engines: [
      [-0.55, -0.22, 0.09],
      [-0.55, 0.22, 0.09],
    ],
    body(c, r, color) {
      for (const s of [-1, 1]) {
        plate(
          c,
          scaled(
            [
              [0.75, 0.12 * s],
              [0.1, 0.55 * s],
              [-0.4, 1.15 * s],
              [-0.85, 0.9 * s],
              [-0.55, 0.12 * s],
            ],
            r,
          ),
          color,
          2,
          8,
        );
        // Nervures de l'aile
        for (const k of [0.45, 0.7, 0.95])
          line(c, CYAN, 1, [0.2 * r, 0.3 * s * r], [(-0.1 - 0.35 * k) * r, (0.3 + k * 0.75) * s * r]);
      }
      plate(
        c,
        scaled(
          [
            [1.1, 0],
            [0.3, -0.36],
            [-0.55, -0.26],
            [-0.55, 0.26],
            [0.3, 0.36],
          ],
          r,
        ),
        color,
        2.4,
        12,
      );
      cockpit(c, 0.5 * r, 0, r * 0.26, r * 0.13, color);
      light(c, -0.4 * r, 1.15 * r, r * 0.06, CYAN);
      light(c, -0.4 * r, -1.15 * r, r * 0.06, CYAN);
    },
    live(c, r, color, now) {
      c.strokeStyle = color;
      c.lineWidth = 1.6;
      c.globalAlpha *= 0.8;
      c.beginPath();
      for (let k = 0; k <= 8; k++) {
        const x = (-0.55 - k * 0.12) * r;
        const y = Math.sin(now / 120 + k * 0.7) * 0.05 * k * r;
        if (k) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.stroke();
    },
  },

  /** Aiguille : flèche effilée en trois étages, rail central qui se charge. */
  needle: {
    engines: [[-0.65, 0, 0.1]],
    body(c, r, color) {
      for (const s of [-1, 1]) {
        plate(
          c,
          scaled(
            [
              [-0.1, 0.25 * s],
              [-0.9, 0.62 * s],
              [-0.62, 0.12 * s],
            ],
            r,
          ),
          VIOLET,
          1.4,
          6,
        );
      }
      plate(
        c,
        scaled(
          [
            [1.55, 0],
            [0.2, -0.28],
            [-0.68, -0.16],
            [-0.68, 0.16],
            [0.2, 0.28],
          ],
          r,
        ),
        color,
        2.2,
        12,
      );
      line(c, "#ffffff", 1, [1.35 * r, 0], [-0.4 * r, 0]);
      cockpit(c, 0.25 * r, 0, r * 0.2, r * 0.08, color);
    },
    live(c, r, color, now) {
      // Impulsion qui remonte le rail jusqu'à la pointe
      const t = (now / 600) % 1;
      const x = (-0.4 + t * 1.8) * r;
      c.fillStyle = "#ffffff";
      c.globalAlpha *= 1 - t * 0.6;
      c.beginPath();
      c.arc(x, 0, r * 0.07, 0, TAU);
      c.fill();
    },
  },

  /** Trident : trois pointes, la centrale en avant, les deux autres ourlées d'or. */
  trident: {
    engines: [
      [-0.7, -0.3, 0.1],
      [-0.7, 0.3, 0.1],
    ],
    body(c, r, color) {
      for (const s of [-1, 1]) {
        plate(
          c,
          scaled(
            [
              [0.4, 0.3 * s],
              [1.05, 0.8 * s],
              [-0.2, 0.95 * s],
              [-0.6, 0.5 * s],
            ],
            r,
          ),
          color,
          2,
          8,
        );
        line(c, GOLD, 1.3, [0.95 * r, 0.78 * s * r], [-0.1 * r, 0.88 * s * r]);
        light(c, 1.0 * r, 0.8 * s * r, r * 0.06, GOLD);
      }
      plate(
        c,
        scaled(
          [
            [1.3, -0.12],
            [1.3, 0.12],
            [0.2, 0.26],
            [-0.88, 0.36],
            [-0.6, 0],
            [-0.88, -0.36],
            [0.2, -0.26],
          ],
          r,
        ),
        color,
        2.4,
        12,
      );
      cockpit(c, 0.35 * r, 0, r * 0.24, r * 0.1, color);
    },
    live(c, r, color, now) {
      // Arc d'énergie entre les trois pointes
      c.strokeStyle = CYAN;
      c.lineWidth = 1.2;
      c.globalAlpha *= 0.4 + 0.4 * Math.abs(Math.sin(now / 180));
      zigzag(c, 1.0 * r, -0.8 * r, 1.3 * r, 0, 4, r * 0.06, now / 90);
      zigzag(c, 1.3 * r, 0, 1.0 * r, 0.8 * r, 4, r * 0.06, now / 70);
    },
  },

  /** Phénix : ailes de flammes en dégradé or → rose, plumes de queue qui dansent. */
  phoenix: {
    engines: [[-0.62, 0, 0.13]],
    body(c, r, color) {
      for (const s of [-1, 1]) {
        plate(
          c,
          scaled(
            [
              [0.5, 0.26 * s],
              [0.15, 1.2 * s],
              [-0.3, 0.5 * s],
            ],
            r,
          ),
          ORANGE,
          1.8,
          10,
        );
        plate(
          c,
          scaled(
            [
              [0.35, 0.3 * s],
              [0.12, 0.85 * s],
              [-0.15, 0.42 * s],
            ],
            r,
          ),
          GOLD,
          1.2,
          6,
        );
        plate(
          c,
          scaled(
            [
              [-0.3, 0.3 * s],
              [-1.05, 0.95 * s],
              [-0.65, 0.12 * s],
            ],
            r,
          ),
          PINK,
          1.6,
          8,
        );
      }
      plate(
        c,
        scaled(
          [
            [1.25, 0],
            [0.5, -0.26],
            [-0.6, -0.18],
            [-0.7, 0],
            [-0.6, 0.18],
            [0.5, 0.26],
          ],
          r,
        ),
        color,
        2.4,
        12,
      );
      cockpit(c, 0.6 * r, 0, r * 0.24, r * 0.1, GOLD);
    },
    live(c, r, color, now) {
      const alpha = c.globalAlpha;
      for (const k of [-1, 0, 1]) {
        c.strokeStyle = k ? ORANGE : GOLD;
        c.lineWidth = 1.4;
        c.globalAlpha = alpha * 0.7;
        c.beginPath();
        c.moveTo(-0.6 * r, k * 0.12 * r);
        c.quadraticCurveTo(
          -1.0 * r,
          (k * 0.3 + Math.sin(now / 90 + k) * 0.12) * r,
          -1.3 * r,
          (k * 0.45 + Math.sin(now / 70 + k * 2) * 0.1) * r,
        );
        c.stroke();
      }
      c.globalAlpha = alpha;
    },
  },

  /** Étoile : étoile à cinq branches, cœur qui tourne en sens inverse. */
  star: {
    engines: [],
    body(c, r, color) {
      plate(c, scaled(starPoints(5, 1.15, 0.5), r), color, 2.4, 14);
      plate(c, scaled(starPoints(5, 0.62, 0.3, Math.PI / 5), r), GOLD, 1.4, 8);
      for (let i = 0; i < 5; i++) {
        const a = (i * TAU) / 5;
        light(c, Math.cos(a) * 0.95 * r, Math.sin(a) * 0.95 * r, r * 0.05, "#ffffff");
      }
    },
    live(c, r, color, now) {
      c.save();
      c.rotate(-now / 400);
      c.strokeStyle = "#ffffff";
      c.lineWidth = 1.2;
      c.globalAlpha *= 0.8;
      polygon(c, scaled(starPoints(4, 0.32, 0.12), r));
      c.stroke();
      c.restore();
    },
  },

  /** Nova (saison) : éclat en étoile filante, quatre pointes, couronne de rayons qui pulse. */
  nova: {
    engines: [
      [-0.6, -0.15, 0.1],
      [-0.6, 0.15, 0.1],
    ],
    body(c, r, color) {
      for (const s of [-1, 1]) {
        plate(
          c,
          scaled(
            [
              [0.35, 0.28 * s],
              [0.2, 1.1 * s],
              [-0.2, 0.4 * s],
            ],
            r,
          ),
          GOLD,
          1.6,
          8,
        );
        plate(
          c,
          scaled(
            [
              [-0.2, 0.36 * s],
              [-1, 0.7 * s],
              [-0.55, 0.1 * s],
            ],
            r,
          ),
          color,
          1.6,
          8,
        );
      }
      plate(
        c,
        scaled(
          [
            [1.4, 0],
            [0.3, -0.28],
            [-0.6, -0.12],
            [-0.6, 0.12],
            [0.3, 0.28],
          ],
          r,
        ),
        color,
        2.4,
        14,
      );
      cockpit(c, 0.4 * r, 0, r * 0.22, r * 0.1, color);
    },
    live(c, r, color, now) {
      const k = 0.5 + 0.5 * Math.sin(now / 200);
      c.strokeStyle = GOLD;
      c.lineWidth = 1;
      c.globalAlpha *= 0.3 + 0.5 * k;
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8 + now / 1500;
        c.moveTo(0.4 * r + Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
        c.lineTo(0.4 * r + Math.cos(a) * r * (0.42 + 0.1 * k), Math.sin(a) * r * (0.42 + 0.1 * k));
      }
      c.stroke();
    },
  },

  /** Brasier (saison) : coque en langues de feu superposées, braises qui s'échappent. */
  blaze: {
    engines: [[-0.95, 0, 0.16]],
    body(c, r, color) {
      for (const s of [-1, 1]) {
        plate(
          c,
          scaled(
            [
              [0.5, 0.5 * s],
              [0.6, 1 * s],
              [-0.1, 0.7 * s],
              [-0.5, 1.1 * s],
              [-0.6, 0.4 * s],
            ],
            r,
          ),
          ORANGE,
          1.8,
          10,
        );
        plate(
          c,
          scaled(
            [
              [0.35, 0.45 * s],
              [0.38, 0.75 * s],
              [-0.08, 0.55 * s],
            ],
            r,
          ),
          GOLD,
          1.1,
          6,
        );
      }
      plate(
        c,
        scaled(
          [
            [1.3, 0],
            [0.5, -0.45],
            [-0.6, -0.36],
            [-1.05, 0],
            [-0.6, 0.36],
            [0.5, 0.45],
          ],
          r,
        ),
        color,
        2.4,
        14,
      );
      line(c, GOLD, 1.2, [0.9 * r, 0], [-0.7 * r, 0]);
      cockpit(c, 0.55 * r, 0, r * 0.25, r * 0.12, ORANGE);
    },
    live(c, r, color, now) {
      c.fillStyle = GOLD;
      const alpha = c.globalAlpha;
      for (let i = 0; i < 5; i++) {
        const t = (now / 700 + i / 5) % 1;
        c.globalAlpha = alpha * (1 - t);
        const x = (-0.6 - t * 0.9) * r;
        const y = Math.sin(i * 2.3 + now / 200) * (0.25 + t * 0.4) * r;
        c.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
      }
      c.globalAlpha = alpha;
    },
  },

  /** Faille (saison) : pinces ouvertes autour d'une déchirure violette qui tourbillonne. */
  rift: {
    engines: [
      [-0.75, -0.3, 0.09],
      [-0.75, 0.3, 0.09],
    ],
    body(c, r, color) {
      for (const s of [-1, 1]) {
        plate(
          c,
          scaled(
            [
              [1.2, 0.15 * s],
              [0.9, 0.9 * s],
              [0.2, 1.15 * s],
              [-0.1, 0.5 * s],
              [0.45, 0.3 * s],
            ],
            r,
          ),
          color,
          2,
          10,
        );
        plate(
          c,
          scaled(
            [
              [0.4, 0.42 * s],
              [-0.9, 0.6 * s],
              [-0.5, 0.1 * s],
            ],
            r,
          ),
          VIOLET,
          1.6,
          8,
        );
      }
      plate(
        c,
        scaled(
          [
            [0.6, 0],
            [0.35, -0.42],
            [-0.6, -0.32],
            [-0.75, 0],
            [-0.6, 0.32],
            [0.35, 0.42],
          ],
          r,
        ),
        color,
        2.2,
        10,
      );
      cockpit(c, 0.1 * r, 0, r * 0.18, r * 0.1, VIOLET);
    },
    live(c, r, color, now) {
      // Déchirure entre les pinces
      c.save();
      c.translate(0.85 * r, 0);
      c.rotate(now / 260);
      c.strokeStyle = VIOLET;
      c.lineWidth = 1.5;
      c.globalAlpha *= 0.85;
      c.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = (k * TAU) / 3;
        c.moveTo(0, 0);
        c.quadraticCurveTo(
          Math.cos(a) * r * 0.25,
          Math.sin(a) * r * 0.25,
          Math.cos(a + 1) * r * 0.3,
          Math.sin(a + 1) * r * 0.3,
        );
      }
      c.stroke();
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(0, 0, r * 0.06, 0, TAU);
      c.fill();
      c.restore();
    },
  },

  /** Foudre (saison) : ailes en éclairs brisés, arcs électriques qui crépitent entre elles. */
  thunder: {
    engines: [
      [-0.72, -0.12, 0.1],
      [-0.72, 0.12, 0.1],
    ],
    body(c, r, color) {
      for (const s of [-1, 1]) {
        plate(
          c,
          scaled(
            [
              [0.4, 0.35 * s],
              [0.55, 0.95 * s],
              [-0.3, 0.5 * s],
              [-0.15, 1.05 * s],
              [-1, 0.3 * s],
              [-0.55, 0.15 * s],
            ],
            r,
          ),
          color,
          2,
          10,
        );
        line(c, GOLD, 1.2, [0.42 * r, 0.8 * s * r], [-0.2 * r, 0.52 * s * r], [-0.1 * r, 0.9 * s * r]);
      }
      plate(
        c,
        scaled(
          [
            [1.4, 0],
            [0.4, -0.3],
            [-0.7, -0.14],
            [-0.7, 0.14],
            [0.4, 0.3],
          ],
          r,
        ),
        color,
        2.4,
        14,
      );
      cockpit(c, 0.45 * r, 0, r * 0.22, r * 0.1, GOLD);
    },
    live(c, r, color, now) {
      // Arc qui saute entre les bouts d'ailes, de temps en temps
      const beat = Math.floor(now / 90);
      if (beat % 4 === 0) return;
      c.strokeStyle = "#ffffff";
      c.lineWidth = 1.1;
      c.globalAlpha *= 0.75;
      zigzag(c, -0.15 * r, -1.05 * r, -0.15 * r, 1.05 * r, 7, r * 0.12, beat);
    },
  },
};
