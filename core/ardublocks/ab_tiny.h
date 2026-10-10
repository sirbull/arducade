// Just enough of the Arduino core for the ATtiny85, so a game fits in 8 KB.
// Arduino pin n is PBn. Timer0 counts milliseconds, Timer1 plays tones.
#pragma once

#include <avr/interrupt.h>
#include <avr/io.h>
#include <avr/pgmspace.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define LOW 0
#define HIGH 1
#define INPUT 0
#define OUTPUT 1
#define INPUT_PULLUP 2
#define constrain(v, lo, hi) ((v) < (lo) ? (lo) : (v) > (hi) ? (hi) : (v))

static void pinMode(uint8_t pin, uint8_t mode) {
  uint8_t bit = 1 << pin;
  if (mode == OUTPUT) { DDRB |= bit; return; }
  DDRB &= ~bit;
  if (mode == INPUT_PULLUP) PORTB |= bit;
  else PORTB &= ~bit;
}

static void digitalWrite(uint8_t pin, uint8_t v) {
  if (v) PORTB |= 1 << pin;
  else PORTB &= ~(1 << pin);
}

static uint8_t digitalRead(uint8_t pin) { return (PINB >> pin) & 1; }

static volatile uint32_t abMillis;
ISR(TIMER0_COMPA_vect) { abMillis++; }

static uint32_t millis() {
  uint8_t s = SREG;
  cli();
  uint32_t m = abMillis;
  SREG = s;
  return m;
}

// ponytail: only used to seed the random numbers, so the timer count will do.
static uint32_t micros() { return TCNT0; }

static void delay(uint32_t ms) {
  uint32_t start = millis();
  while (millis() - start < ms) {}
}

// Square wave from a Timer1 interrupt. ms 0 plays until noTone().
static uint8_t toneBit;
static volatile uint32_t toneToggles;

static void noTone(uint8_t) {
  TIMSK &= ~_BV(OCIE1A);
  PORTB &= ~toneBit;
}

ISR(TIMER1_COMPA_vect) {
  PINB = toneBit; // Writing a 1 to PINB toggles the pin.
  if (toneToggles && !--toneToggles) noTone(0);
}

static void tone(uint8_t pin, uint16_t freq, uint32_t ms = 0) {
  // Two toggles per period. Timer1 counts F_CPU / 2^(cs - 1) and restarts at OCR1C.
  uint32_t top = F_CPU / 2 / freq;
  uint8_t cs = 1;
  while (top > 256 && cs < 15) { top >>= 1; cs++; }
  if (top > 256) top = 256;
  if (!top) top = 1;
  TIMSK &= ~_BV(OCIE1A);
  toneBit = 1 << pin;
  TCCR1 = _BV(CTC1) | cs;
  OCR1C = OCR1A = top - 1;
  TCNT1 = 0;
  uint32_t toggles = 2UL * freq * ms / 1000;
  toneToggles = ms ? (toggles ? toggles : 1) : 0;
  TIMSK |= _BV(OCIE1A);
}

void setup();
void loop();

int main() {
  // Run at the full 8 MHz even when the CKDIV8 fuse is still set (the factory default).
  CLKPR = _BV(CLKPCE);
  CLKPR = 0;
#ifdef AB_OSCCAL
  // The internal oscillator can be up to 10 % off. Tune it per chip if timing matters.
  OSCCAL = AB_OSCCAL;
#endif
  TCCR0A = _BV(WGM01);
  TCCR0B = _BV(CS01) | _BV(CS00);
  OCR0A = F_CPU / 64 / 1000 - 1;
  TIMSK |= _BV(OCIE0A);
  sei();
  setup();
  for (;;) loop();
}
