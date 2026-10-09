// An emulated game console: an ATmega328P (avr8js) with an SSD1306 screen on
// I2C, six buttons and a speaker. Used to run games with C++ blocks in the
// simulator, because those can only run as real machine code.

import {
  AVREEPROM,
  AVRIOPort,
  AVRTimer,
  AVRTWI,
  avrInstruction,
  CPU,
  EEPROMMemoryBackend,
  portBConfig,
  portCConfig,
  portDConfig,
  timer0Config,
  timer1Config,
  timer2Config,
  twiConfig,
} from 'avr8js';
import { parseHex } from '../upload/serial';

export const CLOCK_HZ = 16_000_000;

/** Hardware of the emulator, see EMULATOR_PROFILE in src/hw/profile.ts. */

const ARG_COUNT: Record<number, number> = { 0x20: 1, 0x21: 2, 0x22: 2, 0x81: 1, 0x8d: 1, 0xa8: 1, 0xd3: 1, 0xd5: 1, 0xd9: 1, 0xda: 1, 0xdb: 1 };

/** An SSD1306 on the I2C bus, in horizontal addressing mode. */
export class Ssd1306 {
  buffer = new Uint8Array(1024);
  inverted = false;
  onFrame: (buffer: Uint8Array) => void = () => {};
  private control = -1;
  private cmd: number[] = [];
  private col = 0;
  private page = 0;
  private col0 = 0;
  private col1 = 127;
  private page0 = 0;
  private page1 = 7;
  private written = 0;

  constructor(private twi: AVRTWI) {}

  start() {
    this.control = -1;
    this.twi.completeStart();
  }
  stop() {
    this.twi.completeStop();
  }
  connectToSlave(addr: number) {
    this.twi.completeConnect(addr === 0x3c);
  }
  readByte() {
    this.twi.completeRead(0xff);
  }
  writeByte(v: number) {
    if (this.control < 0) this.control = v;
    else if (this.control === 0x40) this.data(v);
    else this.command(v);
    this.twi.completeWrite(true);
  }
  private command(v: number) {
    this.cmd.push(v);
    const need = ARG_COUNT[this.cmd[0]] ?? 0;
    if (this.cmd.length <= need) return;
    const [c, a, b] = this.cmd;
    if (c === 0x21) [this.col0, this.col1, this.col] = [a, b, a];
    if (c === 0x22) [this.page0, this.page1, this.page] = [a, b, a];
    if (c === 0xa6) this.inverted = false;
    if (c === 0xa7) this.inverted = true;
    this.cmd = [];
  }
  private data(v: number) {
    this.buffer[this.page * 128 + this.col] = v;
    if (++this.col > this.col1) {
      this.col = this.col0;
      if (++this.page > this.page1) this.page = this.page0;
    }
    if (++this.written % 1024 === 0) this.onFrame(this.buffer);
  }
}

export class AvrBoard {
  cpu: CPU;
  screen: Ssd1306;
  eeprom: EEPROMMemoryBackend;
  /** Called with a frequency when the speaker tone changes, 0 for silence. */
  onTone: (freq: number) => void = () => {};
  private portD: AVRIOPort;
  private lastToggle = 0;
  private halfPeriod = 0;
  private tone = 0;

  constructor(hex: string, eeprom?: Uint8Array) {
    const program = new Uint16Array(0x4000);
    new Uint8Array(program.buffer).set(parseHex(hex));
    this.cpu = new CPU(program, 2048);
    new AVRTimer(this.cpu, timer0Config);
    new AVRTimer(this.cpu, timer1Config);
    new AVRTimer(this.cpu, timer2Config);
    this.eeprom = new EEPROMMemoryBackend(1024);
    if (eeprom) this.eeprom.memory.set(eeprom.subarray(0, 1024));
    new AVREEPROM(this.cpu, this.eeprom);
    const portB = new AVRIOPort(this.cpu, portBConfig);
    new AVRIOPort(this.cpu, portCConfig);
    this.portD = new AVRIOPort(this.cpu, portDConfig);
    for (let i = 0; i <= 5; i++) portB.setPin(i, true);
    this.setButtons(0);
    const twi = new AVRTWI(this.cpu, twiConfig, CLOCK_HZ);
    this.screen = new Ssd1306(twi);
    twi.eventHandler = this.screen;
    // The speaker is on D9 (PB1). Measure how often the pin changes.
    portB.addListener((value, old) => {
      if (((value ^ old) & 0b10) === 0) return;
      const now = this.cpu.cycles;
      const half = now - this.lastToggle;
      this.lastToggle = now;
      if (half > 0 && half < CLOCK_HZ / 40) {
        this.halfPeriod = half;
        const freq = Math.round(CLOCK_HZ / (2 * half));
        if (Math.abs(freq - this.tone) > this.tone * 0.03) {
          this.tone = freq;
          this.onTone(freq);
        }
      }
    });
  }

  /** Buttons held, as bits in BUTTON_IDS order (up, down, left, right, A, B on D2 to D7). */
  setButtons(bits: number) {
    for (let b = 0; b < 6; b++) this.portD.setPin(2 + b, !(bits & (1 << b)));
  }

  /** Runs the program for a number of clock cycles. */
  run(cycles: number) {
    const end = this.cpu.cycles + cycles;
    const cpu = this.cpu;
    while (cpu.cycles < end) {
      avrInstruction(cpu);
      cpu.tick();
    }
    // Silence when the speaker pin has stopped changing.
    if (this.tone && cpu.cycles - this.lastToggle > Math.max(this.halfPeriod * 4, CLOCK_HZ / 50)) {
      this.tone = 0;
      this.onTone(0);
    }
  }
}
