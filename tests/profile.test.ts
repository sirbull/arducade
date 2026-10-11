import { describe, expect, it } from 'vitest';
import { newProject, parseProject, serializeProject } from '../src/project/model';
import { DEVELOPMENT_BOARDS, configurationMode, profileChip, withBoardDefaults, withMicrocontrollerMode, hardwareChanges, BUILTIN_PROFILES, cloneProfile, createCustomProfile, hasErrors, parseProfile, profileToConfigH, serializeProfile, validateProfile } from '../src/hw/profile';

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

describe('board configuration metadata', () => {
  it('keeps legacy profiles in manual mode without guessing or resetting pins', () => {
    const p = cloneProfile(BUILTIN_PROFILES[0], 'Legacy');
    p.buttons.a = 'D10';
    const loaded = parseProfile(serializeProfile(p));
    expect(configurationMode(loaded)).toBe('microcontroller');
    expect(loaded.boardId).toBeUndefined();
    expect(loaded).toEqual(p);
  });
  it('uses known board clocks and defaults and preserves unrelated screen preferences', () => {
    const p = createCustomProfile();
    expect(configurationMode(p)).toBe('board');
    p.display.mirror = true;
    p.display.contrast = 42;
    for (const id of ['promicro-16', 'promicro-8', 'leonardo', 'micro', 'nano', 'uno-r3', 'arduboy-devkit', 'itsybitsy-16', 'itsybitsy-8', 'espboy-original']) {
      const board = DEVELOPMENT_BOARDS.find(b => b.id === id)!;
      const next = withBoardDefaults(p, id);
      expect(next.chip).toBe(board.chip);
      expect(next.clockHz).toBe(board.clockHz);
      expect(next.display.mirror).toBe(true);
      expect(next.display.contrast).toBe(42);
      expect(hasErrors(validateProfile(next))).toBe(false);
      expect(parseProfile(serializeProfile(next))).toEqual(next);
      expect(profileToConfigH(next)).toContain(`#define AB_CPU_HZ ${board.clockHz}`);
    }
    const devkit = withBoardDefaults(p, 'arduboy-devkit');
    expect(devkit.display.cs).toBe('D6');
    expect(devkit.sound).toEqual({ pin1: 'A2' });
    expect(profileChip(withBoardDefaults(p, 'promicro-8')).browserCompile).toBe(false);
    expect(profileChip(withBoardDefaults(p, 'promicro-16')).browserCompile).toBe(true);
    expect(profileChip(withBoardDefaults(p, 'uno-r3')).fqbn).toBe('arduino:avr:uno');
  });
  it('preserves custom hardware when switching to manual mode', () => {
    const p = withBoardDefaults(createCustomProfile(), 'promicro-8');
    p.buttons.up = 'D0';
    const next = withMicrocontrollerMode(p);
    expect(hardwareChanges(p, next)).toEqual([]);
    expect(next.buttons).toEqual(p.buttons);
    expect(next.clockHz).toBe(8000000);
    expect(next.boardId).toBeUndefined();
    expect(profileChip(next).browserCompile).toBe(false);
    expect(profileToConfigH(next)).toBe(profileToConfigH(p));
  });
  it('reports the changes that overwrite wiring without mutating the input', () => {
    const p = withBoardDefaults(createCustomProfile(), 'promicro-16');
    p.buttons.up = 'D0';
    const next = withBoardDefaults(p, 'promicro-16');
    expect(hardwareChanges(p, next)).toEqual(['buttons']);
    expect(p.buttons.up).toBe('D0');
    expect(next.buttons.up).toBe('A0');
  });
  it('rejects contradictory targets and unavailable board pins', () => {
    const p = withBoardDefaults(createCustomProfile(), 'promicro-16');
    p.buttons.up = 'D12';
    expect(validateProfile(p).some(i => i.key === 'profile.pinUnknown')).toBe(true);
    p.clockHz = 8000000;
    expect(validateProfile(p).some(i => i.key === 'profile.invalidTarget')).toBe(true);
    expect(() => parseProfile(serializeProfile(p))).toThrow('file.broken');
    p.clockHz = 16000000; p.chip = 'atmega328p';
    expect(() => profileToConfigH(p)).toThrow('profile.hasErrors');
  });
  it('disables audio without discarding wiring or requiring speaker validation', () => {
    const p = cloneProfile(BUILTIN_PROFILES[0], 'Silent');
    p.sound = { enabled: false, pin1: 'A0', pin2: 'invalid' };
    expect(hasErrors(validateProfile(p))).toBe(false);
    expect(profileToConfigH(p)).not.toContain('AB_PIN_SOUND');
    expect(parseProfile(serializeProfile(p)).sound).toEqual(p.sound);
    p.sound.enabled = true;
    expect(hasErrors(validateProfile(p))).toBe(true);
  });
  it('detects bus aliases, output restrictions and SPI input conflicts', () => {
    const p = cloneProfile(BUILTIN_PROFILES[0], 'SPI');
    p.buttons.up = 'D16';
    expect(validateProfile(p).some(i => i.key === 'profile.pinBus')).toBe(true);
    p.buttons.up = 'D17';
    expect(validateProfile(p).some(i => i.key === 'profile.pinUnknown' || i.key === 'profile.pinSpiSs')).toBe(true);
    const esp = withMicrocontrollerMode(withBoardDefaults(createCustomProfile(), 'esp32'));
    esp.sound.pin1 = 'GPIO34';
    expect(validateProfile(esp).some(i => i.key === 'profile.pinInputOnly')).toBe(true);
  });
});

it('preserves board metadata and disabled audio in saved projects', () => {
  const p = withBoardDefaults(createCustomProfile(), 'promicro-8');
  p.sound.enabled = false;
  const loaded = parseProject(serializeProject(newProject('Hardware', p)));
  expect(loaded.profile).toEqual(p);
  const legacy = newProject('Legacy', cloneProfile(BUILTIN_PROFILES[0], 'Old'));
  expect(configurationMode(parseProject(serializeProject(legacy)).profile)).toBe('microcontroller');
});
