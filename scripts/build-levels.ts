/**
 * Turn the pregenerated puzzles in puzzles/*.json into level packs (one per size; the files'
 * `difficulty` field is ignored):
 * src/levels/packs.json (index, loaded up front) and src/levels/data/<packId>.json (lazy-loaded boards).
 * Run with `npm run levels` after changing puzzles/.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { levelId, type RawLevel } from '../src/levels/raw';

const SRC = 'puzzles';
const OUT = 'src/levels';

const puzzles: RawLevel[] = readdirSync(SRC)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(SRC, f), 'utf8')) as RawLevel[]);

const groups = new Map<number, RawLevel[]>();
for (const p of puzzles) groups.set(p.size, [...(groups.get(p.size) ?? []), p]);

const packs = [...groups.entries()]
  .sort(([a], [b]) => a - b)
  .map(([size, levels]) => {
    levels.sort((a, b) => (a.score ?? 0) - (b.score ?? 0) || a.seed - b.seed);
    return { id: `${size}x${size}`, size, levels };
  });

rmSync(join(OUT, 'data'), { recursive: true, force: true });
mkdirSync(join(OUT, 'data'), { recursive: true });
for (const pack of packs) {
  const slim = pack.levels.map(({ size, seed, score, board, solution }) => ({
    size,
    seed,
    score,
    board,
    solution,
  }));
  writeFileSync(join(OUT, 'data', `${pack.id}.json`), JSON.stringify(slim));
  console.log(`${pack.id.padEnd(6)} ${pack.levels.length}`);
}
const index = packs.map(({ id, size, levels }) => ({
  id,
  size,
  levelIds: levels.map((l) => levelId(l.board)),
}));
writeFileSync(join(OUT, 'packs.json'), JSON.stringify(index));
console.log(`${packs.length} packs, ${puzzles.length} levels`);
