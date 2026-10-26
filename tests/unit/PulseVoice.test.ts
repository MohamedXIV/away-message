import { describe, expect, it } from 'vitest';
import type { CharacterTraits } from '../../src/engine/types';
import {
  pulseVoiceFor, realizePulseReply, formatPulseNewsLine,
} from '../../src/simulation/host/PulseVoice';
import { pulseOutreachOptions } from '../../src/simulation/host/PulseOutreachContent';

const reserved: CharacterTraits = { shyness: 97, warmth: 22, discipline: 30, spontaneity: 8, loyalty: 45 };
const bright: CharacterTraits = { shyness: 5, warmth: 46, discipline: 12, spontaneity: 99, loyalty: 40 };
const gentle: CharacterTraits = { shyness: 29, warmth: 100, discipline: 24, spontaneity: 38, loyalty: 92 };
const direct: CharacterTraits = { shyness: 23, warmth: 19, discipline: 98, spontaneity: 15, loyalty: 65 };

describe('#223 character-specific offline Pulse realization', () => {
  it('derives a stable voice from canonical fixed actor traits', () => {
    expect([reserved, bright, gentle, direct].map(pulseVoiceFor))
      .toEqual(['reserved', 'bright', 'gentle', 'direct']);
    expect(pulseVoiceFor({ ...reserved })).toBe('reserved');
  });

  it('makes the same Ink-authored meaning sound distinct without changing claims', () => {
    const ink = "It was a long shift, but I'm doing okay. Thanks for asking.";
    const variants = [reserved, bright, gentle, direct].map(traits => realizePulseReply(ink, traits));
    expect(new Set(variants).size).toBe(4);
    for (const line of variants) {
      expect(line).toMatch(/long shift/i);
      expect(line).toMatch(/doing okay/i);
      expect(line).toMatch(/thanks for asking/i);
    }
    expect(realizePulseReply('A specific authored clue.', bright))
      .toBe('A specific authored clue.');
  });

  it('uses one actor voice across outreach topics without inventing private experiences', () => {
    const motives = ['hello', 'remote', 'shift', 'shared', 'promise'] as const;
    for (const motive of motives) {
      const lines = [reserved, bright, gentle, direct]
        .map(traits => pulseOutreachOptions(motive, traits)[0]);
      expect(new Set(lines).size).toBe(4);
      expect(lines.every(text => typeof text === 'string' && text.length > 8)).toBe(true);
    }
    expect(pulseOutreachOptions('hello', reserved)).toEqual(pulseOutreachOptions('hello', { ...reserved }));
  });

  it('frames World-owned news according to that actor's recorded attitude', () => {
    const title = 'Canal Bridge Night Market announced';
    const guarded = formatPulseNewsLine(title, 'skeptical', reserved);
    const upbeat = formatPulseNewsLine(title, 'hyped', bright);
    expect(guarded).toContain(title);
    expect(guarded).toContain('not convinced');
    expect(upbeat).toContain(title);
    expect(upbeat).toContain('looking forward');
    expect(guarded).not.toBe(upbeat);
    expect(guarded.length).toBeLessThanOrEqual(240);
  });
});
