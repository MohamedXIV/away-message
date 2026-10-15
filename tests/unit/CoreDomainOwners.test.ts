import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../../src/engine/SimulationEngine';
import { createCoreDomainOwners } from '../../src/engine/kernel/CoreDomainOwners';
import { projectCoreState } from '../../src/engine/kernel/CoreStateProjection';

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

  it('projects current-format Core reads from the same domain authority graph', () => {
    const source = new SimulationEngine();
    const state = source.getState();
    const owners = createCoreDomainOwners(source.exportSnapshot());
    const projected = projectCoreState(owners, state.activeView);

    expect(projected.time).toEqual(state.time);
    expect(projected.social).toEqual(state.social);
    expect(projected.world).toEqual(state.world);
    expect(projected.player).toEqual(state.player);
    expect(projected.activeView).toBe(state.activeView);
  });

  it('projects and exports without any hidden hardware/OS metadata mutation', () => {
    const source = new SimulationEngine();
    const owners = createCoreDomainOwners(source.exportSnapshot());
    for (const hardware of [source.hardware, owners.hardware]) {
      Object.defineProperty(hardware, 'state', {
        configurable: true,
        get: () => { throw new Error('hardware compatibility state must never be read'); },
        set: () => { throw new Error('hardware compatibility state must never be written'); },
      });
    }

    expect(projectCoreState(owners, 'room').os.currentOsId)
      .toBe(owners.os.getCurrentOsId());
    expect(source.getState().os.currentOsId).toBe(source.os.getCurrentOsId());
    expect(source.exportSnapshot().os.currentOsId).toBe(source.os.getCurrentOsId());
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
