// Web Serial helpers: port selection, a byte reader with timeouts, and
// Intel HEX parsing.

export interface SerialPortLike {
  open(opts: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  setSignals(s: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
  getInfo(): { usbVendorId?: number; usbProductId?: number };
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

interface SerialApi {
  requestPort(opts?: { filters?: { usbVendorId?: number; usbProductId?: number }[] }): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
}

export function serialApi(): SerialApi | null {
  return (navigator as unknown as { serial?: SerialApi }).serial ?? null;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class UploadError extends Error {
  constructor(public key: string, public params?: Record<string, string | number>) {
    super(key);
  }
}

/** Reads bytes from an open port with timeouts. */
export class Connection {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private buf: number[] = [];
  private waiting: (() => void) | null = null;
  private closed = false;
  private pump: Promise<void>;

  constructor(public port: SerialPortLike) {
    this.reader = port.readable!.getReader();
    this.writer = port.writable!.getWriter();
    this.pump = this.readLoop();
  }

  private async readLoop() {
    try {
      for (;;) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) for (const b of value) this.buf.push(b);
        this.waiting?.();
      }
    } catch {
      // Port closed or device gone.
    }
    this.closed = true;
    this.waiting?.();
  }

  async write(bytes: number[] | Uint8Array) {
    await this.writer.write(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes));
  }

  drain() {
    this.buf = [];
  }

  async read(n: number, timeoutMs = 500): Promise<number[]> {
    const end = performance.now() + timeoutMs;
    while (this.buf.length < n) {
      const left = end - performance.now();
      if (left <= 0 || this.closed) throw new UploadError('upload.timeout');
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, left);
        this.waiting = () => (clearTimeout(t), resolve());
      });
      this.waiting = null;
    }
    return this.buf.splice(0, n);
  }

  async close() {
    try {
      await this.reader.cancel();
    } catch {
      // Ignore.
    }
    await this.pump;
    this.reader.releaseLock();
    try {
      this.writer.releaseLock();
    } catch {
      // Ignore.
    }
    await this.port.close().catch(() => {});
  }
}

/** Program bytes from Intel HEX text, starting at address 0. */
export function parseHex(hex: string): Uint8Array {
  const data: number[] = [];
  let base = 0;
  let max = 0;
  for (const raw of hex.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line[0] !== ':') throw new Error('Bad HEX');
    const bytes = line
      .slice(1)
      .match(/../g)!
      .map((x) => parseInt(x, 16));
    const len = bytes[0];
    const addr = (bytes[1] << 8) | bytes[2];
    const type = bytes[3];
    const sum = bytes.reduce((a, b) => a + b, 0) & 0xff;
    if (sum !== 0) throw new Error('Bad HEX checksum');
    if (type === 0) {
      for (let i = 0; i < len; i++) {
        const a = base + addr + i;
        while (data.length <= a) data.push(0xff);
        data[a] = bytes[4 + i];
        max = Math.max(max, a + 1);
      }
    } else if (type === 2) base = ((bytes[4] << 8) | bytes[5]) << 4;
    else if (type === 4) base = ((bytes[4] << 8) | bytes[5]) << 16;
    else if (type === 1) break;
  }
  return Uint8Array.from(data.slice(0, max));
}
