import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import {
  PhysicalItemEngine,
  type PhysicalContainerDefinition,
  type PhysicalItemDefinition,
  type PhysicalWorldState,
} from '../../src/engine/PhysicalItemEngine';

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
      containers: [{ instanceId: 'parcel:ord_1', definitionId: 'delivery_parcel' }],
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

    expect(engine.getItem('parcel:ord_1').location).toEqual({ kind: 'worldAnchor', anchorId: 'room104:door' });
    expect(engine.getContainerContents('parcel:ord_1')).toEqual([
      expect.objectContaining({ instanceId: 'item:ord_1:0', definitionId: 'noodles_cup' }),
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

describe('physical delivery arrival', () => {
  it('turns a due courier order into a physical parcel at the delivery anchor without crediting pantry', () => {
    const sim = new SimulationEngine();
    sim.economy.earnCash(100, 'delivery integration test');

    const placed = sim.dispatchAction({
      type: 'PLAYER_PLACE_ORDER',
      items: [{ sku: 'grocery_bag', qty: 2 }],
      fulfillment: 'delivery',
    });
    expect(placed.success).toBe(true);
    const orderId = (placed.data as { orderId: string }).orderId;
    const order = sim.delivery.getState().orders.find((candidate) => candidate.id === orderId)!;

    expect(sim.getState().player.pantry.groceries).toBe(0);
    sim.advanceGameMinutes(order.readyMinute - order.placedMinute + 1, 'wait for courier');

    expect(sim.delivery.getState().orders.find((candidate) => candidate.id === orderId)?.status).toBe('done');
    expect(sim.getState().player.pantry.groceries).toBe(0);

    const physical = sim.getPhysicalWorldState();
    const parcelId = `parcel:${orderId}`;
    expect(physical.items[parcelId]).toEqual(
      expect.objectContaining({
        instanceId: parcelId,
        definitionId: 'delivery_parcel',
        location: { kind: 'worldAnchor', anchorId: 'room104:delivery' },
      }),
    );
    expect(physical.containers[parcelId]).toEqual({ instanceId: parcelId, definitionId: 'delivery_parcel' });

    const contents = Object.values(physical.items).filter(
      (item) => item.location.kind === 'container' && item.location.containerInstanceId === parcelId,
    );
    expect(contents).toHaveLength(2);
    expect(contents.map((item) => item.instanceId)).toEqual([
      `order-item:${orderId}:grocery_bag:0`,
      `order-item:${orderId}:grocery_bag:1`,
    ]);
  });

  it('persists an arrived parcel and exact contents across save/reload without duplicating arrival', () => {
    const sim = new SimulationEngine();
    sim.economy.earnCash(100, 'delivery persistence test');
    const placed = sim.dispatchAction({
      type: 'PLAYER_PLACE_ORDER',
      items: [{ sku: 'noodles_cup', qty: 1 }],
      fulfillment: 'delivery',
    });
    const orderId = (placed.data as { orderId: string }).orderId;
    const order = sim.delivery.getState().orders.find((candidate) => candidate.id === orderId)!;
    sim.advanceGameMinutes(order.readyMinute - order.placedMinute + 1, 'wait for courier');

    const before = sim.getPhysicalWorldState();
    const restored = new SimulationEngine(sim.exportSnapshot());
    restored.advanceGameMinutes(1, 'post-load tick');

    expect(restored.getPhysicalWorldState()).toEqual(before);
    expect(Object.keys(restored.getPhysicalWorldState().items).filter((id) => id === `parcel:${orderId}`)).toHaveLength(1);
    expect(restored.getState().player.pantry.noodles).toBe(2);
  });
});
