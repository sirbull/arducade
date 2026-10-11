// ESPboy hardware adapter. Games retain the 1024-byte, 128x64 one-bit buffer.
// Requires Adafruit ST7735 and ST7789 Library (and its Library Manager dependencies).
#pragma once
#include <Wire.h>
#include <Adafruit_ST7735.h>
#include <ESP8266WiFi.h>

namespace ab {

static void espMcpWrite(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(AB_ESP_MCP_ADDRESS);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}
static uint8_t espMcpRead(uint8_t reg) {
  Wire.beginTransmission(AB_ESP_MCP_ADDRESS);
  Wire.write(reg);
  if (Wire.endTransmission() != 0) return 0xff;
  Wire.requestFrom((uint8_t)AB_ESP_MCP_ADDRESS, (uint8_t)1);
  return Wire.available() ? Wire.read() : 0xff;
}
static void espMcpBit(uint8_t reg, uint8_t pin, bool value) {
  reg += pin / 8;
  uint8_t bits = espMcpRead(reg), mask = 1 << (pin % 8);
  espMcpWrite(reg, value ? bits | mask : bits & ~mask);
}
static void espPinMode(int8_t pin, bool input) {
  if (pin < 0) return;
  if (pin < 64) { pinMode(pin, input ? INPUT_PULLUP : OUTPUT); return; }
  espMcpBit(0x00, pin - 64, input); // IODIR, BANK=0
  espMcpBit(0x0c, pin - 64, input); // GPPU
}
static void espPinWrite(int8_t pin, bool high) {
  if (pin < 0) return;
  if (pin < 64) digitalWrite(pin, high ? HIGH : LOW);
  else espMcpBit(0x14, pin - 64, high); // OLAT
}
static void espHardwareBegin() {
  WiFi.mode(WIFI_OFF);
  Wire.begin(AB_ESP_SDA, AB_ESP_SCL);
  Wire.setClock(400000);
  // MCP23017 powers up in BANK=0 with all pins as inputs.
#ifdef AB_PIN_CS
  espPinWrite(AB_PIN_CS, false);
  espPinMode(AB_PIN_CS, false);
#endif
}

#ifdef AB_PIN_RST
#define AB_ESP_RST AB_PIN_RST
#else
#define AB_ESP_RST -1
#endif
// MCP chip select is held low; this adapter owns the display SPI bus.
// ESP8266 hardware SPI claims MISO/GPIO12 and SS/GPIO15 too.
#define AB_ESP_SPI_CONFLICT(pin) ((pin) == 12 || (pin) == 15)
#if AB_ESP_MOSI == 13 && AB_ESP_SCK == 14 && \
    !AB_ESP_SPI_CONFLICT(AB_PIN_UP) && !AB_ESP_SPI_CONFLICT(AB_PIN_DOWN) && \
    !AB_ESP_SPI_CONFLICT(AB_PIN_LEFT) && !AB_ESP_SPI_CONFLICT(AB_PIN_RIGHT) && \
    !AB_ESP_SPI_CONFLICT(AB_PIN_A) && !AB_ESP_SPI_CONFLICT(AB_PIN_B) && \
    !AB_ESP_SPI_CONFLICT(AB_PIN_DC) && !AB_ESP_SPI_CONFLICT(AB_PIN_CS) && \
    !AB_ESP_SPI_CONFLICT(AB_PIN_RST) && !AB_ESP_SPI_CONFLICT(AB_PIN_SOUND1)
static Adafruit_ST7735 espTft(-1, AB_PIN_DC, AB_ESP_RST);
#else
static Adafruit_ST7735 espTft(-1, AB_PIN_DC, AB_ESP_MOSI, AB_ESP_SCK, AB_ESP_RST);
#endif
#undef AB_ESP_SPI_CONFLICT
static void displayBegin() {
  espTft.initR(INITR_144GREENTAB);
  espTft.setRotation(0);
  espTft.fillScreen(ST7735_BLACK);
#ifdef AB_ESP_DAC_ADDRESS
  // Volatile fast-mode write: do not wear the DAC EEPROM on every boot.
  const uint16_t level = (uint32_t)AB_CONTRAST * 4095 / 255;
  Wire.beginTransmission(AB_ESP_DAC_ADDRESS);
  Wire.write((uint8_t)(level >> 8));
  Wire.write((uint8_t)level);
  Wire.endTransmission();
#endif
}
static void displayInvert(bool on) { espTft.invertDisplay(on); }
static void displayShow(const uint8_t *buffer) {
  // Convert one row at a time. No full RGB framebuffer; no scaling.
  uint16_t row[128];
  espTft.startWrite();
  espTft.setAddrWindow(0, 32, 128, 64);
  for (uint8_t y = 0; y < 64; y++) {
    uint8_t sy = AB_ROTATE180 ? 63 - y : y;
    for (uint8_t x = 0; x < 128; x++) {
      uint8_t sx = (AB_ROTATE180 != AB_MIRROR) ? 127 - x : x;
      row[x] = buffer[(sy >> 3) * 128 + sx] & (1 << (sy & 7)) ? ST7735_WHITE : ST7735_BLACK;
    }
    espTft.writePixels(row, 128);
    // Keep the ESP8266 watchdog serviced, including custom software SPI wiring.
    if ((y & 7) == 7) yield();
  }
  espTft.endWrite();
}
} // namespace ab
