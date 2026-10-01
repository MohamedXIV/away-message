import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createWorldSceneProjection } from '../../src/world/phaser/presentationAdapter';

describe('living-world residence integration (#29)', () => {
  it('owns current home through persisted ResidenceTenancy instead of a UI alias', () => {
    const sim = new SimulationEngine();
    const residence = sim.getResidenceState();

    expect(residence.currentResidencePlaceId).toBe(sim.getCurrentResidencePlaceId());
    expect(residence.tenancyId).toBeTruthy();

    const snapshot = sim.exportSnapshot();
    const restored = new SimulationEngine(snapshot);
    expect(restored.getResidenceState()).toEqual(residence);
  });

  it('projects the canonical residence as authored Phaser views with semantic interactions', () => {
    const sim = new SimulationEngine();
    const projection = createWorldSceneProjection({
      placeId: sim.getCurrentResidencePlaceId(),
      environment: sim.gameContext.environment.current(),
      timeOfDay: sim.gameContext.time.current().timeOfDay,
    });

    expect(projection.placeId).toBe(sim.getCurrentResidencePlaceId());
    expect(projection.availableViews.length).toBeGreaterThan(1);
    expect(projection.anchors.flatMap((anchor) => anchor.interactions).map((i) => i.capability))
      .toEqual(expect.arrayContaining(['sleep']));
  });

  it('keeps semantic home delivery resolution on the current tenancy when local XYZ is absent', () => {
    const sim = new SimulationEngine();
    expect(sim.getActorSpatialProjection('player')).toBeNull();
    expect(sim.getCurrentResidencePlaceId()).toBe(sim.getResidenceState().currentResidencePlaceId);
  });
});
