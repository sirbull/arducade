// Writes the templates in src/templates to public/templates as project files,
// with an index.json the editor reads to show the gallery.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeProject } from '../src/project/model';
import { TEMPLATE_SOURCES, templateToProject } from '../src/templates';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = join(root, 'public/templates');
mkdirSync(dir, { recursive: true });
const files: string[] = [];
for (const t of TEMPLATE_SOURCES) {
  const file = `${t.id}.abproject`;
  writeFileSync(join(dir, file), serializeProject(templateToProject(t)));
  files.push(file);
}
writeFileSync(join(dir, 'index.json'), JSON.stringify(files, null, 1) + '\n');
console.log(`Wrote ${files.length} templates to public/templates`);
