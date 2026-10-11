// Direct touch-friendly controls, retaining Blockly's text_join saved format.
import * as Blockly from 'blockly/core';

interface JoinBlock extends Blockly.Block {
  itemCount_: number;
  updateShape_(): void;
  changeItems(delta: number): void;
  saveExtraState(): { itemCount: number };
}

const icon = (minus: boolean) => 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect x="1" y="1" width="30" height="30" fill="#fff" stroke="#222"/><path d="M8 16h16${minus ? '' : 'M16 8v16'}" stroke="#222" stroke-width="2"/></svg>`,
);

class JoinButton extends Blockly.FieldImage {
  constructor(minus: boolean, action: () => void) {
    super(icon(minus), 32, 32, Blockly.Msg[minus ? 'AB_TEXT_REMOVE' : 'AB_TEXT_ADD'], action);
  }
  override initView() {
    super.initView();
    const root = this.getSvgRoot();
    if (!root) return;
    root.setAttribute('role', 'button');
    root.setAttribute('tabindex', '0');
    root.setAttribute('aria-label', this.getText());
    root.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        this.showEditor_();
      }
    });
  }
}

export function registerTextJoin() {
  Blockly.Blocks.text_join = {
    init(this: JoinBlock) {
      this.itemCount_ = 2;
      this.setStyle('text_blocks');
      this.setOutput(true, 'String');
      this.setInputsInline(true);
      this.setTooltip(Blockly.Msg.AB_TEXT_JOIN_TOOLTIP);
      this.appendDummyInput('CONTROLS')
        .appendField(new JoinButton(false, () => this.changeItems(1)), 'PLUS')
        .appendField(new JoinButton(true, () => this.changeItems(-1)), 'MINUS');
      this.updateShape_();
    },
    saveExtraState(this: JoinBlock) { return { itemCount: this.itemCount_ }; },
    loadExtraState(this: JoinBlock, state: { itemCount?: number }) {
      // Preserve legacy zero/one-input blocks; newly edited blocks have at least two.
      this.itemCount_ = Math.max(0, Math.min(64, Math.trunc(Number(state.itemCount) || 0)));
      this.updateShape_();
    },
    mutationToDom(this: JoinBlock) {
      const el = Blockly.utils.xml.createElement('mutation');
      el.setAttribute('items', String(this.itemCount_));
      return el;
    },
    domToMutation(this: JoinBlock, el: Element) {
      this.itemCount_ = Math.max(0, Math.min(64, Number(el.getAttribute('items')) || 0));
      this.updateShape_();
    },
    changeItems(this: JoinBlock, delta: number) {
      const count = Math.max(2, Math.min(64, this.itemCount_ + delta));
      if (count === this.itemCount_) return;
      const group = Blockly.Events.getGroup();
      Blockly.Events.setGroup(group || true);
      try {
        const before = JSON.stringify(this.saveExtraState());
        this.itemCount_ = count;
        this.updateShape_();
        Blockly.Events.fire(new Blockly.Events.BlockChange(this, 'mutation', null, before, JSON.stringify(this.saveExtraState())));
      } finally { Blockly.Events.setGroup(group); }
    },
    updateShape_(this: JoinBlock) {
      for (let i = 0; i < this.itemCount_; i++) {
        if (!this.getInput(`ADD${i}`)) {
          const input = this.appendValueInput(`ADD${i}`).setCheck(['String', 'Number', 'Boolean']);
          if (i === 0) input.appendField(Blockly.Msg.TEXT_JOIN_TITLE_CREATEWITH);
          this.moveInputBefore(`ADD${i}`, 'CONTROLS');
        }
      }
      for (let i = this.itemCount_; this.getInput(`ADD${i}`); i++) {
        // Keep real child blocks on the workspace when an input is removed.
        const child = this.getInputTargetBlock(`ADD${i}`);
        if (child && !child.isShadow()) child.unplug();
        this.removeInput(`ADD${i}`);
      }
    },
  };
}
