// STK500 version 1, used by Optiboot and the old ATmega328P bootloader.

import { Connection, sleep, UploadError, type SerialPortLike } from './serial';

const OK = 0x10;
const INSYNC = 0x14;
const EOP = 0x20;

export interface UploadProgress {
  (stage: 'connect' | 'write' | 'verify' | 'done', fraction: number): void;
}

async function command(c: Connection, bytes: number[], replyLen = 0, timeout = 500): Promise<number[]> {
  await c.write([...bytes, EOP]);
  const head = await c.read(1, timeout);
  if (head[0] !== INSYNC) throw new UploadError('upload.noSync');
  const reply = replyLen ? await c.read(replyLen, timeout) : [];
  const tail = await c.read(1, timeout);
  if (tail[0] !== OK) throw new UploadError('upload.noSync');
  return reply;
}

async function resetBoard(port: SerialPortLike) {
  // A pulse on DTR and RTS resets Arduino boards through a capacitor.
  await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  await sleep(250);
  await port.setSignals({ dataTerminalReady: true, requestToSend: true });
  await sleep(50);
}

async function sync(c: Connection): Promise<boolean> {
  for (let i = 0; i < 10; i++) {
    c.drain();
    try {
      await c.write([0x30, EOP]);
      const r = await c.read(2, 200);
      if (r[0] === INSYNC && r[1] === OK) return true;
    } catch {
      // Try again.
    }
  }
  return false;
}

/** Connects at one of the baud rates and returns the open connection. */
async function connect(port: SerialPortLike, bauds: number[]): Promise<Connection> {
  for (const baud of bauds) {
    await port.open({ baudRate: baud });
    const c = new Connection(port);
    await resetBoard(port);
    if (await sync(c)) return c;
    await c.close();
  }
  throw new UploadError('upload.noBootloader');
}

export async function uploadStk500v1(
  port: SerialPortLike,
  program: Uint8Array,
  opts: { bauds: number[]; pageSize: number; signature?: number[]; progress: UploadProgress },
) {
  opts.progress('connect', 0);
  const c = await connect(port, opts.bauds);
  try {
    const sig = await command(c, [0x75], 3);
    if (opts.signature && sig.some((b, i) => b !== opts.signature![i])) {
      throw new UploadError('upload.wrongChip', { found: sig.map((b) => b.toString(16).padStart(2, '0')).join(' ') });
    }
    await command(c, [0x50]);
    const pages = Math.ceil(program.length / opts.pageSize);
    for (let p = 0; p < pages; p++) {
      const addr = p * opts.pageSize;
      const page = Array.from(program.subarray(addr, addr + opts.pageSize));
      while (page.length < opts.pageSize) page.push(0xff);
      await command(c, [0x55, (addr >> 1) & 0xff, (addr >> 9) & 0xff]);
      await command(c, [0x64, page.length >> 8, page.length & 0xff, 0x46, ...page], 0, 1000);
      opts.progress('write', (p + 1) / pages);
    }
    for (let p = 0; p < pages; p++) {
      const addr = p * opts.pageSize;
      await command(c, [0x55, (addr >> 1) & 0xff, (addr >> 9) & 0xff]);
      const got = await command(c, [0x74, opts.pageSize >> 8, opts.pageSize & 0xff, 0x46], opts.pageSize, 1000);
      for (let i = 0; i < opts.pageSize && addr + i < program.length; i++) {
        if (got[i] !== program[addr + i]) throw new UploadError('upload.verifyFailed');
      }
      opts.progress('verify', (p + 1) / pages);
    }
    await command(c, [0x51]);
    opts.progress('done', 1);
  } finally {
    await c.close();
  }
}
