import * as Blockly from 'blockly/core';
import { PIANO_SVG } from '../ui/piano-icon';
import { t } from '../i18n/i18n';
import { openMelodyRecorder } from '../ui/melody-recorder';

class RecorderField extends Blockly.FieldImage {
  constructor() { super('data:image/svg+xml,' + encodeURIComponent(PIANO_SVG), 32, 32, t('music.keyboard'), field => (field as RecorderField).open()); }
  override initView() {
    super.initView();
    const root = this.getSvgRoot();
    root?.setAttribute('tabindex','0'); root?.setAttribute('role','button'); root?.setAttribute('aria-label',t('music.keyboard'));
    root?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); this.open(); } });
  }
  open() {
    const block = this.getSourceBlock(); if (!block) return;
    const tempo = block.getInputTargetBlock('TEMPO');
    const bpm = tempo?.type === 'math_number' ? Number(tempo.getFieldValue('NUM')) : 120;
    openMelodyRecorder(String(block.getFieldValue('NOTES') ?? ''), bpm, (notes, newTempo) => {
      if (block.isDisposed()) return;
      Blockly.Events.setGroup(true);
      try { block.setFieldValue(notes,'NOTES'); if (tempo?.type === 'math_number') tempo.setFieldValue(String(newTempo),'NUM'); }
      finally { Blockly.Events.setGroup(false); }
    });
  }
}
export function registerMelodyRecorder() {
  Blockly.Extensions.register('ab_melody_recorder', function(this: Blockly.Block) { this.inputList[0].appendField(new RecorderField(), 'RECORDER'); });
  Blockly.ContextMenuRegistry.registry.register({
    id: 'abRecordMelody', scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK, weight: 6,
    displayText: () => t('music.keyboard'), preconditionFn: scope => scope.block?.type === 'ab_play_melody' ? 'enabled' : 'hidden',
    callback: scope => (scope.block?.getField('RECORDER') as RecorderField | null)?.open(),
  });
}
