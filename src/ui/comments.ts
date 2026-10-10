import * as Blockly from 'blockly/core';
import { t } from '../i18n/i18n';

/** Square speech bubble shown when a workspace note is collapsed. */
const BUBBLE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2.5 3.5h15v10h-9l-4 3.5v-3.5h-2z" fill="#fff" stroke="#333" stroke-width="1.5"/></svg>');

/** Comments are edited in a reserved column, never over the program. */
export class CommentsPanel {
  private panel = document.getElementById('comments-panel')!;
  private toggle = document.getElementById('btn-comments')!;
  private visible = false;
  private showAll = false;
  /** Notes that were collapsed before "show all", so unticking folds them again. */
  private folded = new Set<string>();
  private timer?: ReturnType<typeof setTimeout>;
  private click = () => this.show(!this.visible);
  private change = (event: Blockly.Events.Abstract) => {
    if (event.type === Blockly.Events.BUBBLE_OPEN) {
      const bubble = event as Blockly.Events.BubbleOpen;
      if (bubble.bubbleType === 'comment' && bubble.isOpen && !this.showAll) {
        this.show(true);
        this.syncBubbles();
      }
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.syncBubbles();
      this.iconifyNotes();
      // Preserve the current edit and cursor until the field loses focus.
      if (!this.panel.contains(document.activeElement)) this.render();
    }, 0);
  };

  constructor(private ws: Blockly.WorkspaceSvg) {
    // Right-click (or long-press) on the background adds a free note.
    if (!Blockly.ContextMenuRegistry.registry.getItem('commentCreate')) Blockly.ContextMenuItems.registerCommentOptions();
    this.toggle.addEventListener('click', this.click);
    this.ws.addChangeListener(this.change);
    this.show(this.toggle.getAttribute('aria-pressed') === 'true');
  }

  dispose() {
    clearTimeout(this.timer);
    this.toggle.removeEventListener('click', this.click);
    this.ws.removeChangeListener(this.change);
  }

  private unfoldNotes() {
    for (const c of this.ws.getTopComments(false) as Blockly.comments.RenderedWorkspaceComment[]) {
      if (this.showAll && c.isCollapsed()) {
        this.folded.add(c.id);
        c.setCollapsed(false);
      } else if (!this.showAll && this.folded.has(c.id)) c.setCollapsed(true);
    }
    if (!this.showAll) this.folded.clear();
  }

  /** Collapsed notes shrink to a speech-bubble icon; tapping it opens the note again. */
  private iconifyNotes() {
    for (const c of this.ws.getTopComments(false) as Blockly.comments.RenderedWorkspaceComment[]) {
      const root = c.getSvgRoot();
      const icon = root.querySelector<SVGImageElement>('.blocklyFoldoutIcon');
      const bar = root.querySelector('.blocklyCommentTopbarBackground');
      if (!icon || !bar) continue;
      icon.dataset.href ??= icon.getAttribute('href') ?? '';
      icon.setAttribute('href', c.isCollapsed() ? BUBBLE : icon.dataset.href);
      // ponytail: Blockly resets this width itself when the note is expanded.
      if (c.isCollapsed()) bar.setAttribute('width', '24');
    }
  }

  /** Block comment bubbles stay hidden unless the user asked to see every comment in the editor. */
  private syncBubbles() {
    for (const block of this.ws.getAllBlocks(false)) {
      const icon = block.getIcon(Blockly.icons.CommentIcon.TYPE) as Blockly.icons.CommentIcon | null;
      if (icon && icon.bubbleIsVisible() !== this.showAll) void icon.setBubbleVisible(this.showAll);
    }
  }

  private show(visible: boolean) {
    this.visible = visible;
    this.panel.hidden = !visible;
    this.toggle.setAttribute('aria-pressed', String(visible));
    this.syncBubbles();
    this.render();
    Blockly.svgResize(this.ws);
  }

  private render() {
    if (!this.visible) return;
    this.panel.replaceChildren();
    const heading = document.createElement('h3');
    heading.textContent = t('comments.toggle');
    const add = document.createElement('button');
    add.textContent = t('comments.add');
    const selected = Blockly.getSelected();
    const block = selected instanceof Blockly.BlockSvg && selected.workspace === this.ws ? selected : null;
    add.disabled = !block;
    add.onclick = () => {
      if (!block) return;
      block.setCommentText(block.getCommentText() ?? '');
      this.render();
      this.panel.querySelector<HTMLTextAreaElement>(`[data-block-id="${CSS.escape(block.id)}"]`)?.focus();
    };
    const all = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = this.showAll;
    box.onchange = () => { this.showAll = box.checked; this.syncBubbles(); this.unfoldNotes(); };
    all.append(box, t('comments.showAll'));
    this.panel.append(heading, all, add);
    let count = 0;
    for (const b of this.ws.getAllBlocks(true)) {
      const inline = b.type === 'ab_comment' || b.type === 'ab_comment_group';
      const icon = b.getIcon(Blockly.icons.CommentIcon.TYPE);
      if (!inline && !icon) continue;
      count++;
      this.card(b.toString(60), inline ? String(b.getFieldValue('TEXT') ?? '') : b.getCommentText() ?? '',
        text => inline ? b.setFieldValue(text, 'TEXT') : b.setCommentText(text),
        () => { this.ws.centerOnBlock(b.id); b.select(); }, b.id);
    }
    for (const c of this.ws.getTopComments(true)) {
      count++;
      this.card(t('comments.toggle'), c.getText(), text => c.setText(text));
    }
    if (!count) {
      const hint = document.createElement('p');
      hint.className = 'muted small';
      hint.textContent = t('comments.empty');
      this.panel.append(hint);
    }
  }

  private card(label: string, value: string, save: (text: string) => void, locate?: () => void, id?: string) {
    const card = document.createElement('div');
    card.className = 'comment-card';
    const title = document.createElement(locate ? 'button' : 'div');
    title.textContent = label;
    if (locate) title.addEventListener('click', locate);
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('aria-label', label);
    if (id) input.dataset.blockId = id;
    input.addEventListener('input', () => save(input.value));
    input.addEventListener('blur', () => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.render(), 0);
    });
    card.append(title, input);
    this.panel.append(card);
  }
}
