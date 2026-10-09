import * as Blockly from 'blockly/core';
import { expect, it } from 'vitest';
import { FieldMultilineInput } from '@blockly/field-multilineinput';
import { compileProject } from './helpers';
import { newProject } from '../src/project/model';

it('provides an editable multiline C++ field and preserves code through save and generation', () => {
  const ws = new Blockly.Workspace();
  try {
    const event = ws.newBlock('ab_on_start');
    const block = ws.newBlock('ab_cpp');
    expect(block.getField('CODE')).toBeInstanceOf(FieldMultilineInput);
    expect(block.getField('CODE')?.EDITABLE).toBe(true);
    const code = 'int customValue = 42;\ncustomValue += 1;';
    block.setFieldValue(code, 'CODE');
    event.getInput('DO')!.connection!.connect(block.previousConnection!);
    const project = newProject('Custom code');
    project.blocks = Blockly.serialization.workspaces.save(ws);
    const result = compileProject(project);
    expect(result.cpp.code).toContain('int customValue = 42;');
    expect(result.cpp.code).toContain('customValue += 1;');
    const restored = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(project.blocks as object, restored);
      expect(restored.getBlocksByType('ab_cpp', false)[0].getFieldValue('CODE')).toBe(code);
    } finally { restored.dispose(); }
  } finally { ws.dispose(); }
});
