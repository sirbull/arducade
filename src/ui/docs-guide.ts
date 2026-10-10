// Illustrated editor guide. Screenshots are from the unmodified Platformer template.
import { t } from '../i18n/i18n';
import { BUILTIN_PROFILES, BUTTONS, SECRET_PROFILES } from '../hw/profile';
import { tinyDipPin } from '../hw/attiny85-pinout';
import { getChip } from '../hw/chips';
import { platformer } from '../templates/platformer';
import { h } from './dom';

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
  const el = h('div', { class: 'docs-illustrated' });
  if (id === 'start') {
    el.append(figure('arduboy-front-back.jpg', 'docs.visual.arduboy.caption', 'Foto: Drummyfish · CC0'),
      step('first'), figure('simulator.png', 'docs.visual.sim.caption'));
  } else if (id === 'blocks') {
    el.append(step('events'), picture([
      { type: 'ab_on_start', inputs: { DO: { block: { type: 'ab_score_set', inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 0 } } } } } } } },
      { type: 'ab_on_button', fields: { BUTTON: 'a', EVENT: 'pressed' }, inputs: { DO: { block: { type: 'ab_score_change', inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } } } } },
    ]), step('code'), picture((platformer.blocks as Json).blocks.blocks, true));
  } else if (id === 'assets') {
    el.append(step('sprite', 'sprites.png'), step('tile', 'tiles.png'), step('map', 'tilemap.png'), step('connect'));
  } else if (id === 'sim') {
    el.append(figure('simulator.png', 'docs.visual.sim.caption'), step('test'));
  } else if (id === 'device') {
    el.append(figure('arduboy-front-back.jpg', 'docs.visual.arduboy.caption', 'Foto: Drummyfish · CC0'), step('export'));
  } else if (id === 'homemade') {
    el.append(step('parts'), step('profile'), figure('pro-micro-wiring.svg', 'docs.visual.wiring.caption'),
      figure('pro-micro-schematic.svg', 'docs.visual.schematic.caption'), wiringTable(),
      step('power'), step('supply'), step('screen'), step('buttons'), step('sound'), step('reset'), step('upload'), step('trouble'),
      h('details', {}, h('summary', {}, t('docs.visual.references.title')),
        h('p', {}, t('docs.visual.references.body')),
        figure('pro-micro-pinout.png', 'docs.visual.pinout.caption')),
      h('h3', {}, t('docs.visual.sources')),
      h('p', {}, h('a', { href: 'https://github.com/MrBlinky/Arduboy-homemade-package', target: '_blank', rel: 'noopener' }, 'MrBlinky · Arduboy homemade package')),
      h('p', {}, h('a', { href: 'https://learn.sparkfun.com/tutorials/pro-micro--fio-v3-hookup-guide', target: '_blank', rel: 'noopener' }, 'SparkFun · Pro Micro')),
      h('p', {}, h('a', { href: 'https://cdn.sparkfun.com/datasheets/Dev/Arduino/Boards/Pro_Micro_v13b.pdf', target: '_blank', rel: 'noopener' }, 'SparkFun · Pro Micro schematic')),
      h('p', {}, h('a', { href: 'https://github.com/MrBlinky/Arduboy', target: '_blank', rel: 'noopener' }, 'MrBlinky · Arduboy')));
  } else if (id === 'attiny') {
    el.append(step('tiny-parts'), figure('attiny85-components.svg', 'docs.visual.tiny-components.caption'),
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
