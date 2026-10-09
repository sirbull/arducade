// Microcontrollers that have enough RAM (at least 2 KB) and flash (at least
// 32 KB) to run an Arduboy style game with a 1 KB screen buffer.

export type UploadProtocol =
  | 'stk500v1' // Optiboot and the old ATmega328P bootloader
  | 'stk500v2' // ATmega2560 (Mega) bootloader
  | 'avr109' // Caterina bootloader on ATmega32U4
  | 'none'; // Export the sketch and upload with the Arduino IDE

export type ChipFamily = 'avr' | 'megaavr' | 'rp2040' | 'esp32' | 'esp8266' | 'stm32' | 'samd';

export interface PinInfo {
  /** Name shown in the editor, for example "D7" or "A0". */
  id: string;
  /** Expression used for the pin in generated C++ (Arduino pin number or macro). */
  cpp: string;
  /** Pin can only be used as analog input (A6 and A7 on Nano). */
  analogOnly?: boolean;
  /** Pin has no internal pull up resistor. */
  noPullup?: boolean;
  /** Pin should not be used (for example connected to flash on ESP8266). */
  reserved?: boolean;
  /** Pin is used for uploading over serial (D0 and D1). */
  serial?: boolean;
}

export interface BusPins {
  sda?: string;
  scl?: string;
  mosi?: string;
  miso?: string;
  sck?: string;
  ss?: string;
}

export interface Chip {
  id: string;
  name: string;
  family: ChipFamily;
  /** Value passed to avr-gcc as -mmcu. */
  mmcu?: string;
  /** avr-libc multilib architecture, for example avr5. */
  arch?: string;
  fCpu: number;
  flash: number;
  ram: number;
  eeprom: number;
  /** Flash used by the bootloader. */
  bootloader: number;
  /** Boards that commonly use the chip. */
  boards: string[];
  /** Arduino IDE board (FQBN) used when exporting the sketch. */
  fqbn: string;
  /** Device signature read by the bootloader. */
  signature?: [number, number, number];
  upload: UploadProtocol;
  /** Baud rates to try when uploading, in order. */
  baud?: number[];
  /** The editor can compile for this chip in the browser. */
  browserCompile: boolean;
  /** Fixed pins for the hardware buses. */
  bus: BusPins;
  pins: PinInfo[];
}

function digital(from: number, to: number, prefix = 'D', cppPrefix = ''): PinInfo[] {
  const pins: PinInfo[] = [];
  for (let i = from; i <= to; i++) pins.push({ id: `${prefix}${i}`, cpp: `${cppPrefix}${i}` });
  return pins;
}

function analog(from: number, to: number): PinInfo[] {
  const pins: PinInfo[] = [];
  for (let i = from; i <= to; i++) pins.push({ id: `A${i}`, cpp: `A${i}` });
  return pins;
}

function markSerial(pins: PinInfo[], ids: string[]): PinInfo[] {
  return pins.map((p) => (ids.includes(p.id) ? { ...p, serial: true } : p));
}

const nanoPins: PinInfo[] = [
  ...markSerial(digital(0, 13), ['D0', 'D1']),
  ...analog(0, 5),
  { id: 'A6', cpp: 'A6', analogOnly: true, noPullup: true },
  { id: 'A7', cpp: 'A7', analogOnly: true, noPullup: true },
];

const leonardoPins: PinInfo[] = [
  ...markSerial(digital(0, 16), ['D0', 'D1']),
  ...analog(0, 5),
];

const megaPins: PinInfo[] = [...markSerial(digital(0, 53), ['D0', 'D1']), ...analog(0, 15)];

const mightyPins: PinInfo[] = [...markSerial(digital(0, 23), ['D8', 'D9']), ...analog(0, 7)];

const everyPins: PinInfo[] = [...digital(0, 13), ...analog(0, 7)];

function gpio(from: number, to: number, prefix: string, extra: (n: number) => Partial<PinInfo> = () => ({})): PinInfo[] {
  const pins: PinInfo[] = [];
  for (let i = from; i <= to; i++) pins.push({ id: `${prefix}${i}`, cpp: `${i}`, ...extra(i) });
  return pins;
}

function stm32Pins(): PinInfo[] {
  const pins: PinInfo[] = [];
  for (const port of ['A', 'B', 'C']) {
    const last = port === 'C' ? 15 : 15;
    for (let i = port === 'C' ? 13 : 0; i <= last; i++) pins.push({ id: `P${port}${i}`, cpp: `P${port}${i}` });
  }
  return pins.map((p) => (['PA11', 'PA12', 'PA13', 'PA14'].includes(p.id) ? { ...p, reserved: true } : p));
}

export const CHIPS: Chip[] = [
  {
    id: 'atmega328p',
    name: 'ATmega328P',
    family: 'avr',
    mmcu: 'atmega328p',
    arch: 'avr5',
    fCpu: 16000000,
    flash: 32768,
    ram: 2048,
    eeprom: 1024,
    bootloader: 512,
    boards: ['Arduino Nano', 'Arduino Uno', 'Arduino Pro Mini'],
    fqbn: 'arduino:avr:nano',
    signature: [0x1e, 0x95, 0x0f],
    upload: 'stk500v1',
    baud: [115200, 57600],
    browserCompile: true,
    bus: { sda: 'A4', scl: 'A5', mosi: 'D11', miso: 'D12', sck: 'D13', ss: 'D10' },
    pins: nanoPins,
  },
  {
    id: 'atmega328pb',
    name: 'ATmega328PB',
    family: 'avr',
    mmcu: 'atmega328pb',
    arch: 'avr5',
    fCpu: 16000000,
    flash: 32768,
    ram: 2048,
    eeprom: 1024,
    bootloader: 512,
    boards: ['Arduino Nano clones with 328PB', 'MiniCore boards'],
    fqbn: 'MiniCore:avr:328',
    signature: [0x1e, 0x95, 0x16],
    upload: 'stk500v1',
    baud: [115200, 57600],
    browserCompile: true,
    bus: { sda: 'A4', scl: 'A5', mosi: 'D11', miso: 'D12', sck: 'D13', ss: 'D10' },
    pins: nanoPins,
  },
  {
    id: 'atmega32u4',
    name: 'ATmega32U4',
    family: 'avr',
    mmcu: 'atmega32u4',
    arch: 'avr5',
    fCpu: 16000000,
    flash: 32768,
    ram: 2560,
    eeprom: 1024,
    bootloader: 4096,
    boards: ['Arduboy', 'Arduino Leonardo', 'Arduino Micro', 'Pro Micro'],
    fqbn: 'arduino:avr:leonardo',
    signature: [0x1e, 0x95, 0x87],
    upload: 'avr109',
    baud: [57600],
    browserCompile: true,
    bus: { sda: 'D2', scl: 'D3', mosi: 'D16', miso: 'D14', sck: 'D15', ss: 'D17' },
    pins: leonardoPins,
  },
  {
    id: 'atmega644p',
    name: 'ATmega644P',
    family: 'avr',
    mmcu: 'atmega644p',
    arch: 'avr5',
    fCpu: 16000000,
    flash: 65536,
    ram: 4096,
    eeprom: 2048,
    bootloader: 1024,
    boards: ['MightyCore boards', 'Sanguino'],
    fqbn: 'MightyCore:avr:644',
    signature: [0x1e, 0x96, 0x0a],
    upload: 'stk500v1',
    baud: [115200, 57600],
    browserCompile: true,
    bus: { sda: 'D17', scl: 'D16', mosi: 'D5', miso: 'D6', sck: 'D7', ss: 'D4' },
    pins: mightyPins,
  },
  {
    id: 'atmega1284p',
    name: 'ATmega1284P',
    family: 'avr',
    mmcu: 'atmega1284p',
    arch: 'avr51',
    fCpu: 16000000,
    flash: 131072,
    ram: 16384,
    eeprom: 4096,
    bootloader: 1024,
    boards: ['MightyCore boards'],
    fqbn: 'MightyCore:avr:1284',
    signature: [0x1e, 0x97, 0x05],
    upload: 'stk500v1',
    baud: [115200, 57600],
    // Needs libgcc for this architecture in the browser build. Export for now.
    browserCompile: false,
    bus: { sda: 'D17', scl: 'D16', mosi: 'D5', miso: 'D6', sck: 'D7', ss: 'D4' },
    pins: mightyPins,
  },
  {
    id: 'atmega2560',
    name: 'ATmega2560',
    family: 'avr',
    mmcu: 'atmega2560',
    arch: 'avr6',
    fCpu: 16000000,
    flash: 262144,
    ram: 8192,
    eeprom: 4096,
    bootloader: 8192,
    boards: ['Arduino Mega 2560'],
    fqbn: 'arduino:avr:mega',
    signature: [0x1e, 0x98, 0x01],
    upload: 'stk500v2',
    baud: [115200],
    // Needs libgcc for this architecture in the browser build. Export for now.
    browserCompile: false,
    bus: { sda: 'D20', scl: 'D21', mosi: 'D51', miso: 'D50', sck: 'D52', ss: 'D53' },
    pins: megaPins,
  },
  {
    id: 'atmega4809',
    name: 'ATmega4809',
    family: 'megaavr',
    mmcu: 'atmega4809',
    arch: 'avrxmega3',
    fCpu: 16000000,
    flash: 49152,
    ram: 6144,
    eeprom: 256,
    bootloader: 0,
    boards: ['Arduino Nano Every', 'Arduino Uno WiFi Rev2'],
    fqbn: 'arduino:megaavr:nona4809',
    signature: [0x1e, 0x96, 0x51],
    upload: 'none',
    browserCompile: false,
    bus: { sda: 'A4', scl: 'A5', mosi: 'D11', miso: 'D12', sck: 'D13', ss: 'D8' },
    pins: everyPins,
  },
  {
    id: 'lgt8f328p',
    name: 'LGT8F328P',
    family: 'avr',
    mmcu: 'atmega328p',
    arch: 'avr5',
    fCpu: 16000000,
    flash: 29696,
    ram: 2048,
    eeprom: 1024,
    bootloader: 1024,
    boards: ['LGT8F328P Nano clones'],
    fqbn: 'lgt8fx:avr:328',
    upload: 'none',
    browserCompile: false,
    bus: { sda: 'A4', scl: 'A5', mosi: 'D11', miso: 'D12', sck: 'D13', ss: 'D10' },
    pins: [...markSerial(digital(0, 13), ['D0', 'D1']), ...analog(0, 7)],
  },
  {
    id: 'rp2040',
    name: 'RP2040',
    family: 'rp2040',
    fCpu: 133000000,
    flash: 2097152,
    ram: 264192,
    eeprom: 4096,
    bootloader: 0,
    boards: ['Raspberry Pi Pico', 'Seeed XIAO RP2040'],
    fqbn: 'rp2040:rp2040:rpipico',
    upload: 'none',
    browserCompile: false,
    bus: { sda: 'GP4', scl: 'GP5', mosi: 'GP19', miso: 'GP16', sck: 'GP18', ss: 'GP17' },
    pins: gpio(0, 28, 'GP', (n) => (n === 23 || n === 24 || n === 25 ? { reserved: true } : {})),
  },
  {
    id: 'esp32',
    name: 'ESP32',
    family: 'esp32',
    fCpu: 240000000,
    flash: 4194304,
    ram: 327680,
    eeprom: 4096,
    bootloader: 0,
    boards: ['ESP32 DevKit'],
    fqbn: 'esp32:esp32:esp32',
    upload: 'none',
    browserCompile: false,
    bus: { sda: 'GPIO21', scl: 'GPIO22', mosi: 'GPIO23', miso: 'GPIO19', sck: 'GPIO18', ss: 'GPIO5' },
    // GPIO 20, 24 and 28 to 31 do not exist on the ESP32.
    pins: gpio(0, 39, 'GPIO', (n) => {
      if (n >= 6 && n <= 11) return { reserved: true };
      if (n >= 34) return { noPullup: true };
      return {};
    }).filter((p) => ![20, 24, 28, 29, 30, 31].includes(Number(p.cpp))),
  },
  {
    id: 'esp8266',
    name: 'ESP8266',
    family: 'esp8266',
    fCpu: 80000000,
    flash: 4194304,
    ram: 81920,
    eeprom: 4096,
    bootloader: 0,
    boards: ['Wemos D1 mini', 'NodeMCU', 'ESPboy'],
    fqbn: 'esp8266:esp8266:d1_mini',
    upload: 'none',
    browserCompile: false,
    bus: { sda: 'GPIO4', scl: 'GPIO5', mosi: 'GPIO13', miso: 'GPIO12', sck: 'GPIO14', ss: 'GPIO15' },
    pins: gpio(0, 16, 'GPIO', (n) => {
      if (n >= 6 && n <= 11) return { reserved: true };
      if (n === 16) return { noPullup: true };
      return {};
    }),
  },
  {
    id: 'samd21',
    name: 'SAMD21',
    family: 'samd',
    fCpu: 48000000,
    flash: 262144,
    ram: 32768,
    eeprom: 0,
    bootloader: 8192,
    boards: ['Arduino Zero', 'Seeed XIAO SAMD21', 'Adafruit Feather M0'],
    fqbn: 'arduino:samd:arduino_zero_native',
    upload: 'none',
    browserCompile: false,
    bus: { sda: 'D20', scl: 'D21', mosi: 'D23', miso: 'D22', sck: 'D24' },
    pins: [...digital(0, 13), ...analog(0, 5)],
  },
  {
    id: 'stm32f103',
    name: 'STM32F103',
    family: 'stm32',
    fCpu: 72000000,
    flash: 65536,
    ram: 20480,
    eeprom: 0,
    bootloader: 0,
    boards: ['Blue Pill'],
    fqbn: 'STMicroelectronics:stm32:GenF1',
    upload: 'none',
    browserCompile: false,
    bus: { sda: 'PB7', scl: 'PB6', mosi: 'PA7', miso: 'PA6', sck: 'PA5', ss: 'PA4' },
    pins: stm32Pins(),
  },
];

/** Chips that are too small. Shown in the editor with an explanation. */
export const UNSUPPORTED_CHIPS = [
  { name: 'ATmega168', reason: 'unsupported.ram' },
  { name: 'ATmega8', reason: 'unsupported.ram' },
  { name: 'ATtiny85', reason: 'unsupported.ram' },
];

export function getChip(id: string): Chip {
  const chip = CHIPS.find((c) => c.id === id);
  if (!chip) throw new Error(`Unknown chip: ${id}`);
  return chip;
}

export function findPin(chip: Chip, id: string): PinInfo | undefined {
  return chip.pins.find((p) => p.id === id);
}

/** Flash available for the program, after the bootloader. */
export function usableFlash(chip: Chip): number {
  return chip.flash - chip.bootloader;
}
