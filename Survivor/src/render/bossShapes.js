// Sprites des boss rangés dans systems/bosses/ (fusionnés dans les formes de render/sprites.js).
// Orientés vers la droite : angle 0 = vers la cible ; `r` = rayon de l'entité.

import { dot, eye, glow, neonBody, noGlow, polygon, regular, shade } from "./neon.js";

const TAU = Math.PI * 2;

export const BOSS_SHAPES = {
  /** Ver des sables : tête annelée, gueule ronde garnie de crocs, petits yeux sur le dessus. */
  sandworm(c, r, color) {
    neonBody(c, () => regular(c, 10, r, TAU / 20), color, 3.5, 20);
    c.strokeStyle = shade(color, 0.7);
    c.lineWidth = 2;
    regular(c, 10, r * 0.7, TAU / 20);
    c.stroke();
    // Gueule ouverte vers l'avant
    dot(c, r * 0.35, 0, r * 0.42, "#1a0800", 0);
    c.fillStyle = "#fff1d0";
    glow(c, color, 8);
    for (let i = 0; i < 9; i++) {
      const a = (TAU * i) / 9;
      const bx = r * 0.35 + Math.cos(a) * r * 0.42;
      const by = Math.sin(a) * r * 0.42;
      polygon(c, [
        [bx + Math.cos(a + 1.2) * r * 0.08, by + Math.sin(a + 1.2) * r * 0.08],
        [bx - Math.cos(a) * r * 0.2, by - Math.sin(a) * r * 0.2],
        [bx + Math.cos(a - 1.2) * r * 0.08, by + Math.sin(a - 1.2) * r * 0.08],
      ]);
      c.fill();
    }
    noGlow(c);
    eye(c, -r * 0.35, -r * 0.45, r * 0.09, "#ff3d3d");
    eye(c, -r * 0.35, r * 0.45, r * 0.09, "#ff3d3d");
  },

  /** Anneau du ver : plaque blindée octogonale avec une arête lumineuse. */
  sandwormSegment(c, r, color) {
    neonBody(c, () => regular(c, 8, r, TAU / 16), color, 3, 14);
    c.strokeStyle = shade(color, 0.6);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, -r * 0.85);
    c.lineTo(0, r * 0.85);
    c.stroke();
    for (const s of [-1, 1]) dot(c, s * r * 0.45, 0, r * 0.12, "#ffd9a0", 6);
  },

  /** Mère-Ruche : abdomen rayé, ailes translucides, thorax et couronne. */
  hiveQueen(c, r, color) {
    // Ailes
    c.save();
    c.globalAlpha = 0.45;
    for (const s of [-1, 1]) {
      neonBody(
        c,
        () => {
          c.beginPath();
          c.ellipse(-r * 0.1, s * r * 0.75, r * 0.7, r * 0.32, s * 0.5, 0, TAU);
        },
        "#fff6c0",
        1.5,
        10,
      );
    }
    c.restore();
    // Abdomen rayé (derrière)
    neonBody(
      c,
      () => {
        c.beginPath();
        c.ellipse(-r * 0.45, 0, r * 0.65, r * 0.5, 0, 0, TAU);
      },
      color,
      3,
      18,
    );
    c.strokeStyle = "#2a1a00";
    c.lineWidth = r * 0.1;
    for (const x of [-0.75, -0.5, -0.25]) {
      c.beginPath();
      c.moveTo(x * r, -r * 0.42);
      c.lineTo(x * r, r * 0.42);
      c.stroke();
    }
    // Thorax et tête
    neonBody(c, () => regular(c, 6, r * 0.42, 0), color, 2.5, 14);
    neonBody(c, () => regular(c, 6, r * 0.3, 0), "#9dff3d", 2, 12);
    eye(c, r * 0.48, -r * 0.14, r * 0.09, "#9dff3d");
    eye(c, r * 0.48, r * 0.14, r * 0.09, "#9dff3d");
    // Couronne
    c.fillStyle = "#ffd700";
    glow(c, "#ffd700", 8);
    polygon(c, [
      [r * 0.05, -r * 0.3],
      [r * 0.15, -r * 0.48],
      [r * 0.22, -r * 0.3],
      [r * 0.3, -r * 0.48],
      [r * 0.36, -r * 0.3],
    ]);
    c.fill();
    noGlow(c);
  },

  /** Fleur toxique : cinq pétales autour d'un cœur qui suinte. */
  hiveFlower(c, r, color) {
    for (let i = 0; i < 5; i++) {
      const a = (TAU * i) / 5;
      neonBody(
        c,
        () => {
          c.beginPath();
          c.ellipse(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.5, r * 0.26, a, 0, TAU);
        },
        color,
        2,
        10,
      );
    }
    dot(c, 0, 0, r * 0.35, "#e8ff5a", 14);
    dot(c, 0, 0, r * 0.16, "#2a3a00", 0);
  },

  /** Chronophage : cadran entouré d'un engrenage, douze graduations et deux aiguilles. */
  chronophage(c, r, color) {
    const teeth = [];
    for (let i = 0; i < 24; i++) {
      const a = (TAU * i) / 24;
      const rr = i % 2 ? r * 0.86 : r;
      teeth.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    neonBody(c, () => polygon(c, teeth), color, 3, 20);
    neonBody(
      c,
      () => {
        c.beginPath();
        c.arc(0, 0, r * 0.72, 0, TAU);
      },
      "#ffd27a",
      2.5,
      14,
    );
    c.strokeStyle = "#ffd27a";
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (TAU * i) / 12;
      const inner = i % 3 ? 0.58 : 0.5;
      c.moveTo(Math.cos(a) * r * inner, Math.sin(a) * r * inner);
      c.lineTo(Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66);
    }
    c.stroke();
    // Aiguilles (l'aiguille des minutes pointe vers la cible)
    glow(c, "#ffffff", 10);
    c.strokeStyle = "#ffffff";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(r * 0.6, 0);
    c.moveTo(0, 0);
    c.lineTo(-r * 0.15, -r * 0.38);
    c.stroke();
    noGlow(c);
    dot(c, 0, 0, r * 0.09, color, 8);
  },

  /** Hacker : capuche anguleuse, visage-écran avec deux yeux et lignes de code. */
  hacker(c, r, color) {
    neonBody(
      c,
      () =>
        polygon(c, [
          [r * 0.95, 0],
          [r * 0.35, -r * 0.9],
          [-r * 0.75, -r * 0.7],
          [-r * 0.95, 0],
          [-r * 0.75, r * 0.7],
          [r * 0.35, r * 0.9],
        ]),
      color,
      3,
      20,
    );
    // Visage-écran
    neonBody(
      c,
      () => {
        c.beginPath();
        c.roundRect(-r * 0.25, -r * 0.45, r * 0.85, r * 0.9, r * 0.15);
      },
      "#0dff6a",
      2,
      12,
    );
    c.fillStyle = shade(color, 0.6);
    for (const [y, w] of [
      [-0.3, 0.5],
      [-0.12, 0.3],
      [0.24, 0.45],
    ]) {
      c.fillRect(-r * 0.15, y * r, w * r, r * 0.06);
    }
    eye(c, r * 0.38, -r * 0.18, r * 0.09, "#ff2a6d");
    eye(c, r * 0.38, r * 0.06, r * 0.09, "#ff2a6d");
  },

  /** Cœur du Pulse : cœur néon parcouru de veines, noyau blanc. */
  pulseCore(c, r, color) {
    const heart = () => {
      c.beginPath();
      c.moveTo(r * 0.95, 0);
      c.bezierCurveTo(r * 0.4, -r * 0.35, r * 0.15, -r * 1.05, -r * 0.4, -r * 0.75);
      c.bezierCurveTo(-r * 0.9, -r * 0.5, -r * 0.85, 0, -r * 0.55, 0);
      c.bezierCurveTo(-r * 0.85, 0, -r * 0.9, r * 0.5, -r * 0.4, r * 0.75);
      c.bezierCurveTo(r * 0.15, r * 1.05, r * 0.4, r * 0.35, r * 0.95, 0);
      c.closePath();
    };
    neonBody(c, heart, color, 4, 24);
    c.strokeStyle = shade(color, 0.75);
    c.lineWidth = 2;
    c.beginPath();
    for (const [x1, y1, x2, y2] of [
      [-0.1, 0, -0.45, -0.45],
      [-0.1, 0, -0.45, 0.45],
      [-0.1, 0, 0.55, 0],
      [-0.3, -0.2, -0.1, -0.6],
      [-0.3, 0.2, -0.1, 0.6],
    ]) {
      c.moveTo(x1 * r, y1 * r);
      c.lineTo(x2 * r, y2 * r);
    }
    c.stroke();
    dot(c, -r * 0.1, 0, r * 0.22, "#ff9ab8", 18);
    dot(c, -r * 0.1, 0, r * 0.1, "#ffffff", 0);
  },

  /** Paquet de données (tir du Hacker) : carré lumineux. */
  bit(c, r, color) {
    neonBody(
      c,
      () => {
        c.beginPath();
        c.rect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
      },
      color,
      2,
      10,
    );
    c.fillStyle = "#eafff2";
    c.fillRect(-r * 0.25, -r * 0.25, r * 0.5, r * 0.5);
  },
};
