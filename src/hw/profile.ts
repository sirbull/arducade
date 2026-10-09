import { CHIPS, findPin, getChip, type Chip } from './chips';

export type DisplayDriver = 'ssd1306' | 'sh1106' | 'ssd1309';
export type DisplayBus = 'i2c' | 'spi';
export type ButtonId = 'up' | 'down' | 'left' | 'right' | 'a' | 'b';
export const BUTTONS: ButtonId[] = ['up', 'down', 'left', 'right', 'a', 'b'];

export const DISPLAY_DRIVERS: { id: DisplayDriver; name: string }[] = [
  { id: 'ssd1306', name: 'SSD1306' },
  { id: 'sh1106', name: 'SH1106' },
  { id: 'ssd1309', name: 'SSD1309' },
];

export interface DisplayConfig {
  driver: DisplayDriver;
  bus: DisplayBus;
  /** I2C address, usually 0x3C. */
  i2cAddress: number;
  /** SPI pins. CS can be empty when the pin is tied to ground. */
  cs?: string;
  dc?: string;
  rst?: string;
  rotate180: boolean;
  mirror: boolean;
  /** 0 to 255. */
  contrast: number;
}

export interface Profile {
  format: 'ardublocks-profile';
  version: 1;
  id: string;
  name: string;
  /** Built in profiles can not be edited, only copied. */
  builtin?: boolean;
  chip: string;
  display: DisplayConfig;
  buttons: Record<ButtonId, string>;
  sound: { pin1?: string; pin2?: string };
}

export const PROFILE_EXTENSION = '.abprofile';

function profile(p: Omit<Profile, 'format' | 'version'>): Profile {
  return { format: 'ardublocks-profile', version: 1, ...p };
}

export const BUILTIN_PROFILES: Profile[] = [
  profile({
    id: 'arduboy',
    name: 'Arduboy',
    builtin: true,
    chip: 'atmega32u4',
    display: { driver: 'ssd1306', bus: 'spi', i2cAddress: 0x3c, cs: 'D12', dc: 'D4', rst: 'D6', rotate180: false, mirror: false, contrast: 0xcf },
    buttons: { up: 'A0', right: 'A1', left: 'A2', down: 'A3', a: 'D7', b: 'D8' },
    sound: { pin1: 'D5', pin2: 'D13' },
  }),
  profile({
    id: 'nano-ssd1306-i2c',
    name: 'Nano + SSD1306 (I2C)',
    builtin: true,
    chip: 'atmega328p',
    display: { driver: 'ssd1306', bus: 'i2c', i2cAddress: 0x3c, rotate180: false, mirror: false, contrast: 0xcf },
    buttons: { up: 'D2', down: 'D3', left: 'D4', right: 'D5', a: 'D6', b: 'D7' },
    sound: { pin1: 'D9' },
  }),
  profile({
    id: 'nano-sh1106-i2c',
    name: 'Nano + SH1106 (I2C)',
    builtin: true,
    chip: 'atmega328p',
    display: { driver: 'sh1106', bus: 'i2c', i2cAddress: 0x3c, rotate180: false, mirror: false, contrast: 0xcf },
    buttons: { up: 'D2', down: 'D3', left: 'D4', right: 'D5', a: 'D6', b: 'D7' },
    sound: { pin1: 'D9' },
  }),
  profile({
    id: 'promicro-ssd1306-spi',
    name: 'Pro Micro + SSD1306 (SPI)',
    builtin: true,
    chip: 'atmega32u4',
    display: { driver: 'ssd1306', bus: 'spi', i2cAddress: 0x3c, cs: 'D10', dc: 'D4', rst: 'D6', rotate180: false, mirror: false, contrast: 0xcf },
    buttons: { up: 'A0', right: 'A1', left: 'A2', down: 'A3', a: 'D7', b: 'D8' },
    sound: { pin1: 'D5', pin2: 'D9' },
  }),
];

export const DEFAULT_PROFILE_ID = 'arduboy';

export function cloneProfile(p: Profile, name: string): Profile {
  const copy: Profile = JSON.parse(JSON.stringify(p));
  copy.id = `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  copy.name = name;
  delete copy.builtin;
  return copy;
}

// Validation ---------------------------------------------------------------

export type IssueLevel = 'error' | 'warning' | 'info';

export interface ProfileIssue {
  level: IssueLevel;
  /** Translation key. */
  key: string;
  params?: Record<string, string | number>;
}

interface PinUse {
  pin: string;
  role: string;
  input: boolean;
}

function pinUses(p: Profile): PinUse[] {
  const uses: PinUse[] = [];
  for (const b of BUTTONS) if (p.buttons[b]) uses.push({ pin: p.buttons[b], role: `button.${b}`, input: true });
  if (p.display.bus === 'spi') {
    if (p.display.cs) uses.push({ pin: p.display.cs, role: 'display.cs', input: false });
    if (p.display.dc) uses.push({ pin: p.display.dc, role: 'display.dc', input: false });
    if (p.display.rst) uses.push({ pin: p.display.rst, role: 'display.rst', input: false });
  }
  if (p.sound.pin1) uses.push({ pin: p.sound.pin1, role: 'sound.pin1', input: false });
  if (p.sound.pin2) uses.push({ pin: p.sound.pin2, role: 'sound.pin2', input: false });
  return uses;
}

/** Checks a profile against the rules of its chip. */
export function validateProfile(p: Profile): ProfileIssue[] {
  const issues: ProfileIssue[] = [];
  const chip = CHIPS.find((c) => c.id === p.chip);
  if (!chip) return [{ level: 'error', key: 'profile.unknownChip', params: { chip: p.chip } }];

  const uses = pinUses(p);
  const busPins: { pin: string; role: string }[] = [];
  if (p.display.bus === 'i2c') {
    if (chip.bus.sda) busPins.push({ pin: chip.bus.sda, role: 'bus.sda' });
    if (chip.bus.scl) busPins.push({ pin: chip.bus.scl, role: 'bus.scl' });
  } else {
    if (chip.bus.mosi) busPins.push({ pin: chip.bus.mosi, role: 'bus.mosi' });
    if (chip.bus.sck) busPins.push({ pin: chip.bus.sck, role: 'bus.sck' });
  }

  for (const b of BUTTONS) {
    if (!p.buttons[b]) issues.push({ level: 'error', key: 'profile.buttonMissing', params: { role: `button.${b}` } });
  }
  if (p.display.bus === 'spi' && !p.display.dc) {
    issues.push({ level: 'error', key: 'profile.dcMissing' });
  }

  for (const u of uses) {
    const info = findPin(chip, u.pin);
    if (!info) {
      issues.push({ level: 'error', key: 'profile.pinUnknown', params: { pin: u.pin, role: u.role, chip: chip.name } });
      continue;
    }
    if (info.reserved) issues.push({ level: 'error', key: 'profile.pinReserved', params: { pin: u.pin, role: u.role } });
    if (info.analogOnly) issues.push({ level: 'error', key: 'profile.pinAnalogOnly', params: { pin: u.pin, role: u.role } });
    else if (u.input && info.noPullup) issues.push({ level: 'warning', key: 'profile.pinNoPullup', params: { pin: u.pin, role: u.role } });
    if (info.serial) issues.push({ level: 'warning', key: 'profile.pinSerial', params: { pin: u.pin, role: u.role } });
    const bus = busPins.find((bp) => bp.pin === u.pin);
    if (bus) issues.push({ level: 'error', key: 'profile.pinBus', params: { pin: u.pin, role: u.role, bus: bus.role } });
    if (p.display.bus === 'spi' && chip.family === 'avr' && u.input && u.pin === chip.bus.ss) {
      issues.push({ level: 'warning', key: 'profile.pinSpiSs', params: { pin: u.pin, role: u.role } });
    }
  }

  const seen = new Map<string, string>();
  for (const u of uses) {
    const first = seen.get(u.pin);
    if (first) issues.push({ level: 'error', key: 'profile.pinDuplicate', params: { pin: u.pin, role: u.role, other: first } });
    else seen.set(u.pin, u.role);
  }

  if (p.display.bus === 'i2c') {
    if (p.display.i2cAddress !== 0x3c && p.display.i2cAddress !== 0x3d) {
      issues.push({ level: 'warning', key: 'profile.i2cAddress', params: { address: `0x${p.display.i2cAddress.toString(16)}` } });
    }
    issues.push({ level: 'info', key: 'profile.i2cSlow' });
  }
  if (!p.sound.pin1) issues.push({ level: 'info', key: 'profile.noSound' });
  if (!chip.browserCompile) issues.push({ level: 'info', key: 'profile.exportOnly', params: { chip: chip.name } });
  return issues;
}

export function hasErrors(issues: ProfileIssue[]): boolean {
  return issues.some((i) => i.level === 'error');
}

// Files --------------------------------------------------------------------

/** Parses and checks a profile file. Throws an Error with a translation key. */
export function parseProfile(text: string): Profile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('file.notJson');
  }
  const p = data as Partial<Profile>;
  if (!p || p.format !== 'ardublocks-profile') throw new Error('file.notProfile');
  if (typeof p.version !== 'number' || p.version > 1) throw new Error('file.tooNew');
  if (typeof p.chip !== 'string' || !p.display || !p.buttons || !p.sound) throw new Error('file.broken');
  const result: Profile = {
    format: 'ardublocks-profile',
    version: 1,
    id: typeof p.id === 'string' && p.id ? p.id : `custom-${Date.now().toString(36)}`,
    name: typeof p.name === 'string' && p.name ? p.name : 'Profile',
    chip: p.chip,
    display: {
      driver: p.display.driver ?? 'ssd1306',
      bus: p.display.bus ?? 'i2c',
      i2cAddress: p.display.i2cAddress ?? 0x3c,
      cs: p.display.cs,
      dc: p.display.dc,
      rst: p.display.rst,
      rotate180: !!p.display.rotate180,
      mirror: !!p.display.mirror,
      contrast: clamp(p.display.contrast ?? 0xcf, 0, 255),
    },
    buttons: { ...p.buttons } as Record<ButtonId, string>,
    sound: { ...p.sound },
  };
  return result;
}

export function serializeProfile(p: Profile): string {
  const copy: Profile = JSON.parse(JSON.stringify(p));
  delete copy.builtin;
  return JSON.stringify(copy, null, 2) + '\n';
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

// C++ configuration --------------------------------------------------------

function pinCpp(chip: Chip, id: string | undefined): string | undefined {
  if (!id) return undefined;
  return findPin(chip, id)?.cpp;
}

/** Creates the ab_config.h header for a profile. */
export function profileToConfigH(p: Profile): string {
  const chip = getChip(p.chip);
  const lines: string[] = [
    '// Generated by ArduBlocks from the hardware profile.',
    `// Profile: ${p.name.replace(/[\r\n]/g, ' ')}`,
    '#pragma once',
    '',
    `#define AB_CHIP_${chip.id.toUpperCase()} 1`,
    `#define AB_FAMILY_${chip.family.toUpperCase()} 1`,
    `#define AB_DISPLAY_${p.display.driver.toUpperCase()} 1`,
    `#define AB_BUS_${p.display.bus.toUpperCase()} 1`,
  ];
  if (p.display.bus === 'i2c') {
    lines.push(`#define AB_I2C_ADDRESS 0x${p.display.i2cAddress.toString(16).toUpperCase()}`);
  } else {
    const cs = pinCpp(chip, p.display.cs);
    const dc = pinCpp(chip, p.display.dc);
    const rst = pinCpp(chip, p.display.rst);
    if (cs) lines.push(`#define AB_PIN_CS ${cs}`);
    if (dc) lines.push(`#define AB_PIN_DC ${dc}`);
    if (rst) lines.push(`#define AB_PIN_RST ${rst}`);
  }
  lines.push(`#define AB_ROTATE180 ${p.display.rotate180 ? 1 : 0}`);
  lines.push(`#define AB_MIRROR ${p.display.mirror ? 1 : 0}`);
  lines.push(`#define AB_CONTRAST ${clamp(p.display.contrast, 0, 255)}`);
  for (const b of BUTTONS) {
    lines.push(`#define AB_PIN_${b.toUpperCase()} ${pinCpp(chip, p.buttons[b]) ?? '-1'}`);
  }
  const s1 = pinCpp(chip, p.sound.pin1);
  const s2 = pinCpp(chip, p.sound.pin2);
  if (s1) lines.push(`#define AB_PIN_SOUND1 ${s1}`);
  if (s2) lines.push(`#define AB_PIN_SOUND2 ${s2}`);
  lines.push(`#define AB_EEPROM_SIZE ${chip.eeprom}`);
  lines.push('');
  return lines.join('\n');
}
