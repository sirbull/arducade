import * as Blockly from 'blockly/core';
import { t } from '../i18n/i18n';

/**
 * A visible delete target covering the categories and open block palette.
 * Also keeps the palette open until its category or close button is clicked.
 */
export class ToolboxDeleteOverlay extends Blockly.DeleteArea {
  override id = 'toolbox-delete-overlay';
  private overlay = document.createElement('div');
  private closeButton = document.createElement('button');
  private change = (event: Blockly.Events.Abstract) => {
    if (event.type === Blockly.Events.TOOLBOX_ITEM_SELECT || event.type === Blockly.Events.VIEWPORT_CHANGE) this.placeClose();
    if (event.type !== Blockly.Events.BLOCK_DRAG) return;
    const drag = event as Blockly.Events.BlockDrag;
    this.overlay.hidden = !drag.isStart;
    this.overlay.classList.remove('active');
    if (drag.isStart) this.position();
  };

  constructor(private ws: Blockly.WorkspaceSvg) {
    super();
    this.overlay.className = 'toolbox-delete-overlay';
    this.overlay.hidden = true;
    this.overlay.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
    const label = document.createElement('span');
    label.textContent = t('blocks.dropToDelete');
    this.overlay.append(label);
    this.closeButton.className = 'flyout-close';
    this.closeButton.type = 'button';
    this.closeButton.textContent = '×';
    this.closeButton.title = t('ui.close');
    this.closeButton.setAttribute('aria-label', t('ui.close'));
    this.closeButton.hidden = true;
    // Search results open the flyout without a selected category, so hide it directly too.
    this.closeButton.onclick = () => {
      ws.getToolbox()?.clearSelection();
      ws.getFlyout()?.hide();
      this.placeClose();
    };
    ws.getInjectionDiv().append(this.overlay, this.closeButton);
    const flyout = ws.getFlyout();
    if (flyout) flyout.autoClose = false;
    ws.getComponentManager().addComponent({
      component: this,
      capabilities: [Blockly.ComponentManager.Capability.DRAG_TARGET, Blockly.ComponentManager.Capability.DELETE_AREA],
      weight: -1,
    });
    ws.addChangeListener(this.change);
  }

  private width() {
    const toolboxWidth = this.ws.getToolbox()?.getWidth() ?? 0;
    const flyout = this.ws.getFlyout();
    // An auto-closing palette vanishes as the drag starts, after Blockly has
    // cached this rect for the whole drag, so it must not widen the target.
    return toolboxWidth + (flyout?.isVisible() && !flyout.autoClose ? flyout.getWidth() : 0);
  }

  private position() {
    this.overlay.style.width = `${this.width()}px`;
  }

  private placeClose() {
    const flyout = this.ws.getFlyout();
    this.closeButton.hidden = !flyout?.isVisible();
    this.closeButton.style.left = `${this.width() - 34}px`;
  }

  override getClientRect() {
    // Blockly records targets before its asynchronous drag-start event arrives.
    const rect = this.ws.getInjectionDiv().getBoundingClientRect();
    const width = this.width();
    if (!width || !rect.height) return null;
    return new Blockly.utils.Rect(rect.top, rect.bottom, rect.left, rect.left + width);
  }

  override onDragEnter() { this.overlay.classList.toggle('active', this.wouldDelete_); }
  override onDragOver() { this.overlay.classList.toggle('active', this.wouldDelete_); }
  override onDragExit() { this.overlay.classList.remove('active'); }

  dispose() {
    this.ws.removeChangeListener(this.change);
    this.ws.getComponentManager().removeComponent(this.id);
    this.overlay.remove();
    this.closeButton.remove();
  }
}
