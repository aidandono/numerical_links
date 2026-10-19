import type { Puzzle } from '../core/puzzle';

/**
 * Player state. `base` holds committed paths (one per pair, each starting at
 * one of the pair's endpoints). While dragging, `drag` is the active pair's
 * path. Paths can never cross: a drag stops at any cell another path uses.
 */
export interface GameState {
  base: number[][];
  active: number | null;
  drag: number[];
}

export function initialState(puzzle: Puzzle): GameState {
  return { base: puzzle.pairs.map(() => []), active: null, drag: [] };
}

function endpointPair(puzzle: Puzzle, cell: number): number {
  return puzzle.pairs.findIndex((p) => p.a === cell || p.b === cell);
}

function otherEnd(puzzle: Puzzle, pair: number, cell: number): number {
  const { a, b } = puzzle.pairs[pair];
  return cell === a ? b : a;
}

export function isAdjacent(width: number, c1: number, c2: number): boolean {
  const d = Math.abs(c1 - c2);
  return d === width || (d === 1 && Math.floor(c1 / width) === Math.floor(c2 / width));
}

/** Paths as currently displayed (drag applied). */
export function currentPaths(state: GameState): number[][] {
  if (state.active === null) return state.base;
  return state.base.map((path, q) => (q === state.active ? state.drag : path));
}

export function isComplete(puzzle: Puzzle, path: number[]): boolean {
  return path.length >= 2 && path[path.length - 1] === otherEnd(puzzle, endpointPair(puzzle, path[0]), path[0]);
}

export function startDrag(puzzle: Puzzle, state: GameState, cell: number): GameState {
  const paths = currentPaths(state);
  const ep = endpointPair(puzzle, cell);
  if (ep >= 0) {
    // Grabbing the far end of a completed path: keep it and continue from there.
    const existing = paths[ep];
    const i = existing.indexOf(cell);
    const drag = i >= 0 && existing[0] !== cell ? existing.slice(0, i + 1) : [cell];
    return { base: paths, active: ep, drag };
  }
  const p = paths.findIndex((path) => path.includes(cell));
  if (p < 0) return { ...state, base: paths, active: null, drag: [] };
  return { base: paths, active: p, drag: paths[p].slice(0, paths[p].indexOf(cell) + 1) };
}

export function dragTo(puzzle: Puzzle, state: GameState, cell: number): GameState {
  const p = state.active;
  if (p === null) return state;
  const drag = state.drag;
  const tail = drag[drag.length - 1];
  if (cell === tail) return state;

  const own = drag.indexOf(cell);
  if (own >= 0) return { ...state, drag: drag.slice(0, own + 1) };

  const { shape } = puzzle;
  if (shape.blocked[cell] || !isAdjacent(shape.width, tail, cell)) return state;
  if (isComplete(puzzle, drag)) return state;

  const ep = endpointPair(puzzle, cell);
  if (ep >= 0 && ep !== p) return state;
  if (state.base.some((path, q) => q !== p && path.includes(cell))) return state;
  return { ...state, drag: [...drag, cell] };
}

export function endDrag(state: GameState): GameState {
  if (state.active === null) return state;
  const base = currentPaths(state).map((path) => (path.length === 1 ? [] : path));
  return { base, active: null, drag: [] };
}

export function isSolved(puzzle: Puzzle, state: GameState): boolean {
  const paths = currentPaths(state);
  if (!paths.every((path) => isComplete(puzzle, path))) return false;
  const covered = paths.reduce((n, path) => n + path.length, 0);
  return covered === puzzle.shape.blocked.filter((b) => !b).length;
}
