import { describe, expect, it } from 'vitest';
import { routeRoom104Intent } from '../../src/world/room104IntentRouter';
import type { WorldInteractionIntent } from '../../src/world/phaser/types';

function interaction(capability: string): WorldInteractionIntent {
  return {
    type: 'INTERACTION',
    anchorId: `anchor:${capability}`,
    capability,
    name: capability,
  };
}

describe('Room 104 semantic intent routing (#26)', () => {
  it('keeps authored view transitions presentation-only', () => {
    expect(routeRoom104Intent({
      type: 'VIEW_TRANSITION',
      targetViewId: 'room104_bed_wardrobe',
    })).toEqual({ kind: 'view', targetViewId: 'room104_bed_wardrobe' });
  });

  it('routes physical room verbs to existing owners instead of mutating renderer state', () => {
    expect(routeRoom104Intent(interaction('use_computer'))).toEqual({ kind: 'computer' });
    expect(routeRoom104Intent(interaction('observe_window'))).toEqual({ kind: 'room-action', activity: 'window', modal: 'window' });
    expect(routeRoom104Intent(interaction('prepare_drink'))).toEqual({ kind: 'modal', modal: 'beverage' });
    expect(routeRoom104Intent(interaction('sleep'))).toEqual({ kind: 'modal', modal: 'sleep' });
    expect(routeRoom104Intent(interaction('leave_room'))).toEqual({ kind: 'modal', modal: 'door' });
  });

  it('keeps storage and delivery clicks as inspection requests until real #18 containers are bound', () => {
    expect(routeRoom104Intent(interaction('inspect_desk_storage'))).toEqual({
      kind: 'inspect-storage',
      storage: 'desk',
    });
    expect(routeRoom104Intent(interaction('open_wardrobe'))).toEqual({
      kind: 'inspect-storage',
      storage: 'wardrobe',
    });
    expect(routeRoom104Intent(interaction('open_kitchen_storage'))).toEqual({
      kind: 'inspect-storage',
      storage: 'kitchen',
    });
    expect(routeRoom104Intent(interaction('inspect_delivery_anchor'))).toEqual({
      kind: 'inspect-delivery',
    });
  });

  it('fails closed for hover, malformed, and unknown intents', () => {
    expect(routeRoom104Intent({ type: 'HOTSPOT_HOVER', hoveredAnchorId: 'room104_pc' })).toEqual({ kind: 'none' });
    expect(routeRoom104Intent({ type: 'VIEW_TRANSITION' })).toEqual({ kind: 'none' });
    expect(routeRoom104Intent(interaction('invent_new_reality'))).toEqual({ kind: 'none' });
  });
});
