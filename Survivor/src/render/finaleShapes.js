// Sprites de la fin de l'aventure (vagues 31 à 40) : ennemis de la Faille quantique et du Noyau stellaire,
// boss (Forgeronne, Reflet, Tisseuse, Architecte) et leurs parties. Fusionnés dans les formes de
// render/sprites.js. Orientés vers la droite (angle 0 = vers la cible) ; `r` = rayon de l'entité.
// Sans dépendance au canvas du jeu (le bestiaire s'en sert aussi).

import { dot, eye, glow, neonBody, noGlow, polygon, regular, shade } from "./neon.js";

const TAU = Math.PI * 2;

const circle = (c, r) => () => {
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
};

export const FINALE_SHAPES = {
  /** Déphaseur : losange dédoublé (deux silhouettes décalées), œil unique. */
  phaser(c, r, color) {
    const diamond = (dx) =>
      polygon(c, [
        [r * 1.1 + dx, 0],
        [dx, -r * 0.8],
        [-r * 0.9 + dx, 0],
        [dx, r * 0.8],
      ]);
    c.save();
    c.globalAlpha = 0.45;
    neonBody(c, () => diamond(-r * 0.35), "#00ffe0", 1.5, 8);
    c.restore();
    neonBody(c, () => diamond(0), color, 2.5, 14);
    eye(c, r * 0.2, 0, r * 0.22, "#ffffff");
  },

  /** Réplicateur : cellule ronde avec un noyau qui se dédouble. */
  replicator(c, r, color) {
    neonBody(c, circle(c, r), color, 2.5, 14);
    c.strokeStyle = shade(color, 0.6);
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, -r * 0.85);
    c.lineTo(0, r * 0.85);
    c.stroke();
    dot(c, -r * 0.35, 0, r * 0.25, "#ffffff", 8);
    dot(c, r * 0.35, 0, r * 0.25, "#ffffff", 8);
  },

  /** Fusionneur : hexagone de métal fondu, deux pinces de soudure à l'avant. */
  fuser(c, r, color) {
    for (const s of [-1, 1]) {
      neonBody(
        c,
        () =>
          polygon(c, [
            [r * 0.5, s * r * 0.35],
            [r * 1.25, s * r * 0.55],
            [r * 1.1, s * r * 0.15],
          ]),
        "#ffd27a",
        1.5,
        8,
      );
    }
    neonBody(c, () => regular(c, 6, r * 0.9, 0), color, 2.5, 14);
    c.strokeStyle = shade(color, 0.6);
    c.lineWidth = 1.5;
    regular(c, 6, r * 0.55, 0);
    c.stroke();
    dot(c, 0, 0, r * 0.22, "#fff1d0", 10);
  },

  /** Nova : petite étoile instable à pointes. */
  nova(c, r, color) {
    const star = () => {
      const pts = [];
      for (let i = 0; i < 16; i++) {
        const rr = i % 2 ? r * 0.5 : r * 1.05;
        const a = (TAU * i) / 16;
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      polygon(c, pts);
    };
    neonBody(c, star, color, 2, 14);
    dot(c, 0, 0, r * 0.35, "#ffe14d", 12);
    dot(c, 0, 0, r * 0.15, "#ffffff", 0);
  },

  /** Forgeronne stellaire : enclume massive, foyer incandescent, deux bras-marteaux. */
  forge(c, r, color) {
    for (const s of [-1, 1]) {
      const rect = (x, y, w, h) => () => {
        c.beginPath();
        c.rect(x, y, w, h);
      };
      neonBody(c, rect(-r * 0.2, s * r * 0.75 - r * 0.12, r * 1.1, r * 0.24), "#d9661a", 2.5, 12);
      neonBody(c, rect(r * 0.8, s * r * 0.75 - r * 0.25, r * 0.35, r * 0.5), "#ffd27a", 2.5, 14);
    }
    neonBody(
      c,
      () =>
        polygon(c, [
          [r * 0.85, -r * 0.45],
          [r * 0.85, r * 0.45],
          [-r * 0.3, r * 0.6],
          [-r * 0.95, r * 0.35],
          [-r * 0.95, -r * 0.35],
          [-r * 0.3, -r * 0.6],
        ]),
      color,
      3.5,
      22,
    );
    dot(c, 0, 0, r * 0.32, "#ff3b1a", 18);
    dot(c, 0, 0, r * 0.16, "#fff1d0", 0);
    eye(c, r * 0.5, -r * 0.18, r * 0.08, "#ffffff");
    eye(c, r * 0.5, r * 0.18, r * 0.08, "#ffffff");
  },

  /** Drone de forge : petit triangle rivé. */
  forgeDrone(c, r, color) {
    neonBody(
      c,
      () =>
        polygon(c, [
          [r * 1.1, 0],
          [-r * 0.8, -r * 0.8],
          [-r * 0.8, r * 0.8],
        ]),
      color,
      2,
      10,
    );
    dot(c, 0, 0, r * 0.25, "#fff1d0", 6);
  },

  /** Colosse forgé : bloc carré soudé, plaques et cœur rouge. */
  forgeGolem(c, r, color) {
    neonBody(c, () => regular(c, 4, r, TAU / 8), color, 3, 16);
    c.strokeStyle = shade(color, 0.6);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-r * 0.7, 0);
    c.lineTo(r * 0.7, 0);
    c.moveTo(0, -r * 0.7);
    c.lineTo(0, r * 0.7);
    c.stroke();
    dot(c, 0, 0, r * 0.25, "#ff3b1a", 14);
    eye(c, r * 0.45, 0, r * 0.12, "#ffffff");
  },

  /** Le Reflet : un vaisseau de verre, comme celui du joueur, entouré d'un cadre de miroir. */
  mirror(c, r, color) {
    c.save();
    c.globalAlpha = 0.35;
    neonBody(c, () => regular(c, 6, r * 1.2, 0), "#ffffff", 1.5, 8);
    c.restore();
    neonBody(
      c,
      () =>
        polygon(c, [
          [r * 1.1, 0],
          [-r * 0.7, -r * 0.75],
          [-r * 0.35, 0],
          [-r * 0.7, r * 0.75],
        ]),
      color,
      3,
      20,
    );
    c.strokeStyle = "#ffffff";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(-r * 0.5, -r * 0.5);
    c.lineTo(r * 0.5, r * 0.2);
    c.stroke();
    eye(c, r * 0.3, 0, r * 0.14, "#8fb8ff");
  },

  /** Tisseuse du vide : araignée à huit pattes, abdomen marqué d'une étoile. */
  weaver(c, r, color) {
    c.strokeStyle = shade(color, 0.8);
    c.lineWidth = 3;
    glow(c, color, 10);
    c.beginPath();
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const a = s * (0.5 + i * 0.55);
        const kx = Math.cos(a) * r * 0.9;
        const ky = Math.sin(a) * r * 0.9;
        c.moveTo(0, 0);
        c.lineTo(kx, ky);
        c.lineTo(Math.cos(a + s * 0.3) * r * 1.35, Math.sin(a + s * 0.3) * r * 1.35);
      }
    }
    c.stroke();
    noGlow(c);
    neonBody(
      c,
      () => {
        c.beginPath();
        c.ellipse(-r * 0.3, 0, r * 0.6, r * 0.5, 0, 0, TAU);
      },
      color,
      3,
      18,
    );
    neonBody(c, circle(c, r * 0.32), "#e6c2ff", 2.5, 12);
    dot(c, -r * 0.3, 0, r * 0.14, "#ffffff", 10);
    for (const [x, y] of [
      [0.12, -0.1],
      [0.12, 0.1],
      [0.22, -0.05],
      [0.22, 0.05],
    ])
      eye(c, x * r, y * r, r * 0.05, "#ff5cf4");
  },

  /** Ancre de toile : cristal planté, d'où partent les fils. */
  weaverAnchor(c, r, color) {
    neonBody(
      c,
      () =>
        polygon(c, [
          [0, -r * 1.1],
          [r * 0.6, 0],
          [0, r * 1.1],
          [-r * 0.6, 0],
        ]),
      color,
      2.5,
      14,
    );
    dot(c, 0, 0, r * 0.2, "#ffffff", 8);
  },

  /** L'Architecte : polyèdre doré à facettes, anneau et œil de lumière. */
  architect(c, r, color) {
    c.save();
    c.globalAlpha = 0.5;
    neonBody(c, circle(c, r * 1.15), "#9ff3ff", 1.5, 10);
    c.restore();
    neonBody(c, () => regular(c, 8, r, TAU / 16), color, 4, 26);
    c.strokeStyle = shade(color, 0.7);
    c.lineWidth = 2;
    regular(c, 4, r * 0.75, 0);
    c.stroke();
    regular(c, 4, r * 0.75, TAU / 8);
    c.stroke();
    dot(c, 0, 0, r * 0.3, "#ffffff", 20);
    dot(c, 0, 0, r * 0.12, "#ff2a6d", 0);
  },
};
