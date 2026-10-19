import { components, parseShape, rectShape, type Shape } from './grid';
import { MIN_PATH } from './cover';
import { mulberry32 } from './rng';

export interface Preset {
  id: string;
  label: string;
  make: (seed: number) => Shape;
}

function randomHoles(n: number, density: number, seed: number): Shape {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const s = rectShape(n, n);
  for (let i = 0; i < n * n; i++) if (rng() < density) s.blocked[i] = true;
  // Regions too small to hold a path can never be filled: block them too.
  for (const comp of components(s)) if (comp.length < MIN_PATH) comp.forEach((c) => (s.blocked[c] = true));
  return s;
}

export const PRESETS: Preset[] = [
  ...[5, 6, 7, 8, 9, 10].map((n) => ({ id: `rect${n}`, label: `${n}×${n}`, make: () => rectShape(n, n) })),
  {
    id: 'plus',
    label: 'Plus',
    make: () =>
      parseShape(['##....##', '##....##', '........', '........', '........', '........', '##....##', '##....##']),
  },
  {
    id: 'donut',
    label: 'Donut',
    make: () =>
      parseShape(['........', '........', '........', '...##...', '...##...', '........', '........', '........']),
  },
  {
    id: 'L',
    label: 'L shape',
    make: () =>
      parseShape(['....####', '....####', '....####', '....####', '........', '........', '........', '........']),
  },
  { id: 'holes8', label: 'Random holes 8×8', make: (seed) => randomHoles(8, 0.1, seed) },
  { id: 'holes10', label: 'Random holes 10×10', make: (seed) => randomHoles(10, 0.1, seed) },
];
