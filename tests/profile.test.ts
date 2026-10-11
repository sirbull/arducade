import { describe, expect, it } from 'vitest';
import { BUILTIN_PROFILES, cloneProfile, createCustomProfile, hasErrors, parseProfile, profileToConfigH, serializeProfile, validateProfile } from '../src/hw/profile';

describe('hardware profiles', () => {
  it('accepts every preset and requires wiring for custom profiles', () => {
    for (const p of BUILTIN_PROFILES) expect(hasErrors(validateProfile(p))).toBe(false);
    const p = createCustomProfile();
    expect(p.builtin).toBeUndefined();
    expect(hasErrors(validateProfile(p))).toBe(true);
    p.buttons = { ...BUILTIN_PROFILES[1].buttons };
    expect(hasErrors(validateProfile(p))).toBe(false);
    expect(profileToConfigH(p)).not.toContain('AB_PIN_SOUND1');
  });
  it('preserves custom wiring through export/import and code generation', () => {
    const p = cloneProfile(BUILTIN_PROFILES[1], 'My device');
    p.buttons.up = 'D8';
    p.display.rst = 'D10';
    p.display.driver = 'ssd1309';
    const restored = parseProfile(serializeProfile(p));
    expect(restored).toEqual(p);
    const config = profileToConfigH(restored);
    expect(config).toContain('#define AB_PIN_UP 8');
    expect(config).toContain('#define AB_PIN_RST 10');
    expect(config).toContain('#define AB_DISPLAY_SSD1309 1');
  });
  it('rejects conflicts and invalid settings before generating code', () => {
    const p = cloneProfile(BUILTIN_PROFILES[1], 'Invalid');
    p.display.rst = 'A4';
    expect(validateProfile(p).some((i) => i.key === 'profile.pinBus')).toBe(true);
    expect(() => profileToConfigH(p)).toThrow('profile.hasErrors');
    p.display.rst = 'D2';
    expect(validateProfile(p).some((i) => i.key === 'profile.pinDuplicate')).toBe(true);
    p.display.rst = undefined;
    p.display.driver = 'bad' as typeof p.display.driver;
    expect(() => profileToConfigH(p)).toThrow();
    expect(() => parseProfile(serializeProfile(p))).toThrow('file.broken');
  });
});

describe('ESPboy profiles', () => {
  const preset = () => cloneProfile(BUILTIN_PROFILES.find((p) => p.id === 'espboy-original')!, 'Custom ESPboy');

  it('round trips mixed GPIO/MCP wiring and configurable buses', () => {
    const p = preset();
    p.buttons.a = 'MCP7';
    p.buttons.b = 'GPIO12';
    p.display.cs = 'MCP10';
    p.display.rst = 'GPIO15';
    p.espboy!.mcpAddress = 0x23;
    p.espboy!.dacAddress = undefined;
    p.espboy!.sda = 'GPIO2';
    expect(hasErrors(validateProfile(p))).toBe(false);
    expect(parseProfile(serializeProfile(p))).toEqual(JSON.parse(JSON.stringify(p)));
    const config = profileToConfigH(p);
    expect(config).toContain('#define AB_DISPLAY_ESPBOY 1');
    expect(config).toContain('#define AB_PIN_A 71');
    expect(config).toContain('#define AB_PIN_B 12');
    expect(config).toContain('#define AB_PIN_CS 74');
    expect(config).toContain('#define AB_ESP_SDA 2');
    expect(config).toContain('#define AB_ESP_MCP_ADDRESS 35');
    expect(config).not.toContain('AB_ESP_DAC_ADDRESS');
  });

  it('rejects bus collisions, invalid expanders and unsupported pin roles', () => {
    const bad = (edit: (p: ReturnType<typeof preset>) => void) => {
      const p = preset();
      edit(p);
      expect(hasErrors(validateProfile(p))).toBe(true);
      expect(() => profileToConfigH(p)).toThrow('profile.hasErrors');
      expect(() => parseProfile(serializeProfile(p))).toThrow('file.broken');
    };
    bad((p) => { p.buttons.a = 'GPIO4'; });
    bad((p) => { p.buttons.a = 'MCP8'; });
    bad((p) => { p.buttons.a = 'MCP16'; });
    bad((p) => { p.espboy!.sda = p.espboy!.scl; });
    bad((p) => { p.espboy!.mosi = 'GPIO6'; });
    bad((p) => { p.espboy!.mcpAddress = 0x30; });
    bad((p) => { p.espboy!.dacAddress = 0x50; });
    bad((p) => { p.display.dc = 'MCP9'; });
    bad((p) => { p.sound.pin1 = 'MCP9'; });
    bad((p) => { p.chip = 'atmega328p'; });
    bad((p) => { p.display.bus = 'i2c'; });
    bad((p) => { delete p.espboy; });
  });
});
