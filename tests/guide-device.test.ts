import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileGame, type FileSource } from '../src/compile/avrgcc';
import { COURSES } from '../src/guides/courses';
import { guideProject } from '../src/guides/guide';
import { profileToConfigH } from '../src/hw/profile';
import { compileProject } from './helpers';
const base=join(__dirname,'../public/compiler');
const src: FileSource = {
  bytes: async p => new Uint8Array(readFileSync(join(base,p))),
  text: async p => readFileSync(join(base,p),'utf8'),
  tool: async name => (await import(pathToFileURL(join(base,'tools',`${name}.mjs`)).href)).default,
  wasm: async name => new Uint8Array(readFileSync(join(base,'tools',`${name}.wasm`))),
};
const headers=Object.fromEntries(['ardublocks.h','ab_display.h','ab_font.h'].map(f=>[f,readFileSync(join(__dirname,'../core/ardublocks',f),'utf8')]));
describe.skipIf(!existsSync(join(base,'tools/cc1plus.wasm')))('guided games on device',()=>{
  for(const guide of COURSES){
    it(`compiles ${guide.id} to an AVR program`,async()=>{
      const project=guideProject(guide,'en');project.blocks=guide.steps.at(-1)!.solution;
      const {cpp}=compileProject(project);
      const result=await compileGame(src,{mcu:project.profile.chip,game:cpp.code,config:profileToConfigH(project.profile),headers});
      expect(result.hex.startsWith(':')).toBe(true);
    },120000);
  }
});
