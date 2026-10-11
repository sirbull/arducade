// ESPboy hardware adapter. Games retain the 1024-byte, 128x64 one-bit buffer.
// Reference: ESPboy FirstTest ESPboyLibs_TFTeSPI; see the exported README.txt.
#pragma once
#include "ab_espboy_mcp.h"
#include <ESP8266WiFi.h>
#ifndef AB_PIN_RST
#define AB_ESP_RST -1
#else
#define AB_ESP_RST AB_PIN_RST
#endif
#if AB_ESP_USE_TFT_ESPI
#include <TFT_eSPI.h>
#if !defined(ARDUCADE_ESPBOY_SETUP) || !defined(ST7735_DRIVER) || !defined(ST7735_GREENTAB3) || \
    TFT_WIDTH != 128 || TFT_HEIGHT != 128 || TFT_DC != AB_PIN_DC || TFT_RST != AB_ESP_RST || \
    TFT_CS != -1 || TFT_MISO != -1 || TFT_MOSI != AB_ESP_MOSI || TFT_SCLK != AB_ESP_SCK || \
    SPI_FREQUENCY != 27000000 || defined(TFT_SPI_OVERLAP) || defined(TFT_BL)
#error "Copy the exported ESPboy_User_Setup.h to installed TFT_eSPI/User_Setup.h; see README.txt."
#endif
#else
#include <Adafruit_ST7735.h>
#endif

namespace ab {
static ESPboyMCP espMcp;
static void espPinMode(int8_t pin, bool input) {
  if (pin < 0) return;
  if (pin < 64) { pinMode(pin, input ? INPUT_PULLUP : OUTPUT); return; }
  espMcp.pinMode(pin - 64, input ? INPUT : OUTPUT);
  espMcp.pullUp(pin - 64, input ? HIGH : LOW);
}
static void espPinWrite(int8_t pin, bool high) {
  if (pin < 0) return;
  if (pin < 64) digitalWrite(pin, high ? HIGH : LOW);
  else espMcp.digitalWrite(pin - 64, high ? HIGH : LOW);
}
static void espHardwareBegin() {
  WiFi.mode(WIFI_OFF);
#ifdef AB_ESP_DAC_ADDRESS
  espMcp.begin(AB_ESP_SDA, AB_ESP_SCL, AB_ESP_MCP_ADDRESS, AB_ESP_DAC_ADDRESS);
  espMcp.writeDAC(0, false);
#else
  espMcp.begin(AB_ESP_SDA, AB_ESP_SCL, AB_ESP_MCP_ADDRESS);
#endif
#ifdef AB_PIN_CS
  espPinWrite(AB_PIN_CS, false);
  espPinMode(AB_PIN_CS, false);
#endif
}

// CS is held low through GPIO or MCP, as in the official ESPboy example.
#if AB_ESP_USE_TFT_ESPI
static TFT_eSPI espTft;
#else
// Custom SPI wiring: Adafruit supports software SPI on ESP8266.
static Adafruit_ST7735 espTft(-1, AB_PIN_DC, AB_ESP_MOSI, AB_ESP_SCK, AB_ESP_RST);
#endif
static void displayBegin() {
#if AB_ESP_USE_TFT_ESPI
  espTft.begin();
  espTft.setSwapBytes(true);
#else
  espTft.initR(INITR_144GREENTAB);
#endif
  espTft.setRotation(0);
  espTft.fillScreen(0);
#ifdef AB_ESP_DAC_ADDRESS
  // Volatile write, matching the reference's brightness API without EEPROM wear.
  espMcp.writeDAC((uint32_t)AB_CONTRAST * 4095 / 255, false);
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
      row[x] = buffer[(sy >> 3) * 128 + sx] & (1 << (sy & 7)) ? 0xffff : 0x0000;
    }
#if AB_ESP_USE_TFT_ESPI
    espTft.pushPixels(row, 128);
#else
    espTft.writePixels(row, 128);
#endif
    // Keep the ESP8266 watchdog serviced, including custom software SPI wiring.
    if ((y & 7) == 7) yield();
  }
  espTft.endWrite();
}
} // namespace ab
