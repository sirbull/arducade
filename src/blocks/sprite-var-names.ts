import * as Blockly from 'blockly/core';

// Like MakeCode Arcade: a "set mySprite to sprite" dragged from the toolbox
// gets the first free name (mySprite, mySprite2, ...) so a new sprite does not
// overwrite one already in use. A name no block uses any more is taken again,
// so dragging out and deleting blocks does not pile up variables.
export function registerSpriteVarNames() {
  const proto = Blockly.dragging.BlockDragStrategy.prototype as unknown as {
    positionNewBlock(oldBlock: Blockly.BlockSvg, newBlock: Blockly.BlockSvg): void;
  };
  const positionNewBlock = proto.positionNewBlock;
  proto.positionNewBlock = function (oldBlock, newBlock) {
    positionNewBlock.call(this, oldBlock, newBlock);
    freeSpriteName(newBlock);
  };
}

/** Gives a new sprite creation block a variable no other block uses. */
export function freeSpriteName(block: Blockly.Block) {
  if (block.type !== 'variables_set' || block.getInputTargetBlock('VALUE')?.type !== 'ab_sprite_create') return;
  const ws = block.workspace;
  const field = block.getField('VAR') as Blockly.FieldVariable;
  const own = new Set(block.getDescendants(false));
  const used = (name: string) => {
    const v = ws.getVariableMap().getVariable(name, '');
    return !!v && Blockly.Variables.getVariableUsesById(ws, v.getId()).some((b) => !own.has(b));
  };
  const name = field.getVariable()?.getName() ?? 'mySprite';
  if (!used(name)) return;
  const base = name.replace(/\d+$/, '');
  let i = 2;
  while (used(base + i)) i++;
  const v = ws.getVariableMap().getVariable(base + i, '') ?? ws.getVariableMap().createVariable(base + i, '');
  field.setValue(v.getId());
}
