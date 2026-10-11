// Block definitions. Texts are translation keys (Blockly.Msg) so the blocks
// can be shown in every language. The meaning of each block is in toIR.ts.

import * as Blockly from 'blockly/core';
import { registerFieldMultilineInput } from '@blockly/field-multilineinput';
import { registerAssetFields } from './assets';
import { registerMelodyRecorder } from './melody-recorder';
import { registerPointPicker } from './point-picker';
import { registerAltDrag } from './alt-drag';
import { registerSpriteVarNames } from './sprite-var-names';
import { registerBlockInfo } from './info-icon';
import { registerTextJoin } from './text-join';
import { registerEffectBlocks } from './effects';
import { ICONS, type IconName } from './icons';
import { POLYPHONIC_EFFECT_NAMES } from '../engine/polyphonic-effects';
import { NOTE_CHOICES } from '../engine/melody';
import { SFX_MENU } from '../engine/enums';

type Arg = Record<string, unknown>;

const num = (name: string): Arg => ({ type: 'input_value', name, check: 'Number' });
const text = (name: string): Arg => ({ type: 'input_value', name, check: ['String', 'Number'] });
const sprite = (name: string): Arg => ({ type: 'input_value', name, check: 'Sprite' });
const image = (name = 'IMAGE'): Arg => ({ type: 'field_ab_image', name });
const kind = (name = 'KIND'): Arg => ({ type: 'field_ab_kind', name });
const effect = (name = 'EFFECT'): Arg => ({ type: 'field_ab_effect', name });
const fnum = (name: string, value: number, min: number, max: number): Arg => ({ type: 'field_number', name, value, min, max, precision: 1 });
const tile = (name = 'TILE'): Arg => ({ type: 'field_ab_tile', name });
const variable = (name: string, def: string): Arg => ({ type: 'field_variable', name, variable: def });
const dropdown = (name: string, keys: [string, string][]): Arg => ({
  type: 'field_dropdown',
  name,
  options: keys.map(([label, value]) => [`%{BKY_${label}}`, value]),
});

const TIMER = { type: 'field_ab_timer', name: 'TIMER' };
const backgroundLayer = (): Arg => ({ type: 'field_dropdown', name: 'LAYER', options: [['1', '1'], ['2', '2']] });

const COLOR = dropdown('COLOR', [
  ['AB_COLOR_WHITE', 'white'],
  ['AB_COLOR_BLACK', 'black'],
  ['AB_COLOR_INVERT', 'invert'],
]);
const DRAW_MODE = dropdown('MODE', [['AB_DRAW_UNDERLAY', '1'], ['AB_DRAW_BACKGROUND', '2'], ['AB_DRAW_LAYER_1', '3'], ['AB_DRAW_LAYER_2', '4'], ['AB_DRAW_NORMAL', '0']]);
const PARTICLE_COLOR = dropdown('PARTICLE_COLOR', [['AB_COLOR_WHITE', '1'], ['AB_COLOR_BLACK', '0'], ['AB_PARTICLE_RANDOM', '2']]);
const PROP = dropdown('PROP', [
  ['AB_PROP_X', 'x'],
  ['AB_PROP_Y', 'y'],
  ['AB_PROP_VX', 'vx'],
  ['AB_PROP_VY', 'vy'],
  ['AB_PROP_AX', 'ax'],
  ['AB_PROP_AY', 'ay'],
  ['AB_PROP_LEFT', 'left'],
  ['AB_PROP_RIGHT', 'right'],
  ['AB_PROP_TOP', 'top'],
  ['AB_PROP_BOTTOM', 'bottom'],
]);
const PROP_GET = dropdown('PROP', [
  ['AB_PROP_X', 'x'],
  ['AB_PROP_Y', 'y'],
  ['AB_PROP_VX', 'vx'],
  ['AB_PROP_VY', 'vy'],
  ['AB_PROP_AX', 'ax'],
  ['AB_PROP_AY', 'ay'],
  ['AB_PROP_WIDTH', 'width'],
  ['AB_PROP_HEIGHT', 'height'],
  ['AB_PROP_LEFT', 'left'],
  ['AB_PROP_RIGHT', 'right'],
  ['AB_PROP_TOP', 'top'],
  ['AB_PROP_BOTTOM', 'bottom'],
]);
const BUTTON_KEYS: [string, string][] = [
  ['AB_BUTTON_A', 'a'],
  ['AB_BUTTON_B', 'b'],
  ['AB_BUTTON_UP', 'up'],
  ['AB_BUTTON_DOWN', 'down'],
  ['AB_BUTTON_LEFT', 'left'],
  ['AB_BUTTON_RIGHT', 'right'],
];
const BUTTON = dropdown('BUTTON', BUTTON_KEYS);
const ON_OFF = dropdown('ON', [
  ['AB_ON', 'on'],
  ['AB_OFF', 'off'],
]);

interface Def {
  type: string;
  icon: IconName;
  style: string;
  /** Translation key of the text. */
  msg: string;
  args?: Arg[];
  output?: string | string[] | null;
  statement?: boolean;
  hat?: boolean;
  /** Statement input after the text, for event and loop blocks. */
  body?: boolean;
  inline?: boolean;
  /** Inputs that start a new row, so long inline blocks stay narrow. */
  rows?: string[];
  /** Only blocks with this statement check fit in the body. */
  bodyCheck?: string;
  /** Statement that only fits in a body with this check. */
  part?: string;
  extensions?: string[];
}

const GAME = { icon: 'game', style: 'ab_game' } as const;
const SPRITES = { icon: 'sprites', style: 'ab_sprites' } as const;
const CONTROLLER = { icon: 'controller', style: 'ab_controller' } as const;
const SCENE = { icon: 'scene', style: 'ab_scene' } as const;
const INFO = { icon: 'info', style: 'ab_info' } as const;
const GRAPHICS = { icon: 'graphics', style: 'ab_graphics' } as const;
const MUSIC = { icon: 'beep', style: 'ab_music' } as const;
const POLYPHONIC = { icon: 'music', style: 'ab_polyphonic' } as const;
const MATH = { icon: 'math', style: 'ab_math' } as const;
const CUSTOM = { icon: 'custom', style: 'ab_custom' } as const;
const PARTICLES = { icon: 'particles', style: 'ab_particles' } as const;
const FX_PART = { ...PARTICLES, part: 'EffectPart' } as const;

export const DEFS: Def[] = [
  { type: 'ab_with_draw_mode', ...GRAPHICS, msg: 'AB_WITH_DRAW_MODE', args: [DRAW_MODE], statement: true, body: true },
  { type: 'ab_with_sprite_reference', ...GRAPHICS, msg: 'AB_WITH_SPRITE_REFERENCE', args: [sprite('REFERENCE')], statement: true, body: true },
  { type: 'ab_sprite_set_draw_mode', ...SPRITES, msg: 'AB_SPRITE_SET_DRAW_MODE', args: [sprite('SPRITE'), DRAW_MODE], statement: true, inline: true },
  { type: 'ab_sprite_set_draw_reference', ...SPRITES, msg: 'AB_SPRITE_SET_DRAW_REFERENCE', args: [sprite('SPRITE'), sprite('REFERENCE')], statement: true, inline: true },
  { type: 'ab_particle_pixel', ...GRAPHICS, msg: 'AB_PARTICLE_PIXEL', args: [num('X'), num('Y'), num('VX'), num('VY'), num('MS'), num('END_VX'), num('END_VY'), PARTICLE_COLOR], statement: true, inline: true, rows: ['VX', 'MS'] },
  { type: 'ab_particle_image', ...GRAPHICS, msg: 'AB_PARTICLE_IMAGE', args: [image(), num('X'), num('Y'), num('VX'), num('VY'), num('MS'), num('END_VX'), num('END_VY'), PARTICLE_COLOR], statement: true, inline: true, rows: ['VX', 'MS'] },
  { type: 'ab_particles_clear', ...PARTICLES, msg: 'AB_PARTICLES_CLEAR', statement: true },
  // Particle effects: a recipe made of parts, and blocks that send particles out.
  { type: 'ab_effect', ...PARTICLES, msg: 'AB_EFFECT', args: [{ type: 'field_input', name: 'NAME', text: 'spray' }], hat: true, body: true, bodyCheck: 'EffectPart', extensions: ['ab_effect_name'] },
  { type: 'ab_fx_pixel', ...FX_PART, msg: 'AB_FX_PIXEL', args: [PARTICLE_COLOR] },
  { type: 'ab_fx_image', ...FX_PART, msg: 'AB_FX_IMAGE', args: [image(), PARTICLE_COLOR] },
  { type: 'ab_fx_life', ...FX_PART, msg: 'AB_FX_LIFE', args: [fnum('MIN', 400, 0, 32767), fnum('MAX', 800, 0, 32767)] },
  { type: 'ab_fx_direction', ...FX_PART, msg: 'AB_FX_DIRECTION', args: [fnum('DIR', 0, -360, 360), fnum('SPREAD', 30, 0, 180)] },
  { type: 'ab_fx_speed', ...FX_PART, msg: 'AB_FX_SPEED', args: [fnum('MIN', 20, 0, 2000), fnum('MAX', 40, 0, 2000)] },
  { type: 'ab_fx_area', ...FX_PART, msg: 'AB_FX_AREA', args: [fnum('W', 8, 0, 255), fnum('H', 0, 0, 255)] },
  { type: 'ab_fx_accel', ...FX_PART, msg: 'AB_FX_ACCEL', args: [fnum('AX', 0, -2000, 2000), fnum('AY', 50, -2000, 2000)] },
  { type: 'ab_fx_drag', ...FX_PART, msg: 'AB_FX_DRAG', args: [fnum('DRAG', 40, 0, 100)] },
  { type: 'ab_fx_wobble', ...FX_PART, msg: 'AB_FX_WOBBLE', args: [fnum('WOBBLE', 3, 0, 100)] },
  { type: 'ab_fx_blink', ...FX_PART, msg: 'AB_FX_BLINK', args: [fnum('BLINK', 30, 0, 100)] },
  { type: 'ab_fx_burst', ...PARTICLES, msg: 'AB_FX_BURST', args: [num('COUNT'), effect(), num('X'), num('Y'), num('ROT')], statement: true, inline: true, rows: ['X'] },
  { type: 'ab_fx_burst_from', ...PARTICLES, msg: 'AB_FX_BURST_FROM', args: [num('COUNT'), effect(), sprite('SPRITE'), num('ROT')], statement: true, inline: true },
  { type: 'ab_fx_clear', ...PARTICLES, msg: 'AB_FX_CLEAR', args: [effect()], statement: true },
  // Game
  { type: 'ab_on_start', ...GAME, msg: 'AB_ON_START', hat: true, body: true },
  { type: 'ab_on_update', ...GAME, msg: 'AB_ON_UPDATE', hat: true, body: true },
  { type: 'ab_on_every', ...GAME, msg: 'AB_ON_EVERY', args: [{ type: 'field_number', name: 'MS', value: 500, min: 1, max: 60000, precision: 1 }], hat: true, body: true },
  { type: 'ab_on_draw', ...GRAPHICS, msg: 'AB_ON_DRAW', hat: true, body: true },
  { type: 'ab_splash', ...GAME, msg: 'AB_SPLASH', args: [text('TEXT')], statement: true },
  { type: 'ab_splash_screen', ...GAME, msg: 'AB_SPLASH_SCREEN', statement: true, body: true },
  { type: 'ab_game_over', ...GAME, msg: 'AB_GAME_OVER', args: [dropdown('WIN', [['AB_LOSE', 'lose'], ['AB_WIN', 'win']])], statement: true },
  { type: 'ab_pause', ...GAME, msg: 'AB_PAUSE', args: [num('MS')], statement: true },
  { type: 'ab_runtime', ...GAME, msg: 'AB_RUNTIME', output: 'Number' },
  { type: 'ab_invert', ...GAME, msg: 'AB_INVERT', args: [ON_OFF], statement: true },

  // Sprites
  { type: 'ab_sprite_say', ...SPRITES, msg: 'AB_SPRITE_SAY', args: [sprite('SPRITE'), text('TEXT')], statement: true, inline: true },
  { type: 'ab_sprite_say_for', ...SPRITES, msg: 'AB_SPRITE_SAY_FOR', args: [sprite('SPRITE'), text('TEXT'), num('MS')], statement: true, inline: true },
  { type: 'ab_sprite_speech_position', ...SPRITES, msg: 'AB_SPRITE_SPEECH_POSITION', args: [sprite('SPRITE'), dropdown('POSITION', [['AB_SPEECH_AUTO', '0'], ['AB_SPEECH_ABOVE', '1'], ['AB_SPEECH_BELOW', '2']])], statement: true, inline: true },
  { type: 'ab_sprite_speech_width', ...SPRITES, msg: 'AB_SPRITE_SPEECH_WIDTH', args: [sprite('SPRITE'), num('WIDTH')], statement: true, inline: true },
  { type: 'ab_sprite_speech_colors', ...SPRITES, msg: 'AB_SPRITE_SPEECH_COLORS', args: [sprite('SPRITE'), dropdown('TEXT_COLOR', [['AB_COLOR_BLACK', '0'], ['AB_COLOR_WHITE', '1']]), dropdown('BACKGROUND_COLOR', [['AB_COLOR_WHITE', '1'], ['AB_COLOR_BLACK', '0']])], statement: true, inline: true },
  { type: 'ab_sprite_speech_hide', ...SPRITES, msg: 'AB_SPRITE_SPEECH_HIDE', args: [sprite('SPRITE')], statement: true, inline: true },
  { type: 'ab_sprite_create', ...SPRITES, msg: 'AB_SPRITE_CREATE', args: [image(), kind()], output: 'Sprite' },
  { type: 'ab_sprite_projectile', ...SPRITES, msg: 'AB_SPRITE_PROJECTILE', args: [image(), sprite('FROM'), num('VX'), num('VY')], output: 'Sprite', inline: true },
  { type: 'ab_sprite_projectile_position', ...SPRITES, msg: 'AB_SPRITE_PROJECTILE_POSITION', args: [image(), num('X'), num('Y'), num('VX'), num('VY')], output: 'Sprite', inline: true },
  { type: 'ab_sprite_set_prop', ...SPRITES, msg: 'AB_SPRITE_SET_PROP', args: [sprite('SPRITE'), PROP, num('VALUE')], statement: true, inline: true },
  { type: 'ab_sprite_change_prop', ...SPRITES, msg: 'AB_SPRITE_CHANGE_PROP', args: [sprite('SPRITE'), PROP, num('VALUE')], statement: true, inline: true },
  { type: 'ab_sprite_get_prop', ...SPRITES, msg: 'AB_SPRITE_GET_PROP', args: [sprite('SPRITE'), PROP_GET], output: 'Number', inline: true },
  { type: 'ab_sprite_set_position', ...SPRITES, msg: 'AB_SPRITE_SET_POSITION', args: [{ ...sprite('SPRITE'), check: ['Sprite', 'Timer'] }, num('X'), num('Y')], statement: true, inline: true },
  { type: 'ab_sprite_set_velocity', ...SPRITES, msg: 'AB_SPRITE_SET_VELOCITY', args: [sprite('SPRITE'), num('VX'), num('VY')], statement: true, inline: true },
  { type: 'ab_sprite_set_outline_width', ...SPRITES, msg: 'AB_SPRITE_SET_OUTLINE_WIDTH', args: [sprite('SPRITE'), num('WIDTH')], statement: true, inline: true },
  { type: 'ab_sprite_set_outline', ...SPRITES, msg: 'AB_SPRITE_SET_OUTLINE', args: [sprite('SPRITE'), dropdown('OUTLINE', [['AB_OUTLINE_AUTO', '3'], ['AB_OUTLINE_OFF', '0'], ['AB_COLOR_BLACK', '1'], ['AB_COLOR_WHITE', '2']])], statement: true, inline: true },
  { type: 'ab_sprite_set_z', ...SPRITES, msg: 'AB_SPRITE_SET_Z', args: [sprite('SPRITE'), num('Z')], statement: true, inline: true },
  { type: 'ab_sprite_set_image', ...SPRITES, msg: 'AB_SPRITE_SET_IMAGE', args: [sprite('SPRITE'), image()], statement: true, inline: true },
  { type: 'ab_sprite_stay_in_screen', ...SPRITES, msg: 'AB_SPRITE_STAY_IN_SCREEN', args: [sprite('SPRITE')], statement: true, inline: true },
  {
    type: 'ab_sprite_set_flag',
    ...SPRITES,
    msg: 'AB_SPRITE_SET_FLAG',
    args: [
      sprite('SPRITE'),
      dropdown('FLAG', [
        ['AB_FLAG_STAY_IN_SCREEN', 'stayInScreen'],
        ['AB_FLAG_STAY_IN_MAP', 'stayInMap'],
        ['AB_FLAG_BOUNCE_ON_WALL', 'bounceOnWall'],
        ['AB_FLAG_GHOST', 'ghost'],
        ['AB_FLAG_AUTO_DESTROY', 'autoDestroy'],
        ['AB_FLAG_DESTROY_ON_WALL', 'destroyOnWall'],
        ['AB_FLAG_INVISIBLE', 'invisible'],
      ]),
      ON_OFF,
    ],
    statement: true,
    inline: true,
  },
  { type: 'ab_sprite_animate', ...SPRITES, msg: 'AB_SPRITE_ANIMATE', args: [sprite('SPRITE'), num('MS')], statement: true, inline: true },
  { type: 'ab_sprite_destroy', ...SPRITES, msg: 'AB_SPRITE_DESTROY', args: [sprite('SPRITE')], statement: true },
  { type: 'ab_sprite_destroy_all', ...SPRITES, msg: 'AB_SPRITE_DESTROY_ALL', args: [kind()], statement: true },
  {
    type: 'ab_on_overlap',
    ...SPRITES,
    msg: 'AB_ON_OVERLAP',
    args: [variable('SPRITE', 'sprite'), kind('KIND_A'), variable('OTHER', 'otherSprite'), kind('KIND_B')],
    hat: true,
    body: true,
  },
  { type: 'ab_sprite_overlaps', ...SPRITES, msg: 'AB_SPRITE_OVERLAPS', args: [sprite('A'), sprite('B')], output: 'Boolean', inline: true },
  {
    type: 'ab_sprite_is_hitting',
    ...SPRITES,
    msg: 'AB_SPRITE_IS_HITTING',
    args: [
      sprite('SPRITE'),
      dropdown('DIR', [
        ['AB_DIR_BOTTOM', 'bottom'],
        ['AB_DIR_TOP', 'top'],
        ['AB_DIR_LEFT', 'left'],
        ['AB_DIR_RIGHT', 'right'],
      ]),
    ],
    output: 'Boolean',
    inline: true,
  },
  { type: 'ab_sprite_is_kind', ...SPRITES, msg: 'AB_SPRITE_IS_KIND', args: [sprite('SPRITE'), kind()], output: 'Boolean', inline: true },
  { type: 'ab_sprite_set_kind', ...SPRITES, msg: 'AB_SPRITE_SET_KIND', args: [sprite('SPRITE'), kind()], statement: true, inline: true },
  { type: 'ab_sprite_exists', ...SPRITES, msg: 'AB_SPRITE_EXISTS', args: [sprite('SPRITE')], output: 'Boolean', inline: true },
  { type: 'ab_for_each_kind', ...SPRITES, msg: 'AB_FOR_EACH_KIND', args: [variable('VAR', 'value'), kind()], statement: true, body: true },

  // Controller
  {
    type: 'ab_on_button',
    ...CONTROLLER,
    msg: 'AB_ON_BUTTON',
    args: [
      dropdown('BUTTON', [...BUTTON_KEYS, ['AB_BUTTON_AB', 'ab'], ['AB_BUTTON_DIRECTION', 'direction'], ['AB_BUTTON_ANY', 'any']]),
      dropdown('EVENT', [['AB_PRESSED', 'pressed'], ['AB_RELEASED', 'released']]),
    ],
    hat: true,
    body: true,
  },
  { type: 'ab_is_pressed', ...CONTROLLER, msg: 'AB_IS_PRESSED', args: [BUTTON], output: 'Boolean' },
  { type: 'ab_move_sprite', ...CONTROLLER, msg: 'AB_MOVE_SPRITE', args: [sprite('SPRITE'), num('VX'), num('VY')], statement: true, inline: true },

  // Scene
  { type: 'ab_set_tilemap', ...SCENE, msg: 'AB_SET_TILEMAP', args: [{ type: 'field_ab_tilemap', name: 'MAP' }], statement: true },
  { type: 'ab_camera_follow', ...SCENE, msg: 'AB_CAMERA_FOLLOW', args: [sprite('SPRITE')], statement: true },
  { type: 'ab_set_camera', ...SCENE, msg: 'AB_SET_CAMERA', args: [num('X'), num('Y')], statement: true, inline: true },
  { type: 'ab_camera_x', ...SCENE, msg: 'AB_CAMERA_X', output: 'Number' },
  { type: 'ab_camera_y', ...SCENE, msg: 'AB_CAMERA_Y', output: 'Number' },
  { type: 'ab_shake', ...SCENE, msg: 'AB_SHAKE', args: [num('STRENGTH'), num('MS')], statement: true, inline: true },
  { type: 'ab_bg_set', ...SCENE, msg: 'AB_BG_SET', args: [{ type: 'field_ab_background', name: 'BG' }], statement: true },
  { type: 'ab_bg_layer_set', ...SCENE, msg: 'AB_BG_LAYER_SET', args: [backgroundLayer(), { type: 'field_ab_background', name: 'BG' }, num('PERCENT')], statement: true, inline: true },
  { type: 'ab_bg_layer_clear', ...SCENE, msg: 'AB_BG_LAYER_CLEAR', args: [backgroundLayer()], statement: true },
  { type: 'ab_bg_layer_position', ...SCENE, msg: 'AB_BG_LAYER_POSITION', args: [backgroundLayer(), num('X'), num('Y')], statement: true, inline: true },
  { type: 'ab_bg_layer_change_position', ...SCENE, msg: 'AB_BG_LAYER_CHANGE_POSITION', args: [backgroundLayer(), num('X'), num('Y')], statement: true, inline: true },
  { type: 'ab_bg_clear', ...SCENE, msg: 'AB_BG_CLEAR', statement: true },
  { type: 'ab_bg_set_position', ...SCENE, msg: 'AB_BG_SET_POSITION', args: [num('X'), num('Y')], statement: true, inline: true },
  { type: 'ab_bg_change_position', ...SCENE, msg: 'AB_BG_CHANGE_POSITION', args: [num('X'), num('Y')], statement: true, inline: true },
  { type: 'ab_bg_x', ...SCENE, msg: 'AB_BG_X', output: 'Number' },
  { type: 'ab_bg_y', ...SCENE, msg: 'AB_BG_Y', output: 'Number' },
  { type: 'ab_spawn_on_tiles', ...SCENE, msg: 'AB_SPAWN_ON_TILES', args: [tile(), image(), kind()], statement: true },
  {
    type: 'ab_on_tile',
    ...SCENE,
    msg: 'AB_ON_TILE',
    args: [variable('SPRITE', 'sprite'), kind(), tile(), variable('COL', 'col'), variable('ROW', 'row')],
    hat: true,
    body: true,
  },
  { type: 'ab_set_tile', ...SCENE, msg: 'AB_SET_TILE', args: [num('COL'), num('ROW'), tile()], statement: true, inline: true },
  { type: 'ab_tile_is', ...SCENE, msg: 'AB_TILE_IS', args: [num('COL'), num('ROW'), tile()], output: 'Boolean', inline: true },
  { type: 'ab_place_on_tile', ...SCENE, msg: 'AB_PLACE_ON_TILE', args: [sprite('SPRITE'), num('COL'), num('ROW')], statement: true, inline: true },

  // Info
  { type: 'ab_timer_set', ...INFO, msg: 'AB_TIMER_SET', args: [TIMER, num('SECONDS')], statement: true, inline: true },
  { type: 'ab_timer_change', ...INFO, msg: 'AB_TIMER_CHANGE', args: [TIMER, num('VALUE')], statement: true, inline: true },
  { type: 'ab_timer_set_millis', ...INFO, msg: 'AB_TIMER_SET_MILLIS', args: [TIMER, num('VALUE')], statement: true, inline: true },
  { type: 'ab_timer_change_millis', ...INFO, msg: 'AB_TIMER_CHANGE_MILLIS', args: [TIMER, num('VALUE')], statement: true, inline: true },
  { type: 'ab_timer_millis', ...INFO, msg: 'AB_TIMER_MILLIS', args: [TIMER], output: 'Number' },
  { type: 'ab_timer_run', ...INFO, msg: 'AB_TIMER_RUN', args: [TIMER, dropdown('MODE', [['AB_TIMER_UP', '1'], ['AB_TIMER_DOWN', '-1'], ['AB_TIMER_STOP', '0']])], statement: true },
  { type: 'ab_timer_format', ...INFO, msg: 'AB_TIMER_FORMAT', args: [TIMER, dropdown('FORMAT', [['AB_TIMER_SECONDS', '0'], ['AB_TIMER_MINUTES', '1'], ['AB_TIMER_HOURS', '2'], ['AB_TIMER_MS', '3'], ['AB_TIMER_HMS', '4'], ['AB_TIMER_MS_MILLIS', '6'], ['AB_TIMER_HMS_MILLIS', '7'], ['AB_TIMER_HIDE', '5']])], statement: true },
  { type: 'ab_timer_position', ...INFO, msg: 'AB_TIMER_POSITION', args: [TIMER, num('X'), num('Y')], statement: true, inline: true },
  { type: 'ab_info_position', ...INFO, msg: 'AB_INFO_POSITION', args: [{ type: 'field_ab_hud', name: 'DISPLAY' }, num('X'), num('Y')], statement: true, inline: true },
  { type: 'ab_timer', ...INFO, msg: 'AB_TIMER_VALUE', args: [TIMER], output: ['Number', 'Timer'] },
  { type: 'ab_score_set', ...INFO, msg: 'AB_SCORE_SET', args: [num('VALUE')], statement: true },
  { type: 'ab_score_change', ...INFO, msg: 'AB_SCORE_CHANGE', args: [num('VALUE')], statement: true },
  { type: 'ab_score_position', ...INFO, msg: 'AB_SCORE_POSITION', args: [num('X'), num('Y')], statement: true, inline: true },
  { type: 'ab_score', ...INFO, msg: 'AB_SCORE', output: 'Number' },
  { type: 'ab_life_set', ...INFO, msg: 'AB_LIFE_SET', args: [num('VALUE')], statement: true },
  { type: 'ab_life_change', ...INFO, msg: 'AB_LIFE_CHANGE', args: [num('VALUE')], statement: true },
  { type: 'ab_life', ...INFO, msg: 'AB_LIFE', output: 'Number' },
  { type: 'ab_on_life_zero', ...INFO, msg: 'AB_ON_LIFE_ZERO', hat: true, body: true },
  { type: 'ab_hiscore', ...INFO, msg: 'AB_HISCORE', output: 'Number' },
  { type: 'ab_storage_save', ...INFO, msg: 'AB_STORAGE_SAVE', args: [num('VALUE'), num('SLOT')], statement: true, inline: true },
  { type: 'ab_storage_load', ...INFO, msg: 'AB_STORAGE_LOAD', args: [num('SLOT')], output: 'Number', inline: true },

  // Graphics
  { type: 'ab_draw_text', ...GRAPHICS, msg: 'AB_DRAW_TEXT', args: [text('TEXT'), num('X'), num('Y'), COLOR], statement: true, inline: true },
  { type: 'ab_draw_pixel', ...GRAPHICS, msg: 'AB_DRAW_PIXEL', args: [num('X'), num('Y'), COLOR], statement: true, inline: true },
  { type: 'ab_draw_line', ...GRAPHICS, msg: 'AB_DRAW_LINE', args: [num('X0'), num('Y0'), num('X1'), num('Y1'), COLOR], statement: true, inline: true },
  {
    type: 'ab_draw_rect',
    ...GRAPHICS,
    msg: 'AB_DRAW_RECT',
    args: [dropdown('FILL', [['AB_OUTLINE', 'outline'], ['AB_FILLED', 'filled']]), num('X'), num('Y'), num('W'), num('H'), COLOR],
    statement: true,
    inline: true,
  },
  {
    type: 'ab_draw_circle',
    ...GRAPHICS,
    msg: 'AB_DRAW_CIRCLE',
    args: [dropdown('FILL', [['AB_OUTLINE', 'outline'], ['AB_FILLED', 'filled']]), num('X'), num('Y'), num('R'), COLOR],
    statement: true,
    inline: true,
  },
  { type: 'ab_draw_image', ...GRAPHICS, msg: 'AB_DRAW_IMAGE', args: [image(), num('X'), num('Y')], statement: true, inline: true },
  { type: 'ab_get_pixel', ...GRAPHICS, msg: 'AB_GET_PIXEL', args: [num('X'), num('Y')], output: 'Boolean', inline: true },

  // Music
  {
    type: 'ab_play_effect',
    ...MUSIC,
    msg: 'AB_PLAY_EFFECT',
    args: [
      dropdown('SFX', SFX_MENU.map((name) => [`AB_SFX_${name.toUpperCase()}`, name])),
    ],
    statement: true,
  },
  { type: 'ab_play_poly_effect', ...POLYPHONIC, msg: 'AB_PLAY_POLY_EFFECT', args: [dropdown('SFX', POLYPHONIC_EFFECT_NAMES.map(name=>[`AB_SFX_${name.toUpperCase()}`,name]))], statement: true },
  { type: 'ab_play_tone', ...MUSIC, msg: 'AB_PLAY_TONE', args: [num('FREQ'), num('MS')], statement: true, inline: true },
  { type: 'ab_play_named_melody', ...MUSIC, msg: 'AB_PLAY_NAMED_MELODY', args: [{ type: 'field_ab_melody', name: 'MELODY' }, dropdown('MODE', [['AB_MELODY_ONCE', 'once'], ['AB_MELODY_LOOP', 'loop']])], statement: true, inline: true },
  { type: 'ab_stop_sound', ...MUSIC, msg: 'AB_STOP_SOUND', statement: true },
  {
    type: 'ab_play_song',
    ...POLYPHONIC,
    msg: 'AB_PLAY_SONG',
    args: [
      { type: 'field_ab_song_choice', name: 'SONG' },
      dropdown('MODE', [['AB_MELODY_LOOP', 'loop'], ['AB_MELODY_ONCE', 'once']]),
    ],
    statement: true,
    inline: true,
  },
  { type: 'ab_play_named_song', ...POLYPHONIC, msg: 'AB_PLAY_SONG', args: [{ type: 'field_ab_song', name: 'SONG' }, dropdown('MODE', [['AB_MELODY_LOOP', 'loop'], ['AB_MELODY_ONCE', 'once']])], statement: true, inline: true },
  { type: 'ab_set_song_volume', ...POLYPHONIC, msg: 'AB_SET_SONG_VOLUME', args: [num('VOLUME')], statement: true, inline: true },
  { type: 'ab_stop_song', ...POLYPHONIC, msg: 'AB_STOP_SONG', statement: true },
  { type: 'ab_pitch', ...MUSIC, msg: 'AB_PITCH', args: [num('FROM'), num('TO')], statement: true, body: true, inline: true },
  {
    type: 'ab_play_melody',
    extensions: ['ab_melody_recorder'],
    ...MUSIC,
    msg: 'AB_PLAY_MELODY',
    args: [
      { type: 'field_input', name: 'NOTES', text: 'C D E C' },
      num('TEMPO'),
      dropdown('MODE', [['AB_MELODY_ONCE', 'once'], ['AB_MELODY_LOOP', 'loop']]),
    ],
    statement: true,
    inline: true,
  },
  {
    type: 'ab_note',
    ...MUSIC,
    msg: 'AB_NOTE',
    // Note names are the same in every language, so no translation keys.
    args: [{ type: 'field_dropdown', name: 'NOTE', options: NOTE_CHOICES.map(([name, f]) => [name, String(f)]) }],
    output: 'Number',
  },

  // Math
  { type: 'ab_map', ...MATH, msg: 'AB_MAP', args: [num('VALUE'), num('FROM_LOW'), num('FROM_HIGH'), num('TO_LOW'), num('TO_HIGH')], output: 'Number', inline: true },
  { type: 'ab_random', ...MATH, msg: 'AB_RANDOM', args: [num('FROM'), num('TO')], output: 'Number', inline: true },
  {
    type: 'ab_minmax',
    ...MATH,
    msg: 'AB_MINMAX',
    args: [dropdown('OP', [['AB_MIN', 'min'], ['AB_MAX', 'max']]), num('A'), num('B')],
    output: 'Number',
    inline: true,
  },

  // Comments can sit in a stack or label a group without changing execution.
  { type: 'ab_comment', ...CUSTOM, msg: 'AB_COMMENT', args: [{ type: 'field_multilinetext', name: 'TEXT', text: '' }], statement: true },
  { type: 'ab_comment_group', ...CUSTOM, msg: 'AB_COMMENT_GROUP', args: [{ type: 'field_multilinetext', name: 'TEXT', text: '' }], statement: true, body: true },

  // Custom
  { type: 'ab_cpp', ...CUSTOM, msg: 'AB_CPP', args: [{ type: 'field_multilinetext', name: 'CODE', text: '// C++' }], statement: true },
];

function toJson(d: Def): Record<string, unknown> {
  const json: Record<string, unknown> = {
    type: d.type,
    message0: `%{BKY_${d.msg}}`,
    args0: d.args ?? [],
    style: d.style,
    extensions: [`ab_icon_${d.icon}`],
    tooltip: `%{BKY_${d.msg}_TOOLTIP}`,
  };
  if (d.output !== undefined) json.output = d.output;
  if (d.statement || d.part) {
    json.previousStatement = d.part ?? null;
    json.nextStatement = d.part ?? null;
  }
  if (d.hat) json.hat = 'cap';
  if (d.body) {
    json.message1 = '%1';
    json.args1 = [{ type: 'input_statement', name: 'DO', ...(d.bodyCheck && { check: d.bodyCheck }) }];
  }
  if (d.extensions) (json.extensions as string[]).push(...d.extensions);
  if (d.inline) json.inputsInline = true;
  if (d.rows) (json.extensions as string[]).push('ab_rows');
  return json;
}

let defined = false;

export function defineBlocks() {
  if (defined) return;
  defined = true;
  registerFieldMultilineInput();
  registerAssetFields();
  registerPointPicker();
  registerMelodyRecorder();
  registerAltDrag();
  registerSpriteVarNames();
  registerBlockInfo();
  registerEffectBlocks();
  registerTextJoin();
  for (const name of Object.keys(ICONS) as IconName[]) {
    Blockly.Extensions.register(`ab_icon_${name}`, function (this: Blockly.Block) {
      const first = this.inputList[0];
      if (first) first.insertFieldAt(0, new Blockly.FieldImage(ICONS[name], 16, 16, ''), 'ICON');
    });
  }
  const rows = new Map(DEFS.map((d) => [d.type, d.rows ?? []]));
  Blockly.Extensions.register('ab_rows', function (this: Blockly.Block) {
    rows.get(this.type)!.forEach((name, i) => {
      this.appendEndRowInput(`ROW${i}`);
      this.moveInputBefore(`ROW${i}`, name);
    });
  });
  Blockly.common.defineBlocksWithJsonArray(DEFS.map(toJson));
}

/** Block types that start a script (events). */
export const EVENT_BLOCKS = new Set(DEFS.filter((d) => d.hat).map((d) => d.type));
