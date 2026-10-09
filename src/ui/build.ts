// Turns a project into C++ and simulator code.

import * as Blockly from 'blockly/core';
import { getAssetProject, setAssetProject } from '../blocks/assets';
import { workspaceToIR } from '../blocks/toIR';
import { generateCpp, type CppResult } from '../gen/cpp';
import { generateJs, type GameHooks, type JsResult } from '../gen/js';
import type { Diagnostic, Program } from '../ir/ir';
import type { Project } from '../project/model';
import { parseSource } from '../text/languages';
import { Engine } from '../sim/engine';
import { PIXEL_RGB, type PixelColor } from '../sim/runner';
import { div16, mod16 } from '../sim/intmath';

export interface BuildResult {
  program: Program;
  cpp: CppResult;
  js: JsResult;
  diagnostics: Diagnostic[];
}

export function buildWorkspace(ws: Blockly.Workspace, project: Project): BuildResult {
  let ir: {program: Program; diagnostics: Diagnostic[]};
  try {
    ir = project.source ? {program: parseSource(project.source.code, project.source.language, project), diagnostics: []} : workspaceToIR(ws);
  } catch (error) {
    ir = {program: {vars: [], funcs: [], events: []}, diagnostics: [{level: 'error', key: 'code.sourceError', params: {detail: error instanceof Error ? error.message : String(error)}}]};
  }
  const cpp = generateCpp(ir.program, project);
  const js = generateJs(ir.program, project);
  const seen = new Set<string>();
  const diagnostics = [...ir.diagnostics, ...cpp.diagnostics].filter((d) => {
    const key = `${d.key}|${d.id}|${JSON.stringify(d.params ?? {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { program: ir.program, cpp, js, diagnostics };
}

/** Builds a project without showing it, using a hidden workspace. */
export function buildProject(project: Project): BuildResult {
  const previous = getAssetProject();
  setAssetProject(project);
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(project.blocks as object, ws, { recordUndo: false });
    return buildWorkspace(ws, project);
  } finally {
    ws.dispose();
    setAssetProject(previous);
  }
}

/** Runs a game for a moment without a screen and returns a picture of it. */
export async function gameThumbnail(project: Project, frames = 45, pixelColor: PixelColor = project.pixelColor ?? 'white'): Promise<string> {
  const { js } = buildProject(project);
  let last = new Uint8Array(1024);
  const engine = new Engine({
    show: (b) => (last = b.slice()),
    tone: () => {},
    storage: { read: () => 0, write: () => {} },
    onSkippedCpp: () => {},
    maxSprites: 16,
    hiscoreMagic: js.hiscoreKey,
  });
  const run = async () => {
    const factory = new Function('E', '$w', '$div', '$mod', '$lg', js.code) as (...a: unknown[]) => GameHooks;
    await engine.begin(factory(engine, (v: number) => (v << 16) >> 16, div16, mod16, engine.loopGuard));
    for (let i = 0; i < frames; i++) await engine.frame(true);
  };
  // A game waiting for a button (splash) must not block the gallery.
  await Promise.race([run().catch(() => {}), new Promise((r) => setTimeout(r, 300))]);
  engine.stop();
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(128, 64);
  const [r, g, b] = PIXEL_RGB[pixelColor] ?? PIXEL_RGB.white;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 128; x++) {
      const on = (last[(y >> 3) * 128 + x] >> (y & 7)) & 1;
      const i = (y * 128 + x) * 4;
      img.data[i] = on ? r : 0;
      img.data[i + 1] = on ? g : 0;
      img.data[i + 2] = on ? b : 0;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}
