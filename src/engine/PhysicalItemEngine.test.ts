import { describe, expect, it } from 'vitest';
import {
  PhysicalItemEngine,
  type PhysicalContainerDefinition,
  type PhysicalItemDefinition,
  type PhysicalWorldState,
} from './PhysicalItemEngine';

const itemDefinitions: Record<string, PhysicalItemDefinition> = {
  noodles: { id: 'noodles', kind: 'food', portable: true, volume: 1 },
  jacket: { id: 'jacket', kind: 'clothing', portable: true, volume: 2 },
};

const containerDefinitions: Record<string, PhysicalContainerDefinition> = {
  bag: { id: 'bag', capacity: 1, allowedItemKinds: ['food', 'clothing'] },
  foodParcel: { id: 'foodParcel', capacity: 2, allowedItemKinds: ['food'] },
};

function fixture(): PhysicalWorldState {
  return {
    items: {
      'item-noodles': {
        instanceId: 'item-noodles',
        definitionId: 'noodles',
        location: { kind: 'worldAnchor', anchorId: 'room104:desk' },
      },
      'item-jacket': {
        instanceId: 'item-jacket',
        definitionId: 'jacket',
        location: { kind: 'worldAnchor', anchorId: 'room104:bed' },
      },
    },
    containers: {
      'player-bag': { instanceId: 'player-bag', definitionId: 'bag' },
      'parcel-1': { instanceId: 'parcel-1', definitionId: 'foodParcel' },
    },
  };
}

describe('PhysicalItemEngine', () => {
  it('moves one exact item instance through the same authoritative transfer API used by player containers', () => {
    const engine = new PhysicalItemEngine(fixture(), itemDefinitions, containerDefinitions);

    engine.transfer('item-noodles', { kind: 'container', containerInstanceId: 'player-bag' });

    expect(engine.getItem('item-noodles').location).toEqual({
      kind: 'container',
      containerInstanceId: 'player-bag',
    });
    expect(engine.getContainerContents('player-bag').map((item) => item.instanceId)).toEqual([
      'item-noodles',
    ]);
  });

  it('validates capacity and category before mutation, preserving the exact source state on rejection', () => {
    const engine = new PhysicalItemEngine(fixture(), itemDefinitions, containerDefinitions);
    engine.transfer('item-noodles', { kind: 'container', containerInstanceId: 'player-bag' });
    const before = engine.getState();

    expect(() =>
      engine.transfer('item-jacket', { kind: 'container', containerInstanceId: 'player-bag' }),
    ).toThrow(/capacity/i);
    expect(engine.getState()).toEqual(before);

    expect(() =>
      engine.transfer('item-jacket', { kind: 'container', containerInstanceId: 'parcel-1' }),
    ).toThrow(/category/i);
    expect(engine.getItem('item-jacket').location).toEqual({
      kind: 'worldAnchor',
      anchorId: 'room104:bed',
    });
  });

  it('uses an explicit terminal location so consumed items cannot remain visible in containers', () => {
    const engine = new PhysicalItemEngine(fixture(), itemDefinitions, containerDefinitions);
    engine.transfer('item-noodles', { kind: 'container', containerInstanceId: 'player-bag' });

    engine.transfer('item-noodles', { kind: 'terminal', state: 'consumed' });

    expect(engine.getItem('item-noodles').location).toEqual({ kind: 'terminal', state: 'consumed' });
    expect(engine.getContainerContents('player-bag')).toEqual([]);
  });
});
