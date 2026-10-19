import { rectShape } from '../src/core/grid';
import { generate } from '../src/core/generator';

const sizes = process.argv.slice(2).map(Number);
for (const n of sizes.length ? sizes : [5, 7, 8, 10]) {
  const times: number[] = [];
  let fails = 0;
  let pairs = 0;
  const runs = 30;
  for (let seed = 1; seed <= runs; seed++) {
    const t0 = performance.now();
    const res = generate(rectShape(n, n), { seed, budgetMs: 10000 });
    times.push(performance.now() - t0);
    if (!res.ok) fails++;
    else pairs += res.puzzle.pairs.length;
  }
  times.sort((a, b) => a - b);
  const q = (f: number) => times[Math.min(times.length - 1, Math.floor(f * times.length))].toFixed(0);
  console.log(`${n}x${n}: p50=${q(0.5)}ms p95=${q(0.95)}ms max=${q(1)}ms fails=${fails}/${runs} avgPairs=${(pairs / (runs - fails)).toFixed(1)}`);
}
