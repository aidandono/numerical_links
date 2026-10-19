import { rectShape } from '../core/grid';
import type { Puzzle } from '../core/puzzle';

/** One pregenerated level. In `board`, 0 is empty and k > 0 marks an endpoint of pair k. */
export interface RawLevel {
  size: number;
  paths?: number;
  seed: number;
  /** Vestigial: ignored by the game. */
  difficulty?: string | null;
  score?: number | null;
  board: number[][];
  solution: number[][];
}

/** Short FNV-1a hash of the board, so a level keeps its progress if the file is reordered. */
export function levelId(board: number[][]): string {
  let h = 0x811c9dc5;
  for (const v of board.flat().join(',') + `|${board.length}`) {
    h ^= v.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function rawToPuzzle(level: RawLevel): Puzzle {
  const { size, board, solution } = level;
  const fail = (msg: string) => {
    throw new Error(`Bad level (size ${size}, seed ${level.seed}): ${msg}`);
  };
  if (board.length !== size || board.some((r) => r.length !== size)) fail('board is not size×size');
  if (solution.length !== size || solution.some((r) => r.length !== size)) fail('solution is not size×size');

  const ends = new Map<number, number[]>();
  board.flat().forEach((v, c) => {
    if (v > 0) ends.set(v, [...(ends.get(v) ?? []), c]);
  });
  const pairs = [];
  for (let k = 1; k <= ends.size; k++) {
    const cells = ends.get(k);
    if (!cells || cells.length !== 2) fail(`pair ${k} needs exactly 2 endpoints`);
    pairs.push({ a: cells![0], b: cells![1] });
  }
  const sol = solution.flat().map((v) => v - 1);
  if (sol.some((p) => p < 0 || p >= pairs.length)) fail('solution has empty or unknown cells');

  return { shape: rectShape(size, size), pairs, solution: sol, seed: level.seed };
}
