import { describe, expect, it } from 'vitest';
import { STATIC_OS_CATALOG } from '../../src/engine/OsCatalog';
import {
  getOsPresentationProfile,
  resolveActiveOsPresentation,
  resolveWindowTransition,
} from '../../src/desktop/host/OsPresentation';

describe('central Orion presentation resolver', () => {
  it('resolves every canonical Orion release through one presentation profile contract', () => {
    for (const release of STATIC_OS_CATALOG) {
      const profile = getOsPresentationProfile(release.id);
      expect(profile.themeId).toBe(release.theme);
      expect(profile.uiFontStack.length).toBeGreaterThan(0);
      expect(profile.titlebar.fontStack.length).toBeGreaterThan(0);
      expect(profile.window.chromeId.length).toBeGreaterThan(0);
      expect(profile.window.animation.open.length).toBeGreaterThan(0);
      expect(profile.soundSchemeId.length).toBeGreaterThan(0);
    }
  });

  it('keeps patches in their authored OS theme family instead of branching on version strings', () => {
    expect(getOsPresentationProfile('Orion_6.1').themeId).toBe('orion60');
    expect(getOsPresentationProfile('Orion_7.0.1').themeId).toBe('orion70');
  });

  it('does not expose a running Orion presentation when no OS is installed', () => {
    expect(resolveActiveOsPresentation(null)).toBeNull();
    expect(resolveActiveOsPresentation('Orion_5.0')?.capabilities).toEqual(
      getOsPresentationProfile('Orion_5.0').capabilities,
    );
  });

  it('deterministically collapses OS window transitions when reduced motion is requested', () => {
    const profile = getOsPresentationProfile('Orion_7.0');

    expect(resolveWindowTransition(profile, 'open', false)).toBe('gloss-zoom');
    expect(resolveWindowTransition(profile, 'minimize', false)).toBe('fade-collapse');
    expect(resolveWindowTransition(profile, 'open', true)).toBe('snap');
    expect(resolveWindowTransition(profile, 'minimize', true)).toBe('snap');
  });
});
