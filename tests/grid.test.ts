import { describe, expect, it } from 'vitest';
import { components, neighbors, parseShape, shapeToRows } from '../src/core/grid';

describe('grid', () => {
  it('parses and round-trips ASCII shapes', () => {
    const rows = ['..#', '...', '#..'];
    expect(shapeToRows(parseShape(rows))).toEqual(rows);
  });

  it('pads ragged rows with blocked cells', () => {
    expect(shapeToRows(parseShape(['...', '.']))).toEqual(['...', '.##']);
  });

  it('returns open 4-neighbours only', () => {
    const s = parseShape(['.#.', '...', '...']);
    expect(neighbors(s, 0).sort()).toEqual([3]);
    expect(neighbors(s, 4).sort()).toEqual([3, 5, 7]);
  });

  it('finds connected components', () => {
    const s = parseShape(['..#..', '..#..']);
    expect(components(s).map((c) => c.length).sort()).toEqual([4, 4]);
  });
});
