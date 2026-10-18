// tests/unit/LayeredRoomPropPlan.test.ts
//
// Issue #167 — pure layering/swap/mask planning decisions. Phaser-free.

import { describe, expect, it } from 'vitest';
import type { SoftSurfaceMotionDef } from '../../src/world/phaser/environment/ambientMotion';
import type { WorldScenePropProjection, WorldWeatherWindowZone } from '../../src/world/phaser/types';
import {
  applyRoomDisplayOverrides,
  computeRoomStructureSignature,
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

describe('room structure signature (PR #198 review item 1)', () => {
  const soft: SoftSurfaceMotionDef = {
    id: 'soft-curtain',
    targetName: 'curtain',
    type: 'soft_sway',
    speed: 1.4,
    amplitude: 0.05,
  };
  const base = () => ({
    viewId: 'room_view',
    props: [prop('desk'), prop('glass', { maskZone: true, maskedMember: true }), prop('curtain', { softSurface: true, maskedMember: true })],
    windowZones: [zone('glass')],
    softSurfaces: [soft],
  });
  const unchanged = () => computeRoomStructureSignature(base());

  it('stays stable for pure display state: hidden flags, overrides, weather', () => {
    const unchanged = computeRoomStructureSignature(base());
    // Same geometry, different visibility/hidden flags — visibility is not
    // structure, so the fast path stays valid.
    const hidden = base();
    hidden.props = hidden.props.map((p) => ({ ...p, hidden: true }));
    expect(computeRoomStructureSignature(hidden)).toBe(unchanged);
    // Motion suppression and swap membership are creation-time flags too,
    // as long as geometry is untouched.
    const swapped = base();
    swapped.props = swapped.props.map((p) => ({ ...p, swapGroup: 'beds', variant: 'a' }));
    expect(computeRoomStructureSignature(swapped)).toBe(unchanged);
  });

  it('changes when any same-id prop geometry changes', () => {
    for (const patch of [
      { x: 0.6 }, { y: 0.4 }, { width: 0.2 }, { height: 0.3 }, { depth: 24 },
    ] as const) {
      const moved = base();
      moved.props = moved.props.map((p) => (p.id === 'desk' ? { ...p, ...patch } : p));
      expect(computeRoomStructureSignature(moved)).not.toBe(unchanged());
    }
  });

  it('changes when a window-zone rect moves even with the same zone id', () => {
    const movedZones = base();
    movedZones.windowZones = [{ id: 'glass', x: 0.25, y: 0.2, width: 0.2, height: 0.3 }];
    expect(computeRoomStructureSignature(movedZones)).not.toBe(unchanged());
  });

  it('changes when a soft-surface wave def changes dimensions', () => {
    const faster = base();
    faster.softSurfaces = [{ ...soft, speed: 2.1 }];
    expect(computeRoomStructureSignature(faster)).not.toBe(unchanged());
    const segmented = base();
    segmented.softSurfaces = [{ ...soft, segments: 20 }];
    expect(computeRoomStructureSignature(segmented)).not.toBe(unchanged());
  });

  it('changes when an asset, object kind, layer slot, blend or mask membership changes', () => {
    const assetSwap = base();
    assetSwap.props = assetSwap.props.map((p) => (p.id === 'desk' ? { ...p, assetId: 'other_asset' } : p));
    expect(computeRoomStructureSignature(assetSwap)).not.toBe(unchanged());

    const kindSwap = base();
    kindSwap.props = kindSwap.props.map((p) => (p.id === 'desk' ? { ...p, softSurface: true } : p));
    expect(computeRoomStructureSignature(kindSwap)).not.toBe(unchanged());

    const layerSwap = base();
    layerSwap.props = layerSwap.props.map((p) => (p.id === 'desk' ? { ...p, renderLayer: 'backdrop' as const } : p));
    expect(computeRoomStructureSignature(layerSwap)).not.toBe(unchanged());

    const blendSwap = base();
    blendSwap.props = blendSwap.props.map((p) => (p.id === 'desk' ? { ...p, blendMode: 'add' as const } : p));
    expect(computeRoomStructureSignature(blendSwap)).not.toBe(unchanged());

    const maskSwap = base();
    maskSwap.props = maskSwap.props.map((p) => (p.id === 'desk' ? { ...p, maskZone: true, maskedMember: true } : p));
    expect(computeRoomStructureSignature(maskSwap)).not.toBe(unchanged());
  });

  it('changes when the prop set itself changes', () => {
    const fewer = base();
    fewer.props = fewer.props.filter((p) => p.id !== 'desk');
    expect(computeRoomStructureSignature(fewer)).not.toBe(unchanged());
    const differentView = base();
    differentView.viewId = 'other_view';
    expect(computeRoomStructureSignature(differentView)).not.toBe(unchanged());
  });
});
