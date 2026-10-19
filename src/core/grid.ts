export interface Shape {
  width: number;
  height: number;
  blocked: boolean[];
}

export function rectShape(width: number, height: number): Shape {
  return { width, height, blocked: new Array(width * height).fill(false) };
}

/** Parse an ASCII shape: one string per row, '#' = blocked, anything else = open. */
export function parseShape(rows: string[]): Shape {
  const height = rows.length;
  if (height === 0) throw new Error('Shape has no rows');
  const width = Math.max(...rows.map((r) => r.length));
  if (width === 0) throw new Error('Shape has no columns');
  const blocked: boolean[] = [];
  for (const row of rows) {
    for (let x = 0; x < width; x++) blocked.push(x >= row.length || row[x] === '#');
  }
  return { width, height, blocked };
}

export function shapeToRows(shape: Shape): string[] {
  const rows: string[] = [];
  for (let y = 0; y < shape.height; y++) {
    let r = '';
    for (let x = 0; x < shape.width; x++) r += shape.blocked[y * shape.width + x] ? '#' : '.';
    rows.push(r);
  }
  return rows;
}

export function isOpen(shape: Shape, cell: number): boolean {
  return cell >= 0 && cell < shape.blocked.length && !shape.blocked[cell];
}

/**
 * Open 4-neighbours of a cell. Every algorithm goes through this (or the
 * precomputed adjacency below), so walls/warps can be added here later.
 */
export function neighbors(shape: Shape, cell: number): number[] {
  const { width, height } = shape;
  const x = cell % width;
  const y = (cell - x) / width;
  const out: number[] = [];
  if (y > 0 && !shape.blocked[cell - width]) out.push(cell - width);
  if (x < width - 1 && !shape.blocked[cell + 1]) out.push(cell + 1);
  if (y < height - 1 && !shape.blocked[cell + width]) out.push(cell + width);
  if (x > 0 && !shape.blocked[cell - 1]) out.push(cell - 1);
  return out;
}

/** Precomputed adjacency list for all cells (empty for blocked cells). */
export function adjacency(shape: Shape): number[][] {
  return shape.blocked.map((b, c) => (b ? [] : neighbors(shape, c)));
}

export function openCells(shape: Shape): number[] {
  const out: number[] = [];
  shape.blocked.forEach((b, c) => {
    if (!b) out.push(c);
  });
  return out;
}

/** Connected components of open cells. */
export function components(shape: Shape): number[][] {
  const seen = new Uint8Array(shape.blocked.length);
  const comps: number[][] = [];
  for (const start of openCells(shape)) {
    if (seen[start]) continue;
    const comp: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      comp.push(c);
      for (const n of neighbors(shape, c)) {
        if (!seen[n]) {
          seen[n] = 1;
          stack.push(n);
        }
      }
    }
    comps.push(comp);
  }
  return comps;
}
