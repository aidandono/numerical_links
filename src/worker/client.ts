import type { Shape } from '../core/grid';
import type { WorkerRequest, WorkerResponse } from './generator.worker';

let current: { worker: Worker; reject: (e: Error) => void } | null = null;

/** Generate a puzzle off the main thread. Starting a new request cancels the previous one. */
export function generateInWorker(shape: Shape, seed: number, budgetMs = 5000): Promise<WorkerResponse> {
  cancelGeneration();
  const worker = new Worker(new URL('./generator.worker.ts', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    current = { worker, reject };
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      worker.terminate();
      if (current?.worker === worker) current = null;
      resolve(e.data);
    };
    worker.onerror = (e) => {
      worker.terminate();
      if (current?.worker === worker) current = null;
      reject(new Error(e.message || 'Worker failed'));
    };
    const req: WorkerRequest = { type: 'generate', shape, seed, budgetMs };
    worker.postMessage(req);
  });
}

export function cancelGeneration() {
  if (!current) return;
  current.worker.terminate();
  current.reject(new Error('cancelled'));
  current = null;
}
