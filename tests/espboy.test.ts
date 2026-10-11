import { describe, expect, it } from 'vitest';
import { BUILTIN_PROFILES, cloneProfile, espboyUsesTftESPI } from '../src/hw/profile';
import { sketchFiles } from '../src/project/sketch';
import { newProject } from '../src/project/model';
import { compileProject } from './helpers';
import { TEMPLATE_SOURCES, templateToProject } from '../src/templates';

describe('ESPboy sketch and simulator', () => {
  it('exports the hardware adapter and setup instructions with the game', () => {
    const project = newProject('ESPboy game');
    project.profile = cloneProfile(BUILTIN_PROFILES.find((p) => p.id === 'espboy-diy')!, 'My ESPboy');
    const files = sketchFiles(project, compileProject(project).cpp.code);
    expect(files['ab_config.h']).toContain('#define AB_DISPLAY_ESPBOY 1');
    expect(files['ab_config.h']).not.toContain('AB_ESP_DAC_ADDRESS');
    expect(files['ab_espboy.h']).toContain('namespace ab');
    expect(files['README.txt']).toContain('TFT_eSPI 2.5.43');
    expect(files['ESPboy_User_Setup.h']).toContain('#define ST7735_GREENTAB3');
    expect(files['ab_espboy_mcp.h']).toContain('fbd4393d46d47242315ab373d24e0aa72e1764db');
    project.profile = BUILTIN_PROFILES[0];
    expect(sketchFiles(project, compileProject(project).cpp.code)['README.txt']).toBeUndefined();
  });

  it('exports custom I2C, buttons, DC and reset while retaining the reference SPI backend', () => {
    const project = newProject('Custom ESPboy');
    const p = project.profile = cloneProfile(BUILTIN_PROFILES.find((p) => p.id === 'espboy-original')!, 'Custom');
    p.espboy!.sda = 'GPIO2'; p.espboy!.scl = 'GPIO4'; p.espboy!.mcpAddress = 0x21; p.espboy!.dacAddress = 0x61;
    p.display.dc = 'GPIO5'; p.display.rst = 'GPIO16'; p.buttons.a = 'MCP9';
    const files = sketchFiles(project, compileProject(project).cpp.code);
    expect(files['ab_config.h']).toContain('#define AB_ESP_SDA 2');
    expect(files['ab_config.h']).toContain('#define AB_ESP_MCP_ADDRESS 33');
    expect(files['ab_config.h']).toContain('#define AB_ESP_DAC_ADDRESS 97');
    expect(files['ab_config.h']).toContain('#define AB_PIN_A 73');
    expect(files['ESPboy_User_Setup.h']).toContain('#define TFT_DC 5');
    expect(files['ESPboy_User_Setup.h']).toContain('#define TFT_RST 16');
    expect(files['README.txt']).toContain('MCP 0x21');
  });

  it('selects software SPI for custom bus pins or hardware SPI pin conflicts', () => {
    const project = newProject('Custom ESPboy');
    const p = project.profile = cloneProfile(BUILTIN_PROFILES.find((p) => p.id === 'espboy-diy')!, 'Custom');
    expect(espboyUsesTftESPI(p)).toBe(true);
    p.espboy!.mosi = 'GPIO12'; p.espboy!.sck = 'GPIO15';
    let files = sketchFiles(project, compileProject(project).cpp.code);
    expect(files['ab_config.h']).toContain('#define AB_ESP_USE_TFT_ESPI 0');
    expect(files['README.txt']).toContain('Adafruit ST7735');
    expect(files['ESPboy_User_Setup.h']).toBeUndefined();
    p.espboy!.mosi = 'GPIO13'; p.espboy!.sck = 'GPIO14'; p.buttons.a = 'GPIO12';
    files = sketchFiles(project, compileProject(project).cpp.code);
    expect(files['ab_config.h']).toContain('#define AB_ESP_USE_TFT_ESPI 0');
    p.buttons.a = 'MCP4'; p.sound.pin1 = 'GPIO15'; p.sound.enabled = false;
    expect(espboyUsesTftESPI(p)).toBe(true);
  });

  it('preserves generated simulator game behavior for existing templates', () => {
    for (const template of TEMPLATE_SOURCES) {
      const project = templateToProject(template);
      const original = compileProject(project);
      project.profile = BUILTIN_PROFILES.find((p) => p.id === 'espboy-original')!;
      const espboy = compileProject(project);
      expect(espboy.js.code).toBe(original.js.code);
      expect(espboy.cpp.code).toBe(original.cpp.code);
    }
  });
});
