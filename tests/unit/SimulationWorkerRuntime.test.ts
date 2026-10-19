import { describe, expect, it, vi } from 'vitest';
import { SimulationKernel } from '../../src/engine/kernel/SimulationKernel';
import { createSimulationWorkerRuntime } from '../../src/simulation/host/SimulationWorkerRuntime';
import type {
  SimulationWorkerReply, SimulationWorkerRequest, SimulationWorkerCommand,
} from '../../src/simulation/host/SimulationHostProtocol';

function harness() {
  const sent: SimulationWorkerReply[] = [];
  const runtime = createSimulationWorkerRuntime(message => sent.push(message));
  let nextId = 0;
  const ask = async (command: SimulationWorkerCommand) => {
    const id = ++nextId;
    await runtime.receive({ ...command, id } as SimulationWorkerRequest);
    const result = sent.findLast(message => message.type === 'result' && message.id === id);
    if (!result || result.type !== 'result') throw Error('Missing worker reply');
    if (!result.ok) throw Error(result.error.message);
    return result.value;
  };
  return { runtime, sent, ask };
}

describe('#175 single-writer Worker runtime protocol', () => {
  it('uses one Kernel, dispatches commands, and publishes bounded revisions', async () => {
    const { ask, sent, runtime } = harness();
    const readState = vi.spyOn(SimulationKernel.prototype, 'getState');
    try {
      await ask({ op: 'init' });
      const before = await ask({ op: 'query', query: { kind: 'hud' } })
        as ReturnType<SimulationKernel['getHudProjection']>;
      expect(before.revision).toBe(0);
      await expect(ask({ op: 'init' })).rejects.toThrow('already initialized');
      const changed = await ask({
        op: 'dispatch', action: { type: 'WORLD_SET_FLAG', key: 'worker_law', value: true },
      });
      expect(changed).toMatchObject({ success: true });
      const after = await ask({ op: 'query', query: { kind: 'world' } })
        as ReturnType<SimulationKernel['getWorldRead']>;
      expect(after.revision).toBeGreaterThan(0);
      const events = sent.filter(m => m.type === 'change');
      expect(events.length).toBeGreaterThan(1);
      expect(events.at(-1)).toMatchObject({
        change: { changedDomains: expect.arrayContaining(['world', 'unknown']) },
      });
      expect(readState).not.toHaveBeenCalled();
      expect(JSON.stringify(events)).not.toContain('conversations');
    } finally {
      readState.mockRestore();
      runtime.close();
    }
  });

  it('serializes queued writes and restores saved truth without replaying operations', async () => {
    const { ask, runtime } = harness();
    try {
      await ask({ op: 'init' });
      const initial = await ask({ op: 'query', query: { kind: 'hud' } })
        as ReturnType<SimulationKernel['getHudProjection']>;
      const ops = [
        ask({ op: 'advance', minutes: 3, reason: 'first' }),
        ask({ op: 'advance', minutes: 7, reason: 'second' }),
        ask({ op: 'query', query: { kind: 'hud' } }),
      ];
      const [, , latest] = await Promise.all(ops);
      expect((latest as ReturnType<SimulationKernel['getHudProjection']>).time.totalMinutes)
        .toBe(initial.time.totalMinutes + 10);
      const saved = await ask({ op: 'export' }) as ReturnType<SimulationKernel['exportSnapshot']>;
      await ask({ op: 'advance', minutes: 5 });
      await ask({ op: 'load', snapshot: saved });
      const restored = await ask({ op: 'query', query: { kind: 'hud' } })
        as ReturnType<SimulationKernel['getHudProjection']>;
      expect(restored.time.totalMinutes).toBe(saved.time.totalMinutes);
      expect(restored.cash).toBe(saved.player.cash);
    } finally {
      runtime.close();
    }
  });

  it('refuses private reads, bad deltas and invalid RPCs without moving world time', async () => {
    const { ask, runtime } = harness();
    await ask({ op: 'init' });
    const before = await ask({ op: 'query', query: { kind: 'hud' } });
    await expect(ask({ op: 'query', query: { kind: 'getState' } as never }))
      .rejects.toThrow('Unsupported bounded');
    await expect(ask({ op: 'advance', minutes: -2 }))
      .rejects.toThrow('Invalid world-minute');
    await expect(ask({ op: 'realtime', seconds: Number.POSITIVE_INFINITY }))
      .rejects.toThrow('Invalid bounded');
    expect(await ask({ op: 'query', query: { kind: 'hud' } })).toEqual(before);
    runtime.close();
  });

  it('returns player-safe empty views for guessed private actor IDs', async () => {
    const { ask, runtime } = harness();
    await ask({ op: 'init' });
    expect(await ask({ op: 'query', query: { kind: 'actor', actorId: 'unknown_999' } }))
      .toBeNull();
    expect(await ask({ op: 'query', query: { kind: 'conversation', actorId: 'unknown_999' } }))
      .toMatchObject({ messages: [], total: 0 });
    runtime.close();
  });
});
