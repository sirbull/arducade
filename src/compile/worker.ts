// Web Worker that runs the compiler, so the editor stays responsive.

import { CompileError, compileGame, type CompileInput, type FileSource } from './avrgcc';

let base = '';

const src: FileSource = {
  async bytes(path) {
    const res = await fetch(base + path);
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return new Uint8Array(await res.arrayBuffer());
  },
  async text(path) {
    const res = await fetch(base + path);
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return res.text();
  },
  async tool(name) {
    const mod = await import(/* @vite-ignore */ `${base}tools/${name}.mjs`);
    return mod.default;
  },
  async wasm(name) {
    return src.bytes(`tools/${name}.wasm`);
  },
};

self.onmessage = async (e: MessageEvent<{ id: number; base: string; input: CompileInput }>) => {
  const { id, input } = e.data;
  base = e.data.base;
  try {
    const out = await compileGame(src, input);
    self.postMessage({ id, ok: true, out });
  } catch (err) {
    const log = err instanceof CompileError ? err.log : [];
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err), log });
  }
};
