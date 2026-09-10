import { describe, it, expect } from 'vitest';
import { sanitizeItems, type ReplySuggestionItem } from '../../src/apps/pulse/hooks/useReplySuggestions';
import { chipToneClasses } from '../../src/apps/pulse/components/ReplyChips';

describe('Reply tone colour-coding + battery prices', () => {
  it('sanitizes AI output into capped priced items', () => {
    const items = sanitizeItems([
      { text: '  hey there  ', tone: 'warm', degree: 1, cost: 2 },
      { text: '', tone: 'hot', degree: 2, cost: 45 },
      null,
      { text: 'x'.repeat(200), tone: 'weird', degree: 9, cost: -5 },
      { text: 'fourth', tone: 'normal', degree: 0, cost: 1 },
    ] as unknown as ReplySuggestionItem[]);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ text: 'hey there', tone: 'warm', degree: 1, cost: 2 });
    expect(items[1]).toMatchObject({ tone: 'normal', degree: 2, cost: 0 });
    expect(items[1]!.text).toHaveLength(120);
  });

  it('maps tones to distinct colour families', () => {
    const normal = chipToneClasses('normal', 0);
    const warm = chipToneClasses('warm', 1);
    const flirty = chipToneClasses('flirty', 1);
    const hot = chipToneClasses('hot', 2);
    const cold = chipToneClasses('cold', 1);
    expect(warm).toContain('green');
    expect(flirty).toContain('pink');
    expect(hot).toContain('rose');
    expect(cold).toContain('sky');
    expect(normal).toContain('purple');
    // Hotter degree = stronger treatment
    expect(chipToneClasses('flirty', 2)).not.toBe(flirty);
    expect(chipToneClasses('flirty', 2)).toContain('font-semibold');
  });
});
