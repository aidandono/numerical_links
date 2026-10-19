import { adjacency, type Shape } from './grid';
import type { Pair } from './puzzle';

export interface SolveOptions {
  /**
   * 'fill' (default): count solutions that fill every cell.
   * 'relaxed': count path sets that connect every pair, allowing empty cells,
   * restricted to paths that never touch themselves. Used by the generator to
   * reject boards whose pairs can be connected while leaving gaps: any such
   * alternative can be shortcut into a non-self-touching one, so if the
   * intended (full, non-self-touching) solution is the only relaxed solution,
   * no gap-leaving configuration exists.
   */
  mode?: 'fill' | 'relaxed';
  /** Stop after this many solutions (default 2: enough to decide uniqueness). */
  limit?: number;
  /** Absolute timestamp (performance.now() / Date.now() scale) after which to give up. */
  deadline?: number;
  now?: () => number;
}

export interface SolveResult {
  count: number;
  /** Each solution is one path (cell list, a -> b) per pair. */
  solutions: number[][][];
  /** True if the search hit the deadline; count is then a lower bound. */
  aborted: boolean;
  nodes: number;
}

const EMPTY = -1;
const BLOCKED = -2;

/**
 * Exact solution counter for Flow-style puzzles (all cells must be filled).
 *
 * Paths are extended one cell at a time from each pair's `a` end towards `b`.
 * Every pruning rule below is sound (it only rejects states that have no
 * completion), so the count is exact unless `aborted` is set.
 */
export function countSolutions(shape: Shape, pairs: Pair[], opts: SolveOptions = {}): SolveResult {
  const limit = opts.limit ?? 2;
  const relaxed = opts.mode === 'relaxed';
  const now = opts.now ?? (() => performance.now());
  const deadline = opts.deadline ?? Infinity;

  const N = shape.blocked.length;
  const P = pairs.length;
  const adj = adjacency(shape);
  const result: SolveResult = { count: 0, solutions: [], aborted: false, nodes: 0 };

  const color = new Int16Array(N);
  const headOf = new Int16Array(N).fill(-1);
  const targetOf = new Int16Array(N).fill(-1);
  const head = new Int32Array(P);
  const done = new Uint8Array(P);
  const paths: number[][] = [];
  let emptyCount = 0;
  let activeCount = P;

  for (let c = 0; c < N; c++) {
    color[c] = shape.blocked[c] ? BLOCKED : EMPTY;
    if (!shape.blocked[c]) emptyCount++;
  }
  for (let p = 0; p < P; p++) {
    const { a, b } = pairs[p];
    if (a === b || shape.blocked[a] || shape.blocked[b] || color[a] !== EMPTY || color[b] !== EMPTY) {
      return result; // malformed puzzle: no solutions
    }
    color[a] = p;
    color[b] = p;
    emptyCount -= 2;
    head[p] = a;
    headOf[a] = p;
    targetOf[b] = p;
    paths.push([a]);
  }

  // Scratch buffers reused by analyze().
  const comp = new Int32Array(N);
  const forced = new Int32Array(P);
  const stack = new Int32Array(N);
  let compCount = 0;
  const served: number[] = [];
  const seen = new Int32Array(N);
  let stamp = 0;

  /** Can neighbour cell n still take a connection into an empty cell? */
  const available = (n: number) =>
    color[n] === EMPTY || headOf[n] >= 0 || (targetOf[n] >= 0 && !done[targetOf[n]]);

  /** The pair an available non-empty cell belongs to. */
  const ownerOf = (n: number) => (headOf[n] >= 0 ? headOf[n] : targetOf[n]);

  function labelComponents() {
    comp.fill(-1);
    compCount = 0;
    for (let s = 0; s < N; s++) {
      if (color[s] !== EMPTY || comp[s] >= 0) continue;
      let sp = 0;
      stack[sp++] = s;
      comp[s] = compCount;
      while (sp) {
        const c = stack[--sp];
        for (const n of adj[c]) {
          if (color[n] === EMPTY && comp[n] < 0) {
            comp[n] = compCount;
            stack[sp++] = n;
          }
        }
      }
      compCount++;
    }
  }

  /** Empty cell n can be a later (2nd+) new cell of pair p's path without touching it. */
  const clearOfOwnPath = (p: number, n: number, t: number) => {
    for (const m of adj[n]) if (m !== t && color[m] === p) return false;
    return true;
  };

  /** Relaxed-mode analysis: no fill rules, but paths may not touch themselves. */
  function analyzeRelaxed(): [number, number[]] | null {
    let bestPair = -1;
    let bestMoves: number[] = [];
    for (let p = 0; p < P; p++) {
      if (done[p]) continue;
      const h = head[p];
      const t = pairs[p].b;
      let moves: number[];
      if (adj[h].includes(t)) {
        // Walking past the target would leave a shortcut.
        moves = [t];
      } else {
        moves = [];
        for (const n of adj[h]) {
          if (color[n] !== EMPTY) continue;
          let ok = true;
          for (const m of adj[n]) if (m !== h && m !== t && color[m] === p) ok = false;
          if (ok) moves.push(n);
        }
        if (moves.length === 0) return null;
        // The target must be reachable through cells the path could still use.
        stamp++;
        let sp = 0;
        let reached = false;
        for (const n of moves) {
          seen[n] = stamp;
          stack[sp++] = n;
        }
        while (sp && !reached) {
          const c = stack[--sp];
          for (const m of adj[c]) {
            if (m === t) {
              reached = true;
              break;
            }
            if (color[m] === EMPTY && seen[m] !== stamp && clearOfOwnPath(p, m, t)) {
              seen[m] = stamp;
              stack[sp++] = m;
            }
          }
        }
        if (!reached) return null;
      }
      if (bestPair < 0 || moves.length < bestMoves.length) {
        bestPair = p;
        bestMoves = moves;
      }
    }
    return bestPair < 0 ? null : [bestPair, bestMoves];
  }

  /** Returns [pair, moves] to branch on, or null if the state is dead. */
  function analyze(): [number, number[]] | null {
    if (relaxed) return analyzeRelaxed();
    labelComponents();
    forced.fill(-1);

    // Every empty cell lies in the middle of a path, so needs 2 usable neighbours.
    for (let e = 0; e < N; e++) {
      if (color[e] !== EMPTY) continue;
      let avail = 0;
      let o1 = -1;
      let o2 = -1;
      let h1 = -1;
      for (const n of adj[e]) {
        if (!available(n)) continue;
        avail++;
        if (color[n] !== EMPTY) {
          if (o1 < 0) o1 = ownerOf(n);
          else o2 = ownerOf(n);
          if (headOf[n] >= 0) h1 = headOf[n];
        }
      }
      if (avail < 2) return null;
      if (avail === 2) {
        // Both connections are forced.
        if (o1 >= 0 && o2 >= 0 && o1 !== o2) return null; // would join two different pairs
        if (h1 >= 0) {
          // A head has one free connection, so it must step into e.
          if (forced[h1] >= 0 && forced[h1] !== e) return null;
          forced[h1] = e;
        }
      }
    }

    served.length = compCount;
    served.fill(0);
    let bestPair = -1;
    let bestMoves: number[] = [];

    for (let p = 0; p < P; p++) {
      if (done[p]) continue;
      const h = head[p];
      const t = pairs[p].b;
      const moves: number[] = [];
      let adjTarget = false;
      for (const n of adj[h]) {
        if (n === t) {
          adjTarget = true;
          moves.push(n);
        } else if (color[n] === EMPTY) moves.push(n);
      }
      if (moves.length === 0) return null;

      // The path's interior cells form one connected run of empty cells, so it
      // lives in a single component that borders both its head and its target.
      let reachable = adjTarget;
      for (const n of adj[h]) {
        if (color[n] !== EMPTY) continue;
        const c = comp[n];
        for (const m of adj[t]) {
          if (color[m] === EMPTY && comp[m] === c) {
            reachable = true;
            served[c] = 1;
            break;
          }
        }
      }
      if (!reachable) return null;

      let chosen = moves;
      if (forced[p] >= 0) chosen = [forced[p]];
      if (bestPair < 0 || chosen.length < bestMoves.length) {
        bestPair = p;
        bestMoves = chosen;
      }
    }

    // Every empty component must be fillable by some pair bordering it at both ends.
    for (let c = 0; c < compCount; c++) if (!served[c]) return null;
    return bestPair < 0 ? null : [bestPair, bestMoves];
  }

  let tick = 0;
  function search(): boolean {
    result.nodes++;
    if (++tick >= 512) {
      tick = 0;
      if (now() > deadline) {
        result.aborted = true;
        return true;
      }
    }
    if (activeCount === 0) {
      if (relaxed || emptyCount === 0) {
        result.count++;
        result.solutions.push(paths.map((p) => p.slice()));
        return result.count >= limit;
      }
      return false;
    }
    const a = analyze();
    if (!a) return false;
    const [p, moves] = a;
    const t = pairs[p].b;
    const prevHead = head[p];
    for (const n of moves) {
      headOf[prevHead] = -1;
      paths[p].push(n);
      if (n === t) {
        done[p] = 1;
        activeCount--;
      } else {
        color[n] = p;
        emptyCount--;
        head[p] = n;
        headOf[n] = p;
      }

      const stop = search();

      if (n === t) {
        done[p] = 0;
        activeCount++;
      } else {
        color[n] = EMPTY;
        emptyCount++;
        headOf[n] = -1;
        head[p] = prevHead;
      }
      paths[p].pop();
      headOf[prevHead] = p;
      if (stop) return true;
    }
    return false;
  }

  search();
  return result;
}
