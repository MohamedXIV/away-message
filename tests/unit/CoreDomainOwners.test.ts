import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createCoreDomainOwners } from '../../src/engine/kernel/CoreDomainOwners';

describe('CoreDomainOwners', () => {
  it('composes one event bus and coherent read-only game context', () => {
    const domains = createCoreDomainOwners();

    expect(domains.gameContext.time.current()).toEqual(domains.clock.getTime());
    expect(domains.gameContext.player.needs()).toEqual(domains.needs.getSnapshot());
    expect(domains.gameContext.player.mood()).toEqual(domains.mood.getCurrentSnapshot());

    // The read facade is a projection, not a second mutable state authority.
    const time = domains.gameContext.time.current();
    time.day = 99;
    expect(domains.clock.getTime().day).not.toBe(99);
  });

  it('constructs seeded Social and World from a current-format snapshot', () => {
    const source = new SimulationEngine();
    const snapshot = source.exportSnapshot();
    const domains = createCoreDomainOwners(snapshot);

    expect(domains.clock.getTime()).toEqual(source.clock.getTime());
    expect(domains.social.getBuddies().map((buddy) => buddy.id).sort())
      .toEqual(source.social.getBuddies().map((buddy) => buddy.id).sort());
    expect(domains.gameContext.time.current()).toEqual(domains.clock.getTime());
    expect(domains.os.getCurrentOsId()).toEqual(source.os.getCurrentOsId());
  });

  it('does not duplicate domain owners across a single runtime graph', () => {
    const domains = createCoreDomainOwners();
    const owners = [
      domains.clock,
      domains.needs,
      domains.economy,
      domains.hardware,
      domains.vfs,
      domains.world,
      domains.environment,
      domains.mood,
      domains.os,
      domains.pulse,
      domains.myplace,
      domains.downloads,
      domains.delivery,
      domains.software,
      domains.social,
      domains.telemetry,
    ];

    expect(new Set(owners).size).toBe(owners.length);
    expect(Object.isFrozen(domains.gameContext)).toBe(true);
  });
});
