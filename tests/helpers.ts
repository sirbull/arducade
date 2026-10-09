import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as En from 'blockly/msg/en';
import en from '../public/locales/en.json';
import { setAssetProject } from '../src/blocks/assets';
import { defineBlocks } from '../src/blocks/defs';
import { workspaceToIR } from '../src/blocks/toIR';
import { generateCpp } from '../src/gen/cpp';
import { generateJs } from '../src/gen/js';
import type { Project } from '../src/project/model';

Blockly.setLocale(En as unknown as Record<string, string>);
Object.assign(Blockly.Msg, en.blocks);
defineBlocks();

/** Loads a project into a headless workspace and generates both outputs. */
export function compileProject(project: Project) {
  setAssetProject(project);
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(project.blocks as object, ws);
  const ir = workspaceToIR(ws);
  const cpp = generateCpp(ir.program, project);
  const js = generateJs(ir.program, project);
  ws.dispose();
  return { ir, cpp, js };
}
