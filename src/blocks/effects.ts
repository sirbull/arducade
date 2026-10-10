// The effect name dropdown, renaming an effect everywhere it is used, and
// keeping effect parts inside effects.

import * as Blockly from 'blockly/core';

/** Effect names in the workspace, for a dropdown in it or in its flyout. */
function effectNames(block: Blockly.Block | null): string[] {
  const ws = block?.workspace as Blockly.WorkspaceSvg | undefined;
  const target = ws?.isFlyout ? ws.targetWorkspace : ws;
  const names = (target?.getBlocksByType('ab_effect', false) ?? []).map((b) => String(b.getFieldValue('NAME')));
  return [...new Set(names)].sort();
}

class EffectField extends Blockly.FieldDropdown {
  constructor() {
    let self: EffectField | undefined;
    super(() => {
      const names = effectNames(self?.getSourceBlock() ?? null);
      const value = self?.getValue();
      // A block can load before the effect it uses, so keep its value.
      if (value && !names.includes(value)) names.push(value);
      if (!names.length) names.push(Blockly.Msg.AB_FX_NAME_SPRAY ?? 'spray');
      return names.map((n) => [n, n] as [string, string]);
    });
    self = this;
  }

  protected override doClassValidation_(value?: string): string | null {
    return typeof value === 'string' && value ? value : null;
  }

  static fromJson() {
    return new EffectField();
  }
}

/** Points every dropdown that used the old name at the new name. */
function rename(ws: Blockly.Workspace, from: string, to: string) {
  for (const b of ws.getAllBlocks(false)) {
    for (const input of b.inputList) {
      for (const f of input.fieldRow) if (f instanceof EffectField && f.getValue() === from) f.setValue(to);
    }
  }
}

/**
 * A statement without a check fits anywhere in Blockly. Effect parts must only
 * fit inside an effect, and other statements must not fit there.
 */
class EffectPartChecker extends Blockly.ConnectionChecker {
  override doTypeChecks(a: Blockly.Connection, b: Blockly.Connection): boolean {
    const part = (c: Blockly.Connection) => c.getCheck()?.includes('EffectPart') ?? false;
    return part(a) === part(b) && super.doTypeChecks(a, b);
  }
}

let registered = false;
export function registerEffectBlocks() {
  if (registered) return;
  registered = true;
  Blockly.fieldRegistry.register('field_ab_effect', EffectField);
  Blockly.registry.register(Blockly.registry.Type.CONNECTION_CHECKER, Blockly.registry.DEFAULT, EffectPartChecker, true);
  Blockly.Extensions.register('ab_effect_name', function (this: Blockly.Block) {
    this.getField('NAME')!.setValidator((v: string) => v.trim() || null);
    // One change event when editing ends, with the name from before editing.
    this.setOnChange((e) => {
      if (this.isInFlyout || e.type !== Blockly.Events.BLOCK_CHANGE) return;
      const c = e as Blockly.Events.BlockChange;
      if (c.blockId !== this.id || c.element !== 'field' || c.name !== 'NAME') return;
      const from = String(c.oldValue), to = String(c.newValue);
      const others = this.workspace.getBlocksByType('ab_effect', false).some((b) => b !== this && b.getFieldValue('NAME') === from);
      if (from && to && from !== to && !others) {
        Blockly.Events.setGroup(c.group || true);
        rename(this.workspace, from, to);
        Blockly.Events.setGroup(false);
      }
    });
  });
}
