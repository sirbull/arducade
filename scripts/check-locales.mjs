// Lists texts that are missing or extra in each language compared to English,
// and texts whose placeholders (%1 for blocks, {name} for the editor) differ.
// Usage: node scripts/check-locales.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../public/locales/', import.meta.url));
const en = JSON.parse(readFileSync(dir + 'en.json', 'utf8'));
const marks = (s) => [...(s.match(/%\d|\{\w+\}/g) ?? [])].sort().join(' ');
let problems = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'en.json')) {
  const loc = JSON.parse(readFileSync(dir + file, 'utf8'));
  for (const section of ['ui', 'blocks']) {
    const a = en[section] ?? {};
    const b = loc[section] ?? {};
    for (const k of Object.keys(a)) {
      if (!(k in b)) console.log(`${file} ${section}: missing ${k}`), problems++;
      else if (marks(a[k]) !== marks(b[k])) console.log(`${file} ${section}: placeholders differ in ${k}`), problems++;
    }
    for (const k of Object.keys(b)) if (!(k in a)) console.log(`${file} ${section}: extra ${k}`), problems++;
  }
}
console.log(problems ? `${problems} problems` : 'All languages are complete.');
process.exitCode = problems ? 1 : 0;
