import { describe, expect, it } from 'vitest';
import { embedProject, readCartridge } from '../src/project/cartridge';
import { parseProject, serializeProject, newProject } from '../src/project/model';
const png = () => new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
describe('PNG cartridges', () => {
  it('round trips the entire project including Unicode and assets', () => {
    const project = newProject('Blåbær 🎮');
    project.blocks = { blocks: { blocks: [{ type: 'on_start' }] } };
    project.images = [{ id: 'i', name: 'hero', width: 2, height: 1, frames: [['10']] }];
    expect(readCartridge(embedProject(png(), project))).toEqual(parseProject(serializeProject(project)));
  });
  it('replaces existing project data when saving again', () => {
    const first = newProject('First'), second = newProject('Second');
    expect(readCartridge(embedProject(embedProject(png(), first), second))).toEqual(parseProject(serializeProject(second)));
  });
  it('rejects ordinary images, damaged payloads and truncated files', () => {
    expect(() => readCartridge(png())).toThrow('file.notCartridge');
    const saved = embedProject(png(), newProject('Game'));
    expect(() => readCartridge(saved.slice(0, -10))).toThrow('file.notCartridge');
    saved[100] ^= 1;
    expect(() => readCartridge(saved)).toThrow('file.notCartridge');
  });
});
