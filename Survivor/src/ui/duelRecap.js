// Fin de duel : courbes de vie des deux joueurs dans le temps, avec les attaques (▲, ◆ pour les
// élites) et les sorts (●) envoyés par chacun, à leur couleur.

import { VERSUS } from "../config.js";

const PAD = { left: 34, right: 10, top: 12, bottom: 22 };
const FONT = "Orbitron, sans-serif";

/** `logs` : récaps des deux parties ({ hp: [{ t, h }], marks: [{ t, k }] }), 0 = J1 ou soi-même. */
export function drawDuelRecap(canvas, logs) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const c = canvas.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);

  const end = Math.max(
    10_000,
    ...logs.flatMap((log) => [...log.hp.map((p) => p.t), ...log.marks.map((m) => m.t)]),
  );
  const pw = w - PAD.left - PAD.right;
  const ph = h - PAD.top - PAD.bottom;
  const toX = (t) => PAD.left + (Math.min(t, end) / end) * pw;
  const toY = (pct) => PAD.top + (1 - pct / 100) * ph;

  // Grille : 0 / 50 / 100 % et quelques repères de temps
  c.font = `9px ${FONT}`;
  c.lineWidth = 1;
  c.textBaseline = "middle";
  for (const pct of [0, 50, 100]) {
    c.strokeStyle = "rgba(255, 255, 255, 0.1)";
    c.beginPath();
    c.moveTo(PAD.left, toY(pct));
    c.lineTo(w - PAD.right, toY(pct));
    c.stroke();
    c.fillStyle = "#888";
    c.textAlign = "right";
    c.fillText(`${pct}%`, PAD.left - 5, toY(pct));
  }
  c.textAlign = "center";
  c.textBaseline = "top";
  const step = niceStep(end / 4);
  for (let t = 0; t <= end; t += step) c.fillText(clock(t), toX(t), h - PAD.bottom + 6);

  // Courbes de vie
  logs.forEach((log, i) => {
    const color = VERSUS.colors[i];
    if (log.hp.length === 0) return;
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.shadowBlur = 6;
    c.shadowColor = color;
    c.beginPath();
    // Points triés par temps (le point final forcé peut arriver après un échantillon plus récent)
    [...log.hp]
      .sort((a, b) => a.t - b.t)
      .forEach((p, n) => (n ? c.lineTo(toX(p.t), toY(p.h)) : c.moveTo(toX(p.t), toY(p.h))));
    c.stroke();
    c.shadowBlur = 0;
  });

  // Attaques et sorts : en haut pour J1, en bas pour J2
  logs.forEach((log, i) => {
    const color = VERSUS.colors[i];
    const y = i === 0 ? PAD.top - 4 : h - PAD.bottom - 6;
    for (const m of log.marks) drawMark(c, toX(m.t), y, m.k, color);
  });
}

function drawMark(c, x, y, kind, color) {
  c.fillStyle = color;
  c.strokeStyle = kind === "elite" ? "#ffd700" : color;
  c.lineWidth = 1.5;
  c.beginPath();
  if (kind === "hex") {
    c.arc(x, y + 3, 3.5, 0, Math.PI * 2);
    c.fillStyle = "#00ff88";
    c.fill();
    c.stroke();
    return;
  }
  if (kind === "elite") {
    c.moveTo(x, y - 1);
    c.lineTo(x + 4, y + 3);
    c.lineTo(x, y + 7);
    c.lineTo(x - 4, y + 3);
  } else {
    c.moveTo(x, y);
    c.lineTo(x + 4, y + 7);
    c.lineTo(x - 4, y + 7);
  }
  c.closePath();
  c.fill();
  c.stroke();
}

function niceStep(raw) {
  const steps = [5, 10, 15, 30, 60, 120, 300, 600].map((s) => s * 1000);
  return steps.find((s) => s >= raw) || 600_000;
}

function clock(ms) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
