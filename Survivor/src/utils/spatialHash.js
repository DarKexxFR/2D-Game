// Grille spatiale : évite les tests de collision en O(n²) entre ennemis
// et entre projectiles/ennemis. Chaque objet est inséré dans toutes les
// cellules couvertes par son cercle englobant.

export class SpatialHash {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.cells = new Map();
    this.stamp = 0;
    this.results = [];
  }

  clear() {
    for (const cell of this.cells.values()) cell.length = 0;
  }

  _key(cx, cy) {
    // Coordonnées de cellule bornées (carte de 3000px) : clé entière sans collision.
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  insert(obj, x, y, r) {
    const s = this.cellSize;
    const x0 = Math.floor((x - r) / s);
    const x1 = Math.floor((x + r) / s);
    const y0 = Math.floor((y - r) / s);
    const y1 = Math.floor((y + r) / s);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const key = this._key(cx, cy);
        let cell = this.cells.get(key);
        if (!cell) {
          cell = [];
          this.cells.set(key, cell);
        }
        cell.push(obj);
      }
    }
  }

  /** Renvoie (tableau réutilisé) les objets dont les cellules recoupent le cercle donné. */
  query(x, y, r) {
    const s = this.cellSize;
    const out = this.results;
    out.length = 0;
    const stamp = ++this.stamp;
    const x0 = Math.floor((x - r) / s);
    const x1 = Math.floor((x + r) / s);
    const y0 = Math.floor((y - r) / s);
    const y1 = Math.floor((y + r) / s);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const cell = this.cells.get(this._key(cx, cy));
        if (!cell) continue;
        for (const obj of cell) {
          if (obj._hashStamp === stamp) continue;
          obj._hashStamp = stamp;
          out.push(obj);
        }
      }
    }
    return out;
  }
}
