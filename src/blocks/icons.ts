// Simple one color line icons for the block categories. Drawn as SVG with a
// white stroke so they work on every theme.

const svg = (body: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="butt" stroke-linejoin="miter">${body}</svg>`,
  );

export const ICONS = {
  favourites: svg('<path d="M8 1l2.1 4.4 4.9.7-3.5 3.4.8 4.8L8 12l-4.3 2.3.8-4.8L1 6.1l4.9-.7z"/>'),
  game: svg('<rect x="1.5" y="4" width="13" height="8"/><path d="M4.5 8h3M6 6.5v3"/><circle cx="11" cy="7" r=".6"/><circle cx="12.3" cy="9" r=".6"/>'),
  sprites: svg('<path d="M4 2.5h8v3h2v6h-2v2H4v-2H2v-6h2z"/><path d="M6 7h1M9 7h1"/>'),
  controller: svg('<circle cx="8" cy="8" r="6"/><path d="M8 4.5v2M8 9.5v2M4.5 8h2M9.5 8h2"/>'),
  scene: svg('<rect x="1.5" y="2.5" width="13" height="11"/><path d="M1.5 10l3.5-3 3 2.5 2.5-2 4 3.5"/>'),
  info: svg('<path d="M8 2.5l1.7 3.5 3.8.5-2.8 2.6.7 3.8L8 11l-3.4 1.9.7-3.8-2.8-2.6 3.8-.5z"/>'),
  graphics: svg('<path d="M2.5 13.5l3-1 7.5-7.5-2-2L3.5 10.5z"/><path d="M9.5 4.5l2 2"/>'),
  particles: svg('<path d="M3 13l4-4M9 7l2-2"/><rect x="11.5" y="1.5" width="2" height="2"/><rect x="13" y="6" width="1.5" height="1.5"/><rect x="7" y="2" width="1.5" height="1.5"/><circle cx="3" cy="13" r="1.4"/>'),
  beep: svg('<path d="M7 12V2l5 2v3L7 5"/><circle cx="5" cy="12" r="2"/>'),
  music: svg('<path d="M6 12.5V3.5l7-1.5v9"/><circle cx="4.5" cy="12.5" r="1.8"/><circle cx="11.5" cy="11" r="1.8"/>'),
  logic: svg('<path d="M2 8h4l2-4h6M8 8l2 4h4"/>'),
  loops: svg('<path d="M12.5 6A5 5 0 1 0 13 9.5"/><path d="M13 2.5V6H9.5"/>'),
  math: svg('<path d="M3 4.5h4M5 2.5v4M9.5 4.5h4M3.5 10l3 3M6.5 10l-3 3M9.5 10.5h4M9.5 12.5h4"/>'),
  variables: svg('<path d="M4.5 2.5c-2 0-2 2-2 3s-1 2-1.5 2.5c.5.5 1.5 1 1.5 2.5s0 3 2 3M11.5 2.5c2 0 2 2 2 3s1 2 1.5 2.5c-.5.5-1.5 1-1.5 2.5s0 3-2 3"/><path d="M6 6l4 4M10 6l-4 4"/>'),
  functions: svg('<path d="M10.5 2.5c-2 0-2.5 1-3 3l-1.5 6c-.5 2-1 2.5-2.5 2.5M5 7h5"/>'),
  custom: svg('<path d="M5.5 4L2 8l3.5 4M10.5 4L14 8l-3.5 4"/>'),
} as const;

export type IconName = keyof typeof ICONS;
