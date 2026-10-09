// Web Worker that runs the emulated console in real time, so the editor
// stays responsive while the game runs.

import { AvrBoard, CLOCK_HZ } from './avr-board';

type Msg = { type: 'start'; hex: string; eeprom: number[] } | { type: 'input'; bits: number };

let board: AvrBoard | null = null;
let frame: Uint8Array | null = null;
let inverted = false;
let eepromDirty = false;

self.onmessage = (e: MessageEvent<Msg>) => {
  const m = e.data;
  if (m.type === 'input') {
    board?.setButtons(m.bits);
    return;
  }
  try {
    board = new AvrBoard(m.hex, Uint8Array.from(m.eeprom.map((v) => v ?? 0xff)));
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) });
    return;
  }
  const b = board;
  b.screen.onFrame = (buf) => {
    frame = buf.slice();
    inverted = b.screen.inverted;
  };
  b.onTone = (freq) => self.postMessage({ type: 'tone', freq });
  const write = b.eeprom.writeMemory.bind(b.eeprom);
  b.eeprom.writeMemory = (addr, value) => {
    write(addr, value);
    eepromDirty = true;
  };
  let last = performance.now();
  let lastSave = last;
  const tick = () => {
    const now = performance.now();
    // Run as many cycles as real time has passed, but not more than 100 ms
    // at once (if the computer is too slow the game runs a bit slower).
    const ms = Math.min(100, now - last);
    last = now;
    try {
      b.run(Math.round((ms / 1000) * CLOCK_HZ));
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err) });
      return;
    }
    if (frame) {
      self.postMessage({ type: 'frame', buffer: frame, inverted });
      frame = null;
    }
    if (eepromDirty && now - lastSave > 1000) {
      eepromDirty = false;
      lastSave = now;
      self.postMessage({ type: 'eeprom', data: Array.from(b.eeprom.memory) });
    }
    setTimeout(tick, 4);
  };
  tick();
};
