import * as Blockly from 'blockly/core';
import { t } from '../i18n/i18n';

/**
 * A visible delete target covering only the categories during block drags.
 * Temporarily hides the palette while keeping its contents and scroll position.
 */
export class ToolboxDeleteOverlay extends Blockly.DeleteArea {
  override id = 'toolbox-delete-overlay';
  private overlay = document.createElement('div');
  private closeButton = document.createElement('button');
  private restorePalette = false;
  private originalFlyoutRect?: Blockly.Flyout['getClientRect'];
  private change = (event: Blockly.Events.Abstract) => {
    if (event.type === Blockly.Events.TOOLBOX_ITEM_SELECT || event.type === Blockly.Events.VIEWPORT_CHANGE) this.placeClose();
    if (event.type !== Blockly.Events.BLOCK_DRAG) return;
    const drag = event as Blockly.Events.BlockDrag;
    this.overlay.hidden = !drag.isStart;
    this.overlay.classList.remove('active');
    const flyout = this.ws.getFlyout() as Blockly.Flyout | null;
    if (drag.isStart) {
      this.restorePalette = flyout?.isVisible() ?? false;
      if (this.restorePalette) flyout?.setVisible(false);
      this.position();
    } else {
      if (this.restorePalette) flyout?.setVisible(true);
      this.restorePalette = false;
    }
    this.placeClose();
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
    const flyout = ws.getFlyout() as Blockly.Flyout | null;
    if (flyout) {
      flyout.autoClose = false;
      // Targets are cached before BLOCK_DRAG fires. The open palette must
      // never reserve a delete area over the space freed during the drag.
      this.originalFlyoutRect = flyout.getClientRect;
      flyout.getClientRect = () => null;
    }
    ws.getComponentManager().addComponent({
      component: this,
      capabilities: [Blockly.ComponentManager.Capability.DRAG_TARGET, Blockly.ComponentManager.Capability.DELETE_AREA],
      weight: -1,
    });
    ws.addChangeListener(this.change);
  }

  private width() {
    return this.ws.getToolbox()?.getWidth() ?? 0;
  }

  private position() {
    this.overlay.style.width = `${this.width()}px`;
  }

  private placeClose() {
    const flyout = this.ws.getFlyout() as Blockly.Flyout | null;
    this.closeButton.hidden = !flyout?.isVisible();
    this.closeButton.style.left = `${this.width() + (flyout?.getWidth() ?? 0) - 34}px`;
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
    const flyout = this.ws.getFlyout() as Blockly.Flyout | null;
    if (flyout && this.originalFlyoutRect) flyout.getClientRect = this.originalFlyoutRect;
    if (this.restorePalette) flyout?.setVisible(true);
    this.ws.removeChangeListener(this.change);
    this.ws.getComponentManager().removeComponent(this.id);
    this.overlay.remove();
    this.closeButton.remove();
  }
}
