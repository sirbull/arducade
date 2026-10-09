// Downloads the Arduino cores used to build games for AVR chips into
// .cache/cores. Used by the tests and by scripts/build-sysroot.mjs.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = root + '.cache/cores/';

const AVR = 'https://raw.githubusercontent.com/arduino/ArduinoCore-avr/1.8.6/';
const coreFiles = [
  'Arduino.h', 'CDC.cpp', 'Client.h', 'HardwareSerial.cpp', 'HardwareSerial.h', 'HardwareSerial0.cpp',
  'HardwareSerial1.cpp', 'HardwareSerial2.cpp', 'HardwareSerial3.cpp', 'HardwareSerial_private.h',
  'IPAddress.cpp', 'IPAddress.h', 'PluggableUSB.cpp', 'PluggableUSB.h', 'Print.cpp', 'Print.h',
  'Printable.h', 'Server.h', 'Stream.cpp', 'Stream.h', 'Tone.cpp', 'USBAPI.h', 'USBCore.cpp', 'USBCore.h',
  'USBDesc.h', 'Udp.h', 'WCharacter.h', 'WInterrupts.c', 'WMath.cpp', 'WString.cpp', 'WString.h',
  'abi.cpp', 'binary.h', 'hooks.c', 'main.cpp', 'new.cpp', 'new.h', 'new', 'wiring.c', 'wiring_analog.c',
  'wiring_digital.c', 'wiring_private.h', 'wiring_pulse.S', 'wiring_pulse.c', 'wiring_shift.c',
];

const files = [
  ...coreFiles.map((f) => [AVR + 'cores/arduino/' + f, 'arduino-avr/cores/arduino/' + f]),
  ...['standard', 'leonardo', 'mega'].map((v) => [AVR + `variants/${v}/pins_arduino.h`, `arduino-avr/variants/${v}/pins_arduino.h`]),
  [AVR + 'libraries/EEPROM/src/EEPROM.h', 'arduino-avr/libraries/EEPROM/src/EEPROM.h'],
  // MightyCore pin layout for ATmega644P and ATmega1284P, used with the Arduino core.
  ['https://raw.githubusercontent.com/MCUdude/MightyCore/master/avr/variants/standard/pins_arduino.h', 'arduino-avr/variants/mighty/pins_arduino.h'],
];

let fetched = 0;
for (const [url, path] of files) {
  const dest = out + path;
  if (existsSync(dest)) continue;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  fetched++;
}
console.log(`Cores ready in .cache/cores (${fetched} files downloaded)`);
