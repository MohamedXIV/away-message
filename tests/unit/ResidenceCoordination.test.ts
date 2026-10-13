import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { ResidenceCoordination, fallbackResidenceState } from '../../src/engine/kernel/ResidenceCoordination';

function owner(engine: SimulationEngine): ResidenceCoordination {
  return (engine as unknown as { residenceCoordination: ResidenceCoordination }).residenceCoordination;
}

describe('ResidenceCoordination — canonical tenancy and housing policy', () => {
  it('uses the same housing market and tenancy for public runtime reads', () => {
    const engine = new SimulationEngine();
    const tenancy = owner(engine);
    expect(tenancy.getResidenceState()).toEqual(engine.getResidenceState());
    expect(tenancy.getCurrentResidencePlaceId()).toBe(engine.getCurrentResidencePlaceId());
    expect(tenancy.getHousingOffers()).toEqual(engine.getHousingOffers());
    expect(tenancy.getHousingOffers().filter((offer) => offer.current)).toHaveLength(1);
  });

  it('round-trips current-format tenancy on the same owner without inventing a second residence', () => {
    const engine = new SimulationEngine();
    const tenancy = owner(engine);
    const state = engine.exportSnapshot();
    const original = engine.getResidenceState();

    engine.loadSnapshot(state);
    expect(owner(engine)).toBe(tenancy);
    expect(engine.getResidenceState()).toEqual(original);
    expect(engine.exportSnapshot().residence).toEqual(original);
  });

  it('rejects invalid or already-current housing without mutating finances or physical state', () => {
    const engine = new SimulationEngine();
    const before = engine.exportSnapshot();
    const current = engine.getHousingOffers().find((offer) => offer.current)!;

    expect(engine.moveResidenceToOffer('missing-housing-offer').success).toBe(false);
    expect(engine.moveResidenceToOffer(current.id).success).toBe(false);

    const after = engine.exportSnapshot();
    expect(after.residence).toEqual(before.residence);
    expect(after.player.cash).toBe(before.player.cash);
    expect(after.physicalWorld).toEqual(before.physicalWorld);
    expect(after.inventory).toEqual(before.inventory);
  });

  it('retains deterministic starter fallback for unconfigured development saves', () => {
    const home = fallbackResidenceState();
    expect(home.currentResidencePlaceId).toBeTruthy();
    expect(home.tenancyId).toMatch(/^starter:/);
    expect(home.currentRent).toBeGreaterThanOrEqual(0);
  });
});
