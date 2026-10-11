# Hardware profile configuration

For the user guide, open **Help → Hardware and profiles** in ArduCade
(**Hjelp → Maskinvare og profiler** in Norwegian). That section explains each
microcontroller and display, browser compilation versus sketch export, custom
profile setup, example wiring, safe mode changes and troubleshooting. Its tables
read the editor’s hardware definitions directly. This file documents the profile
format and implementation constraints.

Profiles retain format `ardublocks-profile`, version 1. Optional `configurationMode`,
`boardId`, `clockHz` and `sound.enabled` fields extend the existing structure.
Missing mode means Microcontroller: legacy profiles are never assigned a guessed board.
Missing clock means the existing chip default, and missing sound.enabled retains
legacy behavior (a configured first speaker pin enables firmware audio).

Development board mode fixes chip and clock and applies existing runtime/pin maps.
New custom profiles start with Arduino Nano selected and empty button/audio wiring.
Entering board mode asks for an explicit board in the same form. Compatible custom
wiring survives this mode switch. Board changes and restoring defaults show actual
changed sections for confirmation; cancel keeps the existing configuration.
Rotation, mirroring and contrast survive board resets. Manual chip changes initialize
generic I2C screen settings and empty button/audio wiring, after confirmation.
Disabling audio preserves speaker pins for re-enabling but omits their validation and
firmware macros. Profile save, import, export, delete and copy use the existing store.

## Board choices

- Arduboy and Arduboy DevKit (different screen, button and speaker wiring).
- Pro Micro 5V/16 MHz and 3.3V/8 MHz; only exposed pins are selectable.
- Arduino Leonardo, Micro, Nano and Uno R3.
- Adafruit ItsyBitsy 32U4 5V/16 MHz and 3.3V/8 MHz (Arduino IDE export).
- Existing ESPboy Original, Kit and DIY adapters, including MCP23017/DAC settings.
- Existing export targets: Mega 2560, Nano Every, Raspberry Pi Pico, ESP32 DevKit,
  Arduino Zero and STM32F103 Blue Pill.

DIY screen/button/speaker defaults are wiring examples, not factory-installed peripherals.
Targets without a console preset require the user to assign buttons. Chip specifications
come from the existing hardware definitions, not inferred external flash capacities.

Browser compilation retains the bundled AVR core/variant mappings. These cores were
built at 16 MHz (8 MHz for the standalone ATtiny runtime). ATmega32U4 manual mode
allows 8 or 16 MHz, but 8 MHz must be exported; substituting F_CPU alone would leave
a 16 MHz core with incorrect timing. ItsyBitsy requires its Adafruit core/variant and
is export-only. Other architectures retain their existing export-only limitations.
The export README specifies the selected FQBN and clock; manual builds require a core
and variant matching the user's wiring. Generated headers reject mismatched F_CPU.
Pico and Blue Pill runtime bus initialization now explicitly matches the existing pin map.
ESPboy retains its independent mixed GPIO/MCP/software-SPI implementation.

FX, FX-C, Mini and Jr were investigated but are not advertised as verified board targets
in this change. External flash chip selection, display variants, optional Jr peripherals
and Mini-specific hardware need dedicated definitions and device testing. Selecting
Microcontroller mode retains the ability to configure compatible manual wiring.

## Definition sources

- [Arduboy2 production and DevKit pins](https://github.com/MLXXXp/Arduboy2/blob/master/src/Arduboy2Core.h)
- [SparkFun Pro Micro hardware](https://learn.sparkfun.com/tutorials/pro-micro--fio-v3-hookup-guide)
- [SparkFun board clocks and targets](https://github.com/sparkfun/Arduino_Boards/blob/master/sparkfun/avr/boards.txt)
- [Arduino Micro variant](https://github.com/arduino/ArduinoCore-avr/blob/master/variants/micro/pins_arduino.h)
- [Adafruit targets](https://github.com/adafruit/Adafruit_Arduino_Boards/blob/master/boards.txt)
- [ItsyBitsy pin mapping](https://github.com/adafruit/Adafruit_Arduino_Boards/blob/master/variants/itsybitsy32u4/pins_arduino.h)
- [Official FX-C hardware](https://www.arduboy.com/shop/p/arduboy-fx-c)
- [Official Jr hardware](https://www.arduboy.com/shop/p/arduboy-jr)

Automated checks cover legacy round trips, board defaults and clocks, target restrictions,
mode preservation, UI confirmation/cancel, pin conflicts, disabled audio, ESPboy and
real WebAssembly firmware compilation. Physical wiring, clock timing, displays, sound
and bootloader/upload behavior still require testing on actual devices. Other architecture
exports require their Arduino toolchains; they were not compiled or physically verified here.
