import * as Blockly from 'blockly/core';
import { expect, it } from 'vitest';
import './helpers';
import { workspaceToIR } from '../src/blocks/toIR';

it('keeps comment groups transparent to execution and preserves their text on save', () => {
  const ws = new Blockly.Workspace();
  try {
    const start = ws.newBlock('ab_on_start');
    const group = ws.newBlock('ab_comment_group');
    group.setFieldValue('Set the starting score\nThen continue', 'TEXT');
    const score = ws.newBlock('ab_score_set');
    const note = ws.newBlock('ab_comment');
    note.setFieldValue('Next step', 'TEXT');
    start.getInput('DO')!.connection!.connect(group.previousConnection!);
    group.getInput('DO')!.connection!.connect(score.previousConnection!);
    group.nextConnection!.connect(note.previousConnection!);
    const state = Blockly.serialization.workspaces.save(ws);
    ws.clear();
    Blockly.serialization.workspaces.load(state, ws);
    const result = workspaceToIR(ws);
    expect(result.diagnostics).toEqual([]);
    expect(result.program.events[0].body.map(s => s.k)).toEqual(['comment', 'expr', 'comment']);
    expect(result.program.events[0].body[0]).toMatchObject({text:'Set the starting score\nThen continue'});
  } finally { ws.dispose(); }
});
