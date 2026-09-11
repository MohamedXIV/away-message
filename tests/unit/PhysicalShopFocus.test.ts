import { describe, expect, it } from 'vitest';
import type { PhysicalShopState } from '../../src/engine/PhysicalShopEngine';
import {
  projectPhysicalShopFocus,
  validatePhysicalShopFixtureContent,
  type PhysicalShopFocusableFixture,
} from '../../src/engine/PhysicalShopFocus';

const fixtures: PhysicalShopFocusableFixture[] = [
  {
    id: 'front_shelf',
    kind: 'shelf',
    slots: [{ id: 'front_shelf:0', eligibleDefinitionIds: ['soda'] }],
    focus: {
      viewId: 'view_shelf_close',
      environment: { lightProfileIds: [], audioProfileIds: [], effectTags: [] },
    },
  },
  {
    id: 'drink_fridge',
    kind: 'fridge',
    slots: [{ id: 'drink_fridge:0', eligibleDefinitionIds: ['soda'] }],
    focus: {
      viewId: 'view_fridge_close',
      environment: {
        lightProfileIds: ['light_cool_internal'],
        audioProfileIds: ['audio_compressor_loop'],
        effectTags: ['condensation'],
      },
    },
  },
];

const refs = {
  viewIds: new Set(['view_shelf_close', 'view_fridge_close']),
  lightProfileIds: new Set(['light_cool_internal']),
  audioProfileIds: new Set(['audio_compressor_loop']),
};

const state: PhysicalShopState = {
  stockBySlot: {
    'front_shelf:0': 'shop:corner_mart:front_shelf:0:soda',
    'drink_fridge:0': 'shop:corner_mart:drink_fridge:0:soda',
  },
  ownershipByItemId: {
    'shop:corner_mart:front_shelf:0:soda': 'store',
    'shop:corner_mart:drink_fridge:0:soda': 'store',
  },
  originalSlotByItemId: {
    'shop:corner_mart:front_shelf:0:soda': 'front_shelf:0',
    'shop:corner_mart:drink_fridge:0:soda': 'drink_fridge:0',
  },
};

describe('physical shop authored focus projection (#27)', () => {
  it('projects shelf and fridge focus views from content definitions and persisted exact stock', () => {
    expect(validatePhysicalShopFixtureContent(fixtures, refs)).toEqual([]);

    expect(projectPhysicalShopFocus(fixtures[0]!, state)).toEqual({
      fixtureId: 'front_shelf',
      kind: 'shelf',
      viewId: 'view_shelf_close',
      slots: [{ slotId: 'front_shelf:0', itemInstanceId: 'shop:corner_mart:front_shelf:0:soda' }],
      environment: { lightProfileIds: [], audioProfileIds: [], effectTags: [] },
    });

    expect(projectPhysicalShopFocus(fixtures[1]!, state)).toEqual({
      fixtureId: 'drink_fridge',
      kind: 'fridge',
      viewId: 'view_fridge_close',
      slots: [{ slotId: 'drink_fridge:0', itemInstanceId: 'shop:corner_mart:drink_fridge:0:soda' }],
      environment: {
        lightProfileIds: ['light_cool_internal'],
        audioProfileIds: ['audio_compressor_loop'],
        effectTags: ['condensation'],
      },
    });
  });

  it('reflects an empty authored slot after an item is taken without synthesizing or moving stock', () => {
    const afterTake: PhysicalShopState = {
      ...state,
      stockBySlot: { 'front_shelf:0': state.stockBySlot['front_shelf:0']! },
      ownershipByItemId: { ...state.ownershipByItemId },
      originalSlotByItemId: { ...state.originalSlotByItemId },
    };

    expect(projectPhysicalShopFocus(fixtures[1]!, afterTake).slots).toEqual([
      { slotId: 'drink_fridge:0', itemInstanceId: null },
    ]);
    expect(afterTake.ownershipByItemId['shop:corner_mart:drink_fridge:0:soda']).toBe('store');
  });

  it('rejects broken authored focus/profile references instead of repairing them at runtime', () => {
    const broken: PhysicalShopFocusableFixture[] = [
      {
        ...fixtures[1]!,
        focus: {
          viewId: 'missing_view',
          environment: {
            lightProfileIds: ['missing_light'],
            audioProfileIds: ['missing_audio'],
            effectTags: ['condensation'],
          },
        },
      },
    ];

    expect(validatePhysicalShopFixtureContent(broken, refs)).toEqual([
      'shopFixtures/drink_fridge.focus.viewId: unknown view missing_view.',
      'shopFixtures/drink_fridge.focus.environment.lightProfileIds: unknown light profile missing_light.',
      'shopFixtures/drink_fridge.focus.environment.audioProfileIds: unknown audio profile missing_audio.',
    ]);
  });
});
