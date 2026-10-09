// Block definitions. Texts are translation keys (Blockly.Msg) so the blocks
// can be shown in every language. The meaning of each block is in toIR.ts.

import * as Blockly from 'blockly/core';
import { registerFieldMultilineInput } from '@blockly/field-multilineinput';
import { registerAssetFields } from './assets';
import { registerPointPicker } from './point-picker';
import { registerAltDrag } from './alt-drag';
import { ICONS, type IconName } from './icons';
import { NOTE_CHOICES } from '../engine/melody';

type Arg = Record<string, unknown>;

const num = (name: string): Arg => ({ type: 'input_value', name, check: 'Number' });
const text = (name: string): Arg => ({ type: 'input_value', name, check: ['String', 'Number'] });
const sprite = (name: string): Arg => ({ type: 'input_value', name, check: 'Sprite' });
const image = (name = 'IMAGE'): Arg => ({ type: 'field_ab_image', name });
const kind = (name = 'KIND'): Arg => ({ type: 'field_ab_kind', name });
const tile = (name = 'TILE'): Arg => ({ type: 'field_ab_tile', name });
const variable = (name: string, def: string): Arg => ({ type: 'field_variable', name, variable: def });
const dropdown = (name: string, keys: [string, string][]): Arg => ({
  type: 'field_dropdown',
  name,
  options: keys.map(([label, value]) => [`%{BKY_${label}}`, value]),
});

const COLOR = dropdown('COLOR', [
  ['AB_COLOR_WHITE', 'white'],
  ['AB_COLOR_BLACK', 'black'],
  ['AB_COLOR_INVERT', 'invert'],
]);
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
const BUTTON = dropdown('BUTTON', [
  ['AB_BUTTON_A', 'a'],
  ['AB_BUTTON_B', 'b'],
  ['AB_BUTTON_UP', 'up'],
  ['AB_BUTTON_DOWN', 'down'],
  ['AB_BUTTON_LEFT', 'left'],
  ['AB_BUTTON_RIGHT', 'right'],
]);
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
  output?: string | null;
  statement?: boolean;
  hat?: boolean;
  /** Statement input after the text, for event and loop blocks. */
  body?: boolean;
  inline?: boolean;
}

const GAME = { icon: 'game', style: 'ab_game' } as const;
const SPRITES = { icon: 'sprites', style: 'ab_sprites' } as const;
const CONTROLLER = { icon: 'controller', style: 'ab_controller' } as const;
const SCENE = { icon: 'scene', style: 'ab_scene' } as const;
const INFO = { icon: 'info', style: 'ab_info' } as const;
const GRAPHICS = { icon: 'graphics', style: 'ab_graphics' } as const;
const MUSIC = { icon: 'music', style: 'ab_music' } as const;
const MATH = { icon: 'math', style: 'ab_math' } as const;
const CUSTOM = { icon: 'custom', style: 'ab_custom' } as const;

export const DEFS: Def[] = [
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
  { type: 'ab_sprite_create', ...SPRITES, msg: 'AB_SPRITE_CREATE', args: [image(), kind()], output: 'Sprite' },
  { type: 'ab_sprite_projectile', ...SPRITES, msg: 'AB_SPRITE_PROJECTILE', args: [image(), sprite('FROM'), num('VX'), num('VY')], output: 'Sprite', inline: true },
  { type: 'ab_sprite_set_prop', ...SPRITES, msg: 'AB_SPRITE_SET_PROP', args: [sprite('SPRITE'), PROP, num('VALUE')], statement: true, inline: true },
  { type: 'ab_sprite_change_prop', ...SPRITES, msg: 'AB_SPRITE_CHANGE_PROP', args: [sprite('SPRITE'), PROP, num('VALUE')], statement: true, inline: true },
  { type: 'ab_sprite_get_prop', ...SPRITES, msg: 'AB_SPRITE_GET_PROP', args: [sprite('SPRITE'), PROP_GET], output: 'Number', inline: true },
  { type: 'ab_sprite_set_position', ...SPRITES, msg: 'AB_SPRITE_SET_POSITION', args: [sprite('SPRITE'), num('X'), num('Y')], statement: true, inline: true },
  { type: 'ab_sprite_set_velocity', ...SPRITES, msg: 'AB_SPRITE_SET_VELOCITY', args: [sprite('SPRITE'), num('VX'), num('VY')], statement: true, inline: true },
  { type: 'ab_sprite_set_image', ...SPRITES, msg: 'AB_SPRITE_SET_IMAGE', args: [sprite('SPRITE'), image()], statement: true, inline: true },
  {
    type: 'ab_sprite_set_flag',
    ...SPRITES,
    msg: 'AB_SPRITE_SET_FLAG',
    args: [
      sprite('SPRITE'),
      dropdown('FLAG', [
        ['AB_FLAG_STAY_IN_SCREEN', 'stayInScreen'],
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
    args: [BUTTON, dropdown('EVENT', [['AB_PRESSED', 'pressed'], ['AB_RELEASED', 'released']])],
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
  { type: 'ab_score_set', ...INFO, msg: 'AB_SCORE_SET', args: [num('VALUE')], statement: true },
  { type: 'ab_score_change', ...INFO, msg: 'AB_SCORE_CHANGE', args: [num('VALUE')], statement: true },
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
      dropdown('SFX', [
        ['AB_SFX_JUMP', 'jump'],
        ['AB_SFX_COIN', 'coin'],
        ['AB_SFX_HIT', 'hit'],
        ['AB_SFX_POWERUP', 'powerUp'],
        ['AB_SFX_EXPLOSION', 'explosion'],
        ['AB_SFX_WIN', 'win'],
        ['AB_SFX_LOSE', 'lose'],
        ['AB_SFX_SHOOT', 'shoot'],
      ]),
    ],
    statement: true,
  },
  { type: 'ab_play_tone', ...MUSIC, msg: 'AB_PLAY_TONE', args: [num('FREQ'), num('MS')], statement: true, inline: true },
  { type: 'ab_stop_sound', ...MUSIC, msg: 'AB_STOP_SOUND', statement: true },
  {
    type: 'ab_play_melody',
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
  if (d.statement) {
    json.previousStatement = null;
    json.nextStatement = null;
  }
  if (d.hat) json.hat = 'cap';
  if (d.body) {
    json.message1 = '%1';
    json.args1 = [{ type: 'input_statement', name: 'DO' }];
  }
  if (d.inline) json.inputsInline = true;
  return json;
}

let defined = false;

export function defineBlocks() {
  if (defined) return;
  defined = true;
  registerFieldMultilineInput();
  registerAssetFields();
  registerPointPicker();
  registerAltDrag();
  for (const name of Object.keys(ICONS) as IconName[]) {
    Blockly.Extensions.register(`ab_icon_${name}`, function (this: Blockly.Block) {
      const first = this.inputList[0];
      if (first) first.insertFieldAt(0, new Blockly.FieldImage(ICONS[name], 16, 16, ''), 'ICON');
    });
  }
  Blockly.common.defineBlocksWithJsonArray(DEFS.map(toJson));
}

/** Block types that start a script (events). */
export const EVENT_BLOCKS = new Set(DEFS.filter((d) => d.hat).map((d) => d.type));
