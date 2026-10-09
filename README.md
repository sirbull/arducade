# ArduBlocks

Make games for Arduboy and home made Arduboy compatible devices with blocks,
in the browser. Like MakeCode Arcade, but for 128x64 one bit screens and small
microcontrollers.

* Block editor (Blockly) with game blocks: sprites, collisions, tile maps,
  camera, score, lives, sound.
* Simulator that runs the game right away in the browser.
* Image, tile and tile map editors.
* Templates: Platformer, Pong and Space shooter.
* C++ view that marks the code of the selected block.
* Compiles in the browser with avr-gcc built for WebAssembly, shows the exact
  flash and RAM use, and uploads to the device over USB (Web Serial).
* Hardware profiles for the original Arduboy and home made devices: choose
  chip, screen, bus and pins, and save the profile as a file.
* Editor in English, Norwegian, Spanish, French and German.
* No server code: the whole site is static files.

The specification is in [docs/spec.md](docs/spec.md) (Norwegian).

## Supported hardware

| Chip | Boards | Compile in browser | Upload in browser |
|---|---|---|---|
| ATmega32U4 | Arduboy, Leonardo, Pro Micro | yes | yes (AVR109) |
| ATmega328P | Nano, Uno, Pro Mini | yes | yes (STK500, Optiboot and old bootloader) |
| ATmega328PB | Nano clones, MiniCore | yes | yes |
| ATmega644P | MightyCore | yes | yes |
| ATmega1284P | MightyCore | sketch download | no |
| ATmega2560 | Mega 2560 | sketch download | no |
| ATmega4809 | Nano Every | sketch download | no |
| LGT8F328P | LGT Nano clones | sketch download | no |
| RP2040, ESP32, ESP8266, SAMD21, STM32F103 | Pico, DevKit, D1 mini, Zero, Blue Pill | sketch download | no |

"Sketch download" gives a folder for the Arduino IDE with the game, the
engine and `ab_config.h` for the chosen profile. The engine uses the Arduino
API there, so it builds for any of these boards.

Screens: SSD1306, SH1106 and SSD1309, over I2C or SPI.

## Development

```
npm install
npm run dev        # editor at http://localhost:5173
npm test           # generators, simulator, compiler and translations
npm run build      # static site in dist/
```

`npm run gen` (part of `dev` and `build`) writes the font header, the
template files in `public/templates` and copies the WebAssembly compiler from
`node_modules` to `public/compiler/tools`.

### Layout

```
core/ardublocks/     C++ engine and display drivers that run on the device
src/hw/              chips, hardware profiles, pin checks, ab_config.h
src/ir/              intermediate representation and type checking
src/blocks/          block definitions, toolbox, blocks to IR
src/gen/             IR to C++ and IR to JavaScript
src/sim/             simulator engine (a port of core/ardublocks/ardublocks.h)
src/compile/         in-browser compiler (Web Worker)
src/upload/          Web Serial upload: STK500v1 and AVR109
src/templates/       templates, written with a small helper language
src/ui/              the editor
public/locales/      one JSON file per language
public/compiler/     compiler files (sysroot is committed, tools are copied)
scripts/             generators and build helpers
```

The simulator engine in `src/sim/engine.ts` must behave exactly like
`core/ardublocks/ardublocks.h`. Change both together.

### Adding things without changing code

* **Language:** add `public/locales/<code>.json` (copy `en.json`) and add the
  language to `LANGUAGES` in `src/i18n/i18n.ts`. `npm run check-locales`
  lists missing texts.
* **Template:** download a project from the editor, put the `.abproject` file
  in `templates/` on the server and add its name to `templates/index.json`.
* **Hardware profile:** save a profile from the editor, put the `.abprofile`
  file in `profiles/` and add its name to `profiles/index.json`. A link like
  `https://example.com/ardublocks/?profile=profiles/my-nano.abprofile` loads
  it directly.

### Rebuilding the compiler files

`public/compiler/sysroot` holds the Arduino core, avr-libc headers and
libraries for each chip the browser compiles for. It is made with a native
avr-gcc 7.3.0:

```
node scripts/fetch-cores.mjs
npm test                      # writes .cache/gen/*.ino used to find headers
AVR_GCC_DIR=/path/to/avr-gcc node scripts/build-sysroot.mjs
```

## Publishing on a web server

See [docs/deploy-one-com.nb.md](docs/deploy-one-com.nb.md) (Norwegian) for a
step by step guide for one.com. In short:

1. `npm run build`
2. Upload everything in `dist/` (including `.htaccess`) to the web server.
3. Make sure the site uses HTTPS. Web Serial does not work without it.

## Licenses

The ArduBlocks code does not have a license file yet. The WebAssembly compiler in
`public/compiler/tools` comes from
[@horang-corp/avr-gcc-wasm](https://www.npmjs.com/package/@horang-corp/avr-gcc-wasm)
and is GCC and GNU binutils (GPL v3). The sysroot contains avr-libc (BSD
style license), libgcc (GPL with the GCC runtime exception) and the Arduino
AVR core (LGPL). See `public/compiler/tools/THIRD_PARTY_NOTICES.md`.
