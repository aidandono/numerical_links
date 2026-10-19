import { generate } from '../core/generator';
import type { Shape } from '../core/grid';

export type WorkerRequest = { type: 'generate'; shape: Shape; seed: number; budgetMs: number };
export type WorkerResponse = ReturnType<typeof generate>;

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { shape, seed, budgetMs } = e.data;
  let res: WorkerResponse;
  try {
    res = generate(shape, { seed, budgetMs });
  } catch (err) {
    res = { ok: false, reason: `Generator error: ${(err as Error).message}`, attempts: 0 };
  }
  self.postMessage(res);
};
