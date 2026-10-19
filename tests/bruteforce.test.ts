import { describe, expect, it } from 'vitest';
import { adjacency, rectShape, type Shape } from '../src/core/grid';
import { isSelfTouching, randomPathCover } from '../src/core/cover';
import type { Pair } from '../src/core/puzzle';
import { mulberry32, randInt, shuffle } from '../src/core/rng';
import { countSolutions } from '../src/core/solver';

/** Enumerate every set of simple, non-crossing paths joining all pairs (no pruning at all). */
function enumerate(shape: Shape, pairs: Pair[]): number[][][] {
  const adj = adjacency(shape);
  const used = new Uint8Array(shape.blocked.length);
  for (const { a, b } of pairs) used[a] = used[b] = 1;
  const out: number[][][] = [];
  const chosen: number[][] = [];
  const walk = (p: number, path: number[]) => {
    const tail = path[path.length - 1];
    for (const n of adj[tail]) {
      if (n === pairs[p].b) {
        chosen.push([...path, n]);
        next(p + 1);
        chosen.pop();
      } else if (!used[n]) {
        used[n] = 1;
        path.push(n);
        walk(p, path);
        path.pop();
        used[n] = 0;
      }
    }
  };
  const next = (p: number) => {
    if (p === pairs.length) out.push(chosen.map((c) => c.slice()));
    else walk(p, [pairs[p].a]);
  };
  next(0);
  return out;
}

function randomPuzzle(seed: number): { shape: Shape; pairs: Pair[] } {
  const rng = mulberry32(seed);
  const w = 3 + randInt(rng, 3);
  const h = 3 + randInt(rng, 3);
  const shape = rectShape(w, h);
  for (let i = 0; i < w * h; i++) if (rng() < 0.12) shape.blocked[i] = true;
  // Half the cases use real generator covers, so a full clean solution exists.
  if (seed % 2 === 0) {
    const cover = randomPathCover(shape, rng, { maxLen: 5 + randInt(rng, 10) });
    if (cover) return { shape, pairs: cover.map((p) => ({ a: p[0], b: p[p.length - 1] })) };
  }
  const open = shuffle(rng, shape.blocked.map((b, i) => (b ? -1 : i)).filter((i) => i >= 0));
  const P = Math.min(Math.floor(open.length / 2), 1 + randInt(rng, 4));
  const pairs = Array.from({ length: P }, (_, i) => ({ a: open[2 * i], b: open[2 * i + 1] }));
  return { shape, pairs };
}

describe('solver vs brute force', () => {
  it('matches exhaustive enumeration in fill and relaxed modes', () => {
    let fullCases = 0;
    let relaxedMulti = 0;
    for (let seed = 1; seed <= 12000; seed++) {
      const { shape, pairs } = randomPuzzle(seed);
      const adj = adjacency(shape);
      const all = enumerate(shape, pairs);
      const openCount = shape.blocked.filter((b) => !b).length;
      const full = all.filter((s) => s.flat().length === openCount);
      const clean = all.filter((s) => s.every((p) => !isSelfTouching(p, adj)));

      // Fill mode is an exact count of full solutions.
      expect(countSolutions(shape, pairs, { limit: 1e9 }).count).toBe(full.length);
      // Relaxed mode is an exact count of non-self-touching path sets.
      const relaxed = countSolutions(shape, pairs, { mode: 'relaxed', limit: 1e9 });
      expect(relaxed.count).toBe(clean.length);

      // The property the generator relies on: given a full, non-self-touching
      // solution, "it's the only relaxed solution" <=> "no other way to connect
      // all pairs exists at all, gaps or not".
      if (full.some((s) => s.every((p) => !isSelfTouching(p, adj)))) {
        fullCases++;
        expect(relaxed.count === 1).toBe(all.length === 1);
        if (all.length > 1) relaxedMulti++;
      }
    }
    // Make sure the random cases actually exercise the interesting branches.
    expect(fullCases).toBeGreaterThan(2000);
    expect(relaxedMulti).toBeGreaterThan(40);
  });
});
