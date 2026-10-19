import { components, type Shape } from './grid';
import { MIN_PATH, randomPathCover } from './cover';
import { pathsToPuzzle, type Pair, type Puzzle } from './puzzle';
import { mulberry32, shuffle, type Rng } from './rng';
import { countSolutions } from './solver';

export interface GenerateOptions {
  seed: number;
  /** Total time budget in ms (default 5000). */
  budgetMs?: number;
  /** Max split-refinements per cover before starting a fresh one. */
  maxRefinements?: number;
  now?: () => number;
}

export type GenerateResult =
  | { ok: true; puzzle: Puzzle; attempts: number }
  | { ok: false; reason: string; attempts: number };

export function generate(shape: Shape, opts: GenerateOptions): GenerateResult {
  const now = opts.now ?? (() => performance.now());
  const deadline = now() + (opts.budgetMs ?? 5000);
  const maxRefinements = opts.maxRefinements ?? 20;
  const rng = mulberry32(opts.seed);

  const comps = components(shape);
  if (comps.length === 0) return { ok: false, reason: 'The shape has no open cells.', attempts: 0 };
  if (comps.some((c) => c.length < MIN_PATH)) {
    return {
      ok: false,
      reason: `Every connected region needs at least ${MIN_PATH} cells.`,
      attempts: 0,
    };
  }

  let attempts = 0;
  while (now() < deadline) {
    attempts++;
    let paths = randomPathCover(shape, rng);
    if (!paths) continue;

    for (let r = 0; r <= maxRefinements && now() < deadline; r++) {
      const pairs: Pair[] = paths.map((p) => ({ a: p[0], b: p[p.length - 1] }));
      // Relaxed mode: also finds ways to connect every pair that leave cells
      // empty. Accept only if the cover itself is the one and only way.
      const res = countSolutions(shape, pairs, { mode: 'relaxed', limit: 2, deadline, now });
      if (res.aborted) break;
      if (res.count === 1 && samePaths(res.solutions[0], paths)) {
        return { ok: true, puzzle: pathsToPuzzle(shape, paths, opts.seed), attempts };
      }
      const other = res.solutions.find((s) => !samePaths(s, paths!));
      if (res.count === 0 || !other || res.solutions.length < res.count) {
        throw new Error('Generated cover was not found by the solver (self-touching path?)');
      }
      const split = splitAtDifference(shape, paths, other, rng);
      if (!split) break;
      paths = split;
    }
  }
  return {
    ok: false,
    reason: `Couldn't find a puzzle with a unique solution for this shape (${attempts} attempts).`,
    attempts,
  };
}

/** Path-neighbour signature of each cell: which cells it links to in a solution. */
function linkKeys(N: number, paths: number[][]): string[] {
  const links: number[][] = Array.from({ length: N }, () => []);
  for (const p of paths) {
    for (let i = 0; i + 1 < p.length; i++) {
      links[p[i]].push(p[i + 1]);
      links[p[i + 1]].push(p[i]);
    }
  }
  return links.map((l) => l.sort((x, y) => x - y).join(','));
}

function samePaths(a: number[][], b: number[][]): boolean {
  const N = Math.max(...a.flat(), ...b.flat()) + 1;
  const ka = linkKeys(N, a);
  const kb = linkKeys(N, b);
  return ka.every((k, i) => k === kb[i]);
}

/**
 * Split one of our paths near a cell where the alternative solution differs,
 * introducing a new pair whose endpoints break that alternative.
 */
function splitAtDifference(shape: Shape, paths: number[][], other: number[][], rng: Rng): number[][] | null {
  const N = shape.blocked.length;

  // Best: put a new endpoint on a cell the alternative leaves empty or gives to
  // another pair. Endpoints must be covered by their own pair, so this kills it.
  const altOwner = new Int32Array(N).fill(-1);
  other.forEach((p, i) => p.forEach((c) => (altOwner[c] = i)));
  const cuts: [number, number][] = [];
  paths.forEach((p, pi) => {
    for (let j = MIN_PATH - 1; j <= p.length - MIN_PATH - 1; j++) {
      if (altOwner[p[j]] !== pi || altOwner[p[j + 1]] !== pi) cuts.push([pi, j]);
    }
  });
  if (cuts.length) {
    const [pi, j] = cuts[Math.floor(rng() * cuts.length)];
    const out = paths.slice();
    out.splice(pi, 1, paths[pi].slice(0, j + 1), paths[pi].slice(j + 1));
    return out;
  }

  const mine = linkKeys(N, paths);
  const theirs = linkKeys(N, other);
  const diff: number[] = [];
  for (let c = 0; c < N; c++) if (!shape.blocked[c] && mine[c] !== theirs[c]) diff.push(c);
  shuffle(rng, diff);

  for (const cell of diff) {
    const pi = paths.findIndex((p) => p.includes(cell));
    const p = paths[pi];
    const L = p.length;
    if (L < 2 * MIN_PATH) continue;
    const i = p.indexOf(cell);
    // Cut between j and j+1 with both halves >= MIN_PATH; pick j closest to the cell.
    const lo = MIN_PATH - 1;
    const hi = L - MIN_PATH - 1;
    const j = Math.min(hi, Math.max(lo, rng() < 0.5 ? i : i - 1));
    const out = paths.slice();
    out.splice(pi, 1, p.slice(0, j + 1), p.slice(j + 1));
    return out;
  }
  return null;
}
