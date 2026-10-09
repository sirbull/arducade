#!/bin/bash
# Compiles a generated game with a native avr-gcc to check that the C++ is valid.
# Usage: tests/native/build.sh <sketch.cpp> <ab_config.h> <mmcu> <variant> [out dir]
# AVR_GCC_DIR must point to an avr-gcc toolchain (the folder with bin/).
set -e
SKETCH=$1; CONFIG=$2; MCU=$3; VARIANT=$4; OUT=${5:-/tmp/ab-native-$MCU}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
CORE=$ROOT/.cache/cores/arduino-avr
BIN=$AVR_GCC_DIR/bin
USB=""
if [ "$VARIANT" = "leonardo" ]; then USB="-DUSB_VID=0x2341 -DUSB_PID=0x8036 '-DUSB_MANUFACTURER=\"Arduino LLC\"' '-DUSB_PRODUCT=\"Arduino Leonardo\"'"; fi
FLAGS="-mmcu=$MCU -DF_CPU=16000000L -DARDUINO=10819 -DARDUINO_ARCH_AVR -Os -ffunction-sections -fdata-sections -w -I$CORE/cores/arduino -I$CORE/variants/$VARIANT -I$CORE/libraries/EEPROM/src -I$ROOT/core/ardublocks"
mkdir -p "$OUT"
rm -f "$OUT"/*.o
for f in $CORE/cores/arduino/*.c; do eval $BIN/avr-gcc -c $FLAGS $USB -std=gnu11 "$f" -o "$OUT/$(basename "$f").o"; done
for f in $CORE/cores/arduino/*.cpp; do eval $BIN/avr-g++ -c $FLAGS $USB -std=gnu++11 -fno-exceptions -fno-threadsafe-statics -fpermissive "$f" -o "$OUT/$(basename "$f").o"; done
eval $BIN/avr-gcc -c $FLAGS -x assembler-with-cpp $CORE/cores/arduino/wiring_pulse.S -o "$OUT/wiring_pulse.S.o"
mkdir -p "$OUT/game" && cp "$CONFIG" "$OUT/game/ab_config.h"
eval $BIN/avr-g++ -c $FLAGS $USB -std=gnu++11 -fno-exceptions -fno-threadsafe-statics -Wall -Wextra -Wno-unused-parameter -I$OUT/game -x c++ "$SKETCH" -o "$OUT/game.o"
rm -f "$OUT/core.a"
$BIN/avr-gcc-ar rcs "$OUT/core.a" "$OUT"/*.c.o "$OUT"/*.cpp.o "$OUT/wiring_pulse.S.o"
$BIN/avr-gcc -mmcu=$MCU -Os -Wl,--gc-sections "$OUT/game.o" "$OUT/core.a" -o "$OUT/game.elf" -lm
$BIN/avr-objcopy -O ihex -R .eeprom "$OUT/game.elf" "$OUT/game.hex"
$BIN/avr-size -A "$OUT/game.elf" | grep -E '^\.(text|data|bss) '
