// Icônes du jeu : convertit les SVG exportés de Figma (design/icons/<nom>.svg) en tracés pour le jeu
// (Survivor/src/data/iconPaths.js). `npm run icons` réécrit le fichier, `npm run icons -- --check`
// vérifie qu'il est à jour (lancé par `npm run lint`).
//
// Format attendu (grille 24, voir design/icons/README.md) : <path>, <circle>, <ellipse>, <rect>,
// <line>, <polyline>, <polygon>, sans transform. Un élément avec un trait (`stroke`) va dans le tracé
// au trait (`s`), un élément rempli (`fill` autre que none) dans le tracé plein (`f`).

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "design/icons");
const OUT = join(ROOT, "Survivor/src/data/iconPaths.js");

const num = (v) => {
  const n = parseFloat(v ?? "0");
  return Math.round(n * 100) / 100;
};

/** Attributs d'une balise. */
function attrs(tag) {
  const out = {};
  for (const [, k, v] of tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) out[k] = v;
  // style="fill: …; stroke: …" (export Figma possible)
  for (const decl of (out.style ?? "").split(";")) {
    const [k, v] = decl.split(":").map((s) => s?.trim());
    if (k && v) out[k] = v;
  }
  return out;
}

/** Tracé SVG équivalent à une forme simple. */
function shapeToPath(name, a) {
  switch (name) {
    case "path":
      return a.d.trim();
    case "circle":
    case "ellipse": {
      const cx = num(a.cx);
      const cy = num(a.cy);
      const rx = num(a.rx ?? a.r);
      const ry = num(a.ry ?? a.r);
      return `M${num(cx - rx)} ${cy}A${rx} ${ry} 0 1 0 ${num(cx + rx)} ${cy}A${rx} ${ry} 0 1 0 ${num(cx - rx)} ${cy}Z`;
    }
    case "rect": {
      const x = num(a.x);
      const y = num(a.y);
      const w = num(a.width);
      const h = num(a.height);
      const r = Math.min(num(a.rx ?? a.ry), w / 2, h / 2);
      if (!r) return `M${x} ${y}H${num(x + w)}V${num(y + h)}H${x}Z`;
      return (
        `M${num(x + r)} ${y}H${num(x + w - r)}A${r} ${r} 0 0 1 ${num(x + w)} ${num(y + r)}` +
        `V${num(y + h - r)}A${r} ${r} 0 0 1 ${num(x + w - r)} ${num(y + h)}H${num(x + r)}` +
        `A${r} ${r} 0 0 1 ${x} ${num(y + h - r)}V${num(y + r)}A${r} ${r} 0 0 1 ${num(x + r)} ${y}Z`
      );
    }
    case "line":
      return `M${num(a.x1)} ${num(a.y1)}L${num(a.x2)} ${num(a.y2)}`;
    case "polyline":
    case "polygon": {
      const pts = a.points
        .trim()
        .split(/[\s,]+/)
        .map(num);
      let d = "";
      for (let i = 0; i < pts.length; i += 2) d += `${i ? "L" : "M"}${pts[i]} ${pts[i + 1]}`;
      return name === "polygon" ? d + "Z" : d;
    }
  }
  return null;
}

/** @returns {{ s: string, f: string }} */
export function parseIcon(svg, file = "") {
  const root = attrs(svg.match(/<svg\b[^>]*>/)?.[0] ?? "");
  const viewBox = (root.viewBox ?? "0 0 24 24")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (viewBox.join(" ") !== "0 0 24 24") throw new Error(`${file} : viewBox attendu « 0 0 24 24 »`);
  // On ignore les définitions (masques, découpes) que Figma ajoute parfois
  const body = svg.replace(/<(defs|clipPath|mask)\b[\s\S]*?<\/\1>/g, "");
  let s = "";
  let f = "";
  for (const [tag, name] of body.matchAll(/<(path|circle|ellipse|rect|line|polyline|polygon)\b[^>]*>/g)) {
    const a = attrs(tag);
    if (a.transform) throw new Error(`${file} : « transform » non pris en charge (aplatir dans Figma)`);
    const d = shapeToPath(name, a);
    const fill = a.fill ?? root.fill ?? "black";
    const stroke = a.stroke ?? root.stroke ?? "none";
    if (stroke !== "none") s += d;
    if (fill !== "none") f += d;
  }
  if (!s && !f) throw new Error(`${file} : aucune forme`);
  return { s, f };
}

function build() {
  const files = readdirSync(SRC)
    .filter((n) => n.endsWith(".svg"))
    .sort();
  const lines = files.map((file) => {
    const { s, f } = parseIcon(readFileSync(join(SRC, file), "utf8"), file);
    const parts = [s && `s: ${JSON.stringify(s)}`, f && `f: ${JSON.stringify(f)}`].filter(Boolean);
    return `  ${JSON.stringify(file.slice(0, -4))}: { ${parts.join(", ")} },`;
  });
  return (
    "// Fichier généré par `npm run icons` depuis design/icons/*.svg (exports Figma) : ne pas modifier à la main.\n" +
    "// Grille 24 ; `s` = tracé au trait (épaisseur 2, bouts ronds), `f` = tracé plein.\n\n" +
    "/** @type {Record<string, { s?: string, f?: string }>} */\n" +
    "export const ICON_PATHS = {\n" +
    lines.join("\n") +
    "\n};\n"
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const text = build();
  if (process.argv.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(OUT, "utf8");
    } catch {}
    if (current !== text) {
      console.error("Survivor/src/data/iconPaths.js n'est pas à jour : lancer `npm run icons`.");
      process.exit(1);
    }
  } else {
    writeFileSync(OUT, text);
    console.log(`${text.split("\n").length - 7} icônes écrites dans Survivor/src/data/iconPaths.js`);
  }
}
