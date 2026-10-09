/** Collects lines of code and remembers which lines each block produced. */
export class Writer {
  lines: string[] = [];
  /** Block id to the first and last line (0 based) it produced. */
  ranges = new Map<string, [number, number]>();
  private depth = 0;

  line(text = '') {
    this.lines.push(text ? '  '.repeat(this.depth) + text : '');
  }

  indent() {
    this.depth++;
  }

  dedent() {
    this.depth--;
  }

  /** Writes a block of code and records its lines for the given block id. */
  track(id: string | undefined, fn: () => void) {
    const start = this.lines.length;
    fn();
    if (id && this.lines.length > start) {
      const old = this.ranges.get(id);
      const range: [number, number] = [start, this.lines.length - 1];
      this.ranges.set(id, old ? [Math.min(old[0], range[0]), Math.max(old[1], range[1])] : range);
    }
  }

  toString() {
    return this.lines.join('\n') + '\n';
  }
}
