import { describe, expect, it } from 'vitest';
import { loadPack, PACKS } from '../src/levels/levels';

describe('level packs', () => {
  it('lists packs in ascending size order', () => {
    expect(PACKS.length).toBeGreaterThan(0);
    const sizes = PACKS.map((p) => p.size);
    expect(sizes).toEqual([...new Set(sizes)].sort((a, b) => a - b));
  });

  it('has unique level ids across all packs', () => {
    const ids = PACKS.flatMap((p) => p.levelIds);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const pack of PACKS) {
    it(`${pack.id} loads and matches the index`, async () => {
      const levels = await loadPack(pack.id);
      expect(levels.map((l) => l.id)).toEqual(pack.levelIds);
      expect(levels.map((l) => l.number)).toEqual(levels.map((_, i) => i + 1));
      for (const l of levels) {
        expect(l.packId).toBe(pack.id);
        expect(l.puzzle.shape.width).toBe(pack.size);
      }
    });
  }
});
