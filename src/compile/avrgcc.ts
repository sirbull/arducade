// Compiles a game to Intel HEX with avr-gcc and binutils built for
// WebAssembly. Runs in a Web Worker in the browser, and in Node for tests.
//
// The GCC driver can not run in WebAssembly, so the steps are run one by one:
// cc1plus (C++ to assembly), avr-as, avr-ld and avr-objcopy.

export interface SysrootManifest {
  mcus: Record<string, { define: string; board: string; extra: string[]; headers: string; core: string; crt: string; deviceLib: string; dataStart: string }>;
  libs: string[];
  ldscript: string;
}

export interface CompileInput {
  mcu: string;
  /** Generated game (.ino). */
  game: string;
  /** ab_config.h from the hardware profile. */
  config: string;
  /** Engine headers by file name. */
  headers: Record<string, string>;
}

export interface CompileOutput {
  hex: string;
  /** Program size in flash (text + data). */
  flash: number;
  /** RAM used by variables (data + bss). */
  ram: number;
  log: string[];
}

/** Where the compiler files come from: fetch in the browser, files in Node. */
export interface FileSource {
  bytes(path: string): Promise<Uint8Array>;
  text(path: string): Promise<string>;
  /** Imports an Emscripten tool module (cc1plus.mjs and so on). */
  tool(name: string): Promise<(opts: object) => Promise<EmscriptenModule>>;
  /** The .wasm file of a tool. */
  wasm(name: string): Promise<Uint8Array>;
}

interface EmscriptenFS {
  mkdir(path: string): void;
  writeFile(path: string, data: string | Uint8Array): void;
  readFile(path: string, opts?: { encoding: 'utf8' }): Uint8Array;
  stat(path: string): unknown;
}

interface EmscriptenModule {
  FS: EmscriptenFS;
  callMain(args: string[]): number;
}

export class CompileError extends Error {
  constructor(
    message: string,
    public log: string[],
  ) {
    super(message);
  }
}

function mkdirs(fs: EmscriptenFS, dir: string) {
  let cur = '';
  for (const part of dir.split('/').filter(Boolean)) {
    cur += '/' + part;
    try {
      fs.mkdir(cur);
    } catch {
      // Already there.
    }
  }
}

function write(fs: EmscriptenFS, path: string, data: string | Uint8Array) {
  mkdirs(fs, path.slice(0, path.lastIndexOf('/')));
  fs.writeFile(path, data);
}

const cache = new Map<string, Promise<unknown>>();
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load();
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}

async function runTool(
  src: FileSource,
  name: string,
  args: string[],
  setup: (fs: EmscriptenFS) => void,
  output: string,
  log: string[],
): Promise<Uint8Array> {
  const factory = await cached(`tool:${name}`, () => src.tool(name));
  // Keep the downloaded .wasm, so it is only fetched once.
  const wasmBinary = await cached(`wasm:${name}`, () => src.wasm(name));
  const errors: string[] = [];
  const mod = await factory({
    noInitialRun: true,
    wasmBinary,
    print: (line: string) => line && log.push(line),
    printErr: (line: string) => {
      if (!line) return;
      errors.push(line);
      log.push(line);
    },
  });
  setup(mod.FS);
  let status = 0;
  try {
    status = mod.callMain(args);
  } catch (e) {
    const err = e as { status?: number; message?: string };
    status = err.status ?? 1;
    if (status === 0 || /exit\(0\)/.test(String(err.message))) status = 0;
  }
  if (status !== 0) throw new CompileError(`${name} failed`, errors.length ? errors : log);
  try {
    return mod.FS.readFile(output);
  } catch {
    throw new CompileError(`${name} gave no output`, errors.length ? errors : log);
  }
}

export async function compileGame(src: FileSource, input: CompileInput): Promise<CompileOutput> {
  const manifest = await cached('manifest', async () => JSON.parse(await src.text('sysroot/manifest.json')) as SysrootManifest);
  const m = manifest.mcus[input.mcu];
  if (!m) throw new CompileError(`No compiler files for ${input.mcu}`, []);
  const headers = await cached(`headers:${input.mcu}`, async () => JSON.parse(await src.text(`sysroot/${m.headers}`)) as Record<string, string>);
  const log: string[] = [];

  const asm = await runTool(
    src,
    'cc1plus',
    [
      '-quiet',
      '-imultilib', 'avr5',
      `-D${m.define}`,
      `-D__AVR_DEVICE_NAME__=${input.mcu}`,
      '-DF_CPU=16000000L',
      '-DARDUINO=10819',
      `-D${m.board}`,
      '-DARDUINO_ARCH_AVR',
      ...m.extra,
      '-isystem', '/sysroot/gcc/include',
      '-isystem', '/sysroot/gcc/include-fixed',
      '-isystem', '/sysroot/avr/include',
      '-I', '/game',
      '-I', '/ardublocks',
      '-I', '/arduino/core',
      '-I', '/arduino/variant',
      '-I', '/arduino/libraries/EEPROM',
      '/game/game.cpp',
      '-mn-flash=1',
      '-mno-skip-bug',
      '-dumpbase', 'game.cpp',
      '-mmcu=avr5',
      '-auxbase-strip', '/build/game.s',
      '-Os',
      '-std=gnu++11',
      '-fpermissive',
      '-fno-exceptions',
      '-fno-threadsafe-statics',
      '-fno-rtti',
      '-fno-enforce-eh-specs',
      '-ffunction-sections',
      '-fdata-sections',
      '-o', '/build/game.s',
    ],
    (fs) => {
      for (const [path, text] of Object.entries(headers)) write(fs, path, text);
      for (const [name, text] of Object.entries(input.headers)) write(fs, `/ardublocks/${name}`, text);
      write(fs, '/game/ab_config.h', input.config);
      write(fs, '/game/game.cpp', input.game);
      mkdirs(fs, '/build');
    },
    '/build/game.s',
    log,
  );

  const obj = await runTool(src, 'avr-as', [`-mmcu=${input.mcu}`, '-o', '/build/game.o', '/build/game.s'], (fs) => write(fs, '/build/game.s', asm), '/build/game.o', log);

  const files = await Promise.all(
    [m.crt, m.core, m.deviceLib, ...manifest.libs, manifest.ldscript].map((f) => cached(`file:${f}`, () => src.bytes(`sysroot/${f}`)).then((data) => [f, data] as const)),
  );
  const elf = await runTool(
    src,
    'avr-ld',
    [
      '-m', 'avr5',
      `-Tdata=${m.dataStart}`,
      '--gc-sections',
      '-o', '/build/game.elf',
      `/libs/${m.crt}`,
      '/build/game.o',
      `/libs/${m.core}`,
      '-L/libs',
      '--start-group', '-lgcc', '-lm', '-lc', `-l${m.deviceLib.replace(/^lib|\.a$/g, '')}`, '--end-group',
    ],
    (fs) => {
      write(fs, '/build/game.o', obj);
      for (const [f, data] of files) write(fs, f === manifest.ldscript ? `/ldscripts/${f}` : `/libs/${f}`, data);
    },
    '/build/game.elf',
    log,
  );

  const hexBytes = await runTool(src, 'avr-objcopy', ['-O', 'ihex', '-R', '.eeprom', '/build/game.elf', '/build/game.hex'], (fs) => write(fs, '/build/game.elf', elf), '/build/game.hex', log);
  const sizes = elfSizes(elf);
  return { hex: new TextDecoder().decode(hexBytes), flash: sizes.text + sizes.data, ram: sizes.data + sizes.bss, log };
}

/** Reads the sizes of the .text, .data and .bss sections of an ELF file. */
export function elfSizes(elf: Uint8Array): { text: number; data: number; bss: number } {
  const v = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const shoff = v.getUint32(0x20, true);
  const shentsize = v.getUint16(0x2e, true);
  const shnum = v.getUint16(0x30, true);
  const shstrndx = v.getUint16(0x32, true);
  const strOff = v.getUint32(shoff + shstrndx * shentsize + 0x10, true);
  const name = (off: number) => {
    let s = '';
    for (let i = strOff + off; elf[i]; i++) s += String.fromCharCode(elf[i]);
    return s;
  };
  const out = { text: 0, data: 0, bss: 0 };
  for (let i = 0; i < shnum; i++) {
    const base = shoff + i * shentsize;
    const n = name(v.getUint32(base, true));
    const size = v.getUint32(base + 0x14, true);
    if (n === '.text') out.text += size;
    else if (n === '.data') out.data += size;
    else if (n === '.bss' || n === '.noinit') out.bss += size;
  }
  return out;
}
