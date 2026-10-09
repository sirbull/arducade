// Copies the WebAssembly compiler (avr-gcc and binutils) from node_modules
// to public/compiler/tools, so it is served with the site.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = join(root, 'node_modules/@horang-corp/avr-gcc-wasm/tools');
const dest = join(root, 'public/compiler/tools');
mkdirSync(dest, { recursive: true });
for (const f of readdirSync(src)) copyFileSync(join(src, f), join(dest, f));
copyFileSync(join(root, 'node_modules/@horang-corp/avr-gcc-wasm/THIRD_PARTY_NOTICES.md'), join(dest, 'THIRD_PARTY_NOTICES.md'));
console.log('Copied compiler to public/compiler/tools');

// Blockly loads its icons and cursors from a folder. Serve it ourselves
// instead of from Google's server.
const media = join(root, 'public/blockly-media');
mkdirSync(media, { recursive: true });
for (const f of readdirSync(join(root, 'node_modules/blockly/media'))) copyFileSync(join(root, 'node_modules/blockly/media', f), join(media, f));
console.log('Copied Blockly media to public/blockly-media');
