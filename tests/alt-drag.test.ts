// @vitest-environment jsdom
import * as Blockly from 'blockly/core';
import { expect, it } from 'vitest';
import './helpers';
import { defineBlocks } from '../src/blocks/defs';

it('alt + drag copies a shadow value out as a real block and leaves the original', () => {
  defineBlocks();
  const div = document.createElement('div');
  document.body.append(div);
  const ws = Blockly.inject(div, {});
  try {
    const parent = Blockly.serialization.blocks.append({
      type: 'ab_score_set', inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 500 } } } },
    }, ws) as Blockly.BlockSvg;
    const shadow = parent.getInputTargetBlock('VALUE') as Blockly.BlockSvg;
    (ws as unknown as { getGesture(): unknown }).getGesture = () => ({ startBlock: shadow });
    const e = new PointerEvent('pointermove', { altKey: true });
    const dragged = parent.startDrag(e) as Blockly.BlockSvg;
    expect(dragged).not.toBe(parent);
    expect(dragged.isShadow()).toBe(false);
    expect(dragged.getFieldValue('NUM')).toBe(500);
    expect(parent.getInputTargetBlock('VALUE')).toBe(shadow);
    expect(ws.getAllBlocks(false).length).toBe(3);
  } finally { ws.dispose(); }
});
