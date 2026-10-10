import { expect, it } from 'vitest';
import { newProject, upgradeProject } from '../src/project/model';

it('upgrades older stored projects without losing their blocks or assets', () => {
  const project = newProject('Saved game');
  const { backgrounds: _backgrounds, ...legacy } = project;
  const upgraded = upgradeProject(legacy);
  expect(upgraded.backgrounds).toEqual([]);
  expect(upgraded.id).toBe(project.id);
  expect(upgraded.blocks).toBe(project.blocks);
  expect(upgraded.images).toBe(project.images);
});
