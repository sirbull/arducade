// The block toolbox, with ready made defaults (shadow blocks) for inputs.

import * as Blockly from 'blockly/core';

type Json = Record<string, unknown>;

const n = (v: number): Json => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
const s = (v: string): Json => ({ shadow: { type: 'text', fields: { TEXT: v } } });
const spriteVar = (name = 'mySprite'): Json => ({ block: { type: 'variables_get', fields: { VAR: { name } } } });

function block(type: string, inputs?: Record<string, Json>, fields?: Json): Json {
  const b: Json = { kind: 'block', type };
  if (inputs) b.inputs = inputs;
  if (fields) b.fields = fields;
  return b;
}

function category(key: string, style: string, contents: Json[]): Json {
  return { kind: 'category', name: `%{BKY_AB_CAT_${key}}`, categorystyle: style, contents };
}

export function buildToolbox(): Json {
  return {
    kind: 'categoryToolbox',
    contents: [
      category('GAME', 'ab_game', [
        block('ab_on_start'),
        block('ab_on_update'),
        block('ab_on_every'),
        block('ab_splash', { TEXT: s('Hello!') }),
        block('ab_splash_screen', {
          DO: {
            block: {
              type: 'ab_draw_image',
              inputs: { X: n(56), Y: n(8) },
              next: { block: { type: 'ab_draw_text', inputs: { TEXT: s('Hello!'), X: n(46), Y: n(40) } } },
            },
          },
        }),
        block('ab_game_over'),
        block('ab_pause', { MS: n(500) }),
        block('ab_runtime'),
        block('ab_invert'),
      ]),
      category('SPRITES', 'ab_sprites', [
        block('variables_set', { VALUE: { block: { type: 'ab_sprite_create' } } }, { VAR: { name: 'mySprite' } }),
        block('ab_sprite_set_position', { SPRITE: spriteVar(), X: n(64), Y: n(32) }),
        block('ab_sprite_set_velocity', { SPRITE: spriteVar(), VX: n(50), VY: n(0) }),
        block('ab_sprite_set_prop', { SPRITE: spriteVar(), VALUE: n(0) }),
        block('ab_sprite_change_prop', { SPRITE: spriteVar(), VALUE: n(1) }),
        block('ab_sprite_get_prop', { SPRITE: spriteVar() }),
        block('ab_sprite_stay_in_screen', { SPRITE: spriteVar() }),
        block('ab_sprite_set_flag', { SPRITE: spriteVar() }),
        block('ab_on_overlap'),
        block('ab_sprite_overlaps', { A: spriteVar(), B: spriteVar('otherSprite') }),
        block('ab_sprite_is_hitting', { SPRITE: spriteVar() }),
        block('variables_set', { VALUE: { block: { type: 'ab_sprite_projectile', inputs: { FROM: spriteVar(), VX: n(0), VY: n(-80) } } } }, { VAR: { name: 'projectile' } }),
        block('ab_sprite_set_outline', { SPRITE: spriteVar() }),
        block('ab_sprite_set_outline_width', { SPRITE: spriteVar(), WIDTH: n(1) }),
        block('ab_sprite_set_z', { SPRITE: spriteVar(), Z: n(1) }),
        block('ab_sprite_set_image', { SPRITE: spriteVar() }),
        block('ab_sprite_animate', { SPRITE: spriteVar(), MS: n(200) }),
        block('ab_sprite_destroy', { SPRITE: spriteVar() }),
        block('ab_sprite_destroy_all'),
        block('ab_for_each_kind'),
        block('ab_sprite_is_kind', { SPRITE: spriteVar() }),
        block('ab_sprite_set_kind', { SPRITE: spriteVar() }),
        block('ab_sprite_exists', { SPRITE: spriteVar() }),
      ]),
      category('CONTROLLER', 'ab_controller', [
        block('ab_move_sprite', { SPRITE: spriteVar(), VX: n(60), VY: n(60) }),
        block('ab_on_button'),
        block('ab_is_pressed'),
      ]),
      category('SCENE', 'ab_scene', [
        block('ab_set_tilemap'),
        block('ab_camera_follow', { SPRITE: spriteVar() }),
        block('ab_spawn_on_tiles'),
        block('ab_on_tile'),
        block('ab_set_tile', { COL: varGet('col'), ROW: varGet('row') }),
        block('ab_tile_is', { COL: n(0), ROW: n(0) }),
        block('ab_place_on_tile', { SPRITE: spriteVar(), COL: n(1), ROW: n(1) }),
        block('ab_set_camera', { X: n(0), Y: n(0) }),
        block('ab_camera_x'),
        block('ab_camera_y'),
        block('ab_shake', { STRENGTH: n(3), MS: n(300) }),
        block('ab_bg_set'),
        block('ab_bg_clear'),
        block('ab_bg_set_position', { X: n(0), Y: n(0) }),
        block('ab_bg_change_position', { X: n(-1), Y: n(0) }),
        block('ab_bg_x'),
        block('ab_bg_y'),
      ]),
      category('INFO', 'ab_info', [
        block('ab_timer_set', { SECONDS: n(94) }),
        block('ab_timer_change', { VALUE: n(1) }),
        block('ab_timer_set_millis', { VALUE: n(125) }),
        block('ab_timer_change_millis', { VALUE: n(100) }),
        block('ab_timer_millis'),
        block('ab_timer_run'),
        block('ab_timer_format'),
        block('ab_info_position', { X: n(0), Y: n(10) }),
        block('ab_timer'),
        block('ab_score_set', { VALUE: n(0) }),
        block('ab_score_change', { VALUE: n(1) }),
        block('ab_score_position', { X: n(0), Y: n(0) }),
        block('ab_score'),
        block('ab_life_set', { VALUE: n(3) }),
        block('ab_life_change', { VALUE: n(-1) }),
        block('ab_life'),
        block('ab_on_life_zero'),
        block('ab_hiscore'),
        block('ab_storage_save', { VALUE: n(0), SLOT: n(0) }),
        block('ab_storage_load', { SLOT: n(0) }),
      ]),
      category('GRAPHICS', 'ab_graphics', [
        block('ab_on_draw'),
        block('ab_draw_text', { TEXT: s('Hello'), X: n(0), Y: n(0) }),
        block('text'),
        block('text_join'),
        block('ab_draw_pixel', { X: n(10), Y: n(10) }),
        block('ab_draw_line', { X0: n(0), Y0: n(0), X1: n(127), Y1: n(63) }),
        block('ab_draw_rect', { X: n(10), Y: n(10), W: n(20), H: n(10) }),
        block('ab_draw_circle', { X: n(64), Y: n(32), R: n(10) }),
        block('ab_draw_image', { X: n(0), Y: n(0) }),
        block('ab_get_pixel', { X: n(0), Y: n(0) }),
      ]),
      category('PARTICLES', 'ab_particles', [
        block('ab_fx_burst', { COUNT: n(5), X: n(64), Y: n(32), ROT: n(0) }, { EFFECT: fxName('SPRAY') }),
        block('ab_fx_burst_from', { COUNT: n(3), SPRITE: spriteVar(), ROT: n(0) }, { EFFECT: fxName('SPRAY') }),
        block('ab_fx_clear', undefined, { EFFECT: fxName('SPRAY') }),
        block('ab_particles_clear'),
        // Ready made effects to start from. Angles: 0 up, 90 right, 180 down.
        effect('SPRAY', [pixel(1), part('ab_fx_life', { MIN: 300, MAX: 600 }), part('ab_fx_direction', { DIR: 90, SPREAD: 15 }), part('ab_fx_speed', { MIN: 60, MAX: 90 }), part('ab_fx_accel', { AX: 0, AY: 60 })]),
        effect('SMOKE', [pixel(1), part('ab_fx_life', { MIN: 600, MAX: 1200 }), part('ab_fx_direction', { DIR: 0, SPREAD: 25 }), part('ab_fx_speed', { MIN: 10, MAX: 25 }), part('ab_fx_area', { W: 4, H: 2 }), part('ab_fx_drag', { DRAG: 30 }), part('ab_fx_wobble', { WOBBLE: 3 }), part('ab_fx_blink', { BLINK: 30 })]),
        effect('EXPLOSION', [pixel(2), part('ab_fx_life', { MIN: 300, MAX: 700 }), part('ab_fx_direction', { DIR: 0, SPREAD: 180 }), part('ab_fx_speed', { MIN: 30, MAX: 90 }), part('ab_fx_drag', { DRAG: 60 }), part('ab_fx_blink', { BLINK: 40 })]),
        effect('SPARKS', [pixel(1), part('ab_fx_life', { MIN: 400, MAX: 800 }), part('ab_fx_direction', { DIR: 0, SPREAD: 45 }), part('ab_fx_speed', { MIN: 40, MAX: 80 }), part('ab_fx_accel', { AX: 0, AY: 150 }), part('ab_fx_blink', { BLINK: 25 })]),
        effect('RAIN', [pixel(1), part('ab_fx_life', { MIN: 1000, MAX: 1200 }), part('ab_fx_direction', { DIR: 180, SPREAD: 3 }), part('ab_fx_speed', { MIN: 50, MAX: 70 }), part('ab_fx_area', { W: 128, H: 0 })]),
        block('ab_effect', undefined, { NAME: fxName('MINE') }),
        block('ab_fx_pixel'),
        block('ab_fx_image'),
        block('ab_fx_life'),
        block('ab_fx_direction'),
        block('ab_fx_speed'),
        block('ab_fx_area'),
        block('ab_fx_accel'),
        block('ab_fx_drag'),
        block('ab_fx_wobble'),
        block('ab_fx_blink'),
      ]),
      category('MUSIC', 'ab_music', [
        block('ab_play_effect'),
        block('ab_play_song'),
        block('ab_stop_song'),
        block('ab_play_melody', { TEMPO: n(120) }, { NOTES: 'C D E F G:2 G:2 A:1 A A A G:4 F:1 F F F E:2 E:2 D:1 D D D C:4', MODE: 'loop' }),
        block('ab_play_tone', { FREQ: { shadow: { type: 'ab_note', fields: { NOTE: '440' } } }, MS: n(200) }),
        block('ab_note'),
        block('ab_pitch', { FROM: n(90), TO: n(110), DO: { block: { type: 'ab_play_effect' } } }),
        block('ab_stop_sound'),
      ]),
      category('LOGIC', 'ab_logic', [
        block('controls_if'),
        { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
        block('logic_compare', { A: n(0), B: n(0) }),
        block('logic_operation'),
        block('logic_negate'),
        block('logic_boolean'),
      ]),
      category('LOOPS', 'ab_loops', [
        block('controls_repeat_ext', { TIMES: n(4) }),
        block('controls_whileUntil'),
        block('controls_for', { FROM: n(0), TO: n(4) }),
        block('controls_flow_statements'),
      ]),
      category('MATH', 'ab_math', [
        block('math_number'),
        block('math_arithmetic', { A: n(0), B: n(0) }),
        block('ab_map', { VALUE: n(512), FROM_LOW: n(0), FROM_HIGH: n(1024), TO_LOW: n(0), TO_HIGH: n(100) }),
        block('ab_random', { FROM: n(0), TO: n(10) }),
        block('math_modulo', { DIVIDEND: n(10), DIVISOR: n(3) }),
        block('ab_minmax', { A: n(0), B: n(0) }),
        block('math_single', { NUM: n(-5) }),
        block('math_constrain', { VALUE: n(50), LOW: n(0), HIGH: n(100) }),
      ]),
      { kind: 'category', name: '%{BKY_AB_CAT_VARIABLES}', categorystyle: 'ab_variables', custom: 'VARIABLE' },
      { kind: 'category', name: '%{BKY_AB_CAT_FUNCTIONS}', categorystyle: 'ab_functions', custom: 'PROCEDURE' },
      category('CUSTOM', 'ab_custom', [block('ab_comment'), block('ab_comment_group'), block('ab_cpp')]),
    ],
  };
}

/** Effect names are translated, so a ready made effect has a name in the user's language. */
function fxName(key: string): string {
  return Blockly.Msg[`AB_FX_NAME_${key}`] ?? key.toLowerCase();
}

const part = (type: string, fields: Json): Json => ({ type, fields });
const pixel = (color: number): Json => part('ab_fx_pixel', { PARTICLE_COLOR: String(color) });

/** An effect hat with its parts stacked inside. */
function effect(key: string, parts: Json[]): Json {
  const stack = parts.reduceRight<Json | undefined>((next, p) => ({ ...p, ...(next && { next: { block: next } }) }), undefined);
  return { kind: 'block', type: 'ab_effect', fields: { NAME: fxName(key) }, inputs: { DO: { block: stack } } };
}

function varGet(name: string): Json {
  return { block: { type: 'variables_get', fields: { VAR: { name } } } };
}
