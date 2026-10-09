import * as Blockly from 'blockly/core';
import { expect, it } from 'vitest';
import './helpers';
import { searchBlocks } from '../src/blocks/search';
import { Engine } from '../src/sim/engine';
import { workspaceToIR } from '../src/blocks/toIR';

it('finds all sprite blocks by category and map by block text', () => {
  const workspace = { getToolboxCategoryCallback: () => undefined } as unknown as Blockly.WorkspaceSvg;
  expect(searchBlocks('sprites', workspace)).toHaveLength(23);
  expect(searchBlocks('map', workspace).some((entry) => entry.type === 'ab_map')).toBe(true);
  expect(searchBlocks('nothing matches this', workspace)).toEqual([]);
});

it('maps ranges using wide intermediates and integer results', () => {
  const map = Engine.prototype.mapValue;
  expect(map(0, 0, 1024, 0, 100)).toBe(0);
  expect(map(512, 0, 1024, 0, 100)).toBe(50);
  expect(map(1024, 0, 1024, 0, 100)).toBe(100);
  expect(map(512, 1024, 0, 0, 100)).toBe(50);
  expect(map(1, 0, 3, 0, 100)).toBe(33);
  expect(map(2048, 0, 1024, 0, 100)).toBe(200);
  expect(map(10, 1, 1, 20, 30)).toBe(20);
  expect(map(32767, -32768, 32767, -32768, 32767)).toBe(32767);
});

it('converts map blocks into the shared math API', () => {
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [{
      type: 'ab_on_start', inputs: { DO: { block: { type: 'variables_set', fields: { VAR: { name: 'mapped' } }, inputs: { VALUE: { block: { type: 'ab_map' } } } } } },
    }] } }, ws);
    const result = workspaceToIR(ws);
    expect(JSON.stringify(result.program)).toContain('math.map');
    expect(result.diagnostics.filter((d) => d.level === 'error')).toEqual([]);
  } finally { ws.dispose(); }
});
