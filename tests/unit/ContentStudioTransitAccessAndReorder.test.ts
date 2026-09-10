import { describe, expect, it } from 'vitest';
import {
  parseTransitAccess,
  serializeTransitAccess,
  reorderBusLineStops,
  removeBusLineStop,
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

  it('does not silently clamp invalid walkMinutes so validation can report it', () => {
    const rawWithInvalid = [
      { stopId: 'stop_a', walkMinutes: 0 },
      { stopId: 'stop_b', walkMinutes: -3 },
    ];
    const serialized = serializeTransitAccess(rawWithInvalid);
    expect(JSON.parse(serialized)).toEqual([
      { stopId: 'stop_a', walkMinutes: 0 },
      { stopId: 'stop_b', walkMinutes: -3 },
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

  it('removes bus line stop and correctly updates segment durations', () => {
    const stops = ['stop_a', 'stop_b', 'stop_c', 'stop_d'];
    const segments = [5, 8, 12];

    // Remove first stop (index 0): drops segment 0 (A->B duration), keeping B->C and C->D
    const removedFirst = removeBusLineStop(stops, segments, 0);
    expect(removedFirst.stops).toEqual(['stop_b', 'stop_c', 'stop_d']);
    expect(removedFirst.segments).toEqual([8, 12]);

    // Remove last stop (index 3): drops last segment (C->D duration), keeping A->B and B->C
    const removedLast = removeBusLineStop(stops, segments, 3);
    expect(removedLast.stops).toEqual(['stop_a', 'stop_b', 'stop_c']);
    expect(removedLast.segments).toEqual([5, 8]);

    // Remove middle stop (index 1: stop_b): merges A->B (5) and B->C (8) into A->C (13), keeping C->D (12)
    const removedMiddle = removeBusLineStop(stops, segments, 1);
    expect(removedMiddle.stops).toEqual(['stop_a', 'stop_c', 'stop_d']);
    expect(removedMiddle.segments).toEqual([13, 12]);

    // Remove stop when only 2 remain -> 1 stop left, 0 segments
    const twoStops = ['stop_a', 'stop_b'];
    const oneSeg = [7];
    const removedToSingle = removeBusLineStop(twoStops, oneSeg, 0);
    expect(removedToSingle.stops).toEqual(['stop_b']);
    expect(removedToSingle.segments).toEqual([]);

    // Out of bounds removeIndex returns unchanged copy
    const outOfBounds = removeBusLineStop(stops, segments, 99);
    expect(outOfBounds.stops).toEqual(stops);
    expect(outOfBounds.segments).toEqual(segments);
  });
});
