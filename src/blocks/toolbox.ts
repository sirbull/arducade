// The block toolbox, with ready made defaults (shadow blocks) for inputs.

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
      ]),
      category('INFO', 'ab_info', [
        block('ab_score_set', { VALUE: n(0) }),
        block('ab_score_change', { VALUE: n(1) }),
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
        block('ab_particle_pixel', { X: n(64), Y: n(32), VX: n(30), VY: n(-30), MS: n(500), END_VX: n(0), END_VY: n(30) }),
        block('ab_particle_image', { X: n(64), Y: n(32), VX: n(30), VY: n(-30), MS: n(500), END_VX: n(0), END_VY: n(30) }),
        block('ab_particles_clear'),
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
      category('MUSIC', 'ab_music', [
        block('ab_play_effect'),
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

function varGet(name: string): Json {
  return { block: { type: 'variables_get', fields: { VAR: { name } } } };
}
