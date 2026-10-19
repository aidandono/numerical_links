import type { Shape } from './grid';

export interface Pair {
  a: number;
  b: number;
}

export interface Puzzle {
  shape: Shape;
  pairs: Pair[];
  /** Pair index per cell (-1 for blocked cells). */
  solution: number[];
  seed: number;
}

/** Convert a list of paths (cell lists) into pairs + per-cell solution. */
export function pathsToPuzzle(shape: Shape, paths: number[][], seed: number): Puzzle {
  const solution = new Array(shape.blocked.length).fill(-1);
  paths.forEach((p, i) => p.forEach((c) => (solution[c] = i)));
  return { shape, pairs: paths.map((p) => ({ a: p[0], b: p[p.length - 1] })), solution, seed };
}
