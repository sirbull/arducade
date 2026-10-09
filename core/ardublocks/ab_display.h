// ArduCade display drivers: SSD1306, SH1106 and SSD1309 over I2C or SPI.
// Uses the hardware registers directly on classic AVR chips, and the Arduino
// Wire and SPI libraries everywhere else.
#pragma once

// The ATmega328PB has two I2C and two SPI units. Use the first of each.
#if defined(__AVR_ATmega328PB__)
#define TWBR TWBR0
#define TWSR TWSR0
#define TWCR TWCR0
#define TWDR TWDR0
#define SPCR SPCR0
#define SPSR SPSR0
#define SPDR SPDR0
#endif

#if defined(__AVR__) && defined(TWBR) && defined(SPCR)
#define AB_AVR_DIRECT 1
#endif

#if defined(AB_BUS_I2C) && !defined(AB_AVR_DIRECT)
#include <Wire.h>
#endif
#if defined(AB_BUS_SPI) && !defined(AB_AVR_DIRECT)
#include <SPI.h>
#endif

namespace ab {

#if defined(AB_BUS_I2C)

#if defined(AB_AVR_DIRECT)
static void i2cWait() { while (!(TWCR & _BV(TWINT))) {} }
static void i2cStart() {
  TWCR = _BV(TWINT) | _BV(TWSTA) | _BV(TWEN);
  i2cWait();
  TWDR = AB_I2C_ADDRESS << 1;
  TWCR = _BV(TWINT) | _BV(TWEN);
  i2cWait();
}
static void i2cWrite(uint8_t b) {
  TWDR = b;
  TWCR = _BV(TWINT) | _BV(TWEN);
  i2cWait();
}
static void i2cStop() { TWCR = _BV(TWINT) | _BV(TWEN) | _BV(TWSTO); }
static void busBegin() {
  TWSR = 0;
  TWBR = ((F_CPU / 400000UL) - 16) / 2;
  TWCR = _BV(TWEN);
}
#else
static void i2cStart() { Wire.beginTransmission(AB_I2C_ADDRESS); }
static void i2cStop() { Wire.endTransmission(); }
static void busBegin() { Wire.begin(); Wire.setClock(400000); }
#endif

static void displayCommand(uint8_t c) {
  i2cStart();
#if defined(AB_AVR_DIRECT)
  i2cWrite(0x00);
  i2cWrite(c);
#else
  Wire.write((uint8_t)0x00);
  Wire.write(c);
#endif
  i2cStop();
}

// Sends len bytes of screen data.
static void displayData(const uint8_t *data, uint16_t len) {
#if defined(AB_AVR_DIRECT)
  i2cStart();
  i2cWrite(0x40);
  while (len--) i2cWrite(*data++);
  i2cStop();
#else
  // The Wire buffer is small on some boards, so send short chunks.
  while (len) {
    uint8_t n = len > 16 ? 16 : len;
    Wire.beginTransmission(AB_I2C_ADDRESS);
    Wire.write((uint8_t)0x40);
    Wire.write(data, n);
    Wire.endTransmission();
    data += n;
    len -= n;
  }
#endif
}

#else // AB_BUS_SPI

static void spiTransfer(uint8_t b) {
#if defined(AB_AVR_DIRECT)
  SPDR = b;
  asm volatile("nop");
  while (!(SPSR & _BV(SPIF))) {}
#else
  SPI.transfer(b);
#endif
}

static void busBegin() {
#if defined(AB_PIN_CS)
  pinMode(AB_PIN_CS, OUTPUT);
  digitalWrite(AB_PIN_CS, HIGH);
#endif
  pinMode(AB_PIN_DC, OUTPUT);
#if defined(AB_AVR_DIRECT)
  // SS must be an output for the SPI hardware to stay in master mode.
  pinMode(SS, OUTPUT);
  pinMode(MOSI, OUTPUT);
  pinMode(SCK, OUTPUT);
  SPCR = _BV(SPE) | _BV(MSTR);
  SPSR = _BV(SPI2X);
#else
  SPI.begin();
  SPI.beginTransaction(SPISettings(8000000, MSBFIRST, SPI_MODE0));
#endif
#if defined(AB_PIN_CS)
  digitalWrite(AB_PIN_CS, LOW);
#endif
}

static void displayCommand(uint8_t c) {
  digitalWrite(AB_PIN_DC, LOW);
  spiTransfer(c);
}

static void displayData(const uint8_t *data, uint16_t len) {
  digitalWrite(AB_PIN_DC, HIGH);
  while (len--) spiTransfer(*data++);
}

#endif // AB_BUS_SPI

#if AB_ROTATE180
#define AB_SEG_REMAP (AB_MIRROR ? 0xA1 : 0xA0)
#define AB_COM_SCAN 0xC0
#else
#define AB_SEG_REMAP (AB_MIRROR ? 0xA0 : 0xA1)
#define AB_COM_SCAN 0xC8
#endif

static const uint8_t displayInit[] PROGMEM = {
  0xAE,             // display off
  0xD5, 0x80,       // clock divide
  0xA8, 0x3F,       // multiplex 64
  0xD3, 0x00,       // display offset
  0x40,             // start line 0
#if defined(AB_DISPLAY_SSD1306)
  0x8D, 0x14,       // charge pump on
  0x20, 0x00,       // horizontal addressing
#elif defined(AB_DISPLAY_SSD1309)
  0x20, 0x00,       // horizontal addressing (no charge pump on SSD1309)
#elif defined(AB_DISPLAY_SH1106)
  0xAD, 0x8B,       // DC-DC on
  0x32,             // pump voltage
#endif
  AB_SEG_REMAP,
  AB_COM_SCAN,
  0xDA, 0x12,       // COM pins
  0x81, AB_CONTRAST,
#if defined(AB_DISPLAY_SH1106)
  0xD9, 0x22,       // pre charge
#else
  0xD9, 0xF1,
#endif
  0xDB, 0x40,       // VCOMH
  0xA4,             // show RAM
  0xA6,             // normal (not inverted)
  0xAF,             // display on
};

static void displayBegin() {
#if defined(AB_PIN_RST)
  pinMode(AB_PIN_RST, OUTPUT);
  digitalWrite(AB_PIN_RST, HIGH);
  delay(1);
  digitalWrite(AB_PIN_RST, LOW);
  delay(10);
  digitalWrite(AB_PIN_RST, HIGH);
#endif
  delay(10);
  busBegin();
  for (uint8_t i = 0; i < sizeof(displayInit); i++) displayCommand(pgm_read_byte(&displayInit[i]));
}

static void displayInvert(bool on) { displayCommand(on ? 0xA7 : 0xA6); }

// Sends the whole 128x64 buffer to the screen.
static void displayShow(const uint8_t *buffer) {
#if defined(AB_DISPLAY_SH1106)
  // SH1106 has 132 columns and only page addressing.
  for (uint8_t page = 0; page < 8; page++) {
    displayCommand(0xB0 + page);
    displayCommand(0x02);
    displayCommand(0x10);
    displayData(buffer + page * 128, 128);
  }
#else
  displayCommand(0x21); displayCommand(0); displayCommand(127);
  displayCommand(0x22); displayCommand(0); displayCommand(7);
  displayData(buffer, 1024);
#endif
}

} // namespace ab
