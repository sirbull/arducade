# ESPboy in ArduCade

ESPboy support retains the project's original 128×64 one-bit graphics, six game
buttons and existing game engine. It introduces no color blocks, larger game
resolution or additional game buttons. The 128×64 image is centered vertically
on the physical 128×128 screen, with black margins and no scaling. Rotation and
mirroring apply to the game image. The browser simulator remains unchanged.

## Hardware profiles

The screen selector identifies the physical panel as **ESPboy ST7735 (128×128
TFT)**. This is the standard 1.44-inch screen listed in the official ESPboy
breadboard bill of materials. The adapter initializes that panel and converts
ArduCade's one-bit buffer to black/white TFT pixels; game and simulator resolution
remain 128×64. The Arduino library's name also mentions ST7789, but this adapter
uses ST7735; that library name is not a claim of support for other panel types.

Choose ESPboy Original or ESPboy Kit, or the DIY preset when the backlight is
wired directly rather than controlled by an MCP4725 DAC. These presets share
the standard ESPboy wiring. DIY is a starting point for compatible builds,
not a claim that every homemade device uses these pins.

Copy a profile, or edit it to create a custom copy, to change the wiring.
Profiles can be saved, exported and imported like other ArduCade devices.

| Function | Default |
|---|---|
| Display | ST7735, 128×128, 1.44-inch green-tab initialization |
| Display MOSI / clock | GPIO13 / GPIO14 |
| Display DC / reset | GPIO16 / tied to board reset (no GPIO) |
| Display CS | MCP8 |
| I2C SDA / SCL | GPIO4 / GPIO5 |
| MCP23017 address | 0x20 |
| Left / up / down / right | MCP0 / MCP1 / MCP2 / MCP3 |
| A / B | MCP4 / MCP5 |
| Speaker | GPIO0 |
| Optional MCP4725 backlight address | 0x60 |

MCP0–MCP15 refer to the expander, not ESP8266 GPIO numbers. Buttons and display
CS can use MCP pins or GPIO. DC, reset and sound use GPIO. Bus pins and I2C
addresses are editable; invalid or conflicting assignments prevent export.
Default SPI wiring uses hardware SPI; custom SPI pins use software SPI. Software
SPI is slower. Reusing hardware MISO/GPIO12 or SS/GPIO15 also selects software SPI.
The display CS is held low, so additional modules sharing its SPI bus are not
supported. ESPboy's two extra buttons and RGB LED are outside this integration.
The brightness slider controls the optional DAC; it has no effect on a directly
wired backlight. GPIO0/2/15 are ESP8266 boot-strapping pins: custom wiring must
preserve the board's boot levels.

## Build and upload

1. Select an ESPboy profile and download the Arduino sketch from ArduCade.
2. Install the ESP8266 Arduino board package using its official Boards Manager
   URL: https://arduino.esp8266.com/stable/package_esp8266com_index.json.
3. Select **LOLIN(WEMOS) D1 R2 & mini**, matching the standard ESPboy board.
4. In Library Manager, install **Adafruit ST7735 and ST7789 Library** and the
   offered dependencies (Adafruit GFX and Adafruit BusIO).
5. Open the exported `.ino`, compile and upload in Arduino IDE.

The export includes the game, engine, ESPboy adapter, generated `ab_config.h`
and setup README. The adapter uses Adafruit display APIs and Arduino Wire;
it does not require replacing the user's Arduboy libraries or editing a global
TFT_eSPI setup file. The adapter disables Wi-Fi during game startup to reduce overhead.

The browser's AVR compiler does not compile ESP8266 firmware. Flash and RAM
meters are approximate game-only figures, excluding platform/display libraries,
heap and stack. They do not predict final ESP8266 binary size or guarantee fit.
Actual static memory sizes come from the Arduino IDE build report; runtime heap
and stack consumption additionally depend on execution. Flash capacity in the
profile is chip capacity; partitioning reduces space available to firmware.

## Official references

- [ESPboy website and compatible variants](https://www.espboy.com/)
- [ESPboy Arduboy2 port and hardware initialization](https://github.com/ESPboy-edu/ESPboy_Arduboy2_lib/tree/master/src/lib)
- [Official TFT configuration](https://github.com/ESPboy-edu/ESPboy_ArduinoIDE_Libraries/blob/master/TFT_eSPI-master/User_Setup.h)
- [Adafruit ST7735 library](https://github.com/adafruit/Adafruit-ST7735-Library)

Physical display offsets, backlight, sound and simultaneous button presses should
be checked on an ESPboy before treating this integration as hardware-validated.

Validation during implementation: Pong compiled with the Original preset, and
Platformer compiled with a custom DIY profile using GPIO12/GPIO15, an alternate
MCP button, rotation and mirroring. Builds used ESP8266 Arduino core 3.1.2,
Adafruit ST7735 library 1.11.0 and Adafruit GFX 1.12.6. Profile round trips,
conflict rejection, sketch packaging and unchanged simulator generation for all
existing templates are covered by automated tests. The profile UI was checked
at 768×1024 as well as the desktop viewport. Physical hardware was unavailable.
