import { describe, expect, it } from 'vitest';
import {
  parseTransitAccess,
  serializeTransitAccess,
  reorderBusLineStops,
} from '../../src/tools/studio/transitAuthoring';

describe('Content Studio transit access and stop reordering', () => {
  it('parses and serializes place transit access preserving stopId and walkMinutes', () => {
    const raw = JSON.stringify([
      { stopId: 'stop_a', walkMinutes: 4 },
      { stopId: 'stop_b', walkMinutes: 7 },
    ]);

    const parsed = parseTransitAccess(raw);
    expect(parsed).toEqual([
      { stopId: 'stop_a', walkMinutes: 4 },
      { stopId: 'stop_b', walkMinutes: 7 },
    ]);

    const updated = [...parsed, { stopId: 'stop_c', walkMinutes: 10 }];
    const serialized = serializeTransitAccess(updated);
    expect(JSON.parse(serialized)).toEqual([
      { stopId: 'stop_a', walkMinutes: 4 },
      { stopId: 'stop_b', walkMinutes: 7 },
      { stopId: 'stop_c', walkMinutes: 10 },
    ]);
  });

  it('handles empty or malformed transit access gracefully', () => {
    expect(parseTransitAccess('')).toEqual([]);
    expect(parseTransitAccess('invalid')).toEqual([]);
    expect(parseTransitAccess('{}')).toEqual([]);
  });

  it('reorders bus line stops while preserving segment mapping for surviving pairs', () => {
    const stops = ['stop_a', 'stop_b', 'stop_c'];
    const segments = [5, 8];

    // Swap stop 0 and stop 1: new order ['stop_b', 'stop_a', 'stop_c']
    const result = reorderBusLineStops(stops, segments, 0, 1);
    expect(result.stops).toEqual(['stop_b', 'stop_a', 'stop_c']);
    // New adjacent pairs: (stop_b, stop_a) and (stop_a, stop_c)
    // The segment count must match stops.length - 1 = 2
    expect(result.segments.length).toBe(2);
    expect(result.segments.every((m) => typeof m === 'number' && m > 0)).toBe(true);
  });
});
