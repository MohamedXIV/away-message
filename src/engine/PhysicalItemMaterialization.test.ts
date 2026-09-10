import { describe, expect, it } from 'vitest';
import {
  PhysicalItemEngine,
  type PhysicalContainerDefinition,
  type PhysicalItemDefinition,
  type PhysicalWorldState,
} from './PhysicalItemEngine';

const itemDefinitions: Readonly<Record<string, PhysicalItemDefinition>> = {
  delivery_parcel: { id: 'delivery_parcel', kind: 'container', portable: true, volume: 1 },
  noodles_cup: { id: 'noodles_cup', kind: 'food', portable: true, volume: 1 },
};

const containerDefinitions: Readonly<Record<string, PhysicalContainerDefinition>> = {
  delivery_parcel: { id: 'delivery_parcel', capacity: 8, allowedItemKinds: ['food'] },
};

function emptyWorld(): PhysicalWorldState {
  return { items: {}, containers: {} };
}

describe('PhysicalItemEngine atomic materialization', () => {
  it('materializes one parcel instance at an anchor with exact contained item instances', () => {
    const engine = new PhysicalItemEngine(emptyWorld(), itemDefinitions, containerDefinitions);

    engine.materializeBatch({
      containers: [
        { instanceId: 'parcel:ord_1', definitionId: 'delivery_parcel' },
      ],
      items: [
        {
          instanceId: 'parcel:ord_1',
          definitionId: 'delivery_parcel',
          location: { kind: 'worldAnchor', anchorId: 'room104:door' },
        },
        {
          instanceId: 'item:ord_1:0',
          definitionId: 'noodles_cup',
          location: { kind: 'container', containerInstanceId: 'parcel:ord_1' },
        },
      ],
    });

    expect(engine.getItem('parcel:ord_1').location).toEqual({
      kind: 'worldAnchor',
      anchorId: 'room104:door',
    });
    expect(engine.getContainerContents('parcel:ord_1')).toEqual([
      expect.objectContaining({
        instanceId: 'item:ord_1:0',
        definitionId: 'noodles_cup',
      }),
    ]);
  });

  it('rejects a conflicting repeated materialization without partially adding contents', () => {
    const initial: PhysicalWorldState = {
      items: {
        'parcel:ord_1': {
          instanceId: 'parcel:ord_1',
          definitionId: 'delivery_parcel',
          location: { kind: 'worldAnchor', anchorId: 'room104:door' },
        },
      },
      containers: {
        'parcel:ord_1': { instanceId: 'parcel:ord_1', definitionId: 'delivery_parcel' },
      },
    };
    const engine = new PhysicalItemEngine(initial, itemDefinitions, containerDefinitions);
    const before = engine.getState();

    expect(() =>
      engine.materializeBatch({
        containers: [],
        items: [
          {
            instanceId: 'parcel:ord_1',
            definitionId: 'noodles_cup',
            location: { kind: 'worldAnchor', anchorId: 'elsewhere' },
          },
          {
            instanceId: 'item:ord_1:late',
            definitionId: 'noodles_cup',
            location: { kind: 'container', containerInstanceId: 'parcel:ord_1' },
          },
        ],
      }),
    ).toThrow(/already exists/i);

    expect(engine.getState()).toEqual(before);
  });
});
