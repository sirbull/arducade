import * as Blockly from 'blockly/core';
import { ICONS, type IconName } from './icons';

/** Keep category identity visible through selection, search and theme changes. */
class IconCategory extends Blockly.ToolboxCategory {
  protected override createIconDom_(): Element {
    const badge = document.createElement('span');
    badge.className = 'category-badge';
    badge.setAttribute('aria-hidden', 'true');
    const key = String(this.toolboxItemDef_.categorystyle ?? '').replace(/^ab_/, '') as IconName;
    const img = document.createElement('img');
    img.src = ICONS[key] ?? ICONS.custom;
    img.alt = '';
    badge.append(img);
    return badge;
  }

  protected override addColourBorder_(colour: string): void {
    this.rowDiv_?.style.setProperty('--category-color', colour);
  }

  override setSelected(selected: boolean): void {
    super.setSelected(selected);
    // Blockly's default selection paints the whole row with the block colour.
    // The persistent badge carries that colour; the row uses the page palette.
    if (this.rowDiv_) this.rowDiv_.style.backgroundColor = '';
  }
}

Blockly.registry.register(Blockly.registry.Type.TOOLBOX_ITEM, Blockly.ToolboxCategory.registrationName, IconCategory, true);
