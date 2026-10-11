// An (i) on every block in the toolbox, and "About this block" in the block
// context menu (right click or long press). Both open the documentation for
// the block.

import * as Blockly from 'blockly/core';
import { FavouriteIcon } from './favourites';
import { t } from '../i18n/i18n';

let openInfo: (type: string) => void = () => {};

export function setBlockInfoHandler(fn: (type: string) => void) {
  openInfo = fn;
}

/** The block the documentation is about. "set mySprite to (sprite)" is about the sprite block. */
export function docSubject(block: Blockly.Block): string {
  const value = block.type === 'variables_set' ? block.getInputTargetBlock('VALUE') : null;
  return value?.type.startsWith('ab_') ? value.type : block.type;
}

// Large enough to hit with a finger in the scaled down toolbox.
const SIZE = 20;

class InfoIcon extends Blockly.icons.Icon {
  static readonly TYPE = new Blockly.icons.IconType<InfoIcon>('ab_info');

  override getType() {
    return InfoIcon.TYPE;
  }

  override initView(pointerdownListener: (e: PointerEvent) => void) {
    if (this.svgRoot) return;
    super.initView(pointerdownListener);
    const { createSvgElement } = Blockly.utils.dom;
    createSvgElement('circle', { cx: SIZE / 2, cy: SIZE / 2, r: SIZE / 2 - 1, fill: 'none', stroke: '#fff', 'stroke-width': 1.6 }, this.svgRoot);
    createSvgElement('rect', { x: 9, y: 4.5, width: 2, height: 2, fill: '#fff' }, this.svgRoot);
    createSvgElement('rect', { x: 9, y: 8, width: 2, height: 7.5, fill: '#fff' }, this.svgRoot);
    this.setTooltip(t('docs.aboutBlock'));
  }

  override getSize() {
    return new Blockly.utils.Size(SIZE, SIZE);
  }

  override isShownWhenCollapsed() {
    return true;
  }

  override isClickableInFlyout() {
    return true;
  }

  override onClick() {
    openInfo(docSubject(this.sourceBlock));
  }
}

class InfoFlyoutInflater extends Blockly.BlockFlyoutInflater {
  override createBlock(definition: Blockly.utils.toolbox.BlockInfo, workspace: Blockly.WorkspaceSvg): Blockly.BlockSvg {
    const block = super.createBlock(definition, workspace);
    block.addIcon(new InfoIcon(block));
    if (workspace.targetWorkspace) block.addIcon(new FavouriteIcon(block, definition, workspace.targetWorkspace));
    return block;
  }
}

/** Section labels have real SVG rules above and below their category name. */
class SectionLabelInflater extends Blockly.LabelFlyoutInflater {
  override load(state: object, flyout: Parameters<Blockly.LabelFlyoutInflater['load']>[1]) {
    const item = super.load(state, flyout);
    if ((state as Record<string, unknown>)['web-class'] === 'ab-favourite-heading') {
      const label = item.getElement() as Blockly.FlyoutButton;
      const root = label.getSvgRoot();
      for (const y of [0, label.height]) Blockly.utils.dom.createSvgElement('line',
        { x1: 0, x2: Math.max(220, label.width), y1: y, y2: y, stroke: '#999', 'stroke-width': 1 }, root);
      label.width = Math.max(220, label.width);
    }
    return item;
  }
}

let registered = false;

export function registerBlockInfo() {
  if (registered) return;
  registered = true;
  Blockly.registry.register(Blockly.registry.Type.FLYOUT_INFLATER, 'block', InfoFlyoutInflater, true);
  Blockly.registry.register(Blockly.registry.Type.FLYOUT_INFLATER, 'label', SectionLabelInflater, true);
  // Blockly's own Help item opens web pages for some blocks only.
  const menu = Blockly.ContextMenuRegistry.registry;
  if (menu.getItem('blockHelp')) menu.unregister('blockHelp');
  menu.register({
    id: 'blockHelp',
    scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    weight: 7,
    displayText: () => t('docs.aboutBlock'),
    preconditionFn: () => 'enabled',
    callback: (scope) => {
      if (scope.block) openInfo(docSubject(scope.block));
    },
  });
}
