// Word wrapping shared by simulator rendering and documentation examples.
export function speechLines(text: string, columns: number): string[] {
  const lines: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start;
    let space = -1;
    while (end < text.length && text[end] !== '\n' && end - start < columns) {
      if (text[end] === ' ') space = end;
      end++;
    }
    let next = end;
    if (text[end] === '\n') next++;
    else if (end < text.length && text[end] !== ' ' && space > start) {
      end = space;
      next = space + 1;
    }
    while (next < text.length && text[next] === ' ') next++;
    lines.push(text.slice(start, end));
    start = next;
  }
  return lines.length ? lines : [''];
}
