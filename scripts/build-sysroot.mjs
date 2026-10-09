// Builds the files the in-browser compiler needs for each chip: the headers
// a game uses, the Arduino core as an archive, start up code and libraries.
// The output in public/compiler/sysroot is committed, so building the web
// site does not need an AVR toolchain.
//
// Usage: AVR_GCC_DIR=/path/to/avr-gcc-7.3.0 node scripts/build-sysroot.mjs
// Run scripts/fetch-cores.mjs first, and the tests (which write .cache/gen).

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const tc = process.env.AVR_GCC_DIR;
if (!tc) throw new Error('Set AVR_GCC_DIR to an avr-gcc 7.3.0 toolchain');
const bin = (t) => join(tc, 'bin', t);
const core = join(root, '.cache/cores/arduino-avr');
const out = join(root, 'public/compiler/sysroot');
const work = join(root, '.cache/sysroot-build');

// Chips the browser can compile for. All use the avr5 libraries.
const MCUS = [
  { mcu: 'atmega328p', variant: 'standard', define: '__AVR_ATmega328P__', board: 'ARDUINO_AVR_NANO' },
  { mcu: 'atmega328pb', variant: 'standard', define: '__AVR_ATmega328PB__', board: 'ARDUINO_AVR_NANO' },
  {
    mcu: 'atmega32u4',
    variant: 'leonardo',
    define: '__AVR_ATmega32U4__',
    board: 'ARDUINO_AVR_LEONARDO',
    extra: ['-DUSB_VID=0x2341', '-DUSB_PID=0x8036', '-DUSB_MANUFACTURER="Arduino LLC"', '-DUSB_PRODUCT="Arduino Leonardo"'],
  },
  { mcu: 'atmega644p', variant: 'mighty', define: '__AVR_ATmega644P__', board: 'ARDUINO_AVR_ATmega644P' },
];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
mkdirSync(work, { recursive: true });

const gccInclude = join(tc, 'lib/gcc/avr/7.3.0/include');
const gccFixed = join(tc, 'lib/gcc/avr/7.3.0/include-fixed');
const avrInclude = join(tc, 'avr/include');

/** Maps a real header path to its path in the compiler's virtual file system. */
function virtualPath(file, variant) {
  const map = [
    [gccInclude, '/sysroot/gcc/include'],
    [gccFixed, '/sysroot/gcc/include-fixed'],
    [avrInclude, '/sysroot/avr/include'],
    [join(core, 'cores/arduino'), '/arduino/core'],
    [join(core, 'variants', variant), '/arduino/variant'],
    [join(core, 'libraries/EEPROM/src'), '/arduino/libraries/EEPROM'],
  ];
  for (const [real, virt] of map) {
    const rel = relative(real, file);
    if (!rel.startsWith('..')) return `${virt}/${rel}`;
  }
  return null;
}

const manifest = { mcus: {}, libs: ['libc.a', 'libm.a', 'libgcc.a'], ldscript: 'avr5.xn' };

for (const m of MCUS) {
  const flags = [
    `-mmcu=${m.mcu}`, '-DF_CPU=16000000L', '-DARDUINO=10819', '-DARDUINO_ARCH_AVR', `-D${m.board}`, ...(m.extra ?? []),
    '-Os', '-ffunction-sections', '-fdata-sections', '-w',
    `-I${join(core, 'cores/arduino')}`, `-I${join(core, 'variants', m.variant)}`, `-I${join(core, 'libraries/EEPROM/src')}`,
  ];
  const dir = join(work, m.mcu);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  // Arduino core as an archive, so only the parts a game uses are linked.
  const objs = [];
  for (const f of readdirSync(join(core, 'cores/arduino'))) {
    const src = join(core, 'cores/arduino', f);
    const obj = join(dir, f + '.o');
    if (f.endsWith('.c')) execFileSync(bin('avr-gcc'), ['-c', ...flags, '-std=gnu11', src, '-o', obj]);
    else if (f.endsWith('.cpp')) execFileSync(bin('avr-g++'), ['-c', ...flags, '-std=gnu++11', '-fno-exceptions', '-fno-threadsafe-statics', '-fpermissive', src, '-o', obj]);
    else if (f.endsWith('.S')) execFileSync(bin('avr-gcc'), ['-c', ...flags, '-x', 'assembler-with-cpp', src, '-o', obj]);
    else continue;
    objs.push(obj);
  }
  execFileSync(bin('avr-gcc-ar'), ['rcs', join(out, `core-${m.mcu}.a`), ...objs]);

  // Headers used by games: ask the compiler which headers it reads for each
  // generated template, with both I2C and SPI displays.
  const headers = new Map();
  const games = readdirSync(join(root, '.cache/gen')).filter((f) => f.endsWith('.ino'));
  for (const bus of ['I2C', 'SPI']) {
    const cfg = join(dir, 'cfg', 'ab_config.h');
    mkdirSync(join(dir, 'cfg'), { recursive: true });
    writeFileSync(
      cfg,
      [
        `#define AB_CHIP_${m.mcu.toUpperCase()} 1`, '#define AB_FAMILY_AVR 1', '#define AB_DISPLAY_SSD1306 1', `#define AB_BUS_${bus} 1`,
        '#define AB_I2C_ADDRESS 0x3C', '#define AB_PIN_CS 10', '#define AB_PIN_DC 9', '#define AB_PIN_RST 8',
        '#define AB_ROTATE180 0', '#define AB_MIRROR 0', '#define AB_CONTRAST 207',
        '#define AB_PIN_UP 2', '#define AB_PIN_DOWN 3', '#define AB_PIN_LEFT 4', '#define AB_PIN_RIGHT 5', '#define AB_PIN_A 6', '#define AB_PIN_B 7',
        '#define AB_PIN_SOUND1 A0', '#define AB_EEPROM_SIZE 1024', '',
      ].join('\n'),
    );
    for (const g of games) {
      const deps = execFileSync(bin('avr-g++'), ['-M', ...flags, '-std=gnu++11', `-I${join(dir, 'cfg')}`, `-I${join(root, 'core/ardublocks')}`, '-x', 'c++', join(root, '.cache/gen', g)], { encoding: 'utf8' });
      for (const file of deps.replace(/\\\n/g, ' ').split(/\s+/).slice(1)) {
        if (!file || !existsSync(file)) continue;
        const v = virtualPath(file, m.variant);
        if (v) headers.set(v, readFileSync(file, 'utf8'));
      }
    }
  }
  // Headers games can use from a C++ block.
  for (const extra of ['avr/pgmspace.h', 'avr/eeprom.h', 'avr/interrupt.h', 'util/delay.h', 'stdlib.h', 'string.h']) {
    const v = virtualPath(join(avrInclude, extra), m.variant);
    if (v && !headers.has(v)) headers.set(v, readFileSync(join(avrInclude, extra), 'utf8'));
  }
  writeFileSync(join(out, `headers-${m.mcu}.json`), JSON.stringify(Object.fromEntries([...headers].sort())));

  copyFileSync(join(tc, 'avr/lib/avr5', `crt${m.mcu}.o`), join(out, `crt${m.mcu}.o`));
  // Device library with the EEPROM functions of avr-libc.
  copyFileSync(join(tc, 'avr/lib/avr5', `lib${m.mcu}.a`), join(out, `lib${m.mcu}.a`));
  manifest.mcus[m.mcu] = {
    define: m.define,
    board: m.board,
    extra: m.extra ?? [],
    headers: `headers-${m.mcu}.json`,
    core: `core-${m.mcu}.a`,
    crt: `crt${m.mcu}.o`,
    deviceLib: `lib${m.mcu}.a`,
    dataStart: '0x800100',
  };
  console.log(`${m.mcu}: ${headers.size} headers, ${objs.length} core objects`);
}

copyFileSync(join(tc, 'avr/lib/avr5/libc.a'), join(out, 'libc.a'));
copyFileSync(join(tc, 'avr/lib/avr5/libm.a'), join(out, 'libm.a'));
copyFileSync(join(tc, 'lib/gcc/avr/7.3.0/avr5/libgcc.a'), join(out, 'libgcc.a'));
copyFileSync(join(tc, 'avr/lib/ldscripts/avr5.xn'), join(out, 'avr5.xn'));
// Debug information is not needed and makes the download bigger.
for (const f of readdirSync(out)) if (f.endsWith('.a') || f.endsWith('.o')) execFileSync(bin('avr-strip'), ['--strip-debug', join(out, f)]);
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${relative(root, out)} (${basename(out)})`);
