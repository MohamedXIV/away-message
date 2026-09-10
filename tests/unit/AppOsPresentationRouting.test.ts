import { describe, expect, it } from 'vitest';
import { resolveAppTheme } from '../../src/App';

describe('App OS presentation routing', () => {
  it('is null-safe for a fresh game with no installed OS', () => {
    expect(resolveAppTheme(null)).toBeNull();
  });

  it('delegates Orion presentation routing to the central resolver', () => {
    expect(resolveAppTheme('Orion_4.8')).toBe('orion48');
    expect(resolveAppTheme('Orion_5.0')).toBe('orion50');
    expect(resolveAppTheme('Orion_6.0')).toBe('orion60');
    expect(resolveAppTheme('Orion_7.0')).toBe('orion70');
  });
});
