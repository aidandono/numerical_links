import { parseShape, type Shape } from '../src/core/grid';
import type { Pair } from '../src/core/puzzle';

/**
 * Build a puzzle from ASCII: '#' blocked, '.' empty, letters are endpoints
 * (each letter appears exactly twice).
 */
export function parsePuzzle(rows: string[]): { shape: Shape; pairs: Pair[] } {
  const shape = parseShape(rows.map((r) => r.replace(/[^#]/g, '.')));
  const seen = new Map<string, number[]>();
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (/[A-Za-z]/.test(ch)) seen.set(ch, [...(seen.get(ch) ?? []), y * shape.width + x]);
    }),
  );
  const pairs = [...seen.values()].map(([a, b]) => ({ a, b }));
  return { shape, pairs };
}

/** Check that paths form a valid full-cover solution for the pairs. */
export function isValidSolution(shape: Shape, pairs: Pair[], paths: number[][]): boolean {
  const used = new Set<number>();
  for (let p = 0; p < pairs.length; p++) {
    const path = paths[p];
    const ends = [path[0], path[path.length - 1]].sort();
    if (ends.join() !== [pairs[p].a, pairs[p].b].sort().join()) return false;
    for (let i = 0; i < path.length; i++) {
      const c = path[i];
      if (shape.blocked[c] || used.has(c)) return false;
      used.add(c);
      if (i > 0) {
        const d = Math.abs(c - path[i - 1]);
        const sameRow = Math.floor(c / shape.width) === Math.floor(path[i - 1] / shape.width);
        if (!(d === shape.width || (d === 1 && sameRow))) return false;
      }
    }
  }
  return used.size === shape.blocked.filter((b) => !b).length;
}
