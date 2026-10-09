// Turns names chosen by the user (which may contain any letters, such as
// "æ", "ø" or "å") into valid and unique identifiers for C++ and JavaScript.

const TRANSLIT: Record<string, string> = {
  æ: 'ae', ø: 'o', å: 'a', ä: 'a', ö: 'o', ü: 'u', ß: 'ss', é: 'e', è: 'e', ê: 'e', á: 'a', à: 'a', â: 'a',
  í: 'i', ì: 'i', î: 'i', ó: 'o', ò: 'o', ô: 'o', ú: 'u', ù: 'u', û: 'u', ñ: 'n', ç: 'c',
};

export function sanitize(name: string): string {
  let out = '';
  for (const ch of name.normalize('NFC')) {
    const lower = ch.toLowerCase();
    if (/[A-Za-z0-9_]/.test(ch)) out += ch;
    else if (TRANSLIT[lower]) out += ch === lower ? TRANSLIT[lower] : TRANSLIT[lower].toUpperCase();
    else if (/\s|-/.test(ch)) out += '_';
    else out += `_${ch.codePointAt(0)!.toString(16)}`;
  }
  if (!out) out = '_';
  return out;
}

/** Hands out unique identifiers with a prefix, one per original name. */
export class NameTable {
  private map = new Map<string, string>();
  private used = new Set<string>();

  constructor(private prefix: string) {}

  get(name: string): string {
    let id = this.map.get(name);
    if (id) return id;
    const base = this.prefix + sanitize(name);
    id = base;
    for (let i = 2; this.used.has(id); i++) id = `${base}_${i}`;
    this.used.add(id);
    this.map.set(name, id);
    return id;
  }
}

/** Escapes text for a C++ or JavaScript string literal (ASCII only). */
export function stringLiteral(s: string): string {
  let out = '"';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ch === '"' || ch === '\\') out += '\\' + ch;
    else if (ch === '\n') out += '\\n';
    else if (code >= 32 && code < 127) out += ch;
    else {
      // The font only has ASCII. Use a close letter where possible.
      const t = TRANSLIT[ch.toLowerCase()];
      out += t ? (ch === ch.toLowerCase() ? t : t.toUpperCase()) : '?';
    }
  }
  return out + '"';
}

/** Wraps a number to a 16 bit signed integer, like the device does. */
export function wrap16(v: number): number {
  return (Math.trunc(v) << 16) >> 16;
}
