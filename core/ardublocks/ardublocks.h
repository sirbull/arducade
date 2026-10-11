// ArduCade game engine for Arduboy and Arduboy compatible devices.
//
// Include ab_config.h (generated from the hardware profile) before this file.
// The whole engine is in this header so the game is compiled as one unit,
// which lets the compiler remove everything the game does not use.
//
// The simulator in the editor (src/sim/engine.ts) is a line by line port of
// this file. Keep the two in sync: same integer math, same order of updates.
#pragma once

#if defined(AB_CHIP_ATTINY85)
#include "ab_tiny.h"
#else
#include <Arduino.h>
#endif
#if defined(__AVR__)
#include <avr/pgmspace.h>
#include <avr/eeprom.h>
#else
#include <EEPROM.h>
#endif

#include "ab_display.h"
#include "ab_font.h"

// Too little RAM for a whole screen (ATtiny85): each frame is drawn 8 times,
// one page of 8 rows at a time, into a 128 byte buffer.
#if defined(RAMEND) && RAMEND < 0x0400
#define AB_PAGED 1
#ifndef AB_MAX_SPRITES
#define AB_MAX_SPRITES 5
#endif
#ifndef AB_MAX_PARTICLES
#define AB_MAX_PARTICLES 4
#endif
#ifndef AB_TILE_OVERLAY
#define AB_TILE_OVERLAY 4
#endif
#define AB_TEXT_LEN 22
#endif

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
#ifndef AB_TEXT_LEN
#ifdef AB_HAS_SPEECH
#define AB_TEXT_LEN 64
#else
#define AB_TEXT_LEN 32
#endif
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

#ifdef AB_HAS_SONGS
#include "ab_atm.h"
#endif

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
  FLAG_STAY_IN_MAP = 64,
};

// Hit directions, set when a sprite hits a wall or the screen edge.
enum : uint8_t { HIT_LEFT = 1, HIT_RIGHT = 2, HIT_TOP = 4, HIT_BOTTOM = 8 };

// Sprite properties used by get and set blocks.
enum : uint8_t { P_X, P_Y, P_VX, P_VY, P_AX, P_AY, P_WIDTH, P_HEIGHT, P_LEFT, P_RIGHT, P_TOP, P_BOTTOM };

static const uint8_t NONE = 0xFF;

struct Sprite {
#ifdef AB_HAS_SPEECH_SETTINGS
  uint8_t speechWidth;
  uint8_t speechPosition : 2;
  uint8_t speechColors : 3;
#endif
#ifdef AB_HAS_DRAW_MODE
  uint8_t drawMode; // 0 normal, 1 underlay, 2 background/map, 3/4 layers, 5 + sprite
#endif
  int32_t x, y;      // center, 1/256 pixel
  int16_t vx, vy;    // 1/16 pixel per second
  int16_t ax, ay;    // pixel per second per second
  const uint8_t *img;
  uint8_t kind;
  uint8_t flags;
  uint8_t outlineWidth; // 0 means default thickness of 1
  uint8_t outline;    // 0 off, 1 black, 2 white, 3 automatic
  int8_t z;           // drawing layer, higher is drawn on top
  uint8_t hit;
  uint8_t frame;
  uint8_t animRate;  // frames between animation steps, 0 for no animation
  uint8_t animCount;
  uint8_t alive;
};

#ifdef AB_PAGED
static uint8_t buffer[128];
static uint8_t drawPage; // page being drawn
#else
static uint8_t buffer[1024];
#endif
static Sprite sprites[AB_MAX_SPRITES];
#ifdef AB_HAS_SPEECH
#ifdef AB_PAGED
#define AB_SPEECH_SLOTS 1
#else
#define AB_SPEECH_SLOTS 2
#endif
struct Speech { char text[AB_TEXT_LEN]; uint32_t started; uint16_t duration; uint8_t owner; };
static Speech speeches[AB_SPEECH_SLOTS]; // owner = sprite slot + 1, 0 = empty

static void speechHide(uint8_t s) {
  for (uint8_t i = 0; i < AB_SPEECH_SLOTS; i++) if (speeches[i].owner == s + 1) {
    for (uint8_t j = i; j + 1 < AB_SPEECH_SLOTS; j++) speeches[j] = speeches[j + 1];
    speeches[AB_SPEECH_SLOTS - 1].owner = 0;
    return;
  }
}
static void say(uint8_t s, const char *text, int16_t ms) {
  if (s >= AB_MAX_SPRITES || !sprites[s].alive) return;
  if (!*text || ms < 0) { speechHide(s); return; }
  uint8_t slot = AB_SPEECH_SLOTS;
  for (uint8_t i = 0; i < AB_SPEECH_SLOTS; i++) if (speeches[i].owner == s + 1) { slot = i; break; }
  if (slot == AB_SPEECH_SLOTS)
    for (uint8_t i = 0; i < AB_SPEECH_SLOTS; i++) if (!speeches[i].owner) { slot = i; break; }
  if (slot == AB_SPEECH_SLOTS) {
    for (uint8_t i = 0; i + 1 < AB_SPEECH_SLOTS; i++) speeches[i] = speeches[i + 1];
    slot = AB_SPEECH_SLOTS - 1;
  }
  Speech &b = speeches[slot];
  strncpy(b.text, text, AB_TEXT_LEN - 1);
  b.text[AB_TEXT_LEN - 1] = 0;
  b.owner = s + 1; b.started = millis(); b.duration = ms;
}
#ifdef AB_HAS_SPEECH_SETTINGS
static void speechPosition(uint8_t s, int16_t position) {
  if (s < AB_MAX_SPRITES && sprites[s].alive) sprites[s].speechPosition = constrain(position, 0, 2);
}
static void speechWidth(uint8_t s, int16_t width) {
  if (s < AB_MAX_SPRITES && sprites[s].alive) sprites[s].speechWidth = constrain(width, 14, 128);
}
static void speechColors(uint8_t s, int16_t text, int16_t background) {
  if (s < AB_MAX_SPRITES && sprites[s].alive) sprites[s].speechColors = 4 | (text ? 1 : 0) | (background ? 2 : 0);
}
#endif
#endif


#ifdef AB_HAS_DRAW_MODE
static uint8_t drawingMode;
#ifdef AB_HAS_DRAW_REFERENCE
static uint8_t drawColor(int16_t x, int16_t y, uint8_t fallback);
static void forgetDrawReference(uint8_t s);
#endif
// Stack lifetime restores the outer scope on return, break and continue too.
struct DrawModeScope {
  uint8_t saved;
  DrawModeScope(uint8_t mode) : saved(drawingMode) { drawingMode = mode; }
  ~DrawModeScope() { drawingMode = saved; }
};
#endif
static uint8_t buttons, buttonsPrev;
static uint32_t nextFrame;
static uint32_t frameCount;
static int16_t score, life, hiscore;
static bool showScore, showLife, gameOverPending, gameOverWin;
#ifdef AB_SCORE_POS
static int16_t scoreX = -1, scoreY; // scoreX -1: top right corner
#else
static const int16_t scoreX = -1, scoreY = 0; // folded away when unused
#endif
#ifdef AB_LIFE_POS
static int16_t lifeX = 1, lifeY = 1;
#else
static const int16_t lifeX = 1, lifeY = 1;
#endif
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

// The generator defines AB_NO_MAP, AB_NO_SPRITES, AB_NO_OUTLINE and AB_NO_HUD
// for games that never use them, so the code for them is left out.
#ifdef AB_NO_MAP
static bool hasMap() { return false; }
#else
static bool hasMap() { return map; }
#endif

// Text ------------------------------------------------------------------

struct Text {
  char data[AB_TEXT_LEN];
  Text() = default;
  Text(const char *s) { *this = s; }
  Text &operator=(const char *s) {
    size_t length = strlen(s);
    uint8_t n = length < AB_TEXT_LEN ? length : AB_TEXT_LEN - 1;
    memmove(data, s, n); data[n] = 0; return *this;
  }
  operator const char *() const { return data; }
};
static char textBuf[AB_TEXT_LEN];
static uint8_t textLen;

// Sound -----------------------------------------------------------------

static const uint16_t *soundPos; // pairs of frequency and duration, ends with 0
static uint32_t soundNext;
static const uint16_t *musicStart, *musicPos; // pairs of frequency and quarter beats, ends with 0
static uint32_t musicNext;
static uint16_t musicTempo;
static bool musicLoop;
// Pitch in percent of the normal pitch. The pitch block sets a range, and each
// sound started inside it gets a random pitch from that range.
static int16_t pitchLo = 100, pitchHi = 100;
static uint16_t soundPitch = 100, musicPitch = 100;

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

// The buffer byte for a column of a page, or 0 when the page is not in the buffer.
static uint8_t *at(int16_t page, int16_t x) {
  if ((uint16_t)page >= 8) return 0;
#ifdef AB_PAGED
  return page == drawPage ? &buffer[x] : 0;
#else
  return &buffer[page * 128 + x];
#endif
}

// True when rows y to y + h - 1 touch the page being drawn. Lets AB_PAGED skip
// what is on other pages early. Always true otherwise.
static bool onPage(int16_t y, int16_t h) {
#ifdef AB_PAGED
  return y < (drawPage + 1) * 8 && y + h > drawPage * 8;
#else
  (void)y; (void)h;
  return true;
#endif
}

static void drawPixel(int16_t x, int16_t y, uint8_t color) {
  if ((uint16_t)x >= 128 || (uint16_t)y >= 64) return;
  uint8_t *b = at(y >> 3, x);
  if (!b) return;
  uint8_t bit = 1 << (y & 7);
#ifdef AB_HAS_DRAW_MODE
#ifdef AB_HAS_DRAW_REFERENCE
  color = drawColor(x, y, color);
#else
  if (drawingMode == 1) color = 2;
#endif
#endif
  if (color == 1) *b |= bit;
  else if (color == 0) *b &= ~bit;
  else *b ^= bit;
}

static uint8_t getPixel(int16_t x, int16_t y) {
  if ((uint16_t)x >= 128 || (uint16_t)y >= 64) return 0;
  // ponytail: with AB_PAGED only pixels on the page being drawn can be read.
  uint8_t *b = at(y >> 3, x);
  return b ? (*b >> (y & 7)) & 1 : 0;
}

// Same pixels as drawPixel for every point, but clipped first and written a
// byte (8 rows) at a time. Ray casting games fill most of the screen each frame.
static void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint8_t color) {
  int16_t x0 = x < 0 ? 0 : x, y0 = y < 0 ? 0 : y;
  int32_t x1 = (int32_t)x + w, y1 = (int32_t)y + h;
  if (x1 > 128) x1 = 128;
  if (y1 > 64) y1 = 64;
  if (x0 >= x1 || y0 >= y1) return;
#ifdef AB_HAS_DRAW_REFERENCE
  if (drawingMode > 1) {
    for (int16_t row = y0; row < y1; row++) {
      if (!onPage(row, 1)) continue;
      for (int16_t col = x0; col < x1; col++) drawPixel(col, row, color);
    }
    return;
  }
#endif
#ifdef AB_HAS_DRAW_MODE
  if (drawingMode == 1) color = 2;
#endif
  for (int16_t row = y0; row < y1; row = (row | 7) + 1) {
    int16_t last = row | 7;
    if (last >= y1) last = y1 - 1;
    uint8_t mask = (uint8_t)(0xff << (row & 7)) & (uint8_t)(0xff >> (7 - (last & 7)));
    uint8_t *b = at(row >> 3, x0);
    if (!b) continue;
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
  if (h > 1) hline(x, y + h - 1, w, color);
  for (int16_t j = 1; j < h - 1; j++) {
    drawPixel(x, y + j, color);
    if (w > 1) drawPixel(x + w - 1, y + j, color);
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
    int16_t oldX = x, oldY = y;
    if (fill) {
      hline(cx - x, cy + y, 2 * x + 1, color);
      if (y) hline(cx - x, cy - y, 2 * x + 1, color);
    } else {
      drawPixel(cx + x, cy + y, color);
      if (x) drawPixel(cx - x, cy + y, color);
      if (y) {
        drawPixel(cx + x, cy - y, color);
        if (x) drawPixel(cx - x, cy - y, color);
      }
      if (x != y) {
        drawPixel(cx + y, cy + x, color);
        if (y) drawPixel(cx - y, cy + x, color);
        if (x) {
          drawPixel(cx + y, cy - x, color);
          if (y) drawPixel(cx - y, cy - x, color);
        }
      }
    }
    y++;
    if (err < 0) err += 2 * y + 1;
    else { x--; err += 2 * (y - x) + 1; }
    if (fill && oldX > oldY && (x != oldX || y > x)) {
      hline(cx - oldY, cy + oldX, 2 * oldY + 1, color);
      hline(cx - oldY, cy - oldX, 2 * oldY + 1, color);
    }
  }
}

// Image format in flash: width, height, frame count, flags (bit 0: has mask),
// then for each frame the pixel data and the mask (if any). Pixel data uses
// the Arduboy layout: rows of 8 pixels, one byte per column, top pixel is bit 0.
static uint8_t imgW(const uint8_t *img) { return img ? pgm_read_byte(img) : 0; }
static uint8_t imgH(const uint8_t *img) { return img ? pgm_read_byte(img + 1) : 0; }
static uint8_t imgFrames(const uint8_t *img) { return img ? pgm_read_byte(img + 2) : 0; }

#ifdef AB_HAS_DRAW_REFERENCE
// -1 means transparent; masked black pixels are opaque.
static int8_t imageColor(const uint8_t *img, int16_t x, int16_t y, uint8_t frame = 0) {
  if (!img || x < 0 || y < 0 || x >= imgW(img) || y >= imgH(img)) return -1;
  uint16_t size = (uint16_t)((imgH(img) + 7) >> 3) * imgW(img);
  uint8_t masked = pgm_read_byte(img + 3) & 1;
  if (frame >= imgFrames(img)) frame = 0;
  const uint8_t *data = img + 4 + frame * size * (masked ? 2 : 1);
  uint16_t offset = (y >> 3) * imgW(img) + x;
  uint8_t bit = 1 << (y & 7), color = (pgm_read_byte(data + offset) & bit) ? 1 : 0;
  return (masked ? (pgm_read_byte(data + size + offset) & bit) : color) ? color : -1;
}
#endif

static void drawImage(int16_t x, int16_t y, const uint8_t *img, uint8_t frame, int8_t tint = -1) {
  if (!img) return;
  uint8_t w = pgm_read_byte(img);
  uint8_t h = pgm_read_byte(img + 1);
  uint8_t frames = pgm_read_byte(img + 2);
  uint8_t hasMask = pgm_read_byte(img + 3) & 1;
  if (x + w <= 0 || x >= 128 || y + h <= 0 || y >= 64 || !onPage(y, h)) return;
  uint8_t pages = (h + 7) >> 3;
  uint16_t frameSize = (uint16_t)pages * w;
  if (frame >= frames) frame = 0;
  const uint8_t *data = img + 4 + frame * frameSize * (hasMask ? 2 : 1);
  const uint8_t *mask = data + frameSize;
#ifdef AB_HAS_DRAW_REFERENCE
  if (drawingMode > 1) {
    for (int16_t cy = y < 0 ? -y : 0; cy < h && y + cy < 64; cy++) {
      if (!onPage(y + cy, 1)) continue;
      for (int16_t cx = x < 0 ? -x : 0; cx < w && x + cx < 128; cx++) {
        int8_t color = imageColor(img, cx, cy, frame);
        if (color >= 0) drawPixel(x + cx, y + cy, tint >= 0 ? (tint ? 1 : 0) : color);
      }
    }
    return;
  }
#endif
  uint8_t shift = y & 7;
  for (uint8_t p = 0; p < pages; p++) {
    int16_t page = (y >> 3) + p;
    for (uint8_t i = 0; i < w; i++) {
      int16_t col = x + i;
      if (col < 0 || col >= 128) continue;
      uint16_t src = (uint16_t)p * w + i;
      uint16_t d = pgm_read_byte(data + src) << shift;
      uint16_t m = hasMask ? (uint16_t)pgm_read_byte(mask + src) << shift : d;
      if (tint >= 0) d = tint ? m : 0;
      if (uint8_t *b = at(page, col)) {
#ifdef AB_HAS_DRAW_MODE
        if (drawingMode == 1) *b ^= (uint8_t)m;
        else
#endif
        *b = (*b & ~(uint8_t)m) | (uint8_t)d;
      }
      if (!shift) continue;
      if (uint8_t *b = at(page + 1, col)) {
#ifdef AB_HAS_DRAW_MODE
        if (drawingMode == 1) *b ^= (uint8_t)(m >> 8);
        else
#endif
        *b = (*b & ~(uint8_t)(m >> 8)) | (uint8_t)(d >> 8);
      }
    }
  }
}

static void drawChar(int16_t x, int16_t y, char c, uint8_t color) {
  if (!onPage(y, 7)) return;
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
  uint8_t code = (uint8_t)c;
  if (code >= 128 && code < 192) return; // UTF-8 continuation
  if (c != '\n' && (code < 32 || code > 126)) c = '?';
  if (textLen < sizeof(textBuf) - 1) { textBuf[textLen++] = c; textBuf[textLen] = 0; }
}
static void tbStr(const char *progmemText) {
  char c;
  while ((c = pgm_read_byte(progmemText++))) tbChar(c);
}
static void tbRam(const char *s) { while (*s) tbChar(*s++); }
static void tbNum(int16_t n) {
  char tmp[7];
  itoa(n, tmp, 10);
  for (char *c = tmp; *c; c++) tbChar(*c);
}
static const char *tb() { return textBuf; }

// Sound -----------------------------------------------------------------

#if defined(AB_PIN_SOUND1) && defined(__AVR__) && defined(TCCR1B) && defined(OCIE1A)
// Square wave from a Timer1 interrupt: the same sound as the Arduino tone(),
// but about 1.2 KB smaller. ms 0 plays until toneStop().
static volatile uint8_t *tonePort;
static uint8_t toneMask;
static volatile uint32_t toneToggles;

ISR(TIMER1_COMPA_vect) {
  *tonePort ^= toneMask;
  if (toneToggles && !--toneToggles) {
    TIMSK1 &= ~_BV(OCIE1A);
    *tonePort &= ~toneMask;
  }
}

static void toneStop() {
#ifdef AB_ATM_SYNTH
  if (atm_tone(0, 0)) return;
#endif
  TIMSK1 &= ~_BV(OCIE1A);
  *tonePort &= ~toneMask;
}

static void toneStart(uint16_t freq, uint16_t ms) {
#ifdef AB_ATM_SYNTH
  if (atm_tone(freq, ms)) return;
#endif
  // Two toggles per period. Prescaler 8, or 64 for low notes.
  uint32_t top = F_CPU / 16 / freq;
  uint8_t cs = _BV(CS11);
  if (top > 65536) { top /= 8; cs = _BV(CS11) | _BV(CS10); }
  if (top > 65536) top = 65536;
  TIMSK1 &= ~_BV(OCIE1A);
  TCCR1A = 0;
  TCCR1B = _BV(WGM12) | cs;
  OCR1A = top - 1;
  TCNT1 = 0;
  uint32_t toggles = 2UL * freq * ms / 1000;
  toneToggles = ms ? (toggles ? toggles : 1) : 0;
  TIMSK1 |= _BV(OCIE1A);
}

static void toneBegin() {
  tonePort = portOutputRegister(digitalPinToPort(AB_PIN_SOUND1));
  toneMask = digitalPinToBitMask(AB_PIN_SOUND1);
}
#elif defined(AB_PIN_SOUND1)
static void toneStop() { noTone(AB_PIN_SOUND1); }
static void toneStart(uint16_t freq, uint16_t ms) { tone(AB_PIN_SOUND1, freq, ms); }
static void toneBegin() {}
#endif

static void soundOff() {
#ifdef AB_HAS_SONGS
  atm_stop();
#endif
#if defined(AB_PIN_SOUND1)
  toneStop();
#endif
  soundPos = 0;
  musicPos = 0;
}

static void setPitch(int16_t lo, int16_t hi) {
  pitchLo = constrain(lo, 10, 1000);
  pitchHi = constrain(hi, 10, 1000);
}

static uint16_t pickPitch() { return pitchLo == pitchHi ? pitchLo : random(pitchLo, pitchHi); }

static uint16_t pitched(uint16_t f, uint16_t pct) {
  if (!f || pct == 100) return f;
  uint32_t v = (uint32_t)f * pct / 100;
  return v > 65535 ? 65535 : v ? v : 1;
}

static void playTone(uint16_t freq, uint16_t ms) {
  uint16_t pct = pickPitch();
#if defined(AB_PIN_SOUND1)
  soundPos = 0;
  if (freq) toneStart(pitched(freq, pct), ms);
  else toneStop();
#else
  (void)freq; (void)ms; (void)pct;
#endif
}

static void playSound(const uint16_t *steps) {
  soundPos = steps;
  soundNext = 0;
  soundPitch = pickPitch();
}

// Music plays in the background. A sound effect covers it while it plays.
static void playMelody(const uint16_t *notes, int16_t bpm, bool loop) {
  musicStart = musicPos = notes;
  musicNext = 0;
  musicTempo = constrain(bpm, 20, 600);
  musicLoop = loop;
  musicPitch = pickPitch();
}

#ifdef AB_HAS_SONGS
// Songs play in the background with up to four voices, see ab_atm.h.
static uint16_t songHz; // the song note on the tone pin, without Timer4

static void playSong(const uint8_t *song, bool loop) {
  if (!song) return;
#ifdef AB_HAS_POLY_EFFECTS
  // An explicit new song replaces both the effect and its suspended music.
  uint8_t saved = atm_lock(); atm_background.valid = false; atm_isEffect = false;
#endif
#ifdef AB_HAS_SONG_PITCH
  atm_setPitch(pickPitch());
#endif
  atm_play(song, loop);
#ifdef AB_HAS_POLY_EFFECTS
  atm_unlock(saved);
#endif
  songHz = 0xFFFF;
}

#ifdef AB_HAS_POLY_EFFECTS
static void playPolyEffect(const uint8_t *song) {
  if (!song) return;
  uint8_t saved = atm_lock();
  atm_suspend();
  atm_isEffect = true;
#ifdef AB_HAS_SONG_PITCH
  atm_setPitch(pickPitch());
#endif
  atm_play(song, false);
  atm_unlock(saved);
  songHz = 0xFFFF;
}
#endif

static void stopSong() {
  uint8_t saved = atm_lock();
  atm_stop();
  atm_unlock(saved);
}

static void updateSong() {
#if defined(AB_PIN_SOUND1) && defined(AB_ATM_SYNTH)
  atm_update();
#elif defined(AB_PIN_SOUND1)
  // One voice through the tone pin. A sound effect covers it while it plays.
  uint16_t hz = atm_update();
  if (soundPos) songHz = 0xFFFF;
  else if (hz != songHz) {
    if (hz) toneStart(hz, 0);
    else if (songHz) toneStop();
    songHz = hz;
  }
#endif
}

// Waits. A song goes on meanwhile, also on chips without Timer4.
static void waitMs(uint16_t ms) {
  for (uint32_t start = millis(); millis() - start < ms;) {
    updateSong();
    delay(1);
  }
}
#else
// ponytail: a macro, not a function, so games without songs stay byte for byte the same.
#define waitMs delay
#endif

#ifdef AB_HAS_SONG_VOLUME
static void setSongVolume(int16_t percent) {
#if defined(AB_HAS_SONGS) && defined(AB_ATM_SYNTH)
  atm_setVolume(percent);
#else
  (void)percent;
#endif
}
#endif

static void updateSound() {
#if defined(AB_PIN_SOUND1)
  uint32_t now = millis();
#ifdef AB_HAS_SONGS
  updateSong();
#endif
  if (soundPos && now >= soundNext) {
    uint16_t f = pgm_read_word(soundPos);
    uint16_t ms = pgm_read_word(soundPos + 1);
    if (!ms) {
      soundPos = 0;
      toneStop();
    } else {
      if (f) toneStart(pitched(f, soundPitch), 0);
      else toneStop();
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
      if (f) toneStart(pitched(f, musicPitch), ms - ms / 8);
      else toneStop();
    }
    musicNext = now + ms;
    musicPos += 2;
  }
#endif
}

// The sound effects of the game over screen: frequency and duration pairs.
// The game has a table like these for each other effect it plays.
static const uint16_t sfxWin[] PROGMEM = {523, 100, 659, 100, 784, 100, 1047, 300, 0, 0};
static const uint16_t sfxLose[] PROGMEM = {392, 150, 330, 150, 262, 300, 0, 0};

// Input -----------------------------------------------------------------

static const int8_t buttonPins[BTN_COUNT] = {AB_PIN_UP, AB_PIN_DOWN, AB_PIN_LEFT, AB_PIN_RIGHT, AB_PIN_A, AB_PIN_B};

static void readButtons() {
  buttonsPrev = buttons;
  buttons = 0;
#if defined(AB_DISPLAY_ESPBOY)
  const uint16_t keys = espMcp.readGPIOAB();
  for (uint8_t i = 0; i < BTN_COUNT; i++) {
    const int8_t pin = buttonPins[i];
    if (pin >= 0 && (pin >= 64 ? !(keys & (1 << (pin - 64))) : digitalRead(pin) == LOW)) buttons |= 1 << i;
  }
#else
  for (uint8_t i = 0; i < BTN_COUNT; i++) {
    if (buttonPins[i] >= 0 && digitalRead(buttonPins[i]) == LOW) buttons |= 1 << i;
  }
#endif
#ifdef AB_TWO_BUTTONS
  // Consoles with only left and right: both together are A.
  if ((buttons & (1 << BTN_LEFT)) && (buttons & (1 << BTN_RIGHT))) buttons |= 1 << BTN_A;
#endif
}

static bool isPressed(uint8_t b) { return buttons & (1 << b); }
static bool justPressed(uint8_t b) { return (buttons & ~buttonsPrev) & (1 << b); }

static void waitForA() {
  // Wait until A is released, then pressed and released again.
  do { readButtons(); waitMs(10); } while (isPressed(BTN_A));
  do { readButtons(); waitMs(10); } while (!isPressed(BTN_A));
  do { readButtons(); waitMs(10); } while (isPressed(BTN_A));
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

static int16_t mapW() { return hasMap() ? pgm_read_byte(map) : 0; }
static int16_t mapH() { return hasMap() ? pgm_read_byte(map + 1) : 0; }

static void setMap(const uint8_t *m, const uint8_t *const *images, uint32_t solid) {
  map = m;
  tileImages = images;
  solidTiles = solid;
  memset(tileCleared, 0, sizeof(tileCleared));
  overlayCount = 0;
  camX = camY = 0;
}

static uint8_t tileAt(int16_t col, int16_t row) {
  if (!hasMap() || col < 0 || row < 0 || col >= mapW() || row >= mapH()) return 0;
  uint16_t idx = (uint16_t)row * mapW() + col;
  for (uint8_t i = overlayCount; i-- > 0;) {
    if (overlayIndex[i] == idx) return overlayTile[i];
  }
  if (idx < AB_TILE_CELLS && (tileCleared[idx >> 3] & (1 << (idx & 7)))) return 0;
  return pgm_read_byte(map + 2 + idx);
}

static void setTile(int16_t col, int16_t row, uint8_t tile) {
  if (!hasMap() || col < 0 || row < 0 || col >= mapW() || row >= mapH()) return;
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

static bool isSolid(int16_t col, int16_t row, bool edgeWalls) {
  if (!hasMap()) return false;
  // Outside the left and right side of the map is a wall only for sprites that stay in the map.
  if (col < 0 || col >= mapW()) return edgeWalls;
  if (row < 0 || row >= mapH()) return false;
  return solidTiles & (1UL << tileAt(col, row));
}

static void drawMap() {
  if (!hasMap()) return;
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
#ifdef AB_HAS_DRAW_REFERENCE
      forgetDrawReference(i);
#endif
#ifdef AB_HAS_DRAW_MODE
      sp.drawMode = drawingMode;
#endif
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
#ifdef AB_HAS_SPEECH
  speechHide(s);
#endif
  if (s < AB_MAX_SPRITES) {
#ifdef AB_HAS_DRAW_REFERENCE
    forgetDrawReference(s);
#endif
    sprites[s].alive = 0;
  }
  if (s == cameraSprite) cameraSprite = NONE;
}

static void destroyAll(uint8_t kind) {
  for (uint8_t i = 0; i < AB_MAX_SPRITES; i++) {
    if (sprites[i].alive && sprites[i].kind == kind) destroy(i);
  }
}

static bool exists(uint8_t s) { return s < AB_MAX_SPRITES && sprites[s].alive; }
#ifdef AB_HAS_DRAW_MODE
static uint8_t spriteReference(uint8_t s) { return exists(s) ? 5 + s : 0; }
static void setDrawMode(uint8_t s, uint8_t mode) { if (exists(s)) sprites[s].drawMode = mode; }
#endif
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

static uint8_t createProjectileFromPosition(const uint8_t *img, int16_t x, int16_t y, int16_t vx, int16_t vy) {
  uint8_t s = createProjectile(img, vx, vy, NONE);
  setPosition(s, x, y);
  return s;
}

static void setVelocity(uint8_t s, int16_t vx, int16_t vy) {
  if (!exists(s)) return;
  sprites[s].vx = clamp16((int32_t)vx * 16);
  sprites[s].vy = clamp16((int32_t)vy * 16);
}

static void setZ(uint8_t s, int16_t z) {
  if (exists(s)) sprites[s].z = z < -128 ? -128 : z > 127 ? 127 : z;
}

static void setOutlineWidth(uint8_t s, int16_t width) {
  if (exists(s)) sprites[s].outlineWidth = width < 1 ? 1 : width > 8 ? 8 : width;
}

static void setOutline(uint8_t s, int16_t mode) {
  if (exists(s)) sprites[s].outline = mode >= 0 && mode <= 3 ? mode : 0;
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

#ifdef AB_HAS_SHAKE
static uint16_t shakeLeft; // frames
static int8_t shakeAmp, shakeX, shakeY;
// Strength in pixels (at most 16), time rounded up to whole frames.
static void shake(int16_t strength, int16_t ms) {
  shakeAmp = constrain(strength, 0, 16);
  shakeLeft = ms > 0 ? (ms + AB_FRAME_MS - 1) / AB_FRAME_MS : 0;
}
#endif

#ifdef AB_HAS_BACKGROUND
static const uint8_t *background;
static int16_t bgX, bgY;
static void setBackground(const uint8_t *img) { background = img; }
static void setBackgroundPosition(int16_t x, int16_t y) { bgX = x; bgY = y; }
#ifdef AB_HAS_PARALLAX
struct BackgroundLayer { const uint8_t *image; int16_t x, y; uint8_t percent; };
static BackgroundLayer backgroundLayers[2];
static void setBackgroundLayer(int16_t layer, const uint8_t *img, int16_t percent) {
  if (layer < 1 || layer > 2) return;
  backgroundLayers[layer - 1].image = img;
  backgroundLayers[layer - 1].percent = percent < 0 ? 0 : percent > 100 ? 100 : percent;
}
static void setBackgroundLayerPosition(int16_t layer, int16_t x, int16_t y) {
  if (layer < 1 || layer > 2) return;
  backgroundLayers[layer - 1].x = x; backgroundLayers[layer - 1].y = y;
}
static void changeBackgroundLayerPosition(int16_t layer, int16_t x, int16_t y) {
  if (layer < 1 || layer > 2) return;
  setBackgroundLayerPosition(layer, backgroundLayers[layer - 1].x + x, backgroundLayers[layer - 1].y + y);
}
#endif
// Repeat in screen coordinates, with shake independent of parallax speed.
static void drawRepeatedBackground(const uint8_t *img, int16_t x0, int16_t y0) {
  if (!img) return;
  int16_t w = imgW(img), h = imgH(img);
  if (!w || !h) return;
#ifdef AB_HAS_SHAKE
  x0 -= shakeX;
  y0 -= shakeY;
#endif
  x0 %= w;
  y0 %= h;
  if (x0 > 0) x0 -= w;
  if (y0 > 0) y0 -= h;
  for (int16_t y = y0; y < 64; y += h) {
    if (!onPage(y, h)) continue;
    for (int16_t x = x0; x < 128; x += w) drawImage(x, y, img, 0);
  }
}
static void drawBackground() {
  drawRepeatedBackground(background, bgX, bgY);
#ifdef AB_HAS_PARALLAX
  int16_t cx = camX, cy = camY;
#ifdef AB_HAS_SHAKE
  cx -= shakeX; cy -= shakeY;
#endif
  for (uint8_t i = 0; i < 2; ++i) {
    const BackgroundLayer &layer = backgroundLayers[i];
    drawRepeatedBackground(layer.image, layer.x - (int32_t)cx * layer.percent / 100,
      layer.y - (int32_t)cy * layer.percent / 100);
  }
#endif
}
#endif

#ifdef AB_HAS_DRAW_REFERENCE
static int8_t repeatedColor(const uint8_t *img, int16_t x, int16_t y, int16_t ox, int16_t oy) {
  int16_t w = imgW(img), h = imgH(img);
  if (!w || !h) return -1;
#ifdef AB_HAS_SHAKE
  ox -= shakeX; oy -= shakeY;
#endif
  int16_t cx = ((int32_t)x - ox) % w, cy = ((int32_t)y - oy) % h;
  if (cx < 0) cx += w;
  if (cy < 0) cy += h;
  return imageColor(img, cx, cy);
}
#ifdef AB_HAS_PARALLAX
static int8_t layerColor(uint8_t i, int16_t x, int16_t y) {
  const BackgroundLayer &layer = backgroundLayers[i];
  int16_t cx = camX, cy = camY;
#ifdef AB_HAS_SHAKE
  cx -= shakeX; cy -= shakeY;
#endif
  return repeatedColor(layer.image, x, y,
    layer.x - (int32_t)cx * layer.percent / 100,
    layer.y - (int32_t)cy * layer.percent / 100);
}
#endif
static uint8_t drawColor(int16_t x, int16_t y, uint8_t fallback) {
  uint8_t mode = drawingMode;
  if (!mode) return fallback;
  if (mode == 1) return 2;
  int8_t color = -1;
  if (mode == 2) {
    color = 0;
#ifdef AB_HAS_BACKGROUND
    int8_t c = repeatedColor(background, x, y, bgX, bgY);
    if (c >= 0) color = c;
#ifdef AB_HAS_PARALLAX
    for (uint8_t i = 0; i < 2; i++) { c = layerColor(i, x, y); if (c >= 0) color = c; }
#endif
#endif
#ifndef AB_NO_MAP
    int16_t wx = x + camX, wy = y + camY;
    uint8_t tile = tileAt(wx >> 3, wy >> 3);
    int8_t tc = tile && tileImages ? imageColor((const uint8_t *)pgm_read_ptr(&tileImages[tile]), wx & 7, wy & 7) : -1;
    if (tile && tc >= 0) color = tc;
#endif
  }
#ifdef AB_HAS_PARALLAX
  else if (mode == 3 || mode == 4) color = layerColor(mode - 3, x, y);
#endif
  else if (mode >= 5) {
    uint8_t s = drawingMode - 5;
    if (exists(s)) {
      const Sprite &sp = sprites[s];
      if (!(sp.flags & FLAG_INVISIBLE)) color = imageColor(sp.img,
        x + camX - (px(sp.x) - imgW(sp.img) / 2),
        y + camY - (px(sp.y) - imgH(sp.img) / 2), sp.frame);
    }
  }
  return color < 0 ? fallback : 1 - color;
}
#endif

// Moves one sprite along one axis and stops it at walls.
static void moveAxis(Sprite &sp, bool horizontal, int32_t delta) {
  int16_t w = imgW(sp.img), h = imgH(sp.img);
  if (horizontal) sp.x += delta;
  else sp.y += delta;
  if (!hasMap() || (sp.flags & FLAG_GHOST) || delta == 0) return;
  int16_t left = px(sp.x) - w / 2, top = px(sp.y) - h / 2;
  int16_t right = left + w - 1, bottom = top + h - 1;
  bool bounce = sp.flags & FLAG_BOUNCE_ON_WALL;
  bool edgeWalls = sp.flags & FLAG_STAY_IN_MAP;
  if (horizontal) {
    int16_t col = delta > 0 ? right >> 3 : left >> 3;
    for (int16_t row = top >> 3; row <= bottom >> 3; row++) {
      if (!isSolid(col, row, edgeWalls)) continue;
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
      if (!isSolid(col, row, edgeWalls)) continue;
      if (delta > 0) { top = row * 8 - h; sp.hit |= HIT_BOTTOM; }
      else { top = (row + 1) * 8; sp.hit |= HIT_TOP; }
      sp.y = (int32_t)(top + h / 2) << 8;
      sp.vy = bounce ? -sp.vy : 0;
      return;
    }
  }
}

static void updateSprites() {
#ifndef AB_NO_SPRITES
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
#ifndef AB_NO_SPRITE_MOTION
    sp.vx = clamp16((int32_t)sp.vx + (int32_t)sp.ax * 8 / 15);
    sp.vy = clamp16((int32_t)sp.vy + (int32_t)sp.ay * 8 / 15);
    moveAxis(sp, true, (int32_t)sp.vx * 8 / 15);
    moveAxis(sp, false, (int32_t)sp.vy * 8 / 15);
#endif
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
#endif
}

static void updateCamera() {
#ifdef AB_NO_SPRITES
  return;
#endif
  if (!exists(cameraSprite)) return;
  camX = px(sprites[cameraSprite].x) - 64;
  camY = px(sprites[cameraSprite].y) - 32;
  if (hasMap()) {
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
  if (!hasMap()) return;
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

static bool outlineSolid(const uint8_t *shape, int16_t w, int16_t h, int16_t x, int16_t y) {
  return x >= 0 && y >= 0 && x < w && y < h && (pgm_read_byte(shape + (y >> 3) * w + x) & (1 << (y & 7)));
}

static void drawSprite(Sprite &sp) {
  if (sp.flags & FLAG_INVISIBLE) return;
  int16_t w = imgW(sp.img), h = imgH(sp.img);
  int16_t x = px(sp.x) - w / 2 - camX, y = px(sp.y) - h / 2 - camY;
#ifndef AB_NO_OUTLINE
  if (sp.outline && sp.img) {
    int16_t radius = sp.outlineWidth ? sp.outlineWidth : 1;
    uint16_t size = ((h + 7) >> 3) * w;
    uint8_t masked = pgm_read_byte(sp.img + 3) & 1;
    uint8_t frame = sp.frame < imgFrames(sp.img) ? sp.frame : 0;
    const uint8_t *shape = sp.img + 4 + frame * size * (masked ? 2 : 1) + (masked ? size : 0);
    // Clip first and visit each contour pixel once, including diagonal neighbors.
    for (int16_t cy = y < radius ? -y : -radius; cy < h + radius && cy + y < 64; cy++) {
      for (int16_t cx = x < radius ? -x : -radius; cx < w + radius && cx + x < 128; cx++) {
        if (outlineSolid(shape, w, h, cx, cy)) continue;
        bool adjacent = false;
        for (int8_t dy = -radius; dy <= radius && !adjacent; dy++)
          for (int8_t dx = -radius; dx <= radius; dx++)
            if (outlineSolid(shape, w, h, cx + dx, cy + dy)) { adjacent = true; break; }
        if (adjacent) drawPixel(x + cx, y + cy, sp.outline == 3 ? 2 : sp.outline - 1);
      }
    }
  }
#endif
#ifdef AB_HAS_DRAW_MODE
  DrawModeScope scope(sp.drawMode);
#endif
  drawImage(x, y, sp.img, sp.frame);
}

// Lowest layer first; sprites on the same layer are drawn in pool order.
#ifdef AB_HAS_SPEECH
// Return one wrapped line's bounds, and advance to the next line.
static __attribute__((noinline)) void speechLine(const char *text, uint8_t columns, uint8_t &start, uint8_t &end, uint8_t &next) {
  end = start;
  int16_t space = -1;
  while (text[end] && text[end] != '\n' && end - start < columns) {
    if (text[end] == ' ') space = end;
    end++;
  }
  next = end;
  if (text[end] == '\n') next++;
  else if (text[end] && text[end] != ' ' && space > start) { end = space; next = space + 1; }
  while (text[next] == ' ') next++;
}
static void drawSpeech() {
#ifdef AB_HAS_DRAW_MODE
  uint8_t saved = drawingMode;
  drawingMode = 0;
#endif
  uint32_t now = millis();
  for (uint8_t i = 0; i < AB_SPEECH_SLOTS; i++) {
    Speech &b = speeches[i];
    if (!b.owner) continue;
    uint8_t s = b.owner - 1;
    if (!sprites[s].alive || (b.duration && (uint32_t)(now - b.started) >= b.duration)) {
      speechHide(s); i--; continue;
    }
    Sprite &sp = sprites[s];
    if (sp.flags & FLAG_INVISIBLE) continue;
    uint8_t maxWidth = 86, position = 0, colors = 6;
#ifdef AB_HAS_SPEECH_SETTINGS
    if (sp.speechWidth) maxWidth = sp.speechWidth;
    position = sp.speechPosition;
    if (sp.speechColors) colors = sp.speechColors;
#endif
    uint8_t columns = (maxWidth - 6) / 4;
    uint8_t count = 0, start = 0, end, next;
    do { speechLine(b.text, columns, start, end, next); count++; start = next; } while (b.text[start]);
    uint8_t page = ((uint32_t)(now - b.started) / 1500) % ((count + 2) / 3);
    uint8_t starts[3], ends[3], rows = 0, maxLength = 0;
    start = 0;
    for (uint8_t line = 0; line < count; line++) {
      speechLine(b.text, columns, start, end, next);
      if (line / 3 == page) {
        starts[rows] = start; ends[rows++] = end;
        if (end - start > maxLength) maxLength = end - start;
      }
      start = next;
    }
    int16_t width = maxLength * 4 + 6, height = rows * 6 + 5;
    if (width < 14) width = 14;
    int16_t cx = px(sp.x) - camX;
    uint8_t h = sp.img ? pgm_read_byte(sp.img + 1) : 0;
    int16_t top = px(sp.y) - h / 2 - camY, bottom = top + h;
    int16_t x = cx - width / 2;
    if (x < 0) x = 0;
    if (x > 128 - width) x = 128 - width;
    bool below = position == 2 || (position == 0 && top < height + 3);
    if (below && bottom + 3 + height > 64 && top >= height + 3) below = false;
    if (!below && top < height + 3 && bottom + 3 + height <= 64) below = true;
    int16_t y = below ? bottom + 3 : top - height - 3;
    if (y < 0) y = 0;
    if (y > 64 - height) y = 64 - height;
    uint8_t fg = colors & 1, bg = (colors >> 1) & 1;
    fillRect(x, y, width, height, bg);
    drawRect(x, y, width, height, 1 - bg);
    int16_t tailX = cx;
    if (tailX < x + 3) tailX = x + 3;
    if (tailX > x + width - 4) tailX = x + width - 4;
    fillRect(tailX - 1, below ? y : y + height - 1, 3, 1, bg);
    for (uint8_t t = 0; t < 3; t++) {
      int16_t ty = below ? y - 1 - t : y + height + t;
      if (ty >= 0 && ty < 64) {
        fillRect(tailX - 2 + t, ty, 5 - t * 2, 1, 1 - bg);
        if (t < 2) fillRect(tailX - 1 + t, ty, 3 - t * 2, 1, bg);
      }
    }
    for (uint8_t row = 0; row < rows; row++) for (uint8_t c = starts[row]; c < ends[row]; c++) {
      uint8_t code = b.text[c];
      if (code < 32 || code > 126) code = '?';
      for (uint8_t gx = 0; gx < 3; gx++) {
        uint8_t bits = pgm_read_byte(font3x5 + (code - 32) * 3 + gx);
        for (uint8_t gy = 0; gy < 5; gy++) if (bits & (1 << gy)) drawPixel(x + 3 + (c - starts[row]) * 4 + gx, y + 3 + row * 6 + gy, fg);
      }
    }
  }
#ifdef AB_HAS_DRAW_MODE
  drawingMode = saved;
#endif
}
#endif

static void drawSprites() {
#ifndef AB_NO_SPRITES
  int16_t layer = -129;
  for (;;) {
    int16_t next = 128;
    for (uint8_t i = 0; i < AB_MAX_SPRITES; i++)
      if (sprites[i].alive && sprites[i].z > layer && sprites[i].z < next) next = sprites[i].z;
    if (next == 128) return;
    for (uint8_t i = 0; i < AB_MAX_SPRITES; i++)
      if (sprites[i].alive && sprites[i].z == next) drawSprite(sprites[i]);
    layer = next;
  }
#endif
}

// Visual particles, independent of the sprite pool. 27 bytes each on AVR.
#ifdef AB_HAS_PARTICLES
// A particle effect recipe, generated from the blocks into flash.
// Angles in degrees: 0 up, 90 right. Speeds in pixels per second.
struct Effect {
  const uint8_t *img; // null means one pixel
  int8_t color;       // 0 black, 1 white, 2 random
  uint8_t blink;      // percent of the lifetime, at the end
  int16_t lifeMin, lifeMax, dir, spread, speedMin, speedMax, areaW, areaH, ax, ay, drag, wobble;
};
struct Particle {
#ifdef AB_HAS_DRAW_MODE
  uint8_t drawMode;
#endif
  int32_t x, y; // 1/256 pixel, world coordinates
  int16_t vx, vy, endVx, endVy; // pixels per second, or 1/16 pixels per second with an effect
  const uint8_t *img; // null means one white pixel
  uint16_t remaining, duration;
  int8_t color;
  const Effect *fx; // in flash, null for particles without an effect
};
#ifndef AB_MAX_PARTICLES
#define AB_MAX_PARTICLES (AB_MAX_SPRITES <= 12 ? 12 : 16)
#endif
static Particle particles[AB_MAX_PARTICLES];
static void clearParticles() { memset(particles, 0, sizeof(particles)); }
static Particle *freeParticle() {
  for (uint8_t i = 0; i < AB_MAX_PARTICLES; i++)
    if (!particles[i].remaining) return &particles[i];
  return 0;
}
static void emitParticleTween(const uint8_t *img, int16_t x, int16_t y, int16_t vx, int16_t vy, int16_t ms, int16_t endVx, int16_t endVy, int8_t color = -1) {
  if (ms <= 0) return;
  Particle *p = freeParticle();
  if (!p) return;
  p->x = (int32_t)x * 256; p->y = (int32_t)y * 256;
  p->vx = vx; p->vy = vy; p->img = img; p->remaining = p->duration = ms;
  p->endVx = endVx; p->endVy = endVy; p->fx = 0;
#ifdef AB_HAS_DRAW_MODE
  p->drawMode = drawingMode;
#endif
  p->color = color == 2 ? random(0, 1) : color;
}
static void emitParticle(const uint8_t *img, int16_t x, int16_t y, int16_t vx, int16_t vy, int16_t ms) {
  emitParticleTween(img, x, y, vx, vy, ms, vx, vy);
}

// sin(0 to 90 degrees) * 127, the same table as src/sim/intmath.ts.
static const int8_t sinTable[91] PROGMEM = {
  0, 2, 4, 7, 9, 11, 13, 15, 18, 20, 22, 24, 26, 29, 31, 33, 35, 37, 39, 41, 43, 46, 48, 50, 52, 54, 56, 58, 60, 62,
  63, 65, 67, 69, 71, 73, 75, 76, 78, 80, 82, 83, 85, 87, 88, 90, 91, 93, 94, 96, 97, 99, 100, 101, 103, 104, 105,
  107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 119, 120, 121, 121, 122, 123, 123, 124, 124, 125,
  125, 125, 126, 126, 126, 127, 127, 127, 127, 127, 127,
};
static int8_t isin(int16_t d) {
  d %= 360;
  if (d < 0) d += 360;
  bool neg = d >= 180;
  if (neg) d -= 180;
  if (d > 90) d = 180 - d;
  int8_t v = pgm_read_byte(&sinTable[d]);
  return neg ? -v : v;
}

static void burst(const Effect *fxp, int16_t n, int16_t x, int16_t y, int16_t rot) {
  if (!fxp) return;
  Effect fx;
  memcpy_P(&fx, fxp, sizeof(fx));
  for (int16_t k = 0; k < n; k++) {
    Particle *p = freeParticle();
    if (!p) return;
    // The same order of random numbers as the simulator.
    int16_t life = random(fx.lifeMin, fx.lifeMax);
    int16_t a = (int16_t)(((int32_t)fx.dir + rot + random(-fx.spread, fx.spread)) % 360);
    int16_t sp = random(fx.speedMin, fx.speedMax);
    int16_t ox = fx.areaW ? random(0, fx.areaW - 1) - (fx.areaW >> 1) : 0;
    int16_t oy = fx.areaH ? random(0, fx.areaH - 1) - (fx.areaH >> 1) : 0;
    int8_t color = fx.color == 2 ? random(0, 1) : fx.color;
    if (life <= 0) continue;
    p->x = ((int32_t)x + ox) * 256; p->y = ((int32_t)y + oy) * 256;
    p->vx = (int32_t)sp * 16 * isin(a) / 127;
    p->vy = -((int32_t)sp * 16 * isin(a + 90) / 127);
    p->endVx = p->endVy = 0;
#ifdef AB_HAS_DRAW_MODE
    p->drawMode = drawingMode;
#endif
    p->img = fx.img; p->color = color; p->fx = fxp;
    p->remaining = p->duration = life;
  }
}
static void burstFrom(const Effect *fx, int16_t n, uint8_t s, int16_t rot) {
  if (exists(s)) burst(fx, n, getProp(s, P_X), getProp(s, P_Y), rot);
}
static void clearEffect(const Effect *fx) {
  for (uint8_t i = 0; i < AB_MAX_PARTICLES; i++)
    if (fx && particles[i].fx == fx) particles[i].remaining = 0;
}

static int16_t clampSpeed(int32_t v) { return v < -32000 ? -32000 : v > 32000 ? 32000 : v; }

static void updateParticles() {
  for (uint8_t i = 0; i < AB_MAX_PARTICLES; i++) {
    Particle &p = particles[i];
    if (!p.remaining) continue;
    uint16_t step = p.remaining < AB_FRAME_MS ? p.remaining : AB_FRAME_MS;
    if (p.fx) {
      Effect fx;
      memcpy_P(&fx, p.fx, sizeof(fx));
      p.vx = clampSpeed(p.vx + (int32_t)fx.ax * 16 * step / 1000);
      p.vy = clampSpeed(p.vy + (int32_t)fx.ay * 16 * step / 1000);
      if (fx.drag) {
        p.vx -= (int32_t)p.vx * fx.drag * step / 100000;
        p.vy -= (int32_t)p.vy * fx.drag * step / 100000;
      }
      if (fx.wobble) p.vx = clampSpeed(p.vx + (int32_t)random(-fx.wobble, fx.wobble) * 16);
      p.x += (int32_t)p.vx * 16 * step / 1000;
      p.y += (int32_t)p.vy * 16 * step / 1000;
    } else {
      uint16_t midpoint = p.duration - p.remaining + step / 2;
      int32_t vx = p.vx + ((int32_t)p.endVx - p.vx) * midpoint / p.duration;
      int32_t vy = p.vy + ((int32_t)p.endVy - p.vy) * midpoint / p.duration;
      p.x += vx * 256 * step / 1000;
      p.y += vy * 256 * step / 1000;
    }
    p.remaining -= step;
  }
}
static void drawParticles() {
  for (uint8_t i = 0; i < AB_MAX_PARTICLES; i++) {
    Particle &p = particles[i];
    if (!p.remaining) continue;
    uint8_t blink = p.fx ? pgm_read_byte(&p.fx->blink) : 0;
    if (blink && (uint32_t)p.remaining * 100 < (uint32_t)p.duration * blink && (frameCount & 2)) continue;
    int32_t x = (p.x >> 8) - camX, y = (p.y >> 8) - camY;
    int16_t w = p.img ? imgW(p.img) : 1, h = p.img ? imgH(p.img) : 1;
    if (x + w / 2 < 0 || y + h / 2 < 0 || x - w / 2 >= 128 || y - h / 2 >= 64) continue;
    uint8_t frames = imgFrames(p.img), frame = 0;
    if (p.fx && frames > 1) {
      frame = (uint32_t)(p.duration - p.remaining) * frames / p.duration;
      if (frame >= frames) frame = frames - 1;
    }
#ifdef AB_HAS_DRAW_MODE
    DrawModeScope scope(p.drawMode);
#endif
    if (p.img) drawImage(x - w / 2, y - h / 2, p.img, frame, p.color);
    else drawPixel(x, y, p.color == 0 ? 0 : 1);
  }
}
#endif

#ifdef AB_HAS_DRAW_REFERENCE
// References never attach themselves to a different sprite reusing this slot.
static void forgetDrawReference(uint8_t s) {
  uint8_t reference = 5 + s;
  if (drawingMode == reference) drawingMode = 0;
  for (uint8_t i = 0; i < AB_MAX_SPRITES; i++) if (sprites[i].drawMode == reference) sprites[i].drawMode = 0;
#ifdef AB_HAS_PARTICLES
  for (uint8_t i = 0; i < AB_MAX_PARTICLES; i++) if (particles[i].drawMode == reference) particles[i].drawMode = 0;
#endif
}
#endif

// Score and lives -------------------------------------------------------

static const uint8_t heart[] PROGMEM = {0x06, 0x0F, 0x1E, 0x0F, 0x06};

#ifdef AB_HAS_TIMERS
struct GameTimer { int16_t seconds, x, y; uint32_t last; uint16_t remainder; int8_t mode; uint8_t format; bool visible; };
static GameTimer gameTimers[8];
static void updateTimers() {
  uint32_t now = millis();
  for (uint8_t i = 0; i < 8; i++) {
    GameTimer &t = gameTimers[i];
    if (t.mode) {
      uint32_t elapsed = now - t.last;
      if (elapsed > 32767000UL) elapsed = 32767000UL;
      int32_t value = (int32_t)t.seconds * 1000 + t.remainder + (int32_t)elapsed * t.mode;
      value = value < 0 ? 0 : value > 32767000L ? 32767000L : value;
      t.seconds = value / 1000; t.remainder = value % 1000;
      if (t.mode < 0 && !value) t.mode = 0;
    }
    t.last = now;
  }
}
static int16_t timerValue(uint8_t id) { updateTimers(); return id < 8 ? gameTimers[id].seconds : 0; }
static void timerSet(uint8_t id, int16_t s) {
  updateTimers(); if (id >= 8) return;
  GameTimer &t = gameTimers[id];
  int32_t value = s;
  t.seconds = value < 0 ? 0 : value > 32767 ? 32767 : value;
  t.remainder = 0; t.visible = true;
}
static int16_t timerMillis(uint8_t id) { updateTimers(); return id < 8 ? gameTimers[id].remainder : 0; }
static void timerSetMillis(uint8_t id, int16_t value) {
  updateTimers(); if (id >= 8) return;
  GameTimer &t = gameTimers[id];
  t.remainder = t.seconds == 32767 ? 0 : value < 0 ? 0 : value > 999 ? 999 : value; t.visible = true;
}
static void timerChangeMillis(uint8_t id, int32_t value) {
  updateTimers(); if (id >= 8) return;
  GameTimer &t = gameTimers[id];
  int32_t total = (int32_t)t.seconds * 1000 + t.remainder + value;
  total = total < 0 ? 0 : total > 32767000L ? 32767000L : total;
  t.seconds = total / 1000; t.remainder = total % 1000; t.visible = true;
  if (t.mode < 0 && !total) t.mode = 0;
}
static void timerChange(uint8_t id, int16_t value) { timerChangeMillis(id, (int32_t)value * 1000); }
static void timerRun(uint8_t id, int16_t mode) {
  updateTimers(); if (id >= 8) return;
  gameTimers[id].mode = mode < 0 ? -1 : mode > 0 ? 1 : 0; gameTimers[id].visible = true;
}
static void timerFormat(uint8_t id, uint8_t format) { if (id < 8) { gameTimers[id].format = format; gameTimers[id].visible = format != 5; } }
static void timerPosition(uint8_t id, int16_t x, int16_t y) { if (id < 8) { gameTimers[id].x = x; gameTimers[id].y = y; } }
static void timerDigits(char *&p, uint16_t v) {
  if (v >= 100) *p++ = '0' + v / 100;
  *p++ = '0' + (v / 10) % 10; *p++ = '0' + v % 10;
}
static void drawTimers() {
  for (uint8_t i = 0; i < 8; i++) {
    GameTimer &t = gameTimers[i]; if (!t.visible || t.format == 5 || !onPage(t.y, 9)) continue;
    uint16_t s = t.seconds;
    char text[16], *p = text;
    if (t.format < 3) { tbClear(); tbNum(s / (t.format == 0 ? 1 : t.format == 1 ? 60 : 3600)); }
    else {
      if (t.format == 4 || t.format == 7) { timerDigits(p, s / 3600); *p++ = ':'; }
      timerDigits(p, (t.format == 4 || t.format == 7) ? (s / 60) % 60 : s / 60); *p++ = ':'; timerDigits(p, s % 60);
      if (t.format == 6 || t.format == 7) { *p++ = '.'; *p++ = '0' + t.remainder / 100; timerDigits(p, t.remainder % 100); }
      *p = 0;
    }
    const char *label = t.format < 3 ? textBuf : text;
    fillRect(t.x - 1, t.y, textWidth(label) + 2, 9, 0);
    drawText(t.x, t.y + 1, label, 1);
  }
}
#endif

static void drawHud() {
#ifdef AB_HAS_TIMERS
  drawTimers();
#endif
#ifdef AB_NO_HUD
  return;
#endif
  if (showLife && onPage(lifeY, 5)) {
    for (int16_t i = 0; i < life && i < 8; i++) {
      for (uint8_t c = 0; c < 5; c++) {
        uint8_t bits = pgm_read_byte(&heart[c]);
        for (uint8_t r = 0; r < 5; r++) {
          if (bits & (1 << r)) drawPixel(lifeX + i * 7 + c, lifeY + r, 1);
        }
      }
    }
  }
  if (showScore && onPage(scoreY, 9)) {
    tbClear();
    tbNum(score);
    int16_t w = textWidth(textBuf);
    int16_t x = scoreX < 0 ? 127 - w : scoreX;
    fillRect(x - 1, scoreY, w + 2, 9, 0);
    drawText(x, scoreY + 1, textBuf, 1);
  }
}

static void setScore(int16_t v) { score = v; showScore = true; }
#ifdef AB_SCORE_POS
static void setScorePosition(int16_t x, int16_t y) { scoreX = x < 0 ? 0 : x; scoreY = y; }
#endif
static void changeScore(int16_t by) { setScore(score + by); }
#ifdef AB_LIFE_POS
static void setLifePosition(int16_t x, int16_t y) { lifeX = x; lifeY = y; }
#endif
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

// Clears the screen, draws it and shows it. With AB_PAGED draw runs once per page.
static void render(void (*draw)()) {
#ifdef AB_PAGED
  for (drawPage = 0; drawPage < 8; drawPage++) {
    clear();
    draw();
    displayPage(drawPage, buffer);
  }
#else
  clear();
  draw();
  displayShow(buffer);
#endif
}

// Shows what has been drawn so far and waits until A is pressed.
static void showAndWait() {
  // ponytail: with AB_PAGED nothing is kept between frames, so this only waits.
#ifndef AB_PAGED
  displayShow(buffer);
#endif
  waitForA();
  nextFrame = millis();
}

#ifdef AB_PAGED
static const char *splashText;
static void drawSplash() { messageBox(splashText); }
#endif

static void splash(const char *text) {
#ifdef AB_PAGED
  // The text is drawn on a black screen, since the last frame is not kept.
  splashText = text;
  render(drawSplash);
#else
  messageBox(text);
#endif
  showAndWait();
}

static void pause(int16_t ms) {
  if (ms > 0) waitMs(ms);
  nextFrame = millis();
}

static uint32_t runtime() { return millis(); }

static void restart() {
#ifdef AB_HAS_SONG_VOLUME
  setSongVolume(100);
#endif
#ifdef AB_HAS_DRAW_MODE
  drawingMode = 0;
#endif
  memset(sprites, 0, sizeof(sprites));
#ifdef AB_HAS_SPEECH
  memset(speeches, 0, sizeof(speeches));
#endif
#ifdef AB_HAS_PARTICLES
  clearParticles();
#endif
  map = 0;
  camX = camY = 0;
#ifdef AB_HAS_BACKGROUND
  background = 0;
  bgX = bgY = 0;
#ifdef AB_HAS_PARALLAX
  memset(backgroundLayers, 0, sizeof(backgroundLayers));
#endif
#endif
#ifdef AB_HAS_SHAKE
  shakeLeft = 0;
#endif
  cameraSprite = controlled = NONE;
#ifdef AB_HAS_TIMERS
  memset(gameTimers, 0, sizeof(gameTimers));
  for (uint8_t i = 0; i < 8; i++) { gameTimers[i].format = 3; gameTimers[i].y = 10 + i * 9; gameTimers[i].last = millis(); }
#endif
#ifdef AB_LIFE_POS
  lifeX = lifeY = 1;
#endif
  score = life = 0;
  showScore = showLife = gameOverPending = false;
#ifdef AB_SCORE_POS
  scoreX = -1;
  scoreY = 0;
#endif
  soundOff();
  displayInvert(false);
  frameCount = 0;
  pitchLo = pitchHi = 100;
  ab_init_globals();
  ab_on_start();
}

static void drawGameOver() {
  if (gameOverWin) centerP(8, PSTR("YOU WIN!"));
  else centerP(8, PSTR("GAME OVER"));
  if (showScore) {
    tbClear(); tbStr(PSTR("SCORE ")); tbNum(score);
    drawText(64 - textWidth(textBuf) / 2, 24, textBuf, 1);
    tbClear(); tbStr(PSTR("BEST ")); tbNum(hiscore);
    drawText(64 - textWidth(textBuf) / 2, 34, textBuf, 1);
  }
  centerP(52, PSTR("PRESS A"));
}

static void showGameOver() {
  saveHiscore();
  musicPos = 0;
#ifdef AB_HAS_SONGS
  atm_stop();
#endif
  playSound(gameOverWin ? sfxWin : sfxLose);
  render(drawGameOver);
  waitForA();
  restart();
  nextFrame = millis();
}

// Main loop -------------------------------------------------------------

static void begin() {
#if defined(AB_DISPLAY_ESPBOY)
  espHardwareBegin();
#endif
  for (uint8_t i = 0; i < BTN_COUNT; i++) {
#if defined(AB_DISPLAY_ESPBOY)
    espPinMode(buttonPins[i], true);
#else
    if (buttonPins[i] >= 0) pinMode(buttonPins[i], INPUT_PULLUP);
#endif
  }
#if defined(AB_PIN_SOUND2)
  pinMode(AB_PIN_SOUND2, OUTPUT);
  digitalWrite(AB_PIN_SOUND2, LOW);
#endif
#if defined(AB_PIN_SOUND1)
  pinMode(AB_PIN_SOUND1, OUTPUT);
  toneBegin();
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

static void drawFrame() {
#ifdef AB_HAS_BACKGROUND
  drawBackground();
#endif
  drawMap();
  drawSprites();
#ifdef AB_HAS_PARTICLES
  drawParticles();
#endif
  ab_on_draw();
#ifdef AB_HAS_SPEECH
  drawSpeech();
#endif
  drawHud();
}

static void frame() {
  uint32_t now = millis();
  if ((int32_t)(now - nextFrame) < 0) return;
  nextFrame += AB_FRAME_MS;
  // Do not try to catch up after a long pause.
  if ((int32_t)(now - nextFrame) > AB_FRAME_MS * 4) nextFrame = now + AB_FRAME_MS;
  frameCount++;
  // A pitch block left early (return or break) only lasts until the next frame.
  pitchLo = pitchHi = 100;

  readButtons();
  for (uint8_t b = 0; b < BTN_COUNT; b++) {
    uint8_t mask = 1 << b;
    if ((buttons & mask) && !(buttonsPrev & mask)) ab_on_button(b, 1);
    else if (!(buttons & mask) && (buttonsPrev & mask)) ab_on_button(b, 0);
  }
#ifdef AB_HAS_TIMERS
  updateTimers();
#endif
  ab_on_update();
  updateSprites();
#ifdef AB_HAS_PARTICLES
  updateParticles();
#endif
  checkOverlaps();
  updateCamera();
  updateSound();

#ifdef AB_HAS_SHAKE
  // Shaking moves the camera for one frame and is undone after drawing.
  if (shakeLeft) {
    shakeLeft--;
    shakeX = random(-shakeAmp, shakeAmp);
    shakeY = random(-shakeAmp, shakeAmp);
  } else {
    shakeX = shakeY = 0;
  }
  camX += shakeX;
  camY += shakeY;
#endif
  render(drawFrame);
#ifdef AB_HAS_SHAKE
  camX -= shakeX;
  camY -= shakeY;
#endif

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
