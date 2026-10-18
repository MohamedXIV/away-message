// tests/unit/LivingRoomSpikePresentation.test.ts
//
// Issue #167 — the layered starter-room presentation projection.
//
// These are presentation-authority tests: a fixture swap, lamp toggle,
// weather change, or focus move must only change HOW the room is shown.
// Nothing here may create simulation truth — the outward intents stay
// capability-shaped, and every decision must be recomputable from the
// authored registries plus the options passed in.

import { describe, expect, it } from 'vitest';
import {
  LIVING_ROOM_LAMP_LIGHT_ID,
  createLivingRoomSpikeProjection,
  projectRoomPresentation,
  resolveLivingRoomSpikeViewId,
} from '../../src/world/phaser/layeredRoom/LivingRoomSpikePresentation';
import type { WorldScenePropProjection } from '../../src/world/phaser/types';

const VIEW_ID = 'spike_room_view';
const LAMP_ID = LIVING_ROOM_LAMP_LIGHT_ID;
const WINDOW_LIGHT_ID = 'room-window-light-spike_prop_glass';

const propById = (
  props: readonly WorldScenePropProjection[],
  id: string,
): WorldScenePropProjection => {
  const found = props.find((prop) => prop.id === id);
  if (!found) throw new Error(`expected authored prop '${id}' to be emitted`);
  return found;
};

const lightIds = (projection = createLivingRoomSpikeProjection({})): string[] =>
  (projection.authoredLights ?? []).map((light) => light.id);

const audioIds = (projection = createLivingRoomSpikeProjection({})): string[] =>
  (projection.spatialAudioSources ?? []).map((source) => source.id);

describe('layered room view resolution', () => {
  it('resolves the authored spike view from the place id', () => {
    expect(resolveLivingRoomSpikeViewId()).toBe(VIEW_ID);
    expect(resolveLivingRoomSpikeViewId('place_without_a_room')).toBeNull();
  });

  it('throws instead of silently projecting an empty room', () => {
    expect(() => createLivingRoomSpikeProjection({ placeId: 'nope' })).toThrow(/no authored scene props/);
  });

  it('emits every authored production prop once, interior-flagged', () => {
    const projection = createLivingRoomSpikeProjection({});
    expect(projection.isInterior).toBe(true);
    expect(projection.sceneProps).toHaveLength(17);
    const ids = projection.sceneProps!.map((prop) => prop.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('spike_prop_glass');
  });
});

describe('independent fixture swaps change only visibility', () => {
  it('emits all swap members and keeps exactly one active by default', () => {
    const projection = createLivingRoomSpikeProjection({});
    const bedA = propById(projection.sceneProps!, 'spike_prop_bed_a');
    const bedB = propById(projection.sceneProps!, 'spike_prop_bed_b');
    expect(bedA.hidden).toBe(false);
    expect(bedB.hidden).toBe(true);
    expect(bedA.swapGroup).toBe('spike_bed');
    expect(projection.roomPresentation!.swapGroups).toEqual({
      spike_bed: { variants: ['a', 'b'], active: 'a' },
    });
  });

  it('swapping the variant never adds or removes a light or audio source', () => {
    const base = createLivingRoomSpikeProjection({});
    const swapped = createLivingRoomSpikeProjection({ fixtureVariants: { spike_bed: 'b' } });
    expect(propById(swapped.sceneProps!, 'spike_prop_bed_a').hidden).toBe(true);
    expect(propById(swapped.sceneProps!, 'spike_prop_bed_b').hidden).toBe(false);
    // Same identities, same order: the swap is presentation-only.
    expect(lightIds(swapped)).toEqual(lightIds(base));
    expect(audioIds(swapped)).toEqual(audioIds(base));
    expect(swapped.roomPresentation!.swapGroups.spike_bed?.active).toBe('b');
  });

  it('a null variant hides the whole group without touching lights', () => {
    const hidden = createLivingRoomSpikeProjection({ fixtureVariants: { spike_bed: null } });
    expect(propById(hidden.sceneProps!, 'spike_prop_bed_a').hidden).toBe(true);
    expect(propById(hidden.sceneProps!, 'spike_prop_bed_b').hidden).toBe(true);
    expect(lightIds(hidden)).toEqual(lightIds());
    expect(hidden.roomPresentation!.swapGroups.spike_bed).toEqual({ variants: ['a', 'b'], active: null });
  });

  it('an unknown variant falls back to the authored default, never borrows', () => {
    const fallback = createLivingRoomSpikeProjection({ fixtureVariants: { spike_bed: 'c' } });
    expect(propById(fallback.sceneProps!, 'spike_prop_bed_a').hidden).toBe(false);
    expect(propById(fallback.sceneProps!, 'spike_prop_bed_b').hidden).toBe(true);
  });

  it('runtime hiddenPropIds hide one fixture and disturb nothing else', () => {
    const projection = createLivingRoomSpikeProjection({ hiddenPropIds: ['spike_prop_rug'] });
    expect(propById(projection.sceneProps!, 'spike_prop_rug').hidden).toBe(true);
    expect(propById(projection.sceneProps!, 'spike_prop_bed_a').hidden).toBe(false);
    expect(propById(projection.sceneProps!, 'spike_prop_bed_b').hidden).toBe(true);
    expect(propById(projection.sceneProps!, 'spike_prop_desk').hidden).toBe(false);
  });
});

describe('lamp practical and daylight lights', () => {
  it('projects the stable lamp id plus the window daylight by default', () => {
    const ids = lightIds();
    expect(ids).toContain(LAMP_ID);
    expect(ids).toContain(WINDOW_LIGHT_ID);
    const lamp = (createLivingRoomSpikeProjection({}).authoredLights ?? [])
      .find((light) => light.id === LAMP_ID);
    expect(lamp?.kind).toBe('lamp');
    // The practical sits at the authored bed anchor.
    expect(lamp).toMatchObject({ x: 0.695, y: 0.69 });
  });

  it('turning the lamp off filters only the practical — daylight stays', () => {
    const off = createLivingRoomSpikeProjection({ lampOn: false });
    expect(lightIds(off)).toEqual([WINDOW_LIGHT_ID]);
  });

  it('lamp-on state is reported for the runtime without a second truth', () => {
    expect(createLivingRoomSpikeProjection({}).roomPresentation!.lampOn).toBe(true);
    expect(createLivingRoomSpikeProjection({ lampOn: false }).roomPresentation!.lampOn).toBe(false);
  });
});

describe('day / evening / night presentation', () => {
  const phases = [
    { timeOfDay: 'day', minute: 720 },
    { timeOfDay: 'evening', minute: 1170 },
    { timeOfDay: 'night', minute: 1320 },
  ] as const;

  it('uses the shared day-phase curve and dims ambient across phases', () => {
    const ambient = phases.map(({ timeOfDay, minute }) => {
      const projection = createLivingRoomSpikeProjection({ timeOfDay });
      expect(projection.minuteOfDay).toBe(minute);
      return projection.lighting.ambientIntensity;
    });
    expect(ambient[0]!).toBeGreaterThan(ambient[1]!);
    expect(ambient[1]!).toBeGreaterThan(ambient[2]!);
  });

  it('keeps authored light identities stable across phases', () => {
    for (const { timeOfDay } of phases) {
      expect(lightIds(createLivingRoomSpikeProjection({ timeOfDay }))).toEqual(lightIds());
    }
  });
});

describe('weather presentation stays window-aware', () => {
  it('interior rain never paints the room: the generic particle flag stays off', () => {
    const rain = createLivingRoomSpikeProjection({ weather: 'rain' });
    expect(rain.weather).toBe('rain');
    expect(rain.particles.rain).toBe(false);
    expect(rain.isInterior).toBe(true);
  });

  it('window rain audio joins only when it rains, with muffled exterior params', () => {
    expect(audioIds()).not.toContain('environment_window_rain');
    const rain = createLivingRoomSpikeProjection({ weather: 'rain' });
    expect(rain.roomPresentation!.rainIntensity).toBe(1);
    expect(rain.windIntensity).toBe(0.35);
    const source = (rain.spatialAudioSources ?? []).find((item) => item.id === 'environment_window_rain');
    expect(source).toBeDefined();
    // Placed at the authored window anchor, muffled behind glass.
    expect(source).toMatchObject({ x: 0.3125, y: 0.38, loop: true });
    expect(source?.parameters).toMatchObject({ muffled: 1, rainIntensity: 0.35 });
  });

  it('a view without authored window zones gets no window-rain source at all', () => {
    const other = projectRoomPresentation({ viewId: 'view_a1', weather: 'rain', rainIntensity: 1 });
    expect(other.weatherWindowZones).toHaveLength(0);
    expect(other.props).toHaveLength(0);
    expect(other.spatialAudioSources.map((source) => source.id)).not.toContain('environment_window_rain');
    // The room-tone bed is always first, so ordering stays stable.
    expect(other.spatialAudioSources[0]!.id).toBe('environment_room_tone');
  });

  it('reports the window zone footprint and hasWindowZone flag', () => {
    const projection = createLivingRoomSpikeProjection({});
    expect(projection.roomPresentation!.hasWindowZone).toBe(true);
    expect(projection.weatherWindowZones).toEqual([
      { id: 'spike_prop_glass', x: 0.1775, y: 0.171, width: 0.27, height: 0.418 },
    ]);
  });
});

describe('masked members, soft surfaces, and backdrop layers', () => {
  it('the glass is a masked member with rigid motion suppressed', () => {
    const glass = propById(createLivingRoomSpikeProjection({}).sceneProps!, 'spike_prop_glass');
    expect(glass).toMatchObject({
      maskZone: true,
      maskedMember: true,
      motionSuppressed: true,
      softSurface: false,
      blendMode: 'normal',
    });
  });

  it('the curtain is a top-pinned soft surface inside the mask group', () => {
    const projection = createLivingRoomSpikeProjection({});
    const curtain = propById(projection.sceneProps!, 'spike_prop_curtain');
    // Pinned at the top edge: anchor.y − height/2 = 0.38 − 0.422222/2.
    expect(curtain.softSurface).toBe(true);
    expect(curtain.maskedMember).toBe(true);
    expect(curtain.motionSuppressed).toBe(true);
    expect(curtain.y).toBeCloseTo(0.38 - 0.422222 / 2, 6);
    expect(projection.softSurfaces).toEqual([
      {
        id: 'soft-spike_prop_curtain',
        targetName: 'spike_prop_curtain',
        type: 'soft_sway',
        speed: 1.4,
        amplitude: 0.05,
        segments: 14,
      },
    ]);
    // Soft surfaces drive vertices, never the rigid ambient-motion path.
    expect((projection.ambientMotions ?? []).map((motion) => motion.targetName)).not.toContain('spike_prop_curtain');
  });

  it('exterior foliage keeps rigid sway and the backdrop layer list', () => {
    const projection = createLivingRoomSpikeProjection({});
    expect(projection.roomPresentation!.backdropPropIds).toEqual([
      'spike_prop_exterior',
      'spike_prop_tree_back',
      'spike_prop_tree_mid',
    ]);
    expect(propById(projection.sceneProps!, 'spike_prop_exterior').renderLayer).toBe('backdrop');
    const treeMotions = (projection.ambientMotions ?? []).filter((motion) => motion.targetName.startsWith('spike_prop_tree'));
    expect(treeMotions.map((motion) => [motion.targetName, motion.type, motion.amplitude])).toEqual([
      ['spike_prop_tree_back', 'sway', 6],
      ['spike_prop_tree_mid', 'sway', 9],
    ]);
  });

  it('the lamp glow keeps its authored additive blend', () => {
    const glow = propById(createLivingRoomSpikeProjection({}).sceneProps!, 'spike_prop_lamp_glow');
    expect(glow.blendMode).toBe('add');
  });
});

describe('semantic anchors emit outward intents only', () => {
  it('each anchor carries capability-shaped interactions, no state rules', () => {
    const projection = createLivingRoomSpikeProjection({});
    const capabilities = new Map(
      projection.anchors.map((anchor) => [
        anchor.id,
        (anchor.interactions ?? []).map((interaction) => interaction.capability),
      ]),
    );
    expect(capabilities.get('spike_anchor_bed')).toEqual(['sleep']);
    expect(capabilities.get('spike_anchor_desk')).toEqual(['work']);
    expect(capabilities.get('spike_anchor_door')).toEqual(['leave_room']);
    expect(capabilities.get('spike_anchor_window')).toEqual(['observe_window']);
    expect(capabilities.get('spike_anchor_storage')).toEqual(['open_storage']);
    expect(capabilities.get('spike_anchor_parcel')).toEqual(['inspect_parcel']);
    expect(capabilities.get('spike_anchor_pc')).toEqual(['use_computer']);
    // Anchors hold geometry + semantics only: no money/location/need fields.
    for (const anchor of projection.anchors) {
      for (const interaction of anchor.interactions ?? []) {
        expect(Object.keys(interaction).sort()).toEqual(['capability', 'id', 'name', 'tags']);
      }
    }
  });

  it('focus targets resolve through authored anchors, hero stays neutral', () => {
    expect(createLivingRoomSpikeProjection({}).focus).toEqual({ x: 0.5, y: 0.5, zoom: 1 });
    expect(createLivingRoomSpikeProjection({ focus: 'desk' }).focus).toEqual({ x: 0.32, y: 0.665, zoom: 1.35 });
    expect(createLivingRoomSpikeProjection({ focus: 'window' }).focus).toEqual({ x: 0.3125, y: 0.38, zoom: 1.35 });
  });
});
