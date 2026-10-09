// AVR109, used by the Caterina bootloader on ATmega32U4 boards (Arduboy,
// Leonardo, Pro Micro). Opening the port at 1200 baud restarts the board in
// the bootloader, which shows up as a new serial port for a few seconds.

import { Connection, sleep, UploadError, type SerialPortLike } from './serial';
import type { UploadProgress } from './stk500v1';

/** Restarts the board into the bootloader. */
export async function touch1200(port: SerialPortLike) {
  await port.open({ baudRate: 1200 });
  await port.setSignals({ dataTerminalReady: false });
  await sleep(50);
  await port.close();
}

async function cr(c: Connection, bytes: number[], timeout = 1000) {
  await c.write(bytes);
  const r = await c.read(1, timeout);
  if (r[0] !== 0x0d) throw new UploadError('upload.noSync');
}

export async function uploadAvr109(port: SerialPortLike, image: Uint8Array, opts: { signature?: number[]; progress: UploadProgress }) {
  // Flash is written in 16 bit words.
  const program = image.length % 2 ? Uint8Array.from([...image, 0xff]) : image;
  opts.progress('connect', 0);
  await port.open({ baudRate: 57600 });
  const c = new Connection(port);
  try {
    c.drain();
    await c.write([0x53]); // 'S' software id
    const id = String.fromCharCode(...(await c.read(7, 1500)));
    if (!id.startsWith('CATERIN') && !id.startsWith('AVRBOOT')) throw new UploadError('upload.noBootloader');
    await c.write([0x73]); // 's' signature, lowest byte first
    const sig = (await c.read(3)).reverse();
    if (opts.signature && sig.some((b, i) => b !== opts.signature![i])) {
      throw new UploadError('upload.wrongChip', { found: sig.map((b) => b.toString(16).padStart(2, '0')).join(' ') });
    }
    await c.write([0x62]); // 'b' block size
    const b = await c.read(3);
    const block = b[0] === 0x59 ? (b[1] << 8) | b[2] : 128;
    await cr(c, [0x50]); // enter programming mode
    await cr(c, [0x65], 5000); // erase
    const total = Math.ceil(program.length / block);
    await cr(c, [0x41, 0, 0]); // address 0
    for (let i = 0; i < total; i++) {
      const chunk = Array.from(program.subarray(i * block, (i + 1) * block));
      await cr(c, [0x42, chunk.length >> 8, chunk.length & 0xff, 0x46, ...chunk], 2000);
      opts.progress('write', (i + 1) / total);
    }
    await cr(c, [0x41, 0, 0]);
    for (let i = 0; i < total; i++) {
      const len = Math.min(block, program.length - i * block);
      await c.write([0x67, len >> 8, len & 0xff, 0x46]);
      const got = await c.read(len, 2000);
      for (let j = 0; j < len && i * block + j < program.length; j++) {
        if (got[j] !== program[i * block + j]) throw new UploadError('upload.verifyFailed');
      }
      opts.progress('verify', (i + 1) / total);
    }
    await cr(c, [0x4c]); // leave programming mode
    await cr(c, [0x45]); // exit bootloader and start the game
    opts.progress('done', 1);
  } finally {
    await c.close();
  }
}
