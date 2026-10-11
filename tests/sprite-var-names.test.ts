// @vitest-environment jsdom
import * as Blockly from 'blockly/core';
import { expect, it } from 'vitest';
import './helpers';
import { defineBlocks } from '../src/blocks/defs';
import { freeSpriteName } from '../src/blocks/sprite-var-names';

const create = { type: 'variables_set', fields: { VAR: { name: 'mySprite' } }, inputs: { VALUE: { block: { type: 'ab_sprite_create' } } } };

it('a new sprite block gets the first name no other block uses', () => {
  defineBlocks();
  const div = document.createElement('div');
  document.body.append(div);
  const ws = Blockly.inject(div, {});
  try {
    const add = () => {
      const b = Blockly.serialization.blocks.append(create, ws);
      freeSpriteName(b);
      return b.getField('VAR')!.getText();
    };
    expect(add()).toBe('mySprite');
    expect(add()).toBe('mySprite2');
    const third = ws.getAllBlocks(false).filter((b) => b.type === 'variables_set')[1];
    third.dispose();
    // mySprite2 is free again, so it is reused instead of making mySprite3.
    expect(add()).toBe('mySprite2');
    expect(add()).toBe('mySprite3');
  } finally { ws.dispose(); }
});

it('dragging the block out of the flyout renames it', () => {
  defineBlocks();
  const div = document.createElement('div');
  document.body.append(div);
  const ws = Blockly.inject(div, {});
  try {
    Blockly.serialization.blocks.append(create, ws);
    const flyoutBlock = Blockly.serialization.blocks.append(create, ws) as Blockly.BlockSvg;
    const strategy = new Blockly.dragging.BlockDragStrategy(flyoutBlock) as unknown as { positionNewBlock(a: Blockly.BlockSvg, b: Blockly.BlockSvg): void };
    strategy.positionNewBlock(flyoutBlock, flyoutBlock);
    expect(flyoutBlock.getField('VAR')!.getText()).toBe('mySprite2');
  } finally { ws.dispose(); }
});
