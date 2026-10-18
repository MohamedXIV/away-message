// tests/unit/LayeredRoomPropPlan.test.ts
//
// Issue #167 — pure layering/swap/mask planning decisions. Phaser-free.

import { describe, expect, it } from 'vitest';
import type { WorldScenePropProjection, WorldWeatherWindowZone } from '../../src/world/phaser/types';
import {
  applyRoomDisplayOverrides,
  planRoomPropPlacements,
  resolveRoomWeatherDepth,
} from '../../src/world/phaser/layeredRoom/roomPropPlan';

const prop = (
  id: string,
  overrides: Partial<WorldScenePropProjection> = {},
): WorldScenePropProjection => ({
  id,
  assetId: `asset_${id}`,
  x: 0.5,
  y: 0.5,
  width: 0.1,
  height: 0.1,
  depth: 22,
  ...overrides,
});

const zone = (id: string): WorldWeatherWindowZone => ({ id, x: 0.2, y: 0.2, width: 0.2, height: 0.3 });

describe('room prop placement planning', () => {
  it('routes slots by render layer and authored depth', () => {
    const props = [
      prop('exterior', { renderLayer: 'backdrop', depth: 4 }),
      prop('rug', { depth: 20 }),
      prop('chair', { depth: 25 }),
      prop('actor_thing', { depth: 31 }),
      prop('curtain', { depth: 42 }),
    ];
    const slots = Object.fromEntries(
      planRoomPropPlacements(props, []).map((placement) => [placement.prop.id, placement.slot]),
    );
    expect(slots).toEqual({
      exterior: 'backdrop',
      rug: 'scenery',
      chair: 'scenery',
      actor_thing: 'actors',
      curtain: 'foreground',
    });
  });

  it('gives every masked or soft member all authored window zones', () => {
    const zones = [zone('glass'), zone('skylight')];
    const props = [
      prop('glass', { maskZone: true, maskedMember: true }),
      prop('curtain', { softSurface: true, maskedMember: true }),
      prop('bed'),
    ];
    const placements = planRoomPropPlacements(props, zones);
    expect(placements.find((p) => p.prop.id === 'glass')!.windowZoneIds).toEqual(['glass', 'skylight']);
    expect(placements.find((p) => p.prop.id === 'curtain')!.windowZoneIds).toEqual(['glass', 'skylight']);
    expect(placements.find((p) => p.prop.id === 'bed')!.windowZoneIds).toEqual([]);
    expect(placements.every((p) => !p.unmasked)).toBe(true);
  });

  it('flags a masked prop with no zones as unmasked (cannot render visibly)', () => {
    const placements = planRoomPropPlacements([prop('glass', { maskZone: true })], []);
    expect(placements[0]!.windowZoneIds).toEqual([]);
    expect(placements[0]!.unmasked).toBe(true);
  });

  it('keeps weather layers above room props in the depth band', () => {
    expect(resolveRoomWeatherDepth(30, true)).toBe(30);
    expect(resolveRoomWeatherDepth(60, true)).toBe(44);
    expect(resolveRoomWeatherDepth(45, true)).toBe(44);
    expect(resolveRoomWeatherDepth(46, false)).toBe(46);
    expect(resolveRoomWeatherDepth(49, false)).toBe(49);
  });
});

describe('independent fixture display overrides', () => {
  // The presentation always emits boolean hidden flags; fixtures match it.
  const bedA = prop('bed_a', { swapGroup: 'beds', variant: 'a', hidden: true });
  const bedB = prop('bed_b', { swapGroup: 'beds', variant: 'b', hidden: false });
  const rug = prop('rug', { hidden: false });

  it('keeps presentation-resolved visibility for untouched groups', () => {
    const result = applyRoomDisplayOverrides([bedA, bedB, rug]);
    expect(result.find((p) => p.id === 'bed_a')!.hidden).toBe(true);
    expect(result.find((p) => p.id === 'bed_b')!.hidden).toBe(false);
    expect(result.find((p) => p.id === 'rug')!.hidden).toBe(false);
  });

  it('resolves a swap to exactly one visible member', () => {
    const swapped = applyRoomDisplayOverrides([bedA, bedB, rug], { beds: 'a' });
    expect(swapped.find((p) => p.id === 'bed_a')!.hidden).toBe(false);
    expect(swapped.find((p) => p.id === 'bed_b')!.hidden).toBe(true);
    // Untouched props keep their identities (same object references).
    expect(swapped.find((p) => p.id === 'rug')).toBe(rug);
  });

  it('hides an entire group for a null variant', () => {
    const hidden = applyRoomDisplayOverrides([bedA, bedB, rug], { beds: null });
    expect(hidden.every((p) => p.id === 'rug' || p.hidden)).toBe(true);
  });

  it('layers runtime hides on top without rebuilding the presentation', () => {
    const result = applyRoomDisplayOverrides([bedA, bedB, rug], undefined, ['rug']);
    expect(result.find((p) => p.id === 'rug')!.hidden).toBe(true);
    expect(result.find((p) => p.id === 'bed_b')!.hidden).toBe(false);
  });

  it('treats an unknown requested variant as no active member change for other groups', () => {
    const result = applyRoomDisplayOverrides([bedA, bedB, rug], { beds: 'c' });
    // 'c' matches no member: the group resolves to nothing visible rather
    // than silently borrowing another visual.
    expect(result.find((p) => p.id === 'bed_a')!.hidden).toBe(true);
    expect(result.find((p) => p.id === 'bed_b')!.hidden).toBe(true);
  });
});
