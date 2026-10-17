// Petits graphiques sur canvas pour la page des statistiques (sans bibliothèque) : courbes et barres,
// à la largeur du conteneur et nets sur écran haute densité.

const PAD = { left: 38, right: 10, top: 10, bottom: 24 };

/** @typedef {{ values: number[], color: string }} Series */

/** Prépare le canvas (taille réelle × densité) et renvoie le contexte et la zone de tracé. */
function setup(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.parentElement.clientWidth;
  const height = Number(canvas.getAttribute("height"));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const c = canvas.getContext("2d");
  c.setTransform(ratio, 0, 0, ratio, 0, 0);
  c.clearRect(0, 0, width, height);
  c.font = "11px system-ui, sans-serif";
  return { c, w: width - PAD.left - PAD.right, h: height - PAD.top - PAD.bottom };
}

/** Graduation « ronde » au-dessus du maximum (1, 2, 5, 10, 20, 50...). */
function niceMax(max) {
  if (max <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(max));
  for (const k of [1, 2, 5, 10]) if (k * step >= max) return k * step;
  return 10 * step;
}

/** Axes, quadrillage et étiquettes (une sur `every` en bas, selon la place). */
function axes(c, w, h, labels, max) {
  c.strokeStyle = "rgba(255, 255, 255, 0.08)";
  c.fillStyle = "#888";
  c.textAlign = "right";
  c.textBaseline = "middle";
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + h - (h * i) / 4;
    c.beginPath();
    c.moveTo(PAD.left, y);
    c.lineTo(PAD.left + w, y);
    c.stroke();
    c.fillText(String(Math.round((max * i) / 4)), PAD.left - 6, y);
  }
  c.textAlign = "center";
  c.textBaseline = "top";
  const every = Math.max(1, Math.ceil((labels.length * 42) / w));
  labels.forEach((label, i) => {
    if (i % every) return;
    c.fillText(label, PAD.left + ((i + 0.5) * w) / labels.length, PAD.top + h + 6);
  });
}

/** Courbes (une par série), points sur chaque valeur. */
export function drawLines(canvas, labels, /** @type {Series[]} */ series) {
  const { c, w, h } = setup(canvas);
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  axes(c, w, h, labels, max);
  const x = (i) => PAD.left + ((i + 0.5) * w) / labels.length;
  const y = (v) => PAD.top + h - (v / max) * h;
  for (const s of series) {
    c.strokeStyle = s.color;
    c.fillStyle = s.color;
    c.lineWidth = 2;
    c.beginPath();
    s.values.forEach((v, i) => (i ? c.lineTo(x(i), y(v)) : c.moveTo(x(i), y(v))));
    c.stroke();
    s.values.forEach((v, i) => {
      c.beginPath();
      c.arc(x(i), y(v), 2.5, 0, Math.PI * 2);
      c.fill();
    });
  }
}

/** Barres groupées (une par série et par étiquette). */
export function drawBars(canvas, labels, /** @type {Series[]} */ series) {
  const { c, w, h } = setup(canvas);
  if (labels.length === 0) {
    c.fillStyle = "#666";
    c.textAlign = "center";
    c.fillText("Pas encore de données", PAD.left + w / 2, PAD.top + h / 2);
    return;
  }
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  axes(c, w, h, labels, max);
  const slot = w / labels.length;
  const bar = Math.max(1, (slot * 0.75) / series.length);
  series.forEach((s, k) => {
    c.fillStyle = s.color;
    s.values.forEach((v, i) => {
      const height = (v / max) * h;
      const left = PAD.left + i * slot + slot * 0.125 + k * bar;
      c.fillRect(left, PAD.top + h - height, Math.max(1, bar - 1), height);
    });
  });
}
