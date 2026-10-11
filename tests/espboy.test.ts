import { describe, expect, it } from 'vitest';
import { BUILTIN_PROFILES, cloneProfile } from '../src/hw/profile';
import { sketchFiles } from '../src/project/sketch';
import { newProject } from '../src/project/model';
import { compileProject } from './helpers';
import { TEMPLATE_SOURCES, templateToProject } from '../src/templates';

describe('ESPboy sketch and simulator', () => {
  it('exports the hardware adapter and setup instructions with the game', () => {
    const project = newProject('ESPboy game');
    project.profile = cloneProfile(BUILTIN_PROFILES.find((p) => p.id === 'espboy-diy')!, 'My ESPboy');
    const files = sketchFiles(project, compileProject(project).cpp.code);
    expect(files['ab_config.h']).toContain('#define AB_DISPLAY_ESPBOY 1');
    expect(files['ab_config.h']).not.toContain('AB_ESP_DAC_ADDRESS');
    expect(files['ab_espboy.h']).toContain('namespace ab');
    expect(files['README.txt']).toContain('Adafruit ST7735');
    project.profile = BUILTIN_PROFILES[0];
    expect(sketchFiles(project, compileProject(project).cpp.code)['README.txt']).toBeUndefined();
  });

  it('preserves generated simulator game behavior for existing templates', () => {
    for (const template of TEMPLATE_SOURCES) {
      const project = templateToProject(template);
      const original = compileProject(project);
      project.profile = BUILTIN_PROFILES.find((p) => p.id === 'espboy-original')!;
      const espboy = compileProject(project);
      expect(espboy.js.code).toBe(original.js.code);
      expect(espboy.cpp.code).toBe(original.cpp.code);
    }
  });
});
