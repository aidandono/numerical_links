import { describe, expect, it } from 'vitest';
import { rectShape } from '../src/core/grid';
import type { Puzzle } from '../src/core/puzzle';
import { currentPaths, dragTo, endDrag, initialState, isSolved, startDrag, type GameState } from '../src/game/state';

// 3x2 board:  A . A
//             B . B
const puzzle: Puzzle = {
  shape: rectShape(3, 2),
  pairs: [
    { a: 0, b: 2 },
    { a: 3, b: 5 },
  ],
  solution: [0, 0, 0, 1, 1, 1],
  seed: 0,
};

function drag(state: GameState, cells: number[]): GameState {
  let s = startDrag(puzzle, state, cells[0]);
  for (const c of cells.slice(1)) s = dragTo(puzzle, s, c);
  return s;
}

describe('game state', () => {
  it('extends a path and completes it', () => {
    const s = endDrag(drag(initialState(puzzle), [0, 1, 2]));
    expect(s.base[0]).toEqual([0, 1, 2]);
  });

  it('retracts when moving back over the path', () => {
    const s = drag(initialState(puzzle), [0, 1, 0]);
    expect(currentPaths(s)[0]).toEqual([0]);
  });

  it('ignores non-adjacent cells, blocked cells and other endpoints', () => {
    let s = drag(initialState(puzzle), [0, 2]);
    expect(s.drag).toEqual([0]);
    s = drag(initialState(puzzle), [0, 3]);
    expect(s.drag).toEqual([0]);
  });

  it('stops extending once complete', () => {
    const s = drag(initialState(puzzle), [0, 1, 2, 5]);
    expect(s.drag).toEqual([0, 1, 2]);
  });

  it('cannot draw over another path', () => {
    let s = endDrag(drag(initialState(puzzle), [0, 1, 2]));
    s = drag(s, [3, 4, 1]);
    expect(s.drag).toEqual([3, 4]);
    s = endDrag(s);
    expect(s.base[0]).toEqual([0, 1, 2]);
    expect(s.base[1]).toEqual([3, 4]);
  });

  it('continues from the middle of an existing path', () => {
    let s = endDrag(drag(initialState(puzzle), [0, 1, 2]));
    s = startDrag(puzzle, s, 1);
    expect(s.drag).toEqual([0, 1]);
  });

  it('detects a win only when all pairs connect and every cell is filled', () => {
    let s = endDrag(drag(initialState(puzzle), [0, 1, 2]));
    expect(isSolved(puzzle, s)).toBe(false);
    s = endDrag(drag(s, [3, 4, 5]));
    expect(isSolved(puzzle, s)).toBe(true);
  });
});
