// Editor themes. Each theme sets CSS variables for the page and a Blockly
// theme for the blocks.

import * as Blockly from 'blockly/core';

export type ThemeId = 'arduboy' | 'color' | 'greyscale' | 'blue' | 'green';
export const THEME_IDS: ThemeId[] = ['arduboy', 'color', 'greyscale', 'blue', 'green'];

const CATEGORIES = ['game', 'sprites', 'controller', 'scene', 'info', 'graphics', 'music', 'logic', 'loops', 'math', 'variables', 'functions', 'text', 'custom'] as const;
type Category = (typeof CATEGORIES)[number];

interface ThemeDef {
  page: Record<string, string>;
  blocks: Record<Category, string>;
  workspace: string;
  toolbox: string;
  toolboxText: string;
  flyout: string;
  dark: boolean;
}

/** Shades of one hue, light to dark, for the one colour themes. */
function shades(hue: number, sat: number): Record<Category, string> {
  const out = {} as Record<Category, string>;
  CATEGORIES.forEach((c, i) => {
    const light = 30 + ((i * 7) % 5) * 7 + (i % 2) * 4;
    out[c] = `hsl(${hue}, ${sat}%, ${light}%)`;
  });
  return out;
}

const THEMES: Record<ThemeId, ThemeDef> = {
  arduboy: {
    dark: true,
    page: { '--bg': '#0b0b0c', '--panel': '#2a2a2d', '--panel-2': '#38383c', '--text': '#e8e4dc', '--muted': '#a9a39a', '--accent': '#c9a36b', '--accent-text': '#1b1612', '--border': '#45454a', '--danger': '#d9705f', '--ok': '#8fbf7a' },
    blocks: {
      game: '#8a6f4e', sprites: '#7a6a8a', controller: '#9a5f4f', scene: '#5f7a6a', info: '#a08048', graphics: '#6a7f8f',
      music: '#8f5f73', logic: '#6f7f55', loops: '#7f8a5a', math: '#5a6f8a', variables: '#a0704a', functions: '#7a5a5a', text: '#6f6a5a', custom: '#555555',
    },
    workspace: '#141415',
    toolbox: '#2a2a2d',
    toolboxText: '#e8e4dc',
    flyout: '#232326',
  },
  color: {
    dark: false,
    page: { '--bg': '#f2f4f8', '--panel': '#ffffff', '--panel-2': '#e7ebf2', '--text': '#1d2333', '--muted': '#5d6578', '--accent': '#3b6fe0', '--accent-text': '#ffffff', '--border': '#cfd5e1', '--danger': '#d23c3c', '--ok': '#2f9e55' },
    blocks: {
      game: '#e0752d', sprites: '#4b6cf0', controller: '#d54322', scene: '#2fa38f', info: '#cf63cf', graphics: '#2f9ad9',
      music: '#e3008c', logic: '#4cb050', loops: '#00aa63', math: '#7e3fe0', variables: '#ef5a2b', functions: '#3455db', text: '#b8860b', custom: '#4d4d4d',
    },
    workspace: '#f9fafc',
    toolbox: '#ffffff',
    toolboxText: '#1d2333',
    flyout: '#eef1f6',
  },
  greyscale: {
    dark: true,
    page: { '--bg': '#101010', '--panel': '#262626', '--panel-2': '#333333', '--text': '#ececec', '--muted': '#a0a0a0', '--accent': '#d0d0d0', '--accent-text': '#111111', '--border': '#444444', '--danger': '#e07070', '--ok': '#9fcf9f' },
    blocks: shades(0, 0),
    workspace: '#181818',
    toolbox: '#262626',
    toolboxText: '#ececec',
    flyout: '#202020',
  },
  blue: {
    dark: true,
    page: { '--bg': '#07111f', '--panel': '#132338', '--panel-2': '#1b3150', '--text': '#e3eefc', '--muted': '#93a9c6', '--accent': '#5aaaf0', '--accent-text': '#07111f', '--border': '#284566', '--danger': '#f08070', '--ok': '#80d0a0' },
    blocks: shades(212, 55),
    workspace: '#0c1828',
    toolbox: '#132338',
    toolboxText: '#e3eefc',
    flyout: '#0f1d30',
  },
  green: {
    dark: true,
    page: { '--bg': '#07130b', '--panel': '#13281a', '--panel-2': '#1b3824', '--text': '#e2f6e7', '--muted': '#93b89d', '--accent': '#6cd08a', '--accent-text': '#07130b', '--border': '#2a4d34', '--danger': '#f08070', '--ok': '#a0e0b0' },
    blocks: shades(140, 45),
    workspace: '#0b1a10',
    toolbox: '#13281a',
    toolboxText: '#e2f6e7',
    flyout: '#0f2015',
  },
};

const blocklyThemes = new Map<ThemeId, Blockly.Theme>();

export function blocklyTheme(id: ThemeId): Blockly.Theme {
  let theme = blocklyThemes.get(id);
  if (theme) return theme;
  const def = THEMES[id];
  const blockStyles: Record<string, Partial<Blockly.Theme.BlockStyle>> = {};
  const categoryStyles: Record<string, Blockly.Theme.CategoryStyle> = {};
  for (const c of CATEGORIES) {
    blockStyles[`ab_${c}`] = { colourPrimary: def.blocks[c], hat: 'cap' };
    categoryStyles[`ab_${c}`] = { colour: def.blocks[c] };
  }
  // Styles used by the built in Blockly blocks.
  const builtin: Record<string, Category> = {
    logic_blocks: 'logic',
    loop_blocks: 'loops',
    math_blocks: 'math',
    text_blocks: 'text',
    variable_blocks: 'variables',
    variable_dynamic_blocks: 'variables',
    procedure_blocks: 'functions',
    list_blocks: 'variables',
    colour_blocks: 'graphics',
  };
  for (const [style, c] of Object.entries(builtin)) blockStyles[style] = { colourPrimary: def.blocks[c] };
  theme = Blockly.Theme.defineTheme(`ab_${id}`, {
    name: `ab_${id}`,
    base: Blockly.Themes.Classic,
    blockStyles,
    categoryStyles,
    componentStyles: {
      workspaceBackgroundColour: def.workspace,
      toolboxBackgroundColour: def.toolbox,
      toolboxForegroundColour: def.toolboxText,
      flyoutBackgroundColour: def.flyout,
      flyoutForegroundColour: def.toolboxText,
      flyoutOpacity: 0.97,
      scrollbarColour: def.dark ? '#666' : '#bbb',
      insertionMarkerColour: def.dark ? '#fff' : '#000',
      insertionMarkerOpacity: 0.3,
      cursorColour: def.page['--accent'],
    },
    fontStyle: { family: 'system-ui, sans-serif', size: 11, weight: '600' },
    startHats: true,
  });
  blocklyThemes.set(id, theme);
  return theme;
}

export function applyPageTheme(id: ThemeId) {
  const def = THEMES[id];
  const root = document.documentElement;
  for (const [k, v] of Object.entries(def.page)) root.style.setProperty(k, v);
  root.dataset.theme = id;
  root.style.colorScheme = def.dark ? 'dark' : 'light';
}
