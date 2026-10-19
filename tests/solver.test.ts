import { describe, expect, it } from 'vitest';
import { countSolutions } from '../src/core/solver';
import { rectShape } from '../src/core/grid';
import { isValidSolution, parsePuzzle } from './helpers';

function count(rows: string[], limit = 10) {
  const { shape, pairs } = parsePuzzle(rows);
  const res = countSolutions(shape, pairs, { limit });
  for (const s of res.solutions) expect(isValidSolution(shape, pairs, s)).toBe(true);
  return res.count;
}

describe('countSolutions', () => {
  it('solves a trivial straight line', () => {
    expect(count(['A.A'])).toBe(1);
  });

  it('finds a unique solution', () => {
    // A goes along the top row, B along the bottom.
    expect(count(['A..A', 'B..B'])).toBe(1);
  });

  it('counts multiple solutions', () => {
    // A single pair in an open 3x3 from corner to adjacent-corner-ish: many Hamiltonian paths.
    expect(count(['A..', '...', '..A'])).toBeGreaterThan(1);
  });

  it('counts exact numbers on a small known case', () => {
    // Hamiltonian paths in a 2x3 grid between opposite corners: exactly 1? Enumerate: corner (0,0) to (2,1).
    // ...   cells 0 1 2 / 3 4 5; paths 0->5 covering all: 0-3-4-1-2-5 and 0-1-... no (0-1-2-5 leaves 3,4).
    expect(count(['A..', '..A'])).toBe(1);
  });

  it('detects unsolvable puzzles', () => {
    expect(count(['AB', 'BA'])).toBe(0); // must cross
    expect(count(['A.A.'])).toBe(0); // last cell can't be filled
  });

  it('handles blocked cells', () => {
    expect(count(['A.#', '#.A'])).toBe(1);
    expect(count(['A#A'])).toBe(0);
  });

  it('a classic 5x5 Flow puzzle has a unique solution', () => {
    const rows = [
      'A.B.D',
      '..C.E',
      '.....',
      '.B.D.',
      '.ACE.',
    ];
    expect(count(rows)).toBe(1);
  });

  it('respects the limit', () => {
    const { shape, pairs } = parsePuzzle(['A..A', '....', '....', '....']);
    expect(countSolutions(shape, pairs, { limit: 2 }).count).toBe(2);
  });

  it('respects checkerboard parity', () => {
    // Opposite corners of a 4x4 share a colour; a 16-cell path can't join them.
    expect(count(['A...', '....', '....', '...A'])).toBe(0);
  });
});

describe('regression: user-reported 7x7 with a gap-leaving solution', () => {
  // Pairs as (col,row) from the screenshot. All pairs can be connected while
  // leaving the four top-left cells empty, so this board must be rejected.
  const c = (x: number, y: number) => y * 7 + x;
  const pairs = [
    [2, 0, 4, 4],
    [3, 0, 6, 1],
    [1, 1, 2, 2],
    [5, 1, 0, 4],
    [3, 2, 2, 3],
    [6, 2, 0, 6],
    [0, 3, 3, 4],
  ].map(([x1, y1, x2, y2]) => ({ a: c(x1, y1), b: c(x2, y2) }));
  const shape = rectShape(7, 7);

  it('looked unique to the old fill-only check', () => {
    expect(countSolutions(shape, pairs, { limit: 2 }).count).toBe(1);
  });

  it('relaxed check exposes the gap-leaving solution', () => {
    const res = countSolutions(shape, pairs, { mode: 'relaxed', limit: 5 });
    expect(res.solutions.some((s) => s.flat().length < 49)).toBe(true);
  });

  it('is rejected by the generator acceptance rule', () => {
    // Accept only if the single relaxed solution is a full board.
    const res = countSolutions(shape, pairs, { mode: 'relaxed', limit: 2 });
    const accepted = res.count === 1 && res.solutions[0].flat().length === 49;
    expect(accepted).toBe(false);
  });
});
