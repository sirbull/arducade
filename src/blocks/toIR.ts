// Blockly workspace to IR.

import * as Blockly from 'blockly/core';
import type { BinOp, Diagnostic, Event, Expr, Func, Program, Stmt } from '../ir/ir';

type Block = Blockly.Block;

export interface ToIrResult {
  program: Program;
  diagnostics: Diagnostic[];
}

class Converter {
  diagnostics: Diagnostic[] = [];

  constructor(private ws: Blockly.Workspace) {}

  run(): ToIrResult {
    const program: Program = { vars: [], funcs: [], events: [] };
    for (const v of this.ws.getVariableMap().getAllVariables()) program.vars.push({ name: v.getName(), ty: 'num' });
    const tops = this.ws.getTopBlocks(true);
    for (const b of tops) {
      if (!b.isEnabled()) continue;
      const ev = this.event(b);
      if (ev) program.events.push(ev);
      else if (b.type === 'procedures_defnoreturn' || b.type === 'procedures_defreturn') program.funcs.push(this.func(b));
    }
    return { program, diagnostics: this.diagnostics };
  }

  private field(b: Block, name: string): string {
    return String(b.getFieldValue(name) ?? '');
  }

  private varField(b: Block, name: string): string {
    const id = b.getFieldValue(name);
    return this.ws.getVariableMap().getVariableById(id)?.getName() ?? 'value';
  }

  private body(b: Block, input = 'DO'): Stmt[] {
    return this.stmts(b.getInputTargetBlock(input));
  }

  private event(b: Block): Event | null {
    const id = b.id;
    switch (b.type) {
      case 'ab_on_start':
        return { k: 'start', body: this.body(b), id };
      case 'ab_on_update':
        return { k: 'update', body: this.body(b), id };
      case 'ab_on_draw':
        return { k: 'draw', body: this.body(b), id };
      case 'ab_on_every':
        return { k: 'every', ms: Number(b.getFieldValue('MS')) || 500, body: this.body(b), id };
      case 'ab_on_button':
        return { k: 'button', button: this.field(b, 'BUTTON'), pressed: this.field(b, 'EVENT') !== 'released', body: this.body(b), id };
      case 'ab_on_overlap':
        return {
          k: 'overlap',
          a: this.field(b, 'KIND_A'),
          b: this.field(b, 'KIND_B'),
          sv: this.varField(b, 'SPRITE'),
          ov: this.varField(b, 'OTHER'),
          body: this.body(b),
          id,
        };
      case 'ab_on_tile':
        return {
          k: 'tile',
          kind: this.field(b, 'KIND'),
          tile: this.field(b, 'TILE'),
          sv: this.varField(b, 'SPRITE'),
          col: this.varField(b, 'COL'),
          row: this.varField(b, 'ROW'),
          body: this.body(b),
          id,
        };
      case 'ab_on_life_zero':
        return { k: 'lifeZero', body: this.body(b), id };
    }
    return null;
  }

  private func(b: Block): Func {
    const name = this.field(b, 'NAME');
    const models = (b as unknown as { getVarModels?: () => { getName(): string }[] }).getVarModels?.() ?? [];
    const params = models.map((m) => ({ name: m.getName(), ty: 'num' as const }));
    const body = this.body(b, 'STACK');
    const ret = b.getInputTargetBlock('RETURN');
    if (ret) body.push({ k: 'return', value: this.expr(ret), id: b.id });
    return { name, params, ret: b.type === 'procedures_defreturn' ? 'num' : 'void', body, id: b.id };
  }

  private stmts(first: Block | null): Stmt[] {
    const out: Stmt[] = [];
    for (let b = first; b; b = b.getNextBlock()) {
      if (!b.isEnabled()) continue;
      const s = this.stmt(b);
      if (s) out.push(...(Array.isArray(s) ? s : [s]));
    }
    return out;
  }

  /** Value input as an expression, with a default when it is empty. */
  private input(b: Block, name: string, fallback: Expr = { k: 'num', v: 0 }): Expr {
    const t = b.getInputTargetBlock(name);
    return t ? this.expr(t) : fallback;
  }

  private api(fn: string, args: Expr[], id: string): Stmt {
    return { k: 'expr', e: { k: 'api', fn, args }, id };
  }

  private spriteIn(b: Block, name = 'SPRITE'): Expr {
    const t = b.getInputTargetBlock(name);
    if (!t) {
      this.diagnostics.push({ level: 'error', key: 'diag.missingSprite', id: b.id });
      return { k: 'num', v: 255 };
    }
    return this.expr(t);
  }

  private en(type: Extract<Expr, { k: 'enum' }>['type'], v: string): Expr {
    return { k: 'enum', type, v };
  }

  private stmt(b: Block): Stmt | Stmt[] | null {
    const id = b.id;
    const f = (n: string) => this.field(b, n);
    switch (b.type) {
      case 'ab_comment':
        return { k: 'comment', text: f('TEXT'), id };
      case 'ab_comment_group':
        return [{ k: 'comment', text: f('TEXT'), id }, ...this.body(b)];
      // Blockly built in blocks
      case 'variables_set':
        return { k: 'set', name: this.varField(b, 'VAR'), value: this.input(b, 'VALUE'), id };
      case 'math_change': {
        const name = this.varField(b, 'VAR');
        return { k: 'set', name, value: { k: 'bin', op: '+', a: { k: 'var', name }, b: this.input(b, 'DELTA', { k: 'num', v: 1 }) }, id };
      }
      case 'controls_if': {
        const conds: { cond: Expr; then: Stmt[] }[] = [];
        for (let i = 0; b.getInput(`IF${i}`); i++) {
          conds.push({ cond: this.input(b, `IF${i}`, { k: 'bool', v: false }), then: this.body(b, `DO${i}`) });
        }
        let els: Stmt[] | undefined = b.getInput('ELSE') ? this.body(b, 'ELSE') : undefined;
        for (let i = conds.length - 1; i >= 0; i--) {
          const node: Stmt = { k: 'if', cond: conds[i].cond, then: conds[i].then, else: els, id: i === 0 ? id : undefined };
          els = [node];
        }
        return els ?? null;
      }
      case 'controls_repeat_ext':
        return { k: 'repeat', count: this.input(b, 'TIMES', { k: 'num', v: 10 }), body: this.body(b), id };
      case 'controls_whileUntil': {
        const cond = this.input(b, 'BOOL', { k: 'bool', v: false });
        return { k: 'while', cond: f('MODE') === 'UNTIL' ? { k: 'un', op: 'not', a: cond } : cond, body: this.body(b), id };
      }
      case 'controls_for':
        return { k: 'for', name: this.varField(b, 'VAR'), from: this.input(b, 'FROM'), to: this.input(b, 'TO', { k: 'num', v: 10 }), body: this.body(b), id };
      case 'controls_flow_statements':
        return { k: f('FLOW') === 'CONTINUE' ? 'continue' : 'break', id };
      case 'procedures_callnoreturn':
        return { k: 'expr', e: this.call(b), id };
      case 'procedures_ifreturn': {
        const value = b.getInput('VALUE') ? this.input(b, 'VALUE') : undefined;
        return { k: 'if', cond: this.input(b, 'CONDITION', { k: 'bool', v: false }), then: [{ k: 'return', value }], id };
      }

      // Game
      case 'ab_splash':
        return this.api('game.splash', [this.input(b, 'TEXT', { k: 'str', v: '' })], id);
      case 'ab_splash_screen':
        return [this.api('game.clear', [], id), ...this.body(b), this.api('game.showAndWait', [], id)];
      case 'ab_game_over':
        return this.api('game.over', [{ k: 'bool', v: f('WIN') === 'win' }], id);
      case 'ab_pause':
        return this.api('game.pause', [this.input(b, 'MS', { k: 'num', v: 100 })], id);
      case 'ab_invert':
        return this.api('game.invert', [{ k: 'bool', v: f('ON') === 'on' }], id);

      // Sprites
      case 'ab_sprite_set_prop':
        return this.api('sprites.set', [this.spriteIn(b), this.en('prop', f('PROP')), this.input(b, 'VALUE')], id);
      case 'ab_sprite_change_prop':
        return this.api('sprites.change', [this.spriteIn(b), this.en('prop', f('PROP')), this.input(b, 'VALUE')], id);
      case 'ab_sprite_set_position':
        return this.api('sprites.setPosition', [this.spriteIn(b), this.input(b, 'X'), this.input(b, 'Y')], id);
      case 'ab_sprite_set_velocity':
        return this.api('sprites.setVelocity', [this.spriteIn(b), this.input(b, 'VX'), this.input(b, 'VY')], id);
      case 'ab_sprite_set_image':
        return this.api('sprites.setImage', [this.spriteIn(b), this.en('image', f('IMAGE'))], id);
      case 'ab_sprite_set_flag':
        return this.api('sprites.setFlag', [this.spriteIn(b), this.en('flag', f('FLAG')), { k: 'bool', v: f('ON') === 'on' }], id);
      case 'ab_sprite_animate':
        return this.api('sprites.animate', [this.spriteIn(b), this.input(b, 'MS', { k: 'num', v: 200 })], id);
      case 'ab_sprite_destroy':
        return this.api('sprites.destroy', [this.spriteIn(b)], id);
      case 'ab_sprite_destroy_all':
        return this.api('sprites.destroyAll', [this.en('kind', f('KIND'))], id);
      case 'ab_sprite_set_kind':
        return this.api('sprites.setKind', [this.spriteIn(b), this.en('kind', f('KIND'))], id);
      case 'ab_for_each_kind':
        return { k: 'forKind', name: this.varField(b, 'VAR'), kind: this.en('kind', f('KIND')), body: this.body(b), id };

      // Controller
      case 'ab_move_sprite':
        return this.api('controller.moveSprite', [this.spriteIn(b), this.input(b, 'VX', { k: 'num', v: 60 }), this.input(b, 'VY', { k: 'num', v: 60 })], id);

      // Scene
      case 'ab_set_tilemap':
        return this.api('scene.setTilemap', [this.en('tilemap', f('MAP'))], id);
      case 'ab_camera_follow':
        return this.api('scene.cameraFollow', [this.spriteIn(b)], id);
      case 'ab_set_camera':
        return this.api('scene.setCamera', [this.input(b, 'X'), this.input(b, 'Y')], id);
      case 'ab_spawn_on_tiles':
        return this.api('scene.spawnOnTiles', [this.en('tile', f('TILE')), this.en('image', f('IMAGE')), this.en('kind', f('KIND'))], id);
      case 'ab_set_tile':
        return this.api('scene.setTile', [this.input(b, 'COL'), this.input(b, 'ROW'), this.en('tile', f('TILE'))], id);
      case 'ab_place_on_tile':
        return this.api('scene.placeOnTile', [this.spriteIn(b), this.input(b, 'COL'), this.input(b, 'ROW')], id);

      // Info
      case 'ab_score_set':
        return this.api('info.setScore', [this.input(b, 'VALUE')], id);
      case 'ab_score_change':
        return this.api('info.changeScore', [this.input(b, 'VALUE', { k: 'num', v: 1 })], id);
      case 'ab_life_set':
        return this.api('info.setLife', [this.input(b, 'VALUE', { k: 'num', v: 3 })], id);
      case 'ab_life_change':
        return this.api('info.changeLife', [this.input(b, 'VALUE', { k: 'num', v: -1 })], id);
      case 'ab_storage_save':
        return this.api('storage.save', [this.input(b, 'SLOT'), this.input(b, 'VALUE')], id);

      // Graphics
      case 'ab_draw_text':
        return this.api('draw.text', [this.input(b, 'X'), this.input(b, 'Y'), this.input(b, 'TEXT', { k: 'str', v: '' }), this.en('color', f('COLOR'))], id);
      case 'ab_draw_pixel':
        return this.api('draw.pixel', [this.input(b, 'X'), this.input(b, 'Y'), this.en('color', f('COLOR'))], id);
      case 'ab_draw_line':
        return this.api('draw.line', [this.input(b, 'X0'), this.input(b, 'Y0'), this.input(b, 'X1'), this.input(b, 'Y1'), this.en('color', f('COLOR'))], id);
      case 'ab_draw_rect':
        return this.api(f('FILL') === 'filled' ? 'draw.fillRect' : 'draw.rect', [
          this.input(b, 'X'),
          this.input(b, 'Y'),
          this.input(b, 'W', { k: 'num', v: 10 }),
          this.input(b, 'H', { k: 'num', v: 10 }),
          this.en('color', f('COLOR')),
        ], id);
      case 'ab_draw_circle':
        return this.api(f('FILL') === 'filled' ? 'draw.fillCircle' : 'draw.circle', [
          this.input(b, 'X'),
          this.input(b, 'Y'),
          this.input(b, 'R', { k: 'num', v: 5 }),
          this.en('color', f('COLOR')),
        ], id);
      case 'ab_draw_image':
        return this.api('draw.image', [this.en('image', f('IMAGE')), this.input(b, 'X'), this.input(b, 'Y')], id);

      // Music
      case 'ab_play_effect':
        return this.api('music.effect', [this.en('sfx', f('SFX'))], id);
      case 'ab_play_tone':
        return this.api('music.tone', [this.input(b, 'FREQ', { k: 'num', v: 440 }), this.input(b, 'MS', { k: 'num', v: 200 })], id);
      case 'ab_stop_sound':
        return this.api('music.stop', [], id);
      case 'ab_play_melody':
        return this.api('music.melody', [this.en('melody', f('NOTES')), this.input(b, 'TEMPO', { k: 'num', v: 120 }), { k: 'bool', v: f('MODE') === 'loop' }], id);

      case 'ab_cpp':
        return { k: 'cpp', code: f('CODE'), id };
    }
    if (b.outputConnection) {
      // A value block used as a statement: evaluate it and ignore the result.
      return { k: 'expr', e: this.expr(b), id };
    }
    this.diagnostics.push({ level: 'warning', key: 'diag.unknownBlock', params: { type: b.type }, id });
    return null;
  }

  private call(b: Block): Expr {
    const name = this.field(b, 'NAME');
    const args: Expr[] = [];
    for (let i = 0; b.getInput(`ARG${i}`); i++) args.push(this.input(b, `ARG${i}`));
    return { k: 'call', name, args, id: b.id };
  }

  expr(b: Block): Expr {
    const id = b.id;
    const f = (n: string) => this.field(b, n);
    const api = (fn: string, args: Expr[]): Expr => ({ k: 'api', fn, args, id });
    switch (b.type) {
      case 'math_number':
        return { k: 'num', v: Number(f('NUM')) || 0, id };
      case 'logic_boolean':
        return { k: 'bool', v: f('BOOL') === 'TRUE', id };
      case 'text':
        return { k: 'str', v: f('TEXT'), id };
      case 'text_join': {
        const parts: Expr[] = [];
        for (let i = 0; b.getInput(`ADD${i}`); i++) {
          const t = b.getInputTargetBlock(`ADD${i}`);
          if (t) parts.push(this.expr(t));
        }
        return { k: 'join', parts, id };
      }
      case 'variables_get':
        return { k: 'var', name: this.varField(b, 'VAR'), id };
      case 'math_arithmetic': {
        const ops: Record<string, BinOp> = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/' };
        const op = f('OP');
        if (op === 'POWER') this.diagnostics.push({ level: 'error', key: 'diag.noPower', id });
        return { k: 'bin', op: ops[op] ?? '+', a: this.input(b, 'A'), b: this.input(b, 'B'), id };
      }
      case 'math_modulo':
        return { k: 'bin', op: '%', a: this.input(b, 'DIVIDEND'), b: this.input(b, 'DIVISOR', { k: 'num', v: 1 }), id };
      case 'math_single': {
        const op = f('OP');
        const v = this.input(b, 'NUM');
        if (op === 'NEG') return { k: 'un', op: 'neg', a: v, id };
        if (op !== 'ABS') this.diagnostics.push({ level: 'error', key: 'diag.noFloat', id });
        return api('math.abs', [v]);
      }
      case 'math_constrain':
        return api('math.constrain', [this.input(b, 'VALUE'), this.input(b, 'LOW'), this.input(b, 'HIGH', { k: 'num', v: 100 })]);
      case 'logic_compare': {
        const ops: Record<string, BinOp> = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
        return { k: 'bin', op: ops[f('OP')] ?? '==', a: this.input(b, 'A'), b: this.input(b, 'B'), id };
      }
      case 'logic_operation':
        return {
          k: 'bin',
          op: f('OP') === 'OR' ? '||' : '&&',
          a: this.input(b, 'A', { k: 'bool', v: false }),
          b: this.input(b, 'B', { k: 'bool', v: false }),
          id,
        };
      case 'logic_negate':
        return { k: 'un', op: 'not', a: this.input(b, 'BOOL', { k: 'bool', v: false }), id };
      case 'logic_ternary':
        return { k: 'cond', c: this.input(b, 'IF', { k: 'bool', v: false }), a: this.input(b, 'THEN'), b: this.input(b, 'ELSE'), id };
      case 'procedures_callreturn':
        return this.call(b);

      case 'ab_runtime':
        return api('game.runtime', []);
      case 'ab_sprite_create':
        return api('sprites.create', [this.en('image', f('IMAGE')), this.en('kind', f('KIND'))]);
      case 'ab_sprite_projectile':
        return api('sprites.projectile', [this.en('image', f('IMAGE')), this.input(b, 'VX'), this.input(b, 'VY', { k: 'num', v: -50 }), this.spriteIn(b, 'FROM')]);
      case 'ab_sprite_get_prop':
        return api('sprites.get', [this.spriteIn(b), this.en('prop', f('PROP'))]);
      case 'ab_sprite_overlaps':
        return api('sprites.overlaps', [this.spriteIn(b, 'A'), this.spriteIn(b, 'B')]);
      case 'ab_sprite_is_hitting':
        return api('sprites.isHitting', [this.spriteIn(b), this.en('dir', f('DIR'))]);
      case 'ab_sprite_is_kind':
        return api('sprites.isKind', [this.spriteIn(b), this.en('kind', f('KIND'))]);
      case 'ab_sprite_exists':
        return api('sprites.exists', [this.spriteIn(b)]);
      case 'ab_is_pressed':
        return api('controller.isPressed', [this.en('button', f('BUTTON'))]);
      case 'ab_camera_x':
        return api('scene.cameraX', []);
      case 'ab_camera_y':
        return api('scene.cameraY', []);
      case 'ab_tile_is':
        return api('scene.tileIs', [this.input(b, 'COL'), this.input(b, 'ROW'), this.en('tile', f('TILE'))]);
      case 'ab_score':
        return api('info.score', []);
      case 'ab_life':
        return api('info.life', []);
      case 'ab_hiscore':
        return api('info.highScore', []);
      case 'ab_storage_load':
        return api('storage.load', [this.input(b, 'SLOT')]);
      case 'ab_get_pixel':
        return api('draw.getPixel', [this.input(b, 'X'), this.input(b, 'Y')]);
      case 'ab_map':
        return api('math.map', ['VALUE', 'FROM_LOW', 'FROM_HIGH', 'TO_LOW', 'TO_HIGH'].map((name) => this.input(b, name)));
      case 'ab_random':
        return api('math.random', [this.input(b, 'FROM'), this.input(b, 'TO', { k: 'num', v: 10 })]);
      case 'ab_note':
        return { k: 'num', v: Number(f('NOTE')) || 440, id };
      case 'ab_minmax':
        return api(f('OP') === 'max' ? 'math.max' : 'math.min', [this.input(b, 'A'), this.input(b, 'B')]);
    }
    this.diagnostics.push({ level: 'warning', key: 'diag.unknownBlock', params: { type: b.type }, id });
    return { k: 'num', v: 0, id };
  }
}

export function workspaceToIR(ws: Blockly.Workspace): ToIrResult {
  return new Converter(ws).run();
}
