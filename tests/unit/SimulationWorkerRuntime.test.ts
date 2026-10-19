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
    const result = [...sent].reverse().find(message => message.type === 'result' && message.id === id);
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
      const before = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      expect(before.revision).toBe(0);
      await expect(ask({ op: 'init' })).rejects.toThrow('already initialized');
      const changed = await ask({
        op: 'dispatch', action: { type: 'WORLD_SET_FLAG', key: 'worker_law', value: true },
      });
      expect(changed).toMatchObject({ success: true });
      const after = await ask({ op: 'query', query: { kind: 'world' } }) as ReturnType<SimulationKernel['getWorldRead']>;
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
      const initial = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
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
      const restored = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
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

  it('owns a bounded clock inside the Worker without any render-loop calls', async () => {
    const { ask, runtime } = harness();
    await ask({ op: 'init' });
    const before = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
    vi.useFakeTimers();
    try {
      await ask({ op: 'clock', running: true });
      await expect(ask({ op: 'realtime', seconds: 0.25 }))
        .rejects.toThrow('while Worker clock runs');
      await vi.advanceTimersByTimeAsync(1500);
      const progressed = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      expect(progressed.time.totalMinutes).toBeGreaterThanOrEqual(before.time.totalMinutes + 1);
      await ask({ op: 'clock', running: false });
      const stopped = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      await vi.advanceTimersByTimeAsync(2000);
      expect(await ask({ op: 'query', query: { kind: 'hud' } }))
        .toMatchObject({ time: { totalMinutes: stopped.time.totalMinutes } });
      await ask({ op: 'realtime', seconds: 1 });
      const manuallyAdvanced = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      expect(manuallyAdvanced.time.totalMinutes).toBeGreaterThan(stopped.time.totalMinutes);
    } finally {
      runtime.close();
      vi.useRealTimers();
    }
  });

  it('treats clock engine errors as fatal instead of silently continuing a corrupt world', async () => {
    const { ask, sent, runtime } = harness();
    await ask({ op: 'init' });
    const spy = vi.spyOn(SimulationKernel.prototype, 'advanceRealTime')
      .mockImplementation(() => { throw new Error('clock-owner-failure'); });
    vi.useFakeTimers();
    try {
      await ask({ op: 'clock', running: true });
      await vi.advanceTimersByTimeAsync(500);
      expect(sent.some(event => event.type === 'fatal'
        && event.error.message === 'clock-owner-failure')).toBe(true);
    } finally {
      spy.mockRestore();
      runtime.close();
      vi.useRealTimers();
    }
  });

  it('installs Orion through the original owned-media preflight/commit on the one Worker', async () => {
    const { ask, runtime } = harness();
    try {
      await ask({ op: 'init' });
      const failed = await ask({ op: 'hardware', command: { kind: 'prepareOs' } }) as { success: boolean };
      expect(failed.success).toBe(false);
      const before = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      const purchased = await ask({ op: 'dispatch', action: {
        type: 'STORE_PURCHASE_ITEM', storeId: 'silicon_spares', skuId: 'bundle_scrapyard',
      } }) as { success: boolean };
      expect(purchased.success).toBe(true);
      const setup = await ask({ op: 'hardware', command: { kind: 'setup' } }) as { success: boolean };
      expect(setup.success).toBe(true);
      const desktop = await ask({ op: 'query', query: { kind: 'desktop' } }) as ReturnType<SimulationKernel['getDesktopRead']>;
      const owned = desktop.bootMediaItems.find(item => item.catalogItemId === 'media_orion_48_setup');
      expect(owned?.location).toBe('room_package');
      const inserted = await ask({ op: 'hardware', command: {
        kind: 'insertMedia', instanceId: owned!.instanceId,
      } }) as { success: boolean };
      expect(inserted.success).toBe(true);
      const preflightStart = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      expect(preflightStart.time.totalMinutes).toBeGreaterThan(before.time.totalMinutes);
      const prepared = await ask({ op: 'hardware', command: { kind: 'prepareOs' } }) as ReturnType<SimulationKernel['prepareOsInstallFromInsertedMedia']>;
      expect(prepared).toMatchObject({
        success: true, data: { targetOs: 'Orion_4.8', mode: 'fresh' },
      });
      const preflightTime = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      expect(preflightTime.time.totalMinutes).toBe(preflightStart.time.totalMinutes);
      const ejected = await ask({ op: 'hardware', command: { kind: 'ejectMedia' } }) as { success: boolean };
      expect(ejected.success).toBe(true);
      const stale = await ask({ op: 'hardware', command: {
        kind: 'commitOs', plan: prepared.data!,
      } }) as { success: boolean };
      expect(stale.success).toBe(false);
      expect((await ask({ op: 'query', query: { kind: 'desktop' } }) as ReturnType<SimulationKernel['getDesktopRead']>).osVersion).toBeNull();
      await ask({ op: 'hardware', command: {
        kind: 'insertMedia', instanceId: owned!.instanceId,
      } });
      const current = await ask({ op: 'hardware', command: { kind: 'prepareOs' } }) as ReturnType<SimulationKernel['prepareOsInstallFromInsertedMedia']>;
      const commitStart = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      const committed = await ask({ op: 'hardware', command: {
        kind: 'commitOs', plan: current.data!,
      } }) as { success: boolean };
      expect(committed.success).toBe(true);
      const installed = await ask({ op: 'query', query: { kind: 'desktop' } }) as ReturnType<SimulationKernel['getDesktopRead']>;
      expect(installed.osVersion).toBe('Orion_4.8');
      const after = await ask({ op: 'query', query: { kind: 'hud' } }) as ReturnType<SimulationKernel['getHudProjection']>;
      expect(after.time.totalMinutes - commitStart.time.totalMinutes)
        .toBe(current.data!.durationMinutes);
    } finally { runtime.close(); }
  });
});
