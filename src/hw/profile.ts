import { CHIPS, findPin, getChip, type Chip } from './chips';

export type DisplayDriver = 'ssd1306' | 'sh1106' | 'ssd1309' | 'espboy';
export type DisplayBus = 'i2c' | 'spi';
export type ButtonId = 'up' | 'down' | 'left' | 'right' | 'a' | 'b';
export const BUTTONS: ButtonId[] = ['up', 'down', 'left', 'right', 'a', 'b'];

export const DISPLAY_DRIVERS: { id: DisplayDriver; name: string }[] = [
  { id: 'ssd1306', name: 'SSD1306' },
  { id: 'sh1106', name: 'SH1106' },
  { id: 'ssd1309', name: 'SSD1309' },
  { id: 'espboy', name: 'ESPboy ST7735 (128×128 TFT)' },
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

export interface ESPboyConfig {
  sda: string;
  scl: string;
  mosi: string;
  sck: string;
  mcpAddress: number;
  /** Optional MCP4725 backlight DAC; DIY devices may wire backlight directly. */
  dacAddress?: number;
}

export const ESPBOY_DEFAULTS: ESPboyConfig = {
  sda: 'GPIO4', scl: 'GPIO5', mosi: 'GPIO13', sck: 'GPIO14', mcpAddress: 0x20, dacAddress: 0x60,
};
export const MCP_PINS = Array.from({ length: 16 }, (_, n) => ({ id: `MCP${n}`, cpp: String(64 + n), reserved: false, analogOnly: false, noPullup: false, serial: false }));
export function isESPboy(p: Profile): boolean { return p.display.driver === 'espboy'; }

export interface Profile {
  format: 'ardublocks-profile';
  version: 1;
  id: string;
  name: string;
  /** Built in profiles can not be edited, only copied. */
  builtin?: boolean;
  chip: string;
  espboy?: ESPboyConfig;
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

/** Shown only when the secret setting is on. */
export const SECRET_PROFILES: Profile[] = [
  profile({
    id: 'attiny85-pico',
    name: 'ATtiny85 Pico',
    builtin: true,
    chip: 'attiny85',
    display: { driver: 'ssd1306', bus: 'i2c', i2cAddress: 0x3c, rotate180: false, mirror: false, contrast: 0xcf },
    buttons: { up: '', down: '', left: 'PB0', right: 'PB2', a: '', b: '' },
    sound: { pin1: 'PB1' },
  }),
];

for (const [id, name, dac] of [
  ['espboy-original', 'ESPboy Original', true],
  ['espboy-kit', 'ESPboy Kit', true],
  ['espboy-diy', 'ESPboy DIY (direct backlight)', false],
] as const) {
  BUILTIN_PROFILES.push(profile({
    id, name, builtin: true, chip: 'esp8266',
    espboy: { ...ESPBOY_DEFAULTS, dacAddress: dac ? 0x60 : undefined },
    display: { driver: 'espboy', bus: 'spi', i2cAddress: 0x3c, cs: 'MCP8', dc: 'GPIO16', rotate180: false, mirror: false, contrast: 255 },
    buttons: { left: 'MCP0', up: 'MCP1', down: 'MCP2', right: 'MCP3', a: 'MCP4', b: 'MCP5' },
    sound: { pin1: 'GPIO0' },
  }));
}

export const DEFAULT_PROFILE_ID = 'arduboy';

export function cloneProfile(p: Profile, name: string): Profile {
  const copy: Profile = JSON.parse(JSON.stringify(p));
  copy.id = `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  copy.name = name;
  delete copy.builtin;
  return copy;
}

/** A blank editable profile; the user chooses the button wiring. */
export function createCustomProfile(name = 'Custom'): Profile {
  const p = cloneProfile(BUILTIN_PROFILES[1], name);
  p.buttons = { up: '', down: '', left: '', right: '', a: '', b: '' };
  p.sound = {};
  return p;
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
  }
  if (p.display.rst) uses.push({ pin: p.display.rst, role: 'display.rst', input: false });
  if (p.sound.pin1) uses.push({ pin: p.sound.pin1, role: 'sound.pin1', input: false });
  if (p.sound.pin2) uses.push({ pin: p.sound.pin2, role: 'sound.pin2', input: false });
  return uses;
}

/** Checks a profile against the rules of its chip. */
export function validateProfile(p: Profile): ProfileIssue[] {
  const issues: ProfileIssue[] = [];
  const chip = CHIPS.find((c) => c.id === p.chip);
  if (!chip) return [{ level: 'error', key: 'profile.unknownChip', params: { chip: p.chip } }];

  if (!DISPLAY_DRIVERS.some((d) => d.id === p.display.driver) || !['spi', 'i2c'].includes(p.display.bus) || !Number.isInteger(p.display.i2cAddress) || p.display.i2cAddress < 1 || p.display.i2cAddress > 127 || !Number.isFinite(p.display.contrast) || p.display.contrast < 0 || p.display.contrast > 255 || (p.sound.pin2 && !p.sound.pin1)) {
    issues.push({ level: 'error', key: 'profile.invalidConfig' });
  }
  // Arduino analog aliases may refer to the same physical digital pin.
  const pinKey = (id: string) => {
    const bases: Record<string, number> = { atmega328p: 14, atmega328pb: 14, atmega32u4: 18, atmega644p: 24, atmega1284p: 24, atmega2560: 54, lgt8f328p: 14 };
    const base = bases[chip.id];
    if (base !== undefined && /^A[0-9]+$/.test(id)) return String(base + Number(id.slice(1)));
    return findPin(chip, id)?.cpp ?? id;
  };
  const uses = pinUses(p);
  const busPins: { pin: string; role: string }[] = [];
  if (isESPboy(p)) {
    const e = p.espboy;
    if (chip.id !== 'esp8266' || p.display.bus !== 'spi' || !e ||
        !Number.isInteger(e.mcpAddress) || e.mcpAddress < 0x20 || e.mcpAddress > 0x27 ||
        (e.dacAddress !== undefined && (!Number.isInteger(e.dacAddress) || e.dacAddress < 0x60 || e.dacAddress > 0x67)) ||
        (p.sound.pin1 && !findPin(chip, p.sound.pin1)) || p.sound.pin2) {
      issues.push({ level: 'error', key: 'profile.invalidConfig' });
    }
    if (e) {
      const bus = [['sda', e.sda], ['scl', e.scl], ['mosi', e.mosi], ['sck', e.sck]] as const;
      for (const [role, pin] of bus) {
        const info = findPin(chip, pin);
        if (!info || info.reserved) issues.push({ level: 'error', key: 'profile.pinUnknown', params: { pin, role: `bus.${role}`, chip: chip.name } });
        busPins.push({ pin, role: `bus.${role}` });
      }
      if (new Set(bus.map(([, pin]) => pin)).size !== 4) issues.push({ level: 'error', key: 'profile.invalidConfig' });
    }
  }
  if (!isESPboy(p) && p.display.bus === 'i2c') {
    if (chip.bus.sda) busPins.push({ pin: chip.bus.sda, role: 'bus.sda' });
    if (chip.bus.scl) busPins.push({ pin: chip.bus.scl, role: 'bus.scl' });
  } else if (!isESPboy(p)) {
    if (chip.bus.mosi) busPins.push({ pin: chip.bus.mosi, role: 'bus.mosi' });
    if (chip.bus.sck) busPins.push({ pin: chip.bus.sck, role: 'bus.sck' });
  }

  for (const b of BUTTONS) {
    if (chip.tiny && b !== 'left' && b !== 'right') continue;
    if (!p.buttons[b]) issues.push({ level: 'error', key: 'profile.buttonMissing', params: { role: `button.${b}` } });
  }
  if (chip.tiny && p.display.bus !== 'i2c') issues.push({ level: 'error', key: 'profile.tinyI2cOnly' });
  if (p.display.bus === 'spi' && !p.display.dc) {
    issues.push({ level: 'error', key: 'profile.dcMissing' });
  }

  for (const u of uses) {
    const info = isESPboy(p) && (u.input || u.role === 'display.cs') ? MCP_PINS.find((pin) => pin.id === u.pin) ?? findPin(chip, u.pin) : findPin(chip, u.pin);
    if (!info) {
      issues.push({ level: 'error', key: 'profile.pinUnknown', params: { pin: u.pin, role: u.role, chip: chip.name } });
      continue;
    }
    if (info.reserved) issues.push({ level: 'error', key: 'profile.pinReserved', params: { pin: u.pin, role: u.role } });
    if (info.analogOnly) issues.push({ level: 'error', key: 'profile.pinAnalogOnly', params: { pin: u.pin, role: u.role } });
    else if (u.input && info.noPullup) issues.push({ level: 'warning', key: 'profile.pinNoPullup', params: { pin: u.pin, role: u.role } });
    if (info.serial) issues.push({ level: 'warning', key: 'profile.pinSerial', params: { pin: u.pin, role: u.role } });
    const bus = busPins.find((bp) => pinKey(bp.pin) === pinKey(u.pin));
    if (bus) issues.push({ level: 'error', key: 'profile.pinBus', params: { pin: u.pin, role: u.role, bus: bus.role } });
    if (p.display.bus === 'spi' && chip.family === 'avr' && u.input && u.pin === chip.bus.ss) {
      issues.push({ level: 'error', key: 'profile.pinSpiSs', params: { pin: u.pin, role: u.role } });
    }
  }

  const seen = new Map<string, string>();
  for (const u of uses) {
    const first = seen.get(pinKey(u.pin));
    if (first) issues.push({ level: 'error', key: 'profile.pinDuplicate', params: { pin: u.pin, role: u.role, other: first } });
    else seen.set(pinKey(u.pin), u.role);
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
  const record = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
  if (!CHIPS.some((c) => c.id === p.chip) || !record(p.display) || !record(p.buttons) || !record(p.sound) ||
      !DISPLAY_DRIVERS.some((d) => d.id === p.display!.driver) || !['i2c', 'spi'].includes(p.display.bus) ||
      [p.display.cs, p.display.dc, p.display.rst, p.sound.pin1, p.sound.pin2, ...BUTTONS.map((b) => p.buttons![b])].some((v) => v !== undefined && typeof v !== 'string') ||
      [p.display.i2cAddress, p.display.contrast].some((v) => v !== undefined && (typeof v !== 'number' || !Number.isFinite(v)))) throw new Error('file.broken');
  if (p.espboy && (!record(p.espboy) || ['sda', 'scl', 'mosi', 'sck'].some((k) => typeof (p.espboy as unknown as Record<string, unknown>)[k] !== 'string') ||
      !Number.isInteger(p.espboy.mcpAddress) || (p.espboy.dacAddress !== undefined && !Number.isInteger(p.espboy.dacAddress)))) throw new Error('file.broken');
  const result: Profile = {
    format: 'ardublocks-profile',
    version: 1,
    id: typeof p.id === 'string' && p.id ? p.id : `custom-${Date.now().toString(36)}`,
    name: typeof p.name === 'string' && p.name ? p.name : 'Profile',
    chip: p.chip,
    ...(p.espboy ? { espboy: { ...p.espboy } } : {}),
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
  if (isESPboy(result) && hasErrors(validateProfile(result))) throw new Error('file.broken');
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
  return MCP_PINS.find((p) => p.id === id)?.cpp ?? findPin(chip, id)?.cpp;
}

/** Creates the ab_config.h header for a profile. */
export function profileToConfigH(p: Profile): string {
  if (hasErrors(validateProfile(p))) throw new Error('profile.hasErrors');
  const chip = getChip(p.chip);
  const lines: string[] = [
    '// Generated by ArduCade from the hardware profile.',
    `// Profile: ${p.name.replace(/[\r\n]/g, ' ')}`,
    '#pragma once',
    '',
    `#define AB_CHIP_${chip.id.toUpperCase()} 1`,
    `#define AB_FAMILY_${chip.family.toUpperCase()} 1`,
    `#define AB_DISPLAY_${p.display.driver.toUpperCase()} 1`,
    `#define AB_BUS_${p.display.bus.toUpperCase()} 1`,
  ];
  if (isESPboy(p)) {
    const e = p.espboy!;
    for (const k of ['sda', 'scl', 'mosi', 'sck'] as const) lines.push(`#define AB_ESP_${k.toUpperCase()} ${pinCpp(chip, e[k])}`);
    lines.push(`#define AB_ESP_MCP_ADDRESS ${e.mcpAddress}`);
    if (e.dacAddress !== undefined) lines.push(`#define AB_ESP_DAC_ADDRESS ${e.dacAddress}`);
  }
  if (chip.tiny) {
    lines.push(`#define AB_PIN_SDA ${pinCpp(chip, chip.bus.sda)}`);
    lines.push(`#define AB_PIN_SCL ${pinCpp(chip, chip.bus.scl)}`);
    lines.push('#define AB_TWO_BUTTONS 1');
  }
  if (p.display.bus === 'i2c') {
    lines.push(`#define AB_I2C_ADDRESS 0x${p.display.i2cAddress.toString(16).toUpperCase()}`);
  } else {
    const cs = pinCpp(chip, p.display.cs);
    const dc = pinCpp(chip, p.display.dc);
    if (cs) lines.push(`#define AB_PIN_CS ${cs}`);
    if (dc) lines.push(`#define AB_PIN_DC ${dc}`);
  }
  const rst = pinCpp(chip, p.display.rst);
  if (rst) lines.push(`#define AB_PIN_RST ${rst}`);
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
