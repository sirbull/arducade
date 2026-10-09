// ArduCade game engine for Arduboy and Arduboy compatible devices.
//
// Include ab_config.h (generated from the hardware profile) before this file.
// The whole engine is in this header so the game is compiled as one unit,
// which lets the compiler remove everything the game does not use.
//
// The simulator in the editor (src/sim/engine.ts) is a line by line port of
// this file. Keep the two in sync: same integer math, same order of updates.
#pragma once

#include <Arduino.h>
#if defined(__AVR__)
#include <avr/pgmspace.h>
#include <avr/eeprom.h>
#else
#include <EEPROM.h>
#endif

#include "ab_display.h"
#include "ab_font.h"

// Fewer sprites on chips with little RAM, to leave room for the stack.
#ifndef AB_MAX_SPRITES
#if defined(RAMEND) && RAMEND < 0x0A00
#define AB_MAX_SPRITES 12
#else
#define AB_MAX_SPRITES 16
#endif
#endif
#ifndef AB_TILE_OVERLAY
#define AB_TILE_OVERLAY 8
#endif
#ifndef AB_TILE_CELLS
#define AB_TILE_CELLS 8
#endif
#ifndef AB_HISCORE_ADDR
#define AB_HISCORE_ADDR 16
#endif
#ifndef AB_HISCORE_MAGIC
#define AB_HISCORE_MAGIC 0xAB01
#endif
#define AB_STORAGE_ADDR 64

#define AB_FRAME_MS 33
#define AB_FPS 30

// Hooks implemented by the generated game code.
void ab_init_globals();
void ab_on_start();
void ab_on_update();
void ab_on_draw();
void ab_on_button(uint8_t button, uint8_t pressed);
void ab_on_overlap(uint8_t sprite, uint8_t other);
void ab_on_tile(uint8_t sprite, int16_t col, int16_t row);
bool ab_on_life_zero();

#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wunused-function"
#pragma GCC diagnostic ignored "-Wunused-variable"

namespace ab {

// Buttons, in the same order as the ButtonId list in the editor.
enum : uint8_t { BTN_UP, BTN_DOWN, BTN_LEFT, BTN_RIGHT, BTN_A, BTN_B, BTN_COUNT };

// Built in sprite kinds. Kinds added in the editor start at KIND_USER.
enum : uint8_t { KIND_PLAYER, KIND_ENEMY, KIND_PROJECTILE, KIND_FOOD, KIND_USER };

// Sprite flags.
enum : uint8_t {
  FLAG_STAY_IN_SCREEN = 1,
  FLAG_BOUNCE_ON_WALL = 2,
  FLAG_GHOST = 4,
  FLAG_AUTO_DESTROY = 8,
  FLAG_INVISIBLE = 16,
  FLAG_DESTROY_ON_WALL = 32,
};

// Hit directions, set when a sprite hits a wall or the screen edge.
enum : uint8_t { HIT_LEFT = 1, HIT_RIGHT = 2, HIT_TOP = 4, HIT_BOTTOM = 8 };

// Sprite properties used by get and set blocks.
enum : uint8_t { P_X, P_Y, P_VX, P_VY, P_AX, P_AY, P_WIDTH, P_HEIGHT, P_LEFT, P_RIGHT, P_TOP, P_BOTTOM };

static const uint8_t NONE = 0xFF;

struct Sprite {
  int32_t x, y;      // center, 1/256 pixel
  int16_t vx, vy;    // 1/16 pixel per second
  int16_t ax, ay;    // pixel per second per second
  const uint8_t *img;
  uint8_t kind;
  uint8_t flags;
  uint8_t hit;
  uint8_t frame;
  uint8_t animRate;  // frames between animation steps, 0 for no animation
  uint8_t animCount;
  uint8_t alive;
};

static uint8_t buffer[1024];
static Sprite sprites[AB_MAX_SPRITES];
static uint8_t buttons, buttonsPrev;
static uint32_t nextFrame;
static uint32_t frameCount;
static int16_t score, life, hiscore;
static bool showScore, showLife, gameOverPending, gameOverWin;
static int16_t camX, camY;
static uint8_t cameraSprite = NONE;
static uint16_t rng = 0xACE1;

// Tile map --------------------------------------------------------------

static const uint8_t *map;       // [w, h, cells...] in flash
static const uint8_t *const *tileImages;
static uint32_t solidTiles;      // bit per tile id (tiles 1 to 31)
static uint8_t tileCleared[(AB_TILE_CELLS + 7) / 8];
static uint16_t overlayIndex[AB_TILE_OVERLAY];
static uint8_t overlayTile[AB_TILE_OVERLAY];
static uint8_t overlayCount;

// Text ------------------------------------------------------------------

static char textBuf[32];
static uint8_t textLen;

// Sound -----------------------------------------------------------------

static const uint16_t *soundPos; // pairs of frequency and duration, ends with 0
static uint32_t soundNext;
static const uint16_t *musicStart, *musicPos; // pairs of frequency and quarter beats, ends with 0
static uint32_t musicNext;
static uint16_t musicTempo;
static bool musicLoop;

// Math helpers with the same results on every chip and in the simulator.

static int16_t div(int16_t a, int16_t b) { return b == 0 ? 0 : (int16_t)(a / b); }
static int16_t mod(int16_t a, int16_t b) { return b == 0 ? 0 : (int16_t)(a % b); }

static int16_t mapValue(int16_t value, int16_t fromLow, int16_t fromHigh, int16_t toLow, int16_t toHigh) {
  if (fromLow == fromHigh) return toLow;
  // Wide intermediates avoid overflow when scaling 16 bit ranges.
  return (int16_t)(((int64_t)value - fromLow) * ((int32_t)toHigh - toLow) / ((int32_t)fromHigh - fromLow) + toLow);
}

static int16_t random(int16_t lo, int16_t hi) {
  if (hi < lo) { int16_t t = lo; lo = hi; hi = t; }
  // 16 bit xorshift
  rng ^= rng << 7;
  rng ^= rng >> 9;
  rng ^= rng << 8;
  uint16_t range = (uint16_t)(hi - lo) + 1;
  if (range == 0) return (int16_t)rng;
  return lo + (int16_t)(rng % range);
}

static int16_t clamp16(int32_t v) {
  if (v > 32767) return 32767;
  if (v < -32768) return -32768;
  return (int16_t)v;
}

// Drawing ---------------------------------------------------------------

static void clear() { memset(buffer, 0, sizeof(buffer)); }

static void drawPixel(int16_t x, int16_t y, uint8_t color) {
  if ((uint16_t)x >= 128 || (uint16_t)y >= 64) return;
  uint8_t *b = &buffer[(y >> 3) * 128 + x];
  uint8_t bit = 1 << (y & 7);
  if (color == 1) *b |= bit;
  else if (color == 0) *b &= ~bit;
  else *b ^= bit;
}

static uint8_t getPixel(int16_t x, int16_t y) {
  if ((uint16_t)x >= 128 || (uint16_t)y >= 64) return 0;
  return (buffer[(y >> 3) * 128 + x] >> (y & 7)) & 1;
}

// Same pixels as drawPixel for every point, but clipped first and written a
// byte (8 rows) at a time. Ray casting games fill most of the screen each frame.
static void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint8_t color) {
  int16_t x0 = x < 0 ? 0 : x, y0 = y < 0 ? 0 : y;
  int32_t x1 = (int32_t)x + w, y1 = (int32_t)y + h;
  if (x1 > 128) x1 = 128;
  if (y1 > 64) y1 = 64;
  if (x0 >= x1 || y0 >= y1) return;
  for (int16_t row = y0; row < y1; row = (row | 7) + 1) {
    int16_t last = row | 7;
    if (last >= y1) last = y1 - 1;
    uint8_t mask = (uint8_t)(0xff << (row & 7)) & (uint8_t)(0xff >> (7 - (last & 7)));
    uint8_t *b = &buffer[(row >> 3) * 128 + x0];
    for (int16_t i = x0; i < x1; i++, b++) {
      if (color == 1) *b |= mask;
      else if (color == 0) *b &= ~mask;
      else *b ^= mask;
    }
  }
}

static void hline(int16_t x, int16_t y, int16_t w, uint8_t color) { fillRect(x, y, w, 1, color); }

static void drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint8_t color) {
  if (w <= 0 || h <= 0) return;
  hline(x, y, w, color);
  hline(x, y + h - 1, w, color);
  for (int16_t j = 1; j < h - 1; j++) {
    drawPixel(x, y + j, color);
    drawPixel(x + w - 1, y + j, color);
  }
}

static void drawLine(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint8_t color) {
  // Straight lines are rectangles one pixel wide: the same pixels, much faster.
  if (x0 == x1 || y0 == y1) {
    int32_t w = (int32_t)(x1 > x0 ? x1 - (int32_t)x0 : x0 - (int32_t)x1) + 1;
    int32_t h = (int32_t)(y1 > y0 ? y1 - (int32_t)y0 : y0 - (int32_t)y1) + 1;
    fillRect(x0 < x1 ? x0 : x1, y0 < y1 ? y0 : y1, w > 32767 ? 32767 : w, h > 32767 ? 32767 : h, color);
    return;
  }
  int16_t dx = x1 > x0 ? x1 - x0 : x0 - x1;
  int16_t dy = y1 > y0 ? y0 - y1 : y1 - y0;
  int8_t sx = x0 < x1 ? 1 : -1;
  int8_t sy = y0 < y1 ? 1 : -1;
  int16_t err = dx + dy;
  for (;;) {
    drawPixel(x0, y0, color);
    if (x0 == x1 && y0 == y1) break;
    int16_t e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

static void drawCircle(int16_t cx, int16_t cy, int16_t r, uint8_t color, bool fill) {
  int16_t x = r, y = 0, err = 1 - r;
  while (x >= y) {
    if (fill) {
      hline(cx - x, cy + y, 2 * x + 1, color);
      hline(cx - x, cy - y, 2 * x + 1, color);
      hline(cx - y, cy + x, 2 * y + 1, color);
      hline(cx - y, cy - x, 2 * y + 1, color);
    } else {
      drawPixel(cx + x, cy + y, color); drawPixel(cx - x, cy + y, color);
      drawPixel(cx + x, cy - y, color); drawPixel(cx - x, cy - y, color);
      drawPixel(cx + y, cy + x, color); drawPixel(cx - y, cy + x, color);
      drawPixel(cx + y, cy - x, color); drawPixel(cx - y, cy - x, color);
    }
    y++;
    if (err < 0) err += 2 * y + 1;
    else { x--; err += 2 * (y - x) + 1; }
  }
}

// Image format in flash: width, height, frame count, flags (bit 0: has mask),
// then for each frame the pixel data and the mask (if any). Pixel data uses
// the Arduboy layout: rows of 8 pixels, one byte per column, top pixel is bit 0.
static uint8_t imgW(const uint8_t *img) { return img ? pgm_read_byte(img) : 0; }
static uint8_t imgH(const uint8_t *img) { return img ? pgm_read_byte(img + 1) : 0; }
static uint8_t imgFrames(const uint8_t *img) { return img ? pgm_read_byte(img + 2) : 0; }

static void drawImage(int16_t x, int16_t y, const uint8_t *img, uint8_t frame) {
  if (!img) return;
  uint8_t w = pgm_read_byte(img);
  uint8_t h = pgm_read_byte(img + 1);
  uint8_t frames = pgm_read_byte(img + 2);
  uint8_t hasMask = pgm_read_byte(img + 3) & 1;
  if (x + w <= 0 || x >= 128 || y + h <= 0 || y >= 64) return;
  uint8_t pages = (h + 7) >> 3;
  uint16_t frameSize = (uint16_t)pages * w;
  if (frame >= frames) frame = 0;
  const uint8_t *data = img + 4 + frame * frameSize * (hasMask ? 2 : 1);
  const uint8_t *mask = data + frameSize;
  uint8_t shift = y & 7;
  for (uint8_t p = 0; p < pages; p++) {
    int16_t page = (y >> 3) + p;
    for (uint8_t i = 0; i < w; i++) {
      int16_t col = x + i;
      if (col < 0 || col >= 128) continue;
      uint16_t src = (uint16_t)p * w + i;
      uint16_t d = pgm_read_byte(data + src) << shift;
      uint16_t m = hasMask ? (uint16_t)pgm_read_byte(mask + src) << shift : d;
      if (page >= 0 && page < 8) {
        uint8_t *b = &buffer[page * 128 + col];
        *b = (*b & ~(uint8_t)m) | (uint8_t)d;
      }
      if (shift && page + 1 >= 0 && page + 1 < 8) {
        uint8_t *b = &buffer[(page + 1) * 128 + col];
        *b = (*b & ~(uint8_t)(m >> 8)) | (uint8_t)(d >> 8);
      }
    }
  }
}

static void drawChar(int16_t x, int16_t y, char c, uint8_t color) {
  if (c < 32 || c > 126) c = '?';
  const uint8_t *g = &font5x7[(c - 32) * 5];
  for (uint8_t i = 0; i < 5; i++) {
    uint8_t bits = pgm_read_byte(g + i);
    for (uint8_t j = 0; j < 7; j++) {
      if (bits & (1 << j)) drawPixel(x + i, y + j, color);
    }
  }
}

static void drawText(int16_t x, int16_t y, const char *s, uint8_t color) {
  while (*s) {
    drawChar(x, y, *s++, color);
    x += 6;
  }
}

static int16_t textWidth(const char *s) { return (int16_t)strlen(s) * 6; }

// The text buffer builds a line of text from strings and numbers:
// (ab::tbClear(), ab::tbStr(PSTR("Score ")), ab::tbNum(score), ab::tb())
static void tbClear() { textLen = 0; textBuf[0] = 0; }
static void tbChar(char c) {
  if (textLen < sizeof(textBuf) - 1) { textBuf[textLen++] = c; textBuf[textLen] = 0; }
}
static void tbStr(const char *progmemText) {
  char c;
  while ((c = pgm_read_byte(progmemText++))) tbChar(c);
}
static void tbNum(int16_t n) {
  char tmp[7];
  itoa(n, tmp, 10);
  for (char *c = tmp; *c; c++) tbChar(*c);
}
static const char *tb() { return textBuf; }

// Sound -----------------------------------------------------------------

static void soundOff() {
#if defined(AB_PIN_SOUND1)
  noTone(AB_PIN_SOUND1);
#endif
  soundPos = 0;
  musicPos = 0;
}

static void playTone(uint16_t freq, uint16_t ms) {
#if defined(AB_PIN_SOUND1)
  soundPos = 0;
  if (freq) tone(AB_PIN_SOUND1, freq, ms);
  else noTone(AB_PIN_SOUND1);
#else
  (void)freq; (void)ms;
#endif
}

static void playSound(const uint16_t *steps) {
  soundPos = steps;
  soundNext = 0;
}

// Music plays in the background. A sound effect covers it while it plays.
static void playMelody(const uint16_t *notes, int16_t bpm, bool loop) {
  musicStart = musicPos = notes;
  musicNext = 0;
  musicTempo = constrain(bpm, 20, 600);
  musicLoop = loop;
}

static void updateSound() {
#if defined(AB_PIN_SOUND1)
  uint32_t now = millis();
  if (soundPos && now >= soundNext) {
    uint16_t f = pgm_read_word(soundPos);
    uint16_t ms = pgm_read_word(soundPos + 1);
    if (!ms) {
      soundPos = 0;
      noTone(AB_PIN_SOUND1);
    } else {
      if (f) tone(AB_PIN_SOUND1, f);
      else noTone(AB_PIN_SOUND1);
      soundNext = now + ms;
      soundPos += 2;
    }
  }
  if (musicPos && now >= musicNext) {
    if (!pgm_read_word(musicPos + 1)) musicPos = musicLoop ? musicStart : 0;
    uint16_t beats = musicPos ? pgm_read_word(musicPos + 1) : 0;
    if (!beats) { musicPos = 0; return; }
    uint16_t f = pgm_read_word(musicPos);
    uint16_t ms = (uint32_t)beats * 15000 / musicTempo;
    // Stop a little early so two equal notes do not run together.
    if (!soundPos) {
      if (f) tone(AB_PIN_SOUND1, f, ms - ms / 8);
      else noTone(AB_PIN_SOUND1);
    }
    musicNext = now + ms;
    musicPos += 2;
  }
#endif
}

// Built in sound effects: frequency and duration pairs.
static const uint16_t sfxJump[] PROGMEM = {300, 20, 400, 20, 500, 20, 600, 20, 0, 0};
static const uint16_t sfxCoin[] PROGMEM = {988, 60, 1319, 120, 0, 0};
static const uint16_t sfxHit[] PROGMEM = {220, 40, 180, 40, 140, 40, 100, 40, 0, 0};
static const uint16_t sfxPowerUp[] PROGMEM = {523, 60, 659, 60, 784, 60, 1047, 120, 0, 0};
static const uint16_t sfxExplosion[] PROGMEM = {400, 30, 300, 30, 220, 30, 160, 40, 110, 60, 70, 80, 0, 0};
static const uint16_t sfxWin[] PROGMEM = {523, 100, 659, 100, 784, 100, 1047, 300, 0, 0};
static const uint16_t sfxLose[] PROGMEM = {392, 150, 330, 150, 262, 300, 0, 0};
static const uint16_t sfxShoot[] PROGMEM = {1200, 20, 900, 20, 600, 20, 0, 0};
static const uint16_t *const sfxList[] PROGMEM = {sfxJump, sfxCoin, sfxHit, sfxPowerUp, sfxExplosion, sfxWin, sfxLose, sfxShoot};

static void playEffect(uint8_t id) {
  if (id < sizeof(sfxList) / sizeof(sfxList[0])) playSound((const uint16_t *)pgm_read_ptr(&sfxList[id]));
}

// Input -----------------------------------------------------------------

static const int8_t buttonPins[BTN_COUNT] = {AB_PIN_UP, AB_PIN_DOWN, AB_PIN_LEFT, AB_PIN_RIGHT, AB_PIN_A, AB_PIN_B};

static void readButtons() {
  buttonsPrev = buttons;
  buttons = 0;
  for (uint8_t i = 0; i < BTN_COUNT; i++) {
    if (buttonPins[i] >= 0 && digitalRead(buttonPins[i]) == LOW) buttons |= 1 << i;
  }
}

static bool isPressed(uint8_t b) { return buttons & (1 << b); }
static bool justPressed(uint8_t b) { return (buttons & ~buttonsPrev) & (1 << b); }

static void waitForA() {
  // Wait until A is released, then pressed and released again.
  do { readButtons(); delay(10); } while (isPressed(BTN_A));
  do { readButtons(); delay(10); } while (!isPressed(BTN_A));
  do { readButtons(); delay(10); } while (isPressed(BTN_A));
  buttonsPrev = buttons = 0;
}

// Storage ---------------------------------------------------------------

static uint16_t eepromReadWord(uint16_t addr) {
#if defined(__AVR__)
  return eeprom_read_word((const uint16_t *)addr);
#else
  return EEPROM.read(addr) | (EEPROM.read(addr + 1) << 8);
#endif
}

static void eepromWriteWord(uint16_t addr, uint16_t v) {
#if defined(__AVR__)
  eeprom_update_word((uint16_t *)addr, v);
#else
  EEPROM.write(addr, v & 0xFF);
  EEPROM.write(addr + 1, v >> 8);
#if defined(ESP32) || defined(ESP8266) || defined(ARDUINO_ARCH_RP2040)
  EEPROM.commit();
#endif
#endif
}

static int16_t storageLoad(int16_t slot) {
  if (slot < 0 || slot >= 32) return 0;
  return (int16_t)eepromReadWord(AB_STORAGE_ADDR + slot * 2);
}

static void storageSave(int16_t slot, int16_t value) {
  if (slot < 0 || slot >= 32) return;
  eepromWriteWord(AB_STORAGE_ADDR + slot * 2, (uint16_t)value);
}

static void loadHiscore() {
  hiscore = 0;
  if (eepromReadWord(AB_HISCORE_ADDR) == AB_HISCORE_MAGIC) hiscore = (int16_t)eepromReadWord(AB_HISCORE_ADDR + 2);
}

static void saveHiscore() {
  if (score <= hiscore) return;
  hiscore = score;
  eepromWriteWord(AB_HISCORE_ADDR, AB_HISCORE_MAGIC);
  eepromWriteWord(AB_HISCORE_ADDR + 2, (uint16_t)hiscore);
}

// Tile map --------------------------------------------------------------

static int16_t mapW() { return map ? pgm_read_byte(map) : 0; }
static int16_t mapH() { return map ? pgm_read_byte(map + 1) : 0; }

static void setMap(const uint8_t *m, const uint8_t *const *images, uint32_t solid) {
  map = m;
  tileImages = images;
  solidTiles = solid;
  memset(tileCleared, 0, sizeof(tileCleared));
  overlayCount = 0;
  camX = camY = 0;
}

static uint8_t tileAt(int16_t col, int16_t row) {
  if (!map || col < 0 || row < 0 || col >= mapW() || row >= mapH()) return 0;
  uint16_t idx = (uint16_t)row * mapW() + col;
  for (uint8_t i = overlayCount; i-- > 0;) {
    if (overlayIndex[i] == idx) return overlayTile[i];
  }
  if (idx < AB_TILE_CELLS && (tileCleared[idx >> 3] & (1 << (idx & 7)))) return 0;
  return pgm_read_byte(map + 2 + idx);
}

static void setTile(int16_t col, int16_t row, uint8_t tile) {
  if (!map || col < 0 || row < 0 || col >= mapW() || row >= mapH()) return;
  uint16_t idx = (uint16_t)row * mapW() + col;
  // Forget earlier changes of the same cell.
  for (uint8_t i = 0; i < overlayCount; i++) {
    if (overlayIndex[i] == idx) {
      overlayCount--;
      for (uint8_t j = i; j < overlayCount; j++) {
        overlayIndex[j] = overlayIndex[j + 1];
        overlayTile[j] = overlayTile[j + 1];
      }
      break;
    }
  }
  if (tile == 0 && idx < AB_TILE_CELLS) {
    tileCleared[idx >> 3] |= 1 << (idx & 7);
    return;
  }
  if (idx < AB_TILE_CELLS) tileCleared[idx >> 3] &= ~(1 << (idx & 7));
  if (pgm_read_byte(map + 2 + idx) == tile) return;
  if (overlayCount == AB_TILE_OVERLAY) {
    // Full: drop the oldest change.
    overlayCount--;
    for (uint8_t j = 0; j < overlayCount; j++) {
      overlayIndex[j] = overlayIndex[j + 1];
      overlayTile[j] = overlayTile[j + 1];
    }
  }
  overlayIndex[overlayCount] = idx;
  overlayTile[overlayCount] = tile;
  overlayCount++;
}

static bool isSolid(int16_t col, int16_t row) {
  if (!map) return false;
  // The left and right side of the map are walls.
  if (col < 0 || col >= mapW()) return true;
  if (row < 0 || row >= mapH()) return false;
  return solidTiles & (1UL << tileAt(col, row));
}

static void drawMap() {
  if (!map) return;
  int16_t c0 = camX >> 3, r0 = camY >> 3;
  for (int16_t r = r0; r <= r0 + 8; r++) {
    for (int16_t c = c0; c <= c0 + 16; c++) {
      uint8_t t = tileAt(c, r);
      if (t) drawImage(c * 8 - camX, r * 8 - camY, (const uint8_t *)pgm_read_ptr(&tileImages[t]), 0);
    }
  }
}

// Sprites ---------------------------------------------------------------

static int16_t px(int32_t v) { return (int16_t)(v >> 8); }

static int16_t getProp(uint8_t s, uint8_t prop) {
  if (s >= AB_MAX_SPRITES || !sprites[s].alive) return 0;
  Sprite &sp = sprites[s];
  int16_t w = imgW(sp.img), h = imgH(sp.img);
  switch (prop) {
    case P_X: return px(sp.x);
    case P_Y: return px(sp.y);
    case P_VX: return sp.vx / 16;
    case P_VY: return sp.vy / 16;
    case P_AX: return sp.ax;
    case P_AY: return sp.ay;
    case P_WIDTH: return w;
    case P_HEIGHT: return h;
    case P_LEFT: return px(sp.x) - w / 2;
    case P_RIGHT: return px(sp.x) - w / 2 + w;
    case P_TOP: return px(sp.y) - h / 2;
    case P_BOTTOM: return px(sp.y) - h / 2 + h;
  }
  return 0;
}

static void setProp(uint8_t s, uint8_t prop, int16_t v) {
  if (s >= AB_MAX_SPRITES || !sprites[s].alive) return;
  Sprite &sp = sprites[s];
  int16_t w = imgW(sp.img), h = imgH(sp.img);
  switch (prop) {
    case P_X: sp.x = (int32_t)v << 8; break;
    case P_Y: sp.y = (int32_t)v << 8; break;
    case P_VX: sp.vx = clamp16((int32_t)v * 16); break;
    case P_VY: sp.vy = clamp16((int32_t)v * 16); break;
    case P_AX: sp.ax = v; break;
    case P_AY: sp.ay = v; break;
    case P_LEFT: sp.x = (int32_t)(v + w / 2) << 8; break;
    case P_RIGHT: sp.x = (int32_t)(v - w + w / 2) << 8; break;
    case P_TOP: sp.y = (int32_t)(v + h / 2) << 8; break;
    case P_BOTTOM: sp.y = (int32_t)(v - h + h / 2) << 8; break;
  }
}

static void changeProp(uint8_t s, uint8_t prop, int16_t by) {
  setProp(s, prop, getProp(s, prop) + by);
}

static uint8_t create(const uint8_t *img, uint8_t kind) {
  for (uint8_t i = 0; i < AB_MAX_SPRITES; i++) {
    if (!sprites[i].alive) {
      Sprite &sp = sprites[i];
      memset(&sp, 0, sizeof(Sprite));
      sp.alive = 1;
      sp.img = img;
      sp.kind = kind;
      sp.x = (int32_t)(camX + 64) << 8;
      sp.y = (int32_t)(camY + 32) << 8;
      return i;
    }
  }
  return NONE;
}

static uint8_t createProjectile(const uint8_t *img, int16_t vx, int16_t vy, uint8_t from) {
  uint8_t s = create(img, KIND_PROJECTILE);
  if (s == NONE) return s;
  Sprite &sp = sprites[s];
  if (from < AB_MAX_SPRITES && sprites[from].alive) {
    sp.x = sprites[from].x;
    sp.y = sprites[from].y;
  }
  sp.vx = clamp16((int32_t)vx * 16);
  sp.vy = clamp16((int32_t)vy * 16);
  sp.flags = FLAG_AUTO_DESTROY | FLAG_DESTROY_ON_WALL;
  return s;
}

static void destroy(uint8_t s) {
  if (s < AB_MAX_SPRITES) sprites[s].alive = 0;
  if (s == cameraSprite) cameraSprite = NONE;
}

static void destroyAll(uint8_t kind) {
  for (uint8_t i = 0; i < AB_MAX_SPRITES; i++) {
    if (sprites[i].alive && sprites[i].kind == kind) destroy(i);
  }
}

static bool exists(uint8_t s) { return s < AB_MAX_SPRITES && sprites[s].alive; }
static uint8_t kindOf(uint8_t s) { return exists(s) ? sprites[s].kind : NONE; }
static void setKind(uint8_t s, uint8_t kind) { if (exists(s)) sprites[s].kind = kind; }

static void setImage(uint8_t s, const uint8_t *img) {
  if (exists(s)) { sprites[s].img = img; sprites[s].frame = 0; }
}

static void setPosition(uint8_t s, int16_t x, int16_t y) {
  if (!exists(s)) return;
  sprites[s].x = (int32_t)x << 8;
  sprites[s].y = (int32_t)y << 8;
}

static void setVelocity(uint8_t s, int16_t vx, int16_t vy) {
  if (!exists(s)) return;
  sprites[s].vx = clamp16((int32_t)vx * 16);
  sprites[s].vy = clamp16((int32_t)vy * 16);
}

static void setFlag(uint8_t s, uint8_t flag, bool on) {
  if (!exists(s)) return;
  if (on) sprites[s].flags |= flag;
  else sprites[s].flags &= ~flag;
}

static void animate(uint8_t s, int16_t ms) {
  if (!exists(s)) return;
  int16_t f = ms <= 0 ? 0 : (ms + AB_FRAME_MS / 2) / AB_FRAME_MS;
  sprites[s].animRate = f <= 0 ? (ms > 0 ? 1 : 0) : (f > 255 ? 255 : f);
  sprites[s].animCount = 0;
}

static bool isHitting(uint8_t s, uint8_t dir) { return exists(s) && (sprites[s].hit & dir); }

static bool overlaps(uint8_t a, uint8_t b) {
  if (!exists(a) || !exists(b) || a == b) return false;
  Sprite &sa = sprites[a], &sb = sprites[b];
  int16_t aw = imgW(sa.img), ah = imgH(sa.img), bw = imgW(sb.img), bh = imgH(sb.img);
  int16_t al = px(sa.x) - aw / 2, at = px(sa.y) - ah / 2;
  int16_t bl = px(sb.x) - bw / 2, bt = px(sb.y) - bh / 2;
  return al < bl + bw && bl < al + aw && at < bt + bh && bt < at + ah;
}

// Moves the controlled sprite with the direction buttons.
static uint8_t controlled = NONE;
static int16_t controlVx, controlVy;
static void moveWithButtons(uint8_t s, int16_t vx, int16_t vy) {
  controlled = s;
  controlVx = vx;
  controlVy = vy;
}

// Puts a new sprite on every tile of one type and clears those tiles.
static void spawnOnTiles(uint8_t tile, const uint8_t *img, uint8_t kind) {
  for (int16_t r = 0; r < mapH(); r++) {
    for (int16_t c = 0; c < mapW(); c++) {
      if (tileAt(c, r) != tile) continue;
      uint8_t s = create(img, kind);
      if (s == NONE) return;
      setPosition(s, c * 8 + 4, r * 8 + 4);
      setTile(c, r, 0);
    }
  }
}

static void cameraFollow(uint8_t s) { cameraSprite = s; }
static void setCamera(int16_t x, int16_t y) { cameraSprite = NONE; camX = x; camY = y; }

// Moves one sprite along one axis and stops it at walls.
static void moveAxis(Sprite &sp, bool horizontal, int32_t delta) {
  int16_t w = imgW(sp.img), h = imgH(sp.img);
  if (horizontal) sp.x += delta;
  else sp.y += delta;
  if (!map || (sp.flags & FLAG_GHOST) || delta == 0) return;
  int16_t left = px(sp.x) - w / 2, top = px(sp.y) - h / 2;
  int16_t right = left + w - 1, bottom = top + h - 1;
  bool bounce = sp.flags & FLAG_BOUNCE_ON_WALL;
  if (horizontal) {
    int16_t col = delta > 0 ? right >> 3 : left >> 3;
    for (int16_t row = top >> 3; row <= bottom >> 3; row++) {
      if (!isSolid(col, row)) continue;
      if (delta > 0) { left = col * 8 - w; sp.hit |= HIT_RIGHT; }
      else { left = (col + 1) * 8; sp.hit |= HIT_LEFT; }
      sp.x = (int32_t)(left + w / 2) << 8;
      sp.vx = bounce ? -sp.vx : 0;
      return;
    }
  } else {
    // Include the floor at the exclusive bottom edge so subpixel gravity
    // keeps grounded contact stable between frames.
    int16_t row = delta > 0 ? (bottom + 1) >> 3 : top >> 3;
    for (int16_t col = left >> 3; col <= right >> 3; col++) {
      if (!isSolid(col, row)) continue;
      if (delta > 0) { top = row * 8 - h; sp.hit |= HIT_BOTTOM; }
      else { top = (row + 1) * 8; sp.hit |= HIT_TOP; }
      sp.y = (int32_t)(top + h / 2) << 8;
      sp.vy = bounce ? -sp.vy : 0;
      return;
    }
  }
}

static void updateSprites() {
  if (exists(controlled)) {
    Sprite &sp = sprites[controlled];
    if (controlVx) {
      int16_t dir = (isPressed(BTN_RIGHT) ? 1 : 0) - (isPressed(BTN_LEFT) ? 1 : 0);
      sp.vx = clamp16((int32_t)dir * controlVx * 16);
    }
    if (controlVy) {
      int16_t dir = (isPressed(BTN_DOWN) ? 1 : 0) - (isPressed(BTN_UP) ? 1 : 0);
      sp.vy = clamp16((int32_t)dir * controlVy * 16);
    }
  }
  for (uint8_t i = 0; i < AB_MAX_SPRITES; i++) {
    Sprite &sp = sprites[i];
    if (!sp.alive) continue;
    sp.hit = 0;
    sp.vx = clamp16((int32_t)sp.vx + (int32_t)sp.ax * 8 / 15);
    sp.vy = clamp16((int32_t)sp.vy + (int32_t)sp.ay * 8 / 15);
    moveAxis(sp, true, (int32_t)sp.vx * 8 / 15);
    moveAxis(sp, false, (int32_t)sp.vy * 8 / 15);
    if (sp.hit && (sp.flags & FLAG_DESTROY_ON_WALL)) { destroy(i); continue; }

    int16_t w = imgW(sp.img), h = imgH(sp.img);
    int16_t left = px(sp.x) - w / 2, top = px(sp.y) - h / 2;
    int16_t viewL = camX, viewT = camY;
    if (sp.flags & (FLAG_STAY_IN_SCREEN | FLAG_BOUNCE_ON_WALL)) {
      bool bounce = sp.flags & FLAG_BOUNCE_ON_WALL;
      if (left < viewL) { left = viewL; sp.hit |= HIT_LEFT; if (bounce && sp.vx < 0) sp.vx = -sp.vx; }
      if (left + w > viewL + 128) { left = viewL + 128 - w; sp.hit |= HIT_RIGHT; if (bounce && sp.vx > 0) sp.vx = -sp.vx; }
      if (top < viewT) { top = viewT; sp.hit |= HIT_TOP; if (bounce && sp.vy < 0) sp.vy = -sp.vy; }
      if (top + h > viewT + 64) { top = viewT + 64 - h; sp.hit |= HIT_BOTTOM; if (bounce && sp.vy > 0) sp.vy = -sp.vy; }
      // Preserve fractional positions on axes that did not hit a boundary.
      if (left != px(sp.x) - w / 2) sp.x = (int32_t)(left + w / 2) << 8;
      if (top != px(sp.y) - h / 2) sp.y = (int32_t)(top + h / 2) << 8;
    } else if (sp.flags & FLAG_AUTO_DESTROY) {
      if (left + w < viewL || left >= viewL + 128 || top + h < viewT || top >= viewT + 64) destroy(i);
    }

    if (sp.alive && sp.animRate) {
      if (++sp.animCount >= sp.animRate) {
        sp.animCount = 0;
        if (++sp.frame >= imgFrames(sp.img)) sp.frame = 0;
      }
    }
  }
}

static void updateCamera() {
  if (!exists(cameraSprite)) return;
  camX = px(sprites[cameraSprite].x) - 64;
  camY = px(sprites[cameraSprite].y) - 32;
  if (map) {
    int16_t maxX = mapW() * 8 - 128, maxY = mapH() * 8 - 64;
    if (camX > maxX) camX = maxX;
    if (camY > maxY) camY = maxY;
    if (camX < 0) camX = 0;
    if (camY < 0) camY = 0;
  }
}

static void checkOverlaps() {
#if defined(AB_HAS_OVERLAP)
  for (uint8_t i = 0; i < AB_MAX_SPRITES; i++) {
    for (uint8_t j = i + 1; j < AB_MAX_SPRITES; j++) {
      if (!sprites[i].alive || !sprites[j].alive) continue;
      if ((sprites[i].flags | sprites[j].flags) & FLAG_GHOST) continue;
      if (overlaps(i, j)) ab_on_overlap(i, j);
    }
  }
#endif
#if defined(AB_HAS_TILE_OVERLAP)
  if (!map) return;
  for (uint8_t i = 0; i < AB_MAX_SPRITES; i++) {
    Sprite &sp = sprites[i];
    if (!sp.alive) continue;
    int16_t w = imgW(sp.img), h = imgH(sp.img);
    int16_t left = px(sp.x) - w / 2, top = px(sp.y) - h / 2;
    for (int16_t r = top >> 3; r <= (top + h - 1) >> 3; r++) {
      for (int16_t c = left >> 3; c <= (left + w - 1) >> 3; c++) {
        if (sp.alive && tileAt(c, r)) ab_on_tile(i, c, r);
      }
    }
  }
#endif
}

static void drawSprites() {
  for (uint8_t i = 0; i < AB_MAX_SPRITES; i++) {
    Sprite &sp = sprites[i];
    if (!sp.alive || (sp.flags & FLAG_INVISIBLE)) continue;
    int16_t w = imgW(sp.img), h = imgH(sp.img);
    drawImage(px(sp.x) - w / 2 - camX, px(sp.y) - h / 2 - camY, sp.img, sp.frame);
  }
}

// Score and lives -------------------------------------------------------

static const uint8_t heart[] PROGMEM = {0x06, 0x0F, 0x1E, 0x0F, 0x06};

static void drawHud() {
  if (showLife) {
    for (int16_t i = 0; i < life && i < 8; i++) {
      for (uint8_t c = 0; c < 5; c++) {
        uint8_t bits = pgm_read_byte(&heart[c]);
        for (uint8_t r = 0; r < 5; r++) {
          if (bits & (1 << r)) drawPixel(1 + i * 7 + c, 1 + r, 1);
        }
      }
    }
  }
  if (showScore) {
    tbClear();
    tbNum(score);
    int16_t w = textWidth(textBuf);
    fillRect(127 - w - 1, 0, w + 2, 9, 0);
    drawText(127 - w, 1, textBuf, 1);
  }
}

static void setScore(int16_t v) { score = v; showScore = true; }
static void changeScore(int16_t by) { setScore(score + by); }
static void setLife(int16_t v) {
  life = v;
  showLife = true;
  if (life <= 0) {
    life = 0;
    if (!ab_on_life_zero()) { gameOverPending = true; gameOverWin = false; }
  }
}
static void changeLife(int16_t by) { setLife(life + by); }

static void gameOver(bool win) {
  gameOverPending = true;
  gameOverWin = win;
}

// Draws a box with text in the middle of the screen.
static void messageBox(const char *text) {
  fillRect(4, 22, 120, 19, 0);
  drawRect(4, 22, 120, 19, 1);
  drawText(64 - textWidth(text) / 2, 28, text, 1);
}

// Draws text from flash in the middle of the screen.
static void centerP(int16_t y, const char *progmemText) {
  tbClear();
  tbStr(progmemText);
  drawText(64 - textWidth(textBuf) / 2, y, textBuf, 1);
}

// Shows what has been drawn so far and waits until A is pressed.
static void showAndWait() {
  displayShow(buffer);
  waitForA();
  nextFrame = millis();
}

static void splash(const char *text) {
  messageBox(text);
  showAndWait();
}

static void pause(int16_t ms) {
  if (ms > 0) delay(ms);
  nextFrame = millis();
}

static uint32_t runtime() { return millis(); }

static void restart() {
  memset(sprites, 0, sizeof(sprites));
  map = 0;
  camX = camY = 0;
  cameraSprite = controlled = NONE;
  score = life = 0;
  showScore = showLife = gameOverPending = false;
  soundOff();
  displayInvert(false);
  frameCount = 0;
  ab_init_globals();
  ab_on_start();
}

static void showGameOver() {
  saveHiscore();
  musicPos = 0;
  playEffect(gameOverWin ? 5 : 6);
  clear();
  if (gameOverWin) centerP(8, PSTR("YOU WIN!"));
  else centerP(8, PSTR("GAME OVER"));
  if (showScore) {
    tbClear(); tbStr(PSTR("SCORE ")); tbNum(score);
    drawText(64 - textWidth(textBuf) / 2, 24, textBuf, 1);
    tbClear(); tbStr(PSTR("BEST ")); tbNum(hiscore);
    drawText(64 - textWidth(textBuf) / 2, 34, textBuf, 1);
  }
  centerP(52, PSTR("PRESS A"));
  displayShow(buffer);
  waitForA();
  restart();
  nextFrame = millis();
}

// Main loop -------------------------------------------------------------

static void begin() {
  for (uint8_t i = 0; i < BTN_COUNT; i++) {
    if (buttonPins[i] >= 0) pinMode(buttonPins[i], INPUT_PULLUP);
  }
#if defined(AB_PIN_SOUND2)
  pinMode(AB_PIN_SOUND2, OUTPUT);
  digitalWrite(AB_PIN_SOUND2, LOW);
#endif
#if defined(AB_PIN_SOUND1)
  pinMode(AB_PIN_SOUND1, OUTPUT);
#endif
#if defined(ESP32) || defined(ESP8266) || defined(ARDUINO_ARCH_RP2040)
  EEPROM.begin(512);
#endif
  displayBegin();
  rng ^= (uint16_t)micros();
  if (!rng) rng = 0xACE1;
  loadHiscore();
  restart();
  nextFrame = millis();
}

static void frame() {
  uint32_t now = millis();
  if ((int32_t)(now - nextFrame) < 0) return;
  nextFrame += AB_FRAME_MS;
  // Do not try to catch up after a long pause.
  if ((int32_t)(now - nextFrame) > AB_FRAME_MS * 4) nextFrame = now + AB_FRAME_MS;
  frameCount++;

  readButtons();
  for (uint8_t b = 0; b < BTN_COUNT; b++) {
    uint8_t mask = 1 << b;
    if ((buttons & mask) && !(buttonsPrev & mask)) ab_on_button(b, 1);
    else if (!(buttons & mask) && (buttonsPrev & mask)) ab_on_button(b, 0);
  }
  ab_on_update();
  updateSprites();
  checkOverlaps();
  updateCamera();
  updateSound();

  clear();
  drawMap();
  drawSprites();
  ab_on_draw();
  drawHud();
  displayShow(buffer);

  if (gameOverPending) showGameOver();
}

// Returns true once every ms milliseconds. timer holds the next time.
static bool every(uint32_t &timer, uint16_t ms) {
  uint32_t now = millis();
  if (timer == 0) timer = now + ms;
  if ((int32_t)(now - timer) < 0) return false;
  timer += ms;
  if ((int32_t)(now - timer) > (int32_t)ms) timer = now + ms;
  return true;
}

} // namespace ab

#pragma GCC diagnostic pop
