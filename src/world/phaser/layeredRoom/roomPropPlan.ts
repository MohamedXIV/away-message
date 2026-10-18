// src/world/phaser/layeredRoom/roomPropPlan.ts
//
// Pure planning helpers for layered room props (issue #167). Phaser-free so
// Node unit tests can cover the layering/swap/mask decisions directly.

import type { WorldScenePropProjection, WorldWeatherWindowZone } from '../types';

export type RoomPropSlot = 'backdrop' | 'scenery' | 'actors' | 'foreground';

export interface RoomPropPlacement {
  prop: WorldScenePropProjection;
  slot: RoomPropSlot;
  /**
   * Window container membership: every masked prop plus the soft surfaces
   * hang with the authored window zones so one geometry mask clips them
   * together. Empty for ordinary room props.
   */
  windowZoneIds: string[];
  /** A masked prop without any authored window zone cannot render visibly. */
  unmasked: boolean;
}

/**
 * Scene-root depth band for window-masked members and the window streak
 * emitter. Masked members draw above the foreground layer container (40)
 * and below the weather band owned by EnvironmentManager (dust 45, rain
 * 46, splash 47), so streaks and splashes always composite over fixtures
 * without re-parenting anything.
 */
export function resolveRoomWeatherDepth(baseDepth: number, isRoomProp: boolean): number {
  return isRoomProp ? Math.min(baseDepth, 44) : baseDepth;
}

export function planRoomPropPlacements(
  props: readonly WorldScenePropProjection[],
  windowZones: readonly WorldWeatherWindowZone[],
): RoomPropPlacement[] {
  return props.map((prop) => {
    const slot: RoomPropSlot = prop.renderLayer === 'backdrop'
      ? 'backdrop'
      : prop.depth >= 40
        ? 'foreground'
        : prop.depth >= 30
          ? 'actors'
          : 'scenery';
    const usesWindowMask = prop.maskedMember === true || prop.maskZone === true;
    return {
      prop,
      slot,
      windowZoneIds: usesWindowMask && windowZones.length > 0
        ? windowZones.map((zone) => zone.id)
        : [],
      unmasked: prop.maskZone === true && windowZones.length === 0,
    };
  });
}

/**
 * The single runtime mutation for an independent fixture change: swap
 * groups and hidden ids are resolved into visible/hidden flags on the
 * existing prop list. Nothing outside the affected groups changes, so the
 * room image, lights, audio and every other prop keep their identities.
 *
 * Presentation-level flags stay authoritative for untouched groups: a prop
 * the presentation already marked hidden (an inactive swap member or an
 * authored hide) stays hidden. Within an OVERRIDE-addressed group exactly
 * one member is visible: the requested variant, or the first member when
 * the group is not addressed. `null` hides the entire group.
 */
export function applyRoomDisplayOverrides(
  props: readonly WorldScenePropProjection[],
  fixtureVariants?: Readonly<Record<string, string | null>>,
  hiddenPropIds?: readonly string[],
): WorldScenePropProjection[] {
  const overrides = fixtureVariants ?? {};
  const hidden = new Set(hiddenPropIds ?? []);
  const groupHasOverride = new Set<string>();
  for (const prop of props) {
    if (prop.swapGroup && Object.prototype.hasOwnProperty.call(overrides, prop.swapGroup)) {
      groupHasOverride.add(prop.swapGroup);
    }
  }
  // First authored member per group = the default visible variant.
  const defaultVariant = new Map<string, string | null>();
  for (const prop of props) {
    if (prop.swapGroup && !defaultVariant.has(prop.swapGroup)) {
      defaultVariant.set(prop.swapGroup, prop.variant ?? prop.id);
    }
  }
  return props.map((prop) => {
    let visible = prop.hidden !== true && !hidden.has(prop.id);
    if (prop.swapGroup && groupHasOverride.has(prop.swapGroup)) {
      const requested = overrides[prop.swapGroup];
      const active = requested === null ? null : (requested ?? defaultVariant.get(prop.swapGroup) ?? null);
      // Resolved fresh: the presentation marks inactive members hidden, so
      // a requested variant must be able to override that base flag.
      visible = active !== null && active === (prop.variant ?? prop.id) && !hidden.has(prop.id);
    }
    // Normalise undefined and false — they are the same visible state, so a
    // prop that stays visible is returned by identity (no needless objects).
    return Boolean(prop.hidden) === !visible ? prop : { ...prop, hidden: !visible };
  });
}
