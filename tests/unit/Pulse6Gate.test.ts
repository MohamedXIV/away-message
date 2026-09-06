import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { pulseHasFeature, comparePulseVersions } from '../../src/engine/PulseCatalog';
import { buddySignatureColor } from '../../src/engine/characterTemplates';
import { tokenizeEmoticons } from '../../src/apps/pulse/utils/emoticonParser';

describe('Pulse 6 generation gate', () => {
  it('unlocks colors + motion only on 6.x releases', () => {
    expect(pulseHasFeature('pulse_5.2', 'buddy-colors')).toBe(false);
    expect(pulseHasFeature('pulse_5.3', 'animated-emoticons')).toBe(false);
    expect(pulseHasFeature('pulse_6.0-beta', 'buddy-colors')).toBe(true);
    expect(pulseHasFeature('pulse_6.0', 'buddy-colors')).toBe(true);
    expect(pulseHasFeature('pulse_6.0.1', 'animated-emoticons')).toBe(true);
    expect(pulseHasFeature('pulse_9.9', 'buddy-colors')).toBe(false);
    expect(pulseHasFeature(undefined, 'buddy-colors')).toBe(false);
  });

  it('keeps version comparison intact (regression guard)', () => {
    expect(comparePulseVersions('6.0', '5.3')).toBeGreaterThan(0);
    expect(comparePulseVersions('5.2', '5.2')).toBe(0);
  });

  it('assigns fixed signature colors (core) and archetype colors (procedural)', () => {
    expect(buddySignatureColor('maya', 'artist')).toBe('#6a3fa0');
    expect(buddySignatureColor('ryan', 'coworker')).toBe('#d96c3b');
    expect(buddySignatureColor('sam_guitar', 'artist')).toBe(buddySignatureColor('june_tape', 'artist'));
    expect(buddySignatureColor('sam_guitar', 'artist')).not.toBe(buddySignatureColor('leo_grill', 'coworker'));
  });

  it('parses Pulse 6 animated emoticons only behind the gate', () => {
    const gated = tokenizeEmoticons('hey (:lol:)', false, false);
    expect(gated.some((t) => t.type === 'emoticon')).toBe(false);
    const open = tokenizeEmoticons('hey (:lol:)', false, true);
    const emo = open.find((t) => t.type === 'emoticon');
    expect(emo?.glyph).toBe('🤣');
    expect(emo?.animated).toBe(true);
    // Classics work everywhere
    expect(tokenizeEmoticons(':)', false, false).some((t) => t.type === 'emoticon')).toBe(true);
  });

  it(' fresh engine reads Pulse 5.x (no colors, no motion)', () => {
    const engine = new SimulationEngine();
    expect(engine.isPulse6()).toBe(false);
    expect(engine.pulse.getCurrentPulseId()).toBe('pulse_5.2');
  });
});
