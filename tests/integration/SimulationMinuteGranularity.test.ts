import { describe, expect, it } from 'vitest';
import { SimulationKernel } from '../../src/engine/kernel/SimulationKernel';
import {
  createPopulationScaleFixture,
  populationScaleDigest,
} from '../../src/engine/benchmark/PopulationScaleGate';
import { createSimulationWorkerRuntime } from '../../src/simulation/host/SimulationWorkerRuntime';
import type {
  SimulationWorkerCommand, SimulationWorkerReply, SimulationWorkerRequest,
} from '../../src/simulation/host/SimulationHostProtocol';

/**
 * #175/#177 explicit policy: coarse is one aggregate advance and is NOT
 * falsely promised to equal repeated ticks. Minute-accurate mode is exactly
 * equivalent to N separate normal one-minute calls, including effects/events.
 */
describe('canonical Worker time-skip granularity', () => {
  it('makes an explicit 30-minute accurate advance identical to 30 separate one-minute calls', () => {
    const fixture = createPopulationScaleFixture(20);
    const seed = fixture.engine.exportSnapshot();
    const exact = new SimulationKernel(structuredClone(seed));
    const reference = new SimulationKernel(structuredClone(seed));
    const beforeMinute = exact.clock.getTotalMinutes();
    let exactChanges = 0;
    let referenceChanges = 0;
    exact.subscribeChanges(() => { exactChanges++; });
    reference.subscribeChanges(() => { referenceChanges++; });

    exact.advanceGameMinutes(30, 'student-obligation', 'minute');
    for (let minute = 0; minute < 30; minute++) {
      reference.advanceGameMinutes(1, 'student-obligation');
    }

    expect(exact.clock.getTotalMinutes()).toBe(beforeMinute + 30);
    expect(exactChanges).toBe(referenceChanges);
    expect(exactChanges).toBeGreaterThan(0);
    expect(populationScaleDigest(exact.exportSnapshot()))
      .toBe(populationScaleDigest(reference.exportSnapshot()));
    expect(exact.getNpcMobilityState()).toEqual(reference.getNpcMobilityState());
    expect(exact.getNpcLivesState()).toEqual(reference.getNpcLivesState());
  }, 120_000);

  it('keeps coarse jumps unchanged and rejects unbounded minute replay before any mutation', () => {
    const seed = createPopulationScaleFixture(20).engine.exportSnapshot();
    const defaultCoarse = new SimulationKernel(structuredClone(seed));
    const namedCoarse = new SimulationKernel(structuredClone(seed));
    defaultCoarse.advanceGameMinutes(30, 'coarse-work');
    namedCoarse.advanceGameMinutes(30, 'coarse-work', 'coarse');
    expect(populationScaleDigest(defaultCoarse.exportSnapshot()))
      .toBe(populationScaleDigest(namedCoarse.exportSnapshot()));

    const exact = new SimulationKernel(structuredClone(seed));
    const before = populationScaleDigest(exact.exportSnapshot());
    expect(() => exact.advanceGameMinutes(61, 'unsafe-replay', 'minute'))
      .toThrow('Minute-accurate advance must be an integer from 0 to 60');
    expect(() => exact.advanceGameMinutes(-1, 'unsafe-replay', 'minute')).toThrow();
    expect(() => exact.advanceGameMinutes(1.5, 'unsafe-replay', 'minute')).toThrow();
    expect(() => exact.advanceGameMinutes(1, 'unsafe-replay', 'unknown' as 'minute')).toThrow();
    expect(populationScaleDigest(exact.exportSnapshot())).toBe(before);
  }, 120_000);

  it('Worker FIFO uses the same explicit time policy and rejects invalid request without losing the owner', async () => {
    const seed = createPopulationScaleFixture(20).engine.exportSnapshot();
    const expected = new SimulationKernel(structuredClone(seed));
    const sent: SimulationWorkerReply[] = [];
    const runtime = createSimulationWorkerRuntime(reply => sent.push(reply));
    let id = 0;
    const ask = async (command: SimulationWorkerCommand): Promise<unknown> => {
      const currentId = ++id;
      await runtime.receive({ id: currentId, ...command } as SimulationWorkerRequest);
      const reply = sent.find(message => message.type === 'result' && message.id === currentId);
      if (!reply || reply.type !== 'result') throw new Error('Missing Worker FIFO response');
      if (!reply.ok) throw new Error(reply.error.message);
      return reply.value;
    };
    try {
      await ask({ op: 'init', initialState: structuredClone(seed) });
      await expect(ask({ op: 'advance', minutes: 61, granularity: 'minute' }))
        .rejects.toThrow('60-minute bound');
      await expect(ask({
        op: 'advance', minutes: 1, granularity: 'untrusted' as 'minute',
      })).rejects.toThrow('Invalid time advance granularity');

      expected.advanceGameMinutes(30, 'worker-precise', 'minute');
      await ask({ op: 'advance', minutes: 30, reason: 'worker-precise', granularity: 'minute' });
      const exported = await ask({ op: 'export' });
      expect(populationScaleDigest(exported as ReturnType<SimulationKernel['exportSnapshot']>))
        .toBe(populationScaleDigest(expected.exportSnapshot()));
      const changes = sent.filter(message => message.type === 'change');
      expect(changes.length).toBeGreaterThan(0);
      const hub = await ask({ op: 'query', query: { kind: 'hud' } }) as {
        time: { totalMinutes: number };
      };
      expect(hub.time.totalMinutes).toBe(expected.clock.getTotalMinutes());
    } finally { runtime.close(); }
  }, 120_000);
});
