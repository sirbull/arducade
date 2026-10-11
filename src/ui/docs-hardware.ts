// Hardware documentation reads capabilities from the same definitions as the editor.
import { CHIPS } from '../hw/chips';
import { DEVELOPMENT_BOARDS, BUILTIN_PROFILES, profileChip, withBoardDefaults, supportedClocks } from '../hw/profile';
import { t } from '../i18n/i18n';
import { h } from './dom';

const key = (id: string) => t(`docs.hardware.${id}`);
const paragraphs = (id: string) => key(id).split('\n\n').map(text => h('p', {}, text));
function section(id: string) {
  return h('section', { class: 'docs-step' }, h('h3', {}, key(`${id}.title`)), ...paragraphs(`${id}.body`));
}
function table(caption: string, columns: string[], rows: (string | HTMLElement)[][]) {
  return h('div', { class: 'docs-table-wrap' }, h('table', { class: 'docs-wiring' },
    h('caption', {}, key(caption)),
    h('thead', {}, h('tr', {}, ...columns.map(id => h('th', { scope: 'col' }, key(id))))),
    h('tbody', {}, ...rows.map(row => h('tr', {}, h('th', { scope: 'row' }, row[0]), ...row.slice(1).map(value => h('td', {}, value)))))));
}

export function hardwareGuide(secretTiny = false): HTMLElement {
  const chips = CHIPS.filter(chip => !chip.tiny || secretTiny);
  const route = (browser: boolean) => key(browser ? 'browser' : 'export');
  return h('div', { class: 'docs-illustrated' },
    section('support'), section('memory'),
    table('chips', ['microcontroller', 'clock', 'flash', 'ram', 'build'], chips.map(chip => [
      chip.name, supportedClocks(chip).map(hz => `${hz / 1000000} MHz`).join(' / '),
      `${chip.flash / 1024} ${key('unit')}`, `${chip.ram / 1024} ${key('unit')}`,
      route(chip.browserCompile) + (chip.browserCompile && supportedClocks(chip).length > 1 ? ` (${chip.fCpu / 1000000} MHz)` : ''),
    ])),
    ...chips.map(chip => h('section', { class: 'docs-step' }, h('h4', {}, chip.name), ...paragraphs(`chip.${chip.id}`))),
    section('boards'),
    table('boardList', ['board', 'microcontroller', 'clock', 'build'], DEVELOPMENT_BOARDS.map(board => [
      board.name, CHIPS.find(chip => chip.id === board.chip)!.name, `${board.clockHz / 1000000} MHz`,
      route(profileChip(withBoardDefaults(BUILTIN_PROFILES[0], board.id)).browserCompile),
    ])),
    section('displays'),
    table('displayList', ['driver', 'interface', 'notes'], [
      ['SSD1306', 'I2C / SPI', key('display.ssd1306')],
      ['SH1106', 'I2C / SPI', key('display.sh1106')],
      ['SSD1309', 'I2C / SPI', key('display.ssd1309')],
      ['ESPboy ST7735', 'SPI', key('display.espboy')],
    ]),
    section('bus'), section('profile'),
    h('ol', {}, ...['open', 'target', 'screen', 'buttons', 'sound', 'validate', 'save', 'compile'].map(id => h('li', {}, key(`step.${id}`)))),
    section('example'),
    table('wiring', ['connection', 'pin'], (() => {
      const p = BUILTIN_PROFILES.find(profile => profile.id === 'promicro-ssd1306-spi')!;
      const chip = profileChip(p);
      return [
        ['SPI MOSI', chip.bus.mosi!], ['SPI SCK', chip.bus.sck!],
        ['OLED CS', p.display.cs!], ['OLED DC', p.display.dc!], ['OLED RST', p.display.rst!],
        ...Object.entries(p.buttons).map(([button, pin]) => [t(`role.button.${button}`), pin]),
        [t('role.sound.pin1'), p.sound.pin1!], [t('role.sound.pin2'), p.sound.pin2!],
      ];
    })()),
    section('manual'), section('changes'), section('troubleshooting'),
  );
}
