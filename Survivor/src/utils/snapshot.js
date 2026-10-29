// Copie d'un graphe d'objets en JSON, et retour : références partagées et cycles conservés
// (un ennemi visé par plusieurs tirs reste un seul ennemi), Infinity / NaN / undefined gardés,
// Set et Map pris en charge. Sert à sauvegarder une partie en cours (voir services/runSave.js).
//
// Format : `{ roots, table }`. Chaque objet, tableau, Set ou Map a une entrée dans `table`
// (`["o", {...}]`, `["a", [...]]`, `["s", [...]]`, `["m", [[clé, valeur]...]]`) ; une valeur est soit
// un primitif JSON, soit `{ $: n }` (référence à l'entrée n), soit `{ "#": "Infinity" }` (nombre
// spécial) ou `{ u: 1 }` (undefined). Les racines occupent les premières entrées, dans l'ordre.

/** Valeur impossible à sauvegarder (fonction, objet d'une classe…) : `path` dit où elle se trouve. */
export class SnapshotError extends Error {
  /** @param {string} path */
  constructor(path) {
    super(`Valeur non sauvegardable : ${path}`);
    this.path = path;
  }
}

const SPECIAL = new Map([
  [Infinity, "Infinity"],
  [-Infinity, "-Infinity"],
]);

/** @param {any} value */
function isPlain(value) {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Encode les objets `roots` (nom → objet). `empty` : objets (tableaux) sauvegardés vides
 * (effets purement visuels, inutiles à la reprise).
 * @param {Record<string, object>} roots
 * @param {{ empty?: Iterable<object> }} [options]
 */
export function encodeSnapshot(roots, { empty = [] } = {}) {
  const ids = new Map();
  /** @type {any[]} */
  const table = [];
  const emptySet = new Set(empty);
  /** @type {[object, string][]} */
  const pending = [];

  const ref = (obj, path) => {
    let id = ids.get(obj);
    if (id === undefined) {
      id = table.length;
      ids.set(obj, id);
      table.push(null);
      pending.push([obj, path]);
    }
    return { $: id };
  };

  const value = (v, path) => {
    if (v === undefined) return { u: 1 };
    if (v === null || typeof v === "boolean" || typeof v === "string") return v;
    if (typeof v === "number") {
      if (Number.isFinite(v)) return v;
      return { "#": SPECIAL.get(v) ?? "NaN" };
    }
    if (typeof v === "object") return ref(v, path);
    throw new SnapshotError(path);
  };

  const fill = (obj, path) => {
    const id = ids.get(obj);
    if (emptySet.has(obj)) return (table[id] = Array.isArray(obj) ? ["a", []] : ["o", {}]);
    if (Array.isArray(obj)) return (table[id] = ["a", obj.map((v, i) => value(v, `${path}[${i}]`))]);
    if (obj instanceof Set) return (table[id] = ["s", [...obj].map((v, i) => value(v, `${path}{${i}}`))]);
    if (obj instanceof Map)
      return (table[id] = ["m", [...obj].map(([k, v]) => [value(k, path), value(v, `${path}.${k}`)])]);
    if (!isPlain(obj)) throw new SnapshotError(`${path} (${obj.constructor?.name || "objet"})`);
    const out = {};
    for (const key of Object.keys(obj)) out[key] = value(obj[key], `${path}.${key}`);
    table[id] = ["o", out];
  };

  for (const [name, obj] of Object.entries(roots)) ref(obj, name);
  for (let i = 0; i < pending.length; i++) fill(...pending[i]);
  return { roots: Object.keys(roots), table };
}

/**
 * Décode une copie faite par `encodeSnapshot`. Les racines sont réécrites en place dans les objets
 * vivants de `live` (même nom qu'à l'encodage) : les modules qui les ont importés les voient changer.
 * @param {{ roots: string[], table: any[] }} snapshot
 * @param {Record<string, object>} live
 */
export function decodeSnapshot({ roots, table }, live) {
  /** @type {any[]} */
  const objs = table.map(([kind], i) => {
    const target = i < roots.length ? live[roots[i]] : null;
    if (target) {
      if (Array.isArray(target)) target.length = 0;
      else for (const key of Object.keys(target)) delete target[key];
      return target;
    }
    return kind === "a" ? [] : kind === "s" ? new Set() : kind === "m" ? new Map() : {};
  });

  const value = (v) => {
    if (v === null || typeof v !== "object") return v;
    if ("$" in v) return objs[v.$];
    if ("#" in v) return v["#"] === "Infinity" ? Infinity : v["#"] === "-Infinity" ? -Infinity : NaN;
    return undefined;
  };

  table.forEach(([kind, data], i) => {
    const obj = objs[i];
    if (kind === "a") for (const v of data) obj.push(value(v));
    else if (kind === "s") for (const v of data) obj.add(value(v));
    else if (kind === "m") for (const [k, v] of data) obj.set(value(k), value(v));
    else for (const key of Object.keys(data)) obj[key] = value(data[key]);
  });
  return Object.fromEntries(roots.map((name, i) => [name, objs[i]]));
}
