// Arduino sketch export: the generated game plus the engine headers, ready
// to open in the Arduino IDE for any of the supported boards.

import abAtm from '../../core/ardublocks/ab_atm.h?raw';
import abESPboy from '../../core/ardublocks/ab_espboy.h?raw';
import abESPboyMcp from '../../core/ardublocks/ab_espboy_mcp.h?raw';
import abDisplay from '../../core/ardublocks/ab_display.h?raw';
import abFont from '../../core/ardublocks/ab_font.h?raw';
import abTiny from '../../core/ardublocks/ab_tiny.h?raw';
import ardublocks from '../../core/ardublocks/ardublocks.h?raw';
import { isESPboy, espboyUsesTftESPI, espboyTftSetup, profileToConfigH, profileChip, selectedBoard } from '../hw/profile';
import { sanitize } from '../gen/names';
import type { Project } from './model';
import { makeZip } from './zip';

export const CORE_HEADERS: Record<string, string> = {
  'ardublocks.h': ardublocks,
  'ab_atm.h': abAtm,
  'ab_display.h': abDisplay,
  'ab_espboy.h': abESPboy,
  'ab_espboy_mcp.h': abESPboyMcp,
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
    ...(!isESPboy(project.profile) && (project.profile.configurationMode !== undefined || project.profile.clockHz !== undefined) ? { 'README.txt': `ArduCade hardware profile: ${project.profile.name}\nMicrocontroller: ${profileChip(project.profile).name}\nClock: ${profileChip(project.profile).fCpu / 1000000} MHz\n${selectedBoard(project.profile) ? `Arduino board target: ${profileChip(project.profile).fqbn}` : 'Select an Arduino core/variant matching your custom wiring and clock.'}\nWiring: ab_config.h\n` } : {}),
    ...(isESPboy(project.profile) ? {
      ...(espboyUsesTftESPI(project.profile) ? { 'ESPboy_User_Setup.h': espboyTftSetup(project.profile) } : {}),
      'README.txt': `ESPboy / ArduCade

Open ${sketchName(project)}.ino in Arduino IDE.
Install the ESP8266 board package (tested: 3.1.2):
https://arduino.esp8266.com/stable/package_esp8266com_index.json
Select LOLIN(WEMOS) D1 R2 & mini, CPU Frequency 80 MHz (FQBN esp8266:esp8266:d1_mini).
${espboyUsesTftESPI(project.profile) ? `Display backend: TFT_eSPI (reference ESPboy hardware SPI).
Install TFT_eSPI 2.5.43 using Library Manager.
Back up the installed TFT_eSPI/User_Setup.h, then replace its contents with
this export's ESPboy_User_Setup.h. In TFT_eSPI/User_Setup_Select.h, select
only #include <User_Setup.h>. Repeat after library updates or changes to DC/reset.
Putting the setup beside the sketch alone is insufficient: TFT_eSPI compiles separately.
The sketch rejects an incompatible setup at compile time.
Run TFT_eSPI's Read_User_Setup example and retain its serial output for verification.
Expected: ST7735, 128x128, MOSI 13, SCLK 14, DC ${project.profile.display.dc},
reset ${project.profile.display.rst ?? 'tied to board reset (-1)'}, CS -1, SPI 27 MHz.
` : `Display backend: Adafruit software SPI (selected automatically for custom wiring).
Install Adafruit ST7735 and ST7789 Library 1.11.0 and its dependencies
(tested: Adafruit GFX 1.12.6, Adafruit BusIO 1.17.4) using Library Manager.
No TFT_eSPI setup is required. Custom software SPI is slower.
`}
The adapted ESPboyMCP helper is included; no separate ESPboy library install is needed.
Reference example (RomanS / ESPboy):
https://github.com/ESPboy-edu/ESPboy_FirstTest/tree/fbd4393d46d47242315ab373d24e0aa72e1764db/ESPboy_FirstTest_ESPboyLibs_TFTeSPI
The helper adds configurable I2C pins/addresses and optional DAC, and treats failed
button reads as released. Initialization follows the reference without its logo,
startup delay or DAC EEPROM write. Sound uses the profile's GPIO and Arduino tone.

Profile: ${project.profile.name}
The hardware wiring is in ab_config.h. MCP0..MCP15 are encoded as 64..79.
I2C: SDA ${project.profile.espboy!.sda}, SCL ${project.profile.espboy!.scl}, MCP 0x${project.profile.espboy!.mcpAddress.toString(16)}.
SPI: MOSI ${project.profile.espboy!.mosi}, SCK ${project.profile.espboy!.sck}, CS ${project.profile.display.cs ?? 'ground'}, DC ${project.profile.display.dc}.
Buttons: ${Object.entries(project.profile.buttons).map(([key, pin]) => `${key}=${pin}`).join(', ')}.
Sound: ${project.profile.sound.enabled === false ? 'disabled' : project.profile.sound.pin1 ?? 'disabled'}.
Backlight: ${project.profile.espboy!.dacAddress === undefined ? 'direct wiring (brightness slider has no effect)' : `MCP4725 at 0x${project.profile.espboy!.dacAddress.toString(16)}, brightness ${project.profile.display.contrast}/255`}.
Games remain monochrome 128x64, centered without scaling on the 128x128 screen.
Compile and upload in Arduino IDE; its build report gives actual flash/RAM use.
ArduCade memory figures estimate game data/code only, excluding ESP8266 libraries, heap and stack.
CS is held low: the display owns the SPI bus. Extra modules sharing SPI are not supported.

HARDWARE TEST (not yet physically validated)
1. On a standard ESPboy, run the upstream FirstTest example first to confirm hardware.
2. Upload this game. Check the whole 128x64 image, centered with 32 black rows above/below.
3. Check all six buttons, held buttons, and simultaneous direction + A/B presses.
4. Check sound, brightness (DAC only), restart and a longer session for freezes/resets.
5. Export and check rotation/mirroring; for custom wiring compare every wire to ab_config.h.
Report board model, profile, ESP8266/library versions, setup diagnostic output,
compile flash/RAM report, game name and any display/input/sound/reset problems.
` } : {}),
  };
}

export function sketchZip(project: Project, gameCpp: string): Uint8Array {
  const folder = sketchName(project);
  const files = sketchFiles(project, gameCpp);
  return makeZip(Object.entries(files).map(([name, content]) => ({ name: `${folder}/${name}`, content })));
}
