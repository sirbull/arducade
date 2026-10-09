import * as Blockly from 'blockly/core';

// Alt + drag drags a copy and leaves the original in place. A text or number
// shadow (normally stuck in its input) comes out as a real block with its value.
// Cmd/Ctrl + drag (only this block, the rest of the stack stays) is built
// into Blockly's BlockDragStrategy.
export function registerAltDrag() {
  const proto = Blockly.dragging.BlockDragStrategy.prototype as unknown as {
    block: Blockly.BlockSvg;
    startDrag(e?: PointerEvent | KeyboardEvent): Blockly.IDraggable;
  };
  const startDrag = proto.startDrag;
  // The copy's own startDrag comes back here with Alt still held.
  let copying = false;
  proto.startDrag = function (e) {
    const ws = this.block.workspace;
    if (copying || !(e instanceof PointerEvent) || !e.altKey || ws.isFlyout) return startDrag.call(this, e);
    // The gesture swaps a shadow for its parent; startBlock is what was clicked.
    // ponytail: startBlock is private in Blockly, falls back to the dragged block.
    const clicked = ((ws.getGesture(e) as unknown as { startBlock?: Blockly.BlockSvg } | null)?.startBlock) ?? this.block;
    if (!clicked.isDuplicatable()) return startDrag.call(this, e);
    const state = Blockly.serialization.blocks.save(clicked, { addNextBlocks: false, saveIds: false })!;
    const copy = Blockly.serialization.blocks.append(state, ws) as Blockly.BlockSvg;
    copy.render();
    copy.moveTo(clicked.getRelativeToSurfaceXY());
    copy.bringToFront();
    copying = true;
    try { return copy.startDrag(e); } finally { copying = false; }
  };
}
