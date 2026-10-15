import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { MaterialWorldRuntime } from '../../src/engine/kernel/MaterialWorldRuntime';

function owner(engine: SimulationEngine): MaterialWorldRuntime {
  return (engine as unknown as { physical: { material: MaterialWorldRuntime } }).physical.material;
}

describe('MaterialWorldRuntime — one canonical physical item and object owner', () => {
  it('keeps item and object projections on the same owned runtime', () => {
    const engine = new SimulationEngine();
    const physical = owner(engine);
    expect(physical).toBeInstanceOf(MaterialWorldRuntime);
    expect(engine.getPhysicalWorldState()).toEqual(physical.getPhysicalWorldState());
    expect(engine.getPhysicalObjectState()).toEqual(physical.getPhysicalObjectState());

    const saved = engine.exportSnapshot();
    expect(saved.physicalWorld).toEqual(physical.getPhysicalWorldState());
    expect(saved.physicalObjects).toEqual(physical.getPhysicalObjectState());
  });

  it('restores the canonical physical world and object placements through save/load', () => {
    const source = new SimulationEngine();
    const snapshot = source.exportSnapshot();
    const restored = new SimulationEngine(snapshot);
    expect(restored.getPhysicalWorldState()).toEqual(snapshot.physicalWorld);
    expect(restored.getPhysicalObjectState()).toEqual(snapshot.physicalObjects);

    const originalOwner = owner(restored);
    restored.loadSnapshot(snapshot);
    expect(owner(restored)).toBe(originalOwner);
    expect(restored.getPhysicalWorldState()).toEqual(snapshot.physicalWorld);
    expect(restored.getPhysicalObjectState()).toEqual(snapshot.physicalObjects);
  });

  it('protects canonical physical state from external snapshot mutation', () => {
    const engine = new SimulationEngine();
    const originalWorld = engine.getPhysicalWorldState();
    const externalWorld = owner(engine).getPhysicalWorldState();
    externalWorld.items['external:forgery'] = {
      instanceId: 'external:forgery',
      definitionId: 'fake',
      location: { kind: 'container', containerInstanceId: 'player_inventory' },
    };
    expect(engine.getPhysicalWorldState()).toEqual(originalWorld);

    const originalObjects = engine.getPhysicalObjectState();
    const externalObjects = owner(engine).getPhysicalObjectState();
    externalObjects.objects['external:forgery'] = {
      instanceId: 'external:forgery',
      slotId: 'fake',
      orientation: 0,
    } as never;
    expect(engine.getPhysicalObjectState()).toEqual(originalObjects);
  });

  it('reanchoring owned items at the same home is idempotent and does not create stock', () => {
    const engine = new SimulationEngine();
    const physical = owner(engine);
    const world = physical.getPhysicalWorldState();

    physical.reanchorOwnedItems();
    expect(physical.getPhysicalWorldState()).toEqual(world);
  });
});
