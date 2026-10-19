import { adjacency, openCells, type Shape } from './grid';
import { randInt, shuffle, type Rng } from './rng';

export const MIN_PATH = 3;

export interface CoverOptions {
  /** Upper bound on the random target length of each grown path. */
  maxLen?: number;
}

/**
 * Split every open cell into simple paths of length >= MIN_PATH.
 * Returns null if this random attempt failed (caller just retries).
 */
export function randomPathCover(shape: Shape, rng: Rng, opts: CoverOptions = {}): number[][] | null {
  const adj = adjacency(shape);
  const open = openCells(shape);
  const N = shape.blocked.length;
  const maxLen = opts.maxLen ?? Math.max(MIN_PATH, Math.round(Math.sqrt(open.length) * 1.6));
  const owner = new Int32Array(N).fill(-1);
  const paths: number[][] = [];

  const freeDegree = (c: number) => {
    let d = 0;
    for (const n of adj[c]) if (owner[n] < 0) d++;
    return d;
  };

  /** n can extend path `id` at end cell `end` without the path touching itself. */
  const canExtend = (id: number, end: number, n: number) => {
    if (owner[n] >= 0) return false;
    for (const m of adj[n]) if (owner[m] === id && m !== end) return false;
    return true;
  };

  let remaining = open.length;
  while (remaining > 0) {
    // Warnsdorff: start where the fewest free neighbours remain.
    let best: number[] = [];
    let bestDeg = Infinity;
    for (const c of open) {
      if (owner[c] >= 0) continue;
      const d = freeDegree(c);
      if (d < bestDeg) {
        bestDeg = d;
        best = [c];
      } else if (d === bestDeg) best.push(c);
    }
    const start = best[randInt(rng, best.length)];
    const id = paths.length;
    const path = [start];
    owner[start] = id;
    remaining--;
    const target = MIN_PATH + randInt(rng, maxLen - MIN_PATH + 1);

    // Grow from the tail, then from the head once the tail is stuck.
    for (const atTail of [true, false]) {
      while (path.length < target) {
        const end = atTail ? path[path.length - 1] : path[0];
        const cands = adj[end].filter((n) => canExtend(id, end, n));
        if (cands.length === 0) break;
        // Prefer low-degree cells (avoid stranding them), with some randomness.
        shuffle(rng, cands);
        cands.sort((x, y) => freeDegree(x) - freeDegree(y));
        const n = rng() < 0.75 ? cands[0] : cands[randInt(rng, cands.length)];
        owner[n] = id;
        remaining--;
        if (atTail) path.push(n);
        else path.unshift(n);
      }
    }
    paths.push(path);
  }

  return fixShortPaths(paths, adj, owner, rng);
}

/** True if two cells of the path are grid-adjacent without being consecutive. */
export function isSelfTouching(path: number[], adj: number[][]): boolean {
  const pos = new Map<number, number>();
  path.forEach((c, i) => pos.set(c, i));
  for (let i = 0; i < path.length; i++) {
    for (const n of adj[path[i]]) {
      const j = pos.get(n);
      if (j !== undefined && Math.abs(i - j) > 1) return true;
    }
  }
  return false;
}

/** Merge or splice paths shorter than MIN_PATH into neighbours, never creating self-touching paths. */
function fixShortPaths(paths: number[][], adj: number[][], owner: Int32Array, rng: Rng): number[][] | null {
  const live: (number[] | null)[] = paths.slice();
  const reown = (id: number) => live[id]!.forEach((c) => (owner[c] = id));

  for (let guard = 0; guard < paths.length * 4; guard++) {
    const shortIds = live.map((p, i) => (p && p.length < MIN_PATH ? i : -1)).filter((i) => i >= 0);
    if (shortIds.length === 0) break;
    const s = shortIds[randInt(rng, shortIds.length)];
    const stub = live[s]!;
    let fixed = false;

    // 1) Join the stub onto an adjacent path endpoint.
    for (const [stubEnd, stubOriented] of [
      [stub[0], stub.slice().reverse()],
      [stub[stub.length - 1], stub],
    ] as const) {
      for (const n of shuffle(rng, adj[stubEnd].slice())) {
        const q = owner[n];
        if (q === s || q < 0) continue;
        const other = live[q]!;
        let joined: number[];
        if (other[0] === n) joined = [...stubOriented, ...other];
        else if (other[other.length - 1] === n) joined = [...other, ...stubOriented.slice().reverse()];
        else continue;
        if (isSelfTouching(joined, adj)) continue;
        live[q] = joined;
        live[s] = null;
        reown(q);
        fixed = true;
        break;
      }
      if (fixed) break;
    }

    // 2) Splice: split a neighbouring path at the touching cell and attach the stub.
    if (!fixed) {
      for (const stubEnd of [stub[0], stub[stub.length - 1]]) {
        const stubOut = stubEnd === stub[0] ? stub.slice().reverse() : stub; // ends at stubEnd
        for (const n of shuffle(rng, adj[stubEnd].slice())) {
          const q = owner[n];
          if (q === s || q < 0) continue;
          const other = live[q]!;
          const i = other.indexOf(n);
          // Keep other[0..i] + stub, leave other[i+1..] (needs length >= MIN_PATH).
          let kept: number[];
          let rest: number[];
          if (other.length - i - 1 >= MIN_PATH) {
            kept = [...other.slice(0, i + 1), ...stubOut.slice().reverse()];
            rest = other.slice(i + 1);
          } else if (i >= MIN_PATH) {
            kept = [...stubOut, ...other.slice(i)];
            rest = other.slice(0, i);
          } else continue;
          if (isSelfTouching(kept, adj)) continue;
          live[q] = kept;
          live[s] = rest;
          reown(q);
          reown(s);
          fixed = true;
          break;
        }
        if (fixed) break;
      }
    }
    if (!fixed) return null;
  }

  const out = live.filter((p): p is number[] => p !== null);
  return out.every((p) => p.length >= MIN_PATH && !isSelfTouching(p, adj)) ? out : null;
}
