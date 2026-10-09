// Starts the compiler worker and sends it games to compile.

import type { CompileInput, CompileOutput } from './avrgcc';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (o: CompileOutput) => void; reject: (e: Error & { log?: string[] }) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; out?: CompileOutput; error?: string; log?: string[] }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok && e.data.out) p.resolve(e.data.out);
    else p.reject(Object.assign(new Error(e.data.error ?? 'Compile failed'), { log: e.data.log ?? [] }));
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'Compiler crashed'));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

/** Folder with the compiler files, next to the page. */
function compilerBase(): string {
  return new URL('compiler/', document.baseURI).href;
}

export function compileInWorker(input: CompileInput): Promise<CompileOutput> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, base: compilerBase(), input });
  });
}
