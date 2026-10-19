import { describe, expect, it } from 'vitest';
import { adjacency, parseShape, rectShape, type Shape } from '../src/core/grid';
import { isSelfTouching, randomPathCover } from '../src/core/cover';
import { generate } from '../src/core/generator';
import { countSolutions } from '../src/core/solver';
import { mulberry32 } from '../src/core/rng';
import { isValidSolution } from './helpers';

function randomHoles(n: number, seed: number): Shape {
  const rng = mulberry32(seed);
  const s = rectShape(n, n);
  for (let i = 0; i < n * n; i++) if (rng() < 0.12) s.blocked[i] = true;
  return s;
}

const shapes: [string, Shape][] = [
  ['5x5', rectShape(5, 5)],
  ['6x6', rectShape(6, 6)],
  ['7x7', rectShape(7, 7)],
  ['8x6', rectShape(8, 6)],
  ['plus', parseShape(['##...##', '##...##', '.......', '.......', '.......', '##...##', '##...##'])],
  ['donut', parseShape(['......', '......', '..##..', '..##..', '......', '......'])],
  ['holes7', randomHoles(7, 1)],
  ['holes8', randomHoles(8, 2)],
  ['10x10', rectShape(10, 10)],
];

describe('generate', () => {
  for (const [name, shape] of shapes) {
    it(`produces valid unique puzzles for ${name}`, () => {
      for (let seed = 1; seed <= 4; seed++) {
        const res = generate(shape, { seed, budgetMs: 8000 });
        if (!res.ok) {
          // Random-hole shapes may legitimately include tiny regions.
          expect(name.startsWith('holes')).toBe(true);
          continue;
        }
        const { puzzle } = res;
        expect(puzzle.pairs.length).toBeGreaterThan(0);
        for (const { a, b } of puzzle.pairs) {
          expect(shape.blocked[a]).toBe(false);
          expect(shape.blocked[b]).toBe(false);
        }
        shape.blocked.forEach((bl, c) => expect(puzzle.solution[c] >= 0).toBe(!bl));
        for (let p = 0; p < puzzle.pairs.length; p++) {
          expect(puzzle.solution.filter((x) => x === p).length).toBeGreaterThanOrEqual(3);
        }
        const check = countSolutions(shape, puzzle.pairs, { limit: 2 });
        expect(check.count).toBe(1);
        // No way to connect all pairs at all except the full solution.
        const relaxed = countSolutions(shape, puzzle.pairs, { mode: 'relaxed', limit: 2 });
        expect(relaxed.count).toBe(1);
        expect(relaxed.solutions[0].flat().length).toBe(shape.blocked.filter((b) => !b).length);
        for (const path of relaxed.solutions[0]) expect(isSelfTouching(path, adjacency(shape))).toBe(false);
        expect(isValidSolution(shape, puzzle.pairs, check.solutions[0])).toBe(true);
        check.solutions[0].forEach((path, p) => path.forEach((c) => expect(puzzle.solution[c]).toBe(p)));
      }
    }, 60000);
  }

  it('rejects shapes with tiny regions immediately', () => {
    expect(generate(parseShape(['.#...']), { seed: 1 }).ok).toBe(false);
    expect(generate(parseShape(['..#...']), { seed: 1 }).ok).toBe(false);
    expect(generate(parseShape(['###']), { seed: 1 }).ok).toBe(false);
  });

  it('is deterministic for a given seed', () => {
    const a = generate(rectShape(6, 6), { seed: 42, budgetMs: 8000 });
    const b = generate(rectShape(6, 6), { seed: 42, budgetMs: 8000 });
    expect(a.ok && b.ok && a.puzzle.pairs).toEqual(b.ok && b.puzzle.pairs);
  });
});

describe('presets', () => {
  it('random-hole presets never contain unfillable regions', async () => {
    const { PRESETS } = await import('../src/core/presets');
    const { components } = await import('../src/core/grid');
    for (const id of ['holes8', 'holes10']) {
      const preset = PRESETS.find((p) => p.id === id)!;
      for (let seed = 0; seed < 200; seed++) {
        expect(components(preset.make(seed)).every((c) => c.length >= 3)).toBe(true);
      }
    }
  });
});

describe('randomPathCover', () => {
  it('never returns self-touching or short paths', () => {
    for (const [, shape] of shapes) {
      const adj = adjacency(shape);
      for (let seed = 0; seed < 500; seed++) {
        const cover = randomPathCover(shape, mulberry32(seed));
        if (!cover) continue;
        expect(cover.flat().length).toBe(shape.blocked.filter((b) => !b).length);
        for (const p of cover) {
          expect(p.length).toBeGreaterThanOrEqual(3);
          expect(isSelfTouching(p, adj)).toBe(false);
        }
      }
    }
  });
});
