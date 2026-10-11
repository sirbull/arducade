// Arduino sketch export: the generated game plus the engine headers, ready
// to open in the Arduino IDE for any of the supported boards.

import abESPboy from '../../core/ardublocks/ab_espboy.h?raw';
import abDisplay from '../../core/ardublocks/ab_display.h?raw';
import abFont from '../../core/ardublocks/ab_font.h?raw';
import abTiny from '../../core/ardublocks/ab_tiny.h?raw';
import ardublocks from '../../core/ardublocks/ardublocks.h?raw';
import { isESPboy, profileToConfigH } from '../hw/profile';
import { sanitize } from '../gen/names';
import type { Project } from './model';
import { makeZip } from './zip';

export const CORE_HEADERS: Record<string, string> = {
  'ardublocks.h': ardublocks,
  'ab_display.h': abDisplay,
  'ab_espboy.h': abESPboy,
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
    ...(isESPboy(project.profile) ? { 'README.txt': `ESPboy / ArduCade

Open ${sketchName(project)}.ino in Arduino IDE.
Install the ESP8266 board package and select LOLIN(WEMOS) D1 R2 & mini.
Install Adafruit ST7735 and ST7789 Library and its dependencies using Library Manager.
The hardware wiring is in ab_config.h. MCP0..MCP15 are encoded as 64..79.
Games remain monochrome 128x64, centered without scaling on the 128x128 screen.
Compile and upload in Arduino IDE; its build report gives actual flash/RAM use.
ArduCade memory figures estimate game data/code only, excluding ESP8266 libraries, heap and stack.
DIY profile assumes the backlight is wired directly. Original/Kit use MCP4725.
CS is held low: the display owns the SPI bus. Extra modules sharing SPI are not supported.
` } : {}),
  };
}

export function sketchZip(project: Project, gameCpp: string): Uint8Array {
  const folder = sketchName(project);
  const files = sketchFiles(project, gameCpp);
  return makeZip(Object.entries(files).map(([name, content]) => ({ name: `${folder}/${name}`, content })));
}
