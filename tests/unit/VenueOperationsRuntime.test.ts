import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { VenueOperationsRuntime } from '../../src/engine/kernel/VenueOperationsRuntime';
import { GENERATED_VENUE_DEFINITIONS } from '../../src/engine/venue/GeneratedVenueDefinitions';

function venue(engine: SimulationEngine): VenueOperationsRuntime {
  return (engine as unknown as { physical: { venueRuntime: VenueOperationsRuntime } }).physical.venueRuntime;
}

describe('VenueOperationsRuntime — canonical role and activity ownership', () => {
  it('shares one owner with the top-level engine and restores persisted state on reload', () => {
    const engine = new SimulationEngine();
    const owner = venue(engine);
    const snapshot = engine.exportSnapshot();

    expect(owner.getVenueRuntimeState()).toEqual(engine.getVenueRuntimeState());
    expect(owner.getVenueRuntimeState()).toEqual(snapshot.venueOperations);

    engine.loadSnapshot(snapshot);
    expect(venue(engine)).toBe(owner);
    expect(owner.getVenueRuntimeState()).toEqual(snapshot.venueOperations);
    expect(engine.exportSnapshot().venueOperations).toEqual(snapshot.venueOperations);
  });

  it('evaluates unavailable services from generated venue definitions, not a shadow catalog', () => {
    const engine = new SimulationEngine();
    const owner = venue(engine);
    expect(owner.getVenueServiceAvailability('unknown-service')).toEqual({
      available: false, blockers: ['unknown_service'],
    });
    if (GENERATED_VENUE_DEFINITIONS.services.length) {
      const first = GENERATED_VENUE_DEFINITIONS.services[0]!;
      expect(owner.getVenueServiceAvailability(first.id))
        .toEqual(engine.getVenueServiceAvailability(first.id));
    }
  });

  it('does not alter persisted activities when progressing an empty clock interval', () => {
    const engine = new SimulationEngine();
    const owner = venue(engine);
    const before = owner.getVenueRuntimeState();
    owner.synchronizeVenueActivities();
    expect(owner.getVenueRuntimeState()).toEqual(before);
  });
});
