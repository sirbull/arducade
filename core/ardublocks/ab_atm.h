// Songs with four voices: the ATMlib player (Arduboy Tracker Music).
// Included by ardublocks.h when the game plays a song (AB_HAS_SONGS).
//
// Based on ATMlib by TEAM a.r.g., Davey Taylor and Joeri Gantois:
// https://github.com/JKirchartz/ATMlib (license below). The simulator has the
// same player in src/sim/atm.ts, and src/engine/songs.ts makes the song data.
//
// On an ATmega32u4 with the speaker on pin 5 or 13 (the Arduboy wiring)
// Timer4 mixes four voices at 31250 samples a second: pulse, square, triangle
// and noise. Other chips run the same playroutine from the game loop and play
// the first sounding voice of pulse, square and triangle with tone().
//
// Changes from ATMlib: names start with atm_, playing resets the channels
// stopped by the last song, read_vle() moves its pointer, the first tick comes
// at once, songs can loop, stopping releases the speaker pins, and a tone can
// take over the square voice while a song plays (atm_tone).
//
// BSD 3-Clause License
//
// Copyright (c) 2016, TEAM a.r.g.
// Copyright (c) 2016, Davey Taylor
// Copyright (c) 2016, Joeri Gantois
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// * Redistributions of source code must retain the above copyright notice, this
//   list of conditions and the following disclaimer.
//
// * Redistributions in binary form must reproduce the above copyright notice,
//   this list of conditions and the following disclaimer in the documentation
//   and/or other materials provided with the distribution.
//
// * Neither the name of the copyright holder nor the names of its
//   contributors may be used to endorse or promote products derived from
//   this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
// FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
// DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
// SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
// CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
// OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

#pragma once
#include <stddef.h>
#include <string.h>

#if defined(__AVR_ATmega32U4__) && defined(AB_PIN_SOUND1) && (AB_PIN_SOUND1 == 5 || AB_PIN_SOUND1 == 13)
#define AB_ATM_SYNTH 1
#endif

// The mixer reads these by name from assembly, so they are global and not static.
struct atm_osc_t {
  uint8_t vol;
  uint16_t freq; // phase step, or the noise shift register
  uint16_t phase;
};
atm_osc_t atm_osc[4] __attribute__((used));
uint8_t atm_pcm __attribute__((used)) = 128;
bool atm_half __attribute__((used));
uint16_t atm_cia __attribute__((used)), atm_cia_count __attribute__((used));

static uint8_t atm_lock() {
#ifdef AB_ATM_SYNTH
  uint8_t saved = SREG; cli(); return saved;
#else
  return 0;
#endif
}
static void atm_unlock(uint8_t saved) {
#ifdef AB_ATM_SYNTH
  SREG = saved;
#else
  (void)saved;
#endif
}

#ifdef AB_HAS_SONG_PITCH
static uint16_t atm_pitch = 100;
static void atm_setPitch(uint16_t pitch) {
  uint8_t saved = atm_lock(); atm_pitch = pitch; atm_unlock(saved);
}
#endif

static const uint8_t *atm_song;
static bool atm_loop;
static uint8_t atm_tickRate;
static const uint8_t *atm_trackList;
static const uint8_t *atm_trackBase;

// Bits 4 to 7: the channel still plays. Bits 0 to 3: the channel is muted,
// and the playroutine leaves its oscillator alone.
static volatile uint8_t atm_active;

static const uint16_t atm_noteTable[64] PROGMEM = {
  0,
  262,  277,  294,  311,  330,  349,  370,  392,  415,  440,  466,  494,
  523,  554,  587,  622,  659,  698,  740,  784,  831,  880,  932,  988,
  1047, 1109, 1175, 1245, 1319, 1397, 1480, 1568, 1661, 1760, 1865, 1976,
  2093, 2217, 2349, 2489, 2637, 2794, 2960, 3136, 3322, 3520, 3729, 3951,
  4186, 4435, 4699, 4978, 5274, 5588, 5920, 6272, 6645, 7040, 7459, 7902,
  8372, 8870, 9397,
};

struct atm_ch_t {
  const uint8_t *ptr;
  uint8_t note;

  // Nesting
  uint16_t stackPointer[7];
  uint8_t stackCounter[7];
  uint8_t stackTrack[7];
  uint8_t stackIndex;

  // Looping
  uint16_t delay;
  uint8_t counter;
  uint8_t track;

  uint16_t freq;
  uint8_t vol;

  // Volume and frequency slide
  int8_t volFreSlide;
  uint8_t volFreConfig;
  uint8_t volFreCount;

  // Arpeggio or note cut
  uint8_t arpNotes;  // notes: base, base+[7:4], base+[7:4]+[3:0], 0xFF is note cut
  uint8_t arpTiming; // [6] no third note, [5] retrigger, [4:0] ticks
  uint8_t arpCount;

  // Retrigger (noise)
  uint8_t reConfig; // [7:2] note, [1:0] speed
  uint8_t reCount;  // also the volume a note starts at

  int8_t transConfig;

  // Tremolo or vibrato
  uint8_t treviDepth;
  uint8_t treviConfig;
  uint8_t treviCount;

  // Glissando
  uint8_t glisConfig;
  uint8_t glisCount;
};

static atm_ch_t atm_channel[4];
#ifndef AB_ATM_SYNTH
static uint32_t atm_next;
#endif
#ifdef AB_HAS_POLY_EFFECTS
static volatile bool atm_isEffect;
// One suspended background, shared by successive effects. Included only in
// games using polyphonic effects; no additional state for song-only games.
static struct {
  const uint8_t *song, *trackList, *trackBase;
  atm_ch_t channel[4];
  atm_osc_t osc[4];
  uint16_t cia, ciaCount;
  uint8_t tickRate, active;
  bool loop;
  volatile bool valid;
#ifdef AB_HAS_SONG_PITCH
  uint16_t pitch;
#endif
#ifndef AB_ATM_SYNTH
  int32_t nextDelta;
#endif
} atm_background;
#ifndef AB_ATM_SYNTH
static bool atm_justResumed;
#endif

static void atm_suspend() {
  if (atm_background.valid || atm_isEffect || !atm_song) return;
  atm_background.song = atm_song; atm_background.loop = atm_loop;
  atm_background.trackList = atm_trackList; atm_background.trackBase = atm_trackBase;
  memcpy(atm_background.channel, atm_channel, sizeof(atm_channel));
  memcpy(atm_background.osc, atm_osc, sizeof(atm_osc));
  atm_background.cia = atm_cia; atm_background.ciaCount = atm_cia_count;
  atm_background.tickRate = atm_tickRate; atm_background.active = atm_active;
#ifdef AB_HAS_SONG_PITCH
  atm_background.pitch = atm_pitch;
#endif
#ifndef AB_ATM_SYNTH
  atm_background.nextDelta = (int32_t)(atm_next - millis() * 1000UL);
#endif
  atm_background.valid = true;
}
#endif
#if defined(AB_HAS_SONG_VOLUME) && defined(AB_ATM_SYNTH)
static volatile uint16_t atm_master = 256;
static void atm_setVolume(int16_t percent) {
  uint16_t master = (uint16_t)constrain(percent, 0, 100) * 256 / 100;
  uint8_t saved = SREG; cli(); atm_master = master; SREG = saved;
}
#endif

static uint16_t atm_readVle(const uint8_t **pp) {
  uint16_t q = 0;
  uint8_t d;
  do {
    q <<= 7;
    d = pgm_read_byte((*pp)++);
    q |= (d & 0x7F);
  } while (d & 0x80);
  return q;
}

static const uint8_t *atm_trackPointer(uint8_t track) {
  return atm_trackBase + pgm_read_word((const uint16_t *)(atm_trackList + track * 2));
}

static void atm_load() {
  memset(atm_channel, 0, sizeof(atm_channel));
  atm_tickRate = 25;
  atm_cia = 15625 / atm_tickRate;
  atm_cia_count = 1;
  atm_osc[3].freq = 0x0001; // seed the noise
  atm_channel[3].freq = 0x0001;
  atm_active = (atm_active & 0x0F) | 0xF0;
  const uint8_t *song = atm_song;
  uint8_t trackCount = pgm_read_byte(song++);
  atm_trackList = song;
  song += trackCount << 1;
  atm_trackBase = song + 4;
  for (uint8_t n = 0; n < 4; n++) atm_channel[n].ptr = atm_trackPointer(pgm_read_byte(song++));
}

static void atm_stop() {
#ifdef AB_HAS_POLY_EFFECTS
  atm_background.valid = false;
  atm_isEffect = false;
#endif
#if defined(AB_ATM_SYNTH)
  TIMSK4 = 0;
  TCCR4A = 0; // the speaker pins are normal pins again
#endif
  atm_song = 0;
  atm_active &= 0xF0;
  for (uint8_t n = 0; n < 4; n++) atm_osc[n].vol = 0;
}

extern "C" void ATM_playroutine() asm("ATM_playroutine") __attribute__((used));

static void atm_finish() {
  uint8_t saved = atm_lock();
#ifdef AB_HAS_POLY_EFFECTS
  if (atm_background.valid) {
    atm_song = atm_background.song; atm_loop = atm_background.loop;
    atm_trackList = atm_background.trackList; atm_trackBase = atm_background.trackBase;
    memcpy(atm_channel, atm_background.channel, sizeof(atm_channel));
    memcpy(atm_osc, atm_background.osc, sizeof(atm_osc));
    atm_cia = atm_background.cia; atm_cia_count = atm_background.ciaCount;
    atm_tickRate = atm_background.tickRate; atm_active = atm_background.active;
#ifdef AB_HAS_SONG_PITCH
    atm_pitch = atm_background.pitch;
#endif
#ifndef AB_ATM_SYNTH
    atm_next = millis() * 1000UL + atm_background.nextDelta;
    atm_justResumed = true;
#endif
    atm_background.valid = false;
    atm_isEffect = false;
    atm_unlock(saved);
    return;
  }
#endif
  atm_stop();
  atm_unlock(saved);
}

void ATM_playroutine() {
  if (!(atm_active & 0xF0)) {
    if (atm_loop && atm_song) atm_load();
    else { atm_finish(); return; }
  }

  for (uint8_t n = 0; n < 4; n++) {
    atm_ch_t *ch = &atm_channel[n];

    // Noise retriggering
    if (ch->reConfig) {
      if (ch->reCount >= (ch->reConfig & 0x03)) {
        atm_osc[n].freq = pgm_read_word(&atm_noteTable[ch->reConfig >> 2]);
        ch->reCount = 0;
      }
      else ch->reCount++;
    }

    // Glissando
    if (ch->glisConfig) {
      if (ch->glisCount >= (ch->glisConfig & 0x7F)) {
        if (ch->glisConfig & 0x80) ch->note -= 1;
        else ch->note += 1;
        if (ch->note < 1) ch->note = 1;
        else if (ch->note > 63) ch->note = 63;
        ch->freq = pgm_read_word(&atm_noteTable[ch->note]);
        ch->glisCount = 0;
      }
      else ch->glisCount++;
    }

    // Volume and frequency slides. Like ATMlib, only the frequency has an upper limit.
    if (ch->volFreSlide) {
      if (!ch->volFreCount) {
        int16_t vf = ((ch->volFreConfig & 0x40) ? ch->freq : ch->vol);
        vf += ch->volFreSlide;
        if (!(ch->volFreConfig & 0x80)) {
          if (vf < 0) vf = 0;
          else if ((ch->volFreConfig & 0x40) && vf > 9397) vf = 9397;
        }
        if (ch->volFreConfig & 0x40) ch->freq = vf;
        else ch->vol = vf;
      }
      if (ch->volFreCount++ >= (ch->volFreConfig & 0x3F)) ch->volFreCount = 0;
    }

    // Arpeggio or note cut
    if (ch->arpNotes && ch->note) {
      if ((ch->arpCount & 0x1F) < (ch->arpTiming & 0x1F)) ch->arpCount++;
      else {
        if ((ch->arpCount & 0xE0) == 0x00) ch->arpCount = 0x20;
        else if ((ch->arpCount & 0xE0) == 0x20 && !(ch->arpTiming & 0x40) && (ch->arpNotes != 0xFF)) ch->arpCount = 0x40;
        else ch->arpCount = 0x00;
        uint8_t arpNote = ch->note;
        if ((ch->arpCount & 0xE0) != 0x00) {
          if (ch->arpNotes == 0xFF) arpNote = 0;
          else arpNote += (ch->arpNotes >> 4);
        }
        if ((ch->arpCount & 0xE0) == 0x40) arpNote += (ch->arpNotes & 0x0F);
        ch->freq = pgm_read_word(&atm_noteTable[arpNote + ch->transConfig]);
      }
    }

    // Tremolo or vibrato
    if (ch->treviDepth) {
      int16_t vt = ((ch->treviConfig & 0x40) ? ch->freq : ch->vol);
      vt = (ch->treviCount & 0x80) ? (vt + ch->treviDepth) : (vt - ch->treviDepth);
      if (vt < 0) vt = 0;
      else if ((ch->treviConfig & 0x40) && vt > 9397) vt = 9397;
      if (ch->treviConfig & 0x40) ch->freq = vt;
      else ch->vol = vt;
      if ((ch->treviCount & 0x1F) < (ch->treviConfig & 0x1F)) ch->treviCount++;
      else {
        if (ch->treviCount & 0x80) ch->treviCount = 0;
        else ch->treviCount = 0x80;
      }
    }

    if (ch->delay) ch->delay--;
    else {
      do {
        uint8_t cmd = pgm_read_byte(ch->ptr++);
        if (cmd < 64) {
          // 0 … 63: note on, 0 is note off
          if ((ch->note = cmd)) ch->note += ch->transConfig;
          ch->freq = pgm_read_word(&atm_noteTable[ch->note]);
          ch->vol = ch->reCount;
          if (ch->arpTiming & 0x20) ch->arpCount = 0; // arpeggio retrigger
        } else if (cmd < 160) {
          // 64 … 159: effects
          switch (cmd - 64) {
            case 0: // set volume
              ch->vol = pgm_read_byte(ch->ptr++);
              ch->reCount = ch->vol;
              break;
            case 1: case 4: // volume or frequency slide on
              ch->volFreSlide = pgm_read_byte(ch->ptr++);
              ch->volFreConfig = (cmd - 64) == 1 ? 0x00 : 0x40;
              break;
            case 2: case 5: // volume or frequency slide on, advanced
              ch->volFreSlide = pgm_read_byte(ch->ptr++);
              ch->volFreConfig = pgm_read_byte(ch->ptr++);
              break;
            case 3: case 6: // volume or frequency slide off
              ch->volFreSlide = 0;
              break;
            case 7: // arpeggio
              ch->arpNotes = pgm_read_byte(ch->ptr++);
              ch->arpTiming = pgm_read_byte(ch->ptr++);
              break;
            case 8: // arpeggio off
              ch->arpNotes = 0;
              break;
            case 9: // retrigger (noise)
              ch->reConfig = pgm_read_byte(ch->ptr++);
              break;
            case 10: // retrigger off
              ch->reConfig = 0;
              break;
            case 11: // add transposition
              ch->transConfig += (int8_t)pgm_read_byte(ch->ptr++);
              break;
            case 12: // set transposition
              ch->transConfig = pgm_read_byte(ch->ptr++);
              break;
            case 13: // transposition off
              ch->transConfig = 0;
              break;
            case 14: case 16: // tremolo or vibrato
              ch->treviDepth = pgm_read_byte(ch->ptr++);
              ch->treviConfig = pgm_read_byte(ch->ptr++) + ((cmd - 64) == 14 ? 0x00 : 0x40);
              break;
            case 15: case 17: // tremolo or vibrato off
              ch->treviDepth = 0;
              break;
            case 18: // glissando
              ch->glisConfig = pgm_read_byte(ch->ptr++);
              break;
            case 19: // glissando off
              ch->glisConfig = 0;
              break;
            case 20: // note cut
              ch->arpNotes = 0xFF;
              ch->arpTiming = pgm_read_byte(ch->ptr++);
              break;
            case 21: // note cut off
              ch->arpNotes = 0;
              break;
            case 92: // add tempo
              atm_tickRate += pgm_read_byte(ch->ptr++);
              atm_cia = 15625 / atm_tickRate;
              break;
            case 93: // set tempo
              atm_tickRate = pgm_read_byte(ch->ptr++);
              atm_cia = 15625 / atm_tickRate;
              break;
            case 94: // goto advanced
              for (uint8_t i = 0; i < 4; i++) atm_channel[i].track = pgm_read_byte(ch->ptr++);
              break;
            case 95: // stop channel
              atm_active ^= 1 << (n + 4);
              ch->delay = 0xFFFF;
              break;
          }
        } else if (cmd < 224) {
          // 160 … 223: delay 1 to 64 ticks
          ch->delay = cmd - 159;
        } else if (cmd == 224) {
          // 224: long delay
          ch->delay = atm_readVle(&ch->ptr) + 129;
        } else if (cmd < 252) {
          // 225 … 251: reserved
        } else if (cmd == 252 || cmd == 253) {
          // 252 (253): call a track (repeatedly)
          ch->stackCounter[ch->stackIndex] = ch->counter;
          ch->stackTrack[ch->stackIndex] = ch->track;
          ch->counter = cmd == 252 ? 0 : pgm_read_byte(ch->ptr++);
          ch->track = pgm_read_byte(ch->ptr++);
          ch->stackPointer[ch->stackIndex] = ch->ptr - atm_trackBase;
          ch->stackIndex++;
          ch->ptr = atm_trackPointer(ch->track);
        } else if (cmd == 254) {
          // 254: return, or repeat the track
          if (ch->counter > 0) {
            ch->counter--;
            ch->ptr = atm_trackPointer(ch->track);
          } else if (ch->stackIndex == 0) {
            ch->delay = 0xFFFF; // end of the song data
          } else {
            ch->stackIndex--;
            ch->ptr = ch->stackPointer[ch->stackIndex] + atm_trackBase;
            ch->counter = ch->stackCounter[ch->stackIndex];
            ch->track = ch->stackTrack[ch->stackIndex];
          }
        } else if (cmd == 255) {
          // 255: embedded data
          ch->ptr += atm_readVle(&ch->ptr);
        }
      } while (ch->delay == 0);

      ch->delay--;
    }

    if (!(atm_active & (1 << n))) {
      if (n == 3) {
        atm_osc[n].vol = ch->vol >> 1; // the noise voice plays at half volume
      } else {
#ifdef AB_HAS_SONG_PITCH
        uint32_t pitched = (uint32_t)ch->freq * atm_pitch / 100;
        atm_osc[n].freq = pitched > 65535 ? 65535 : (ch->freq && !pitched ? 1 : pitched);
#else
        atm_osc[n].freq = ch->freq;
#endif
        atm_osc[n].vol = ch->vol;
      }
#if defined(AB_HAS_SONG_VOLUME) && defined(AB_ATM_SYNTH)
      atm_osc[n].vol = (uint16_t)atm_osc[n].vol * atm_master >> 8;
#endif
    }
  }
}

#if defined(AB_ATM_SYNTH)

// Mixes the four voices into OCR4A at 31250 Hz (every second Timer4 overflow)
// and runs the playroutine every atm_cia samples. From ATMlib, unchanged
// except for the atm_ names.
ISR(TIMER4_OVF_vect, ISR_NAKED) {
  asm volatile(
    "push r2                                          " "\n\t"
    "in   r2,                    __SREG__             " "\n\t"
    "push r18                                         " "\n\t"
    "lds  r18, atm_half \n\t"
    "com  r18 \n\t"
    "sts  atm_half, r18 \n\t"
    "breq continue \n\t"
    "pop  r18                                         " "\n\t"
    "out  __SREG__,              r2                   " "\n\t"
    "pop  r2                                          " "\n\t"
    "reti                                             " "\n\t"
    "continue: \n\t"
    "push r27                                         " "\n\t"
    "push r26                                         " "\n\t"
    "push r0                                          " "\n\t"
    "push r1                                          " "\n\t"

    "lds  r18,                   atm_osc+2*%[mul]+%[fre]  " "\n\t"
    "lds  r0,                    atm_osc+2*%[mul]+%[pha]  " "\n\t"
    "add  r0,                    r18                  " "\n\t"
    "sts  atm_osc+2*%[mul]+%[pha],   r0                   " "\n\t"
    "lds  r18,                   atm_osc+2*%[mul]+%[fre]+1" "\n\t"
    "lds  r1,                    atm_osc+2*%[mul]+%[pha]+1" "\n\t"
    "adc  r1,                    r18                  " "\n\t"
    "sts  atm_osc+2*%[mul]+%[pha]+1, r1                   " "\n\t"

    "mov  r27,                   r1                   " "\n\t"
    "sbrc r27,                   7                    " "\n\t"
    "com  r27                                         " "\n\t"
    "lsl  r27                                         " "\n\t"
    "lds  r26,                   atm_osc+2*%[mul]+%[vol]  " "\n\t"
    "subi r27,                   128                  " "\n\t"
    "muls r27,                   r26                  " "\n\t"
    "lsl  r1                                          " "\n\t"
    "mov  r26,                   r1                   " "\n\t"

    "lds  r18,                   atm_osc+0*%[mul]+%[fre]  " "\n\t"
    "lds  r0,                    atm_osc+0*%[mul]+%[pha]  " "\n\t"
    "add  r0,                    r18                  " "\n\t"
    "sts  atm_osc+0*%[mul]+%[pha],   r0                   " "\n\t"
    "lds  r18,                   atm_osc+0*%[mul]+%[fre]+1" "\n\t"
    "lds  r1,                    atm_osc+0*%[mul]+%[pha]+1" "\n\t"
    "adc  r1,                    r18                  " "\n\t"
    "sts  atm_osc+0*%[mul]+%[pha]+1, r1                   " "\n\t"

    "mov  r18,                   r1                   " "\n\t"
    "lsl  r18                                         " "\n\t"
    "and  r18,                   r1                   " "\n\t"
    "lds  r27,                   atm_osc+0*%[mul]+%[vol]  " "\n\t"
    "sbrc r18,                   7                    " "\n\t"
    "neg  r27                                         " "\n\t"
    "add  r26,                   r27                  " "\n\t"

    "lds  r18,                   atm_osc+1*%[mul]+%[fre]  " "\n\t"
    "lds  r0,                    atm_osc+1*%[mul]+%[pha]  " "\n\t"
    "add  r0,                    r18                  " "\n\t"
    "sts  atm_osc+1*%[mul]+%[pha],   r0                   " "\n\t"
    "lds  r18,                   atm_osc+1*%[mul]+%[fre]+1" "\n\t"
    "lds  r1,                    atm_osc+1*%[mul]+%[pha]+1" "\n\t"
    "adc  r1,                    r18                  " "\n\t"
    "sts  atm_osc+1*%[mul]+%[pha]+1, r1                   " "\n\t"

    "lds  r27,                   atm_osc+1*%[mul]+%[vol]  " "\n\t"
    "sbrc r1,                    7                    " "\n\t"
    "neg  r27                                         " "\n\t"
    "add  r26,                   r27                  " "\n\t"

    "ldi  r27,                   1                    " "\n\t"
    "lds  r0,                    atm_osc+3*%[mul]+%[fre]  " "\n\t"
    "lds  r1,                    atm_osc+3*%[mul]+%[fre]+1" "\n\t"
    "add  r0,                    r0                   " "\n\t"
    "adc  r1,                    r1                   " "\n\t"
    "sbrc r1,                    7                    " "\n\t"
    "eor  r0,                    r27                  " "\n\t"
    "sbrc r1,                    6                    " "\n\t"
    "eor  r0,                    r27                  " "\n\t"
    "sts  atm_osc+3*%[mul]+%[fre],   r0                   " "\n\t"
    "sts  atm_osc+3*%[mul]+%[fre]+1, r1                   " "\n\t"

    "lds  r27,                   atm_osc+3*%[mul]+%[vol]  " "\n\t"
    "sbrc r1,                    7                    " "\n\t"
    "neg  r27                                         " "\n\t"
    "add  r26,                   r27                  " "\n\t"

    "lds  r27,                   atm_pcm              " "\n\t"
    "add  r26,                   r27                  " "\n\t"
    "sts  %[reg],                r26                  " "\n\t"

    "lds  r27,                   atm_cia_count+1      " "\n\t"
    "lds  r26,                   atm_cia_count        " "\n\t"
    "sbiw r26,                   1                    " "\n\t"
    "breq call_playroutine                            " "\n\t"
    "sts  atm_cia_count+1,       r27                  " "\n\t"
    "sts  atm_cia_count,         r26                  " "\n\t"
    "pop  r1                                          " "\n\t"
    "pop  r0                                          " "\n\t"
    "pop  r26                                         " "\n\t"
    "pop  r27                                         " "\n\t"
    "pop  r18                                         " "\n\t"
    "out  __SREG__,              r2                   " "\n\t"
    "pop  r2                                          " "\n\t"
    "reti                                             " "\n\t"
    "call_playroutine:                                " "\n\t"

    "lds  r27, atm_cia+1                              " "\n\t"
    "lds  r26, atm_cia                                " "\n\t"
    "sts  atm_cia_count+1,       r27                  " "\n\t"
    "sts  atm_cia_count,         r26                  " "\n\t"

    "sei                                              " "\n\t"
    "push r19                                         " "\n\t"
    "push r20                                         " "\n\t"
    "push r21                                         " "\n\t"
    "push r22                                         " "\n\t"
    "push r23                                         " "\n\t"
    "push r24                                         " "\n\t"
    "push r25                                         " "\n\t"
    "push r30                                         " "\n\t"
    "push r31                                         " "\n\t"

    "clr  r1                                          " "\n\t"
    "call ATM_playroutine                             " "\n\t"

    "pop  r31                                         " "\n\t"
    "pop  r30                                         " "\n\t"
    "pop  r25                                         " "\n\t"
    "pop  r24                                         " "\n\t"
    "pop  r23                                         " "\n\t"
    "pop  r22                                         " "\n\t"
    "pop  r21                                         " "\n\t"
    "pop  r20                                         " "\n\t"
    "pop  r19                                         " "\n\t"

    "pop  r1                                          " "\n\t"
    "pop  r0                                          " "\n\t"
    "pop  r26                                         " "\n\t"
    "pop  r27                                         " "\n\t"
    "pop  r18                                         " "\n\t"
    "out  __SREG__,              r2                   " "\n\t"
    "pop  r2                                          " "\n\t"
    "reti                                             " "\n\t"
    :
    : [reg] "M" _SFR_MEM_ADDR(OCR4A),
      [mul] "M" (sizeof(atm_osc_t)),
      [pha] "M" (offsetof(atm_osc_t, phase)),
      [fre] "M" (offsetof(atm_osc_t, freq)),
      [vol] "M" (offsetof(atm_osc_t, vol))
  );
}

static void atm_play(const uint8_t *song, bool loop) {
  TIMSK4 = 0;
  atm_song = song;
  atm_loop = loop;
  atm_load();
  TCCR4A = 0b01000010; // fast PWM on OC4A and its inverse: pins 13 and 5
  TCCR4B = 0b00000001; // 62500 Hz
  OCR4C = 0xFF;
  OCR4A = 0x80;
  TIMSK4 = 0b00000100;
}

// A tone takes over the square voice while a song plays, because Timer4 owns
// the speaker pins then. 0 Hz gives the voice back to the song.
static uint32_t atm_toneEnd;
static bool atm_tone(uint16_t hz, uint16_t ms) {
  if (!atm_song) return false;
  uint8_t sreg = SREG;
  cli();
  if (hz) {
    atm_active |= 0x02;
    atm_osc[1].freq = (uint32_t)hz * 65536 / 31250;
    atm_osc[1].vol = 32;
  } else {
    atm_active &= ~0x02;
    atm_osc[1].vol = 0;
  }
  SREG = sreg;
  atm_toneEnd = hz && ms ? millis() + ms : 0;
  return true;
}

// Ends a tone with a length. Called every frame.
static void atm_update() {
  if (atm_toneEnd && (int32_t)(millis() - atm_toneEnd) >= 0) {
    atm_toneEnd = 0;
    atm_tone(0, 0);
  }
}

#else

// No Timer4: the game loop runs the playroutine and plays one voice.
// atm_next uses microseconds from millis(), so it works on every chip.

static void atm_play(const uint8_t *song, bool loop) {
  atm_song = song;
  atm_loop = loop;
  atm_load();
  atm_next = millis() * 1000UL;
}

// Runs the ticks that are due. Returns the frequency to play in Hz, or 0.
static uint16_t atm_update() {
  if (!atm_song) return 0;
  uint32_t now = millis() * 1000UL;
  // ponytail: ticks run at most once per frame step, so notes land on 33 ms frames.
  for (uint8_t i = 0; i < 8 && atm_song && (int32_t)(now - atm_next) >= 0; i++) {
    ATM_playroutine();
#ifdef AB_HAS_POLY_EFFECTS
    if (atm_justResumed) { atm_justResumed = false; break; }
#endif
    atm_next += (uint32_t)atm_cia * 32; // atm_cia samples of 32 µs
  }
  if ((int32_t)(now - atm_next) > 0) atm_next = now; // do not catch up after a long pause
  if (!atm_song) return 0;
  for (uint8_t n = 0; n < 3; n++) {
    if (atm_osc[n].vol && atm_osc[n].freq) return (uint32_t)atm_osc[n].freq * 31250 >> 16;
  }
  return 0;
}

#endif
