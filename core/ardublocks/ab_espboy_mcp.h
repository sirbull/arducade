// Adapted from ESPboy FirstTest ESPboyMCP by RomanS.
// Source commit: fbd4393d46d47242315ab373d24e0aa72e1764db
// Changes: header-only; configurable buses/addresses; optional DAC; safe failed reads.
#pragma once
/*
ESPboyMCP class
for www.ESPboy.com project by RomanS
https://hackaday.io/project/164830-espboy-games-iot-stem-for-education-fun
v1.0
*/

#ifndef ESPboy_MCP
#define ESPboy_MCP

#include <Arduino.h>
#include <Wire.h>


class ESPboyMCP{

protected:
  uint8_t mcpAddress = 0x20, dacAddress = 0;
  bool detectedDAC = false;
  bool readyDAC();
  uint8_t readRegister      (const uint8_t address, uint8_t addr);
  uint8_t writeRegisterMode (const uint8_t address, uint16_t value, uint8_t reg);
  void writeRegister        (const uint8_t address, uint8_t regAddr, uint8_t regValue);
  void updateRegisterBit    (const uint8_t address, uint8_t pin, uint8_t pValue, uint8_t portAaddr, uint8_t portBaddr);
public:
  void begin(uint8_t sda, uint8_t scl, uint8_t mcp, uint8_t dac = 0);
  int8_t writeDAC(uint16_t value, const bool eeprom);
  void pinMode(uint8_t p, uint8_t d);
  void pullUp(uint8_t p, uint8_t d);
  void digitalWrite(uint8_t pin, uint8_t d);
  uint16_t readGPIOAB();
};

#endif
/*
ESPboyMCP class
for www.ESPboy.com project by RomanS
https://hackaday.io/project/164830-espboy-games-iot-stem-for-education-fun
v1.0
*/


inline void ESPboyMCP::begin(uint8_t sda, uint8_t scl, uint8_t mcp, uint8_t dac) {
  mcpAddress = mcp; dacAddress = dac;
	Wire.begin(sda, scl);
    Wire.setClock(400000);
	writeRegister(mcpAddress, 0x00,0xff);
	writeRegister(mcpAddress, 0x01,0xff);
	detectedDAC = false;
    if (dacAddress) {
      Wire.beginTransmission(dacAddress);
      detectedDAC = !Wire.endTransmission();
    }
}


inline bool ESPboyMCP::readyDAC(){
  yield();
  uint8_t readed = readRegister(dacAddress, 1);
  return ((readed & 0x80) > 0);
}


inline int8_t ESPboyMCP::writeDAC(uint16_t value, const bool eeprom = 0) {
  if(!detectedDAC) return 0;
  if(eeprom && !readyDAC()) return -1;
  if (value > 4095) value = 4095;
  writeRegisterMode(dacAddress, value, eeprom ? 0x60 : 0x40);
  return 1;
}

inline uint8_t ESPboyMCP::writeRegisterMode(const uint8_t address, uint16_t value, uint8_t reg){
  uint8_t h = (value / 16);
  uint8_t l = (value & 0x0F) << 4;
  Wire.beginTransmission(address);
  Wire.write(reg);
  Wire.write(h);
  Wire.write(l);
  return Wire.endTransmission();
}


inline uint8_t ESPboyMCP::readRegister(const uint8_t address, uint8_t addr){
	Wire.beginTransmission(address);
	Wire.write(addr);
	if (Wire.endTransmission() != 0) return 0xff;
	Wire.requestFrom(address, (const uint8_t)1);
	return Wire.available() ? Wire.read() : 0xff;
}


inline void ESPboyMCP::writeRegister(const uint8_t address, uint8_t regAddr, uint8_t regValue){
	// Write the register
	Wire.beginTransmission(address);
	Wire.write(regAddr);
	Wire.write(regValue);
	Wire.endTransmission();
}

inline void ESPboyMCP::updateRegisterBit(const uint8_t address, uint8_t pin, uint8_t pValue, uint8_t portAaddr, uint8_t portBaddr){
	uint8_t regValue;
	uint8_t regAddr=(pin<8)?portAaddr:portBaddr;
	uint8_t bit=pin%8;
	regValue = readRegister(address, regAddr);
	bitWrite(regValue,bit,pValue);
	writeRegister(address, regAddr,regValue);
}

inline void ESPboyMCP::pinMode(uint8_t p, uint8_t d) {
	updateRegisterBit(mcpAddress, p,(d==INPUT), 0x00, 0x01);
}

inline void ESPboyMCP::pullUp(uint8_t p, uint8_t d) {
	updateRegisterBit(mcpAddress, p, d, 0x0C, 0x0D);
}

inline void ESPboyMCP::digitalWrite(uint8_t pin, uint8_t d) {
	uint8_t gpio;
	uint8_t bit=pin%8;
	uint8_t regAddr=(pin<8)?0x14:0x15;
	gpio = readRegister(mcpAddress, regAddr);
	bitWrite(gpio,bit,d);
	regAddr=(pin<8)?0x12:0x13;
	writeRegister(mcpAddress, regAddr, gpio);
}

inline uint16_t ESPboyMCP::readGPIOAB() {
	uint16_t ba = 0;
	uint8_t a;
	Wire.beginTransmission(mcpAddress);
	Wire.write(0x12);
	if (Wire.endTransmission() != 0) return 0xffff;
	Wire.requestFrom(mcpAddress, (uint8_t)2);
    if (Wire.available() < 2) return 0xffff;
	a = Wire.read();
	ba = Wire.read();
	ba <<= 8;
	ba |= a;
	return ba;
}
