// Arduino sketch export: the generated game plus the engine headers, ready
// to open in the Arduino IDE for any of the supported boards.

import abDisplay from '../../core/ardublocks/ab_display.h?raw';
import abFont from '../../core/ardublocks/ab_font.h?raw';
import abTiny from '../../core/ardublocks/ab_tiny.h?raw';
import ardublocks from '../../core/ardublocks/ardublocks.h?raw';
import { profileToConfigH } from '../hw/profile';
import { sanitize } from '../gen/names';
import type { Project } from './model';
import { makeZip } from './zip';

export const CORE_HEADERS: Record<string, string> = {
  'ardublocks.h': ardublocks,
  'ab_display.h': abDisplay,
  'ab_font.h': abFont,
  'ab_tiny.h': abTiny,
};

export function sketchName(project: Project): string {
  return sanitize(project.name).replace(/^_+/, '') || 'game';
}

/** All files of the sketch, by file name. */
export function sketchFiles(project: Project, gameCpp: string): Record<string, string> {
  return {
    [`${sketchName(project)}.ino`]: gameCpp,
    'ab_config.h': profileToConfigH(project.profile),
    ...CORE_HEADERS,
  };
}

export function sketchZip(project: Project, gameCpp: string): Uint8Array {
  const folder = sketchName(project);
  const files = sketchFiles(project, gameCpp);
  return makeZip(Object.entries(files).map(([name, content]) => ({ name: `${folder}/${name}`, content })));
}
