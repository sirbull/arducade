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
