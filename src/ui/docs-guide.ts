// Illustrated editor guide. Screenshots are from the unmodified Platformer template.
import { t } from '../i18n/i18n';
import { BUILTIN_PROFILES, BUTTONS, SECRET_PROFILES } from '../hw/profile';
import { tinyDipPin } from '../hw/attiny85-pinout';
import { getChip } from '../hw/chips';
import { platformer } from '../templates/platformer';
import { h } from './dom';
import { musicGuide } from './docs-music';
import favouritesExample from '../../docs/images/favourites.png';
import backgroundExample from '../../assets/backgrounds/mono/forest-path.png';

type Json = Record<string, any>;
const asset = (file: string) => `${import.meta.env.BASE_URL}docs/${file}`;

function figure(file: string, key: string, credit?: string) {
  const url = asset(file);
  return h('figure', { class: 'docs-figure' },
    h('a', { href: url, target: '_blank', rel: 'noopener', 'aria-label': t('docs.visual.enlarge') },
      h('img', { src: url, alt: t(key), loading: 'lazy', decoding: 'async' })),
    h('figcaption', {}, t(key)),
    credit && h('small', { class: 'docs-credit' }, credit));
}
function step(id: string, file?: string) {
  return h('article', { class: 'docs-step' }, h('h3', {}, t(`docs.visual.${id}.title`)),
    ...t(`docs.visual.${id}.body`).split('\n\n').map(p => h('p', {}, p)),
    file && figure(file, `docs.visual.${id}.caption`));
}

export function illustratedGuide(id: string, picture: (blocks: Json[], overview?: boolean) => HTMLElement): HTMLElement {
  if (id === 'sound') return musicGuide(picture);
  const el = h('div', { class: 'docs-illustrated' });
  if (id === 'start') {
    el.append(figure('arduboy-front-back.jpg', 'docs.visual.arduboy.caption', 'Foto: Drummyfish · CC0'),
      step('first'), figure('simulator.png', 'docs.visual.sim.caption'),
      h('article', { class: 'docs-step' }, h('h3', {}, t('docs.search.help.title')),
        ...t('docs.search.help.body').split('\n\n').map(p => h('p', {}, p)),
        h('figure', { class: 'docs-figure' },
          h('div', { class: 'docs-search-preview' }, h('span', {}, t('docs.search.label')), h('strong', {}, 'collision')),
          h('figcaption', {}, t('docs.search.placeholder')))));
  } else if (id === 'blocks') {
    el.append(step('events'), picture([
      { type: 'ab_on_start', inputs: { DO: { block: { type: 'ab_score_set', inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 0 } } } } } } } },
      { type: 'ab_on_button', fields: { BUTTON: 'a', EVENT: 'pressed' }, inputs: { DO: { block: { type: 'ab_score_change', inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } } } } },
    ]), step('code'), picture((platformer.blocks as Json).blocks.blocks, true));
  } else if (id === 'favourites') {
    el.append(h('figure', { class: 'docs-figure' },
      h('a', { href: favouritesExample, target: '_blank', rel: 'noopener', 'aria-label': t('docs.visual.enlarge') },
        h('img', { src: favouritesExample, alt: t('docs.favourites.title'), loading: 'lazy' })),
      h('figcaption', {}, t('docs.favourites.title'))));
  } else if (id === 'assets') {
    el.append(step('sprite', 'sprites.png'), step('tile', 'tiles.png'), step('map', 'tilemap.png'),
      step('background'),
      h('figure', { class: 'docs-figure' },
        h('img', { class: 'library-set-preview', src: backgroundExample, width: 512, height: 256, alt: t('docs.visual.background.caption'), loading: 'lazy' }),
        h('figcaption', {}, t('docs.visual.background.caption'))),
      step('connect'));
  } else if (id === 'sim') {
    el.append(figure('simulator.png', 'docs.visual.sim.caption'), step('test'));
  } else if (id === 'device') {
    el.append(figure('arduboy-front-back.jpg', 'docs.visual.arduboy.caption', 'Foto: Drummyfish · CC0'), step('export'));
  } else if (id === 'homemade') {
    el.append(step('parts'), billOfMaterials('pro'), step('profile'), figure('pro-micro-wiring.svg', 'docs.visual.wiring.caption'),
      figure('pro-micro-schematic.svg', 'docs.visual.schematic.caption'), wiringTable(),
      step('power'), step('supply'), step('screen'), step('buttons'), step('sound'), step('reset'), step('upload'), step('trouble'),
      h('h3', {}, t('docs.visual.sources')),
      h('p', {}, h('a', { href: 'https://github.com/MrBlinky/Arduboy-homemade-package', target: '_blank', rel: 'noopener' }, 'MrBlinky · Arduboy homemade package')),
      h('p', {}, h('a', { href: 'https://learn.sparkfun.com/tutorials/pro-micro--fio-v3-hookup-guide', target: '_blank', rel: 'noopener' }, 'SparkFun · Pro Micro')),
      h('p', {}, h('a', { href: 'https://cdn.sparkfun.com/datasheets/Dev/Arduino/Boards/Pro_Micro_v13b.pdf', target: '_blank', rel: 'noopener' }, 'SparkFun · Pro Micro schematic')),
      h('p', {}, h('a', { href: 'https://github.com/MrBlinky/Arduboy', target: '_blank', rel: 'noopener' }, 'MrBlinky · Arduboy')));
  } else if (id === 'attiny') {
    el.append(step('tiny-parts'), billOfMaterials('tiny'), figure('attiny85-components.svg', 'docs.visual.tiny-components.caption'),
      step('tiny-profile'), figure('attiny85-schematic.svg', 'docs.visual.tiny-schematic.caption'), tinyWiringTable(),
      ...['tiny-power', 'tiny-screen', 'tiny-buttons', 'tiny-program', 'tiny-clock', 'tiny-assemble'].map(id => step(id)),
      h('details', {}, h('summary', {}, t('docs.visual.tiny-reference.title')),
        ...t('docs.visual.tiny-reference.body').split('\n\n').map(p => h('p', {}, p)),
        h('a', { href: asset('attiny85-reference.pdf'), target: '_blank', rel: 'noopener' }, t('docs.visual.tiny-reference.link'))),
      h('h3', {}, t('docs.visual.sources')),
      h('p', {}, h('a', { href: 'https://ww1.microchip.com/downloads/en/devicedoc/atmel-2586-avr-8-bit-microcontroller-attiny25-attiny45-attiny85_datasheet.pdf', target: '_blank', rel: 'noopener' }, 'Microchip · ATtiny25/45/85 datasheet')),
      h('p', {}, h('a', { href: 'https://github.com/SpenceKonde/ATTinyCore', target: '_blank', rel: 'noopener' }, 'ATTinyCore · ISP / clock / fuses')),
      h('p', {}, h('a', { href: 'https://learn.sparkfun.com/tutorials/tiny-avr-programmer-hookup-guide/all', target: '_blank', rel: 'noopener' }, 'SparkFun · Tiny AVR Programmer')),
      h('p', {}, h('a', { href: 'https://electronoobs.com/eng_arduino_tut120.php', target: '_blank', rel: 'noopener' }, 'ELECTRONOOBS · ATtiny85 console')));
  }
  return el;
}

/** Read pins from the same profile used by compilation, rather than a second pin list. */
function wiringTable() {
  const p = BUILTIN_PROFILES.find(p => p.id === 'promicro-ssd1306-spi')!;
  const bus = getChip(p.chip).bus;
  const rows = [
    ['OLED GND', 'GND'], ['OLED VCC', t('docs.visual.voltage')],
    ['OLED D0 / CLK / SCK', bus.sck!], ['OLED D1 / DIN / MOSI', bus.mosi!],
    ['OLED CS', p.display.cs!], ['OLED DC', p.display.dc!], ['OLED RES / RST', p.display.rst!], ['Pro Micro RST ↔ GND', 'RST ↔ GND'],
    ...BUTTONS.map(b => [`${(b === 'a' || b === 'b' ? b.toUpperCase() : t(`button.${b}`))} ↔ GND`, p.buttons[b]]),
    [t('docs.visual.piezo'), `${p.sound.pin1} ↔ ${p.sound.pin2}`],
  ];
  return h('div', { class: 'docs-table-wrap' }, h('table', { class: 'docs-wiring' },
    h('caption', {}, p.name), h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, t('docs.visual.connection')), h('th', { scope: 'col' }, 'Pro Micro'))),
    h('tbody', {}, ...rows.map(([label, pin]) => h('tr', {}, h('th', { scope: 'row' }, label), h('td', {}, pin))))));
}

/** Physical package pins and port names are deliberately separate columns. */
function tinyWiringTable() {
  const p = SECRET_PROFILES.find(p => p.id === 'attiny85-pico')!;
  const bus = getChip(p.chip).bus;
  const rows = [
    ['OLED VCC', 'VCC', '8'], ['OLED GND', 'GND', '4'],
    ['OLED SDA', bus.sda!, String(tinyDipPin(bus.sda!))],
    ['OLED SCL', bus.scl!, String(tinyDipPin(bus.scl!))],
    [t('button.left'), `${p.buttons.left} ↔ GND`, `${tinyDipPin(p.buttons.left)} ↔ 4`],
    [t('button.right'), `${p.buttons.right} ↔ GND`, `${tinyDipPin(p.buttons.right)} ↔ 4`],
    [t('docs.visual.piezo'), `${p.sound.pin1} ↔ GND`, `${tinyDipPin(p.sound.pin1!)} ↔ 4`],
    [t('docs.visual.tiny-battery'), 'VCC / GND', '8 / 4'],
    [t('docs.visual.tiny-cap'), 'VCC ↔ GND', '8 ↔ 4'],
    [t('docs.visual.tiny-unused'), 'PB5 / RESET', '1'],
  ];
  return h('div', { class: 'docs-table-wrap' }, h('table', { class: 'docs-wiring' },
    h('caption', {}, p.name),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, t('docs.visual.connection')),
      h('th', { scope: 'col' }, 'ATtiny85'), h('th', { scope: 'col' }, t('docs.visual.tiny-pin')))),
    h('tbody', {}, ...rows.map(([label, port, physical]) => h('tr', {},
      h('th', { scope: 'row' }, label), h('td', {}, port), h('td', {}, physical))))));
}


/** Purchasing specifications describe modules; no unverified manufacturer part numbers. */
function billOfMaterials(console: 'pro' | 'tiny') {
  const common = ['wire', 'board'];
  const parts = console === 'pro'
    ? ['pro-board', 'pro-display', 'pro-buttons', 'reset', 'piezo', 'usb', ...common]
    : ['tiny-chip', 'socket', 'tiny-display', 'tiny-buttons', 'piezo', 'cell', 'holder', 'switch', 'capacitor', ...common];
  const quantities: Record<string, string> = { 'pro-buttons': '6', 'tiny-buttons': '2', wire: t('docs.bom.quantity.wire'), 'isp-wire': t('docs.bom.quantity.wire'), mounting: t('docs.bom.quantity.wire'), board: '1' };
  const group = (ids: string[], label: string) => h('div', { class: 'docs-table-wrap' },
    h('table', { class: 'docs-wiring docs-bom' },
      h('caption', {}, t(label)),
      h('thead', {}, h('tr', {}, ...['quantity', 'component', 'specification'].map(key => h('th', { scope: 'col' }, t(`docs.bom.${key}`))))),
      h('tbody', {}, ...ids.map(id => h('tr', {},
        h('td', {}, quantities[id] ?? '1'),
        h('th', { scope: 'row' }, t(`docs.bom.${id}.name`)),
        h('td', {}, t(`docs.bom.${id}.spec`)))))));
  return h('section', { class: 'docs-step docs-bom-section' },
    h('h3', {}, t('docs.bom.title')),
    h('p', {}, t(`docs.bom.${console}.intro`)),
    group(parts, 'docs.bom.console'),
    group(console === 'pro' ? ['solder', 'iron', 'meter', 'cutters'] : ['programmer', 'isp-wire', 'solder', 'iron', 'meter', 'cutters'], 'docs.bom.tools'),
    group(['case', 'mounting'], 'docs.bom.optional'),
    console === 'pro' && h('p', {}, t('docs.bom.pro.battery')),
    console === 'tiny' && h('p', {}, t('docs.bom.tiny.resistors')));
}
