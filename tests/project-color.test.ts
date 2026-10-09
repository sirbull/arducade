import { describe, expect, it } from 'vitest';
import { instantiateTemplate, newProject, parseProject, serializeProject } from '../src/project/model';

describe('project simulator colour', () => {
  it('starts new projects in black and white', () => {
    expect(newProject('New game').pixelColor).toBe('white');
    const template = newProject('Template');
    template.pixelColor = 'yellow';
    expect(instantiateTemplate(template, 'nb').pixelColor).toBe('white');
  });

  it('preserves independent colours through export and import', () => {
    const white = newProject('White game');
    const yellow = newProject('Yellow game');
    yellow.pixelColor = 'yellow';
    expect(parseProject(serializeProject(white)).pixelColor).toBe('white');
    expect(parseProject(serializeProject(yellow)).pixelColor).toBe('yellow');
  });

  it('defaults legacy and invalid colours to white', () => {
    const project = newProject('Legacy');
    delete project.pixelColor;
    expect(parseProject(serializeProject(project)).pixelColor).toBe('white');
    expect(parseProject(JSON.stringify({ ...project, pixelColor: 'invalid' })).pixelColor).toBe('white');
  });
});
