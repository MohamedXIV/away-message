import { describe, expect, it, vi } from 'vitest';
import { WorkerSimulationHost } from '../../src/simulation/host/WorkerSimulationHost';
import { createSimulationWorkerRuntime } from '../../src/simulation/host/SimulationWorkerRuntime';
import type { SimulationWorkerReply, SimulationWorkerRequest } from '../../src/simulation/host/SimulationHostProtocol';

/** Unit transport double exercises the exact same FIFO runtime without a DOM. */
class LoopbackWorker {
  private readonly listeners = new Map<string, Set<(event: any) => void>>();
  readonly terminate = vi.fn();
  readonly runtime = createSimulationWorkerRuntime(message =>
    this.emit('message', { data: message } as MessageEvent<SimulationWorkerReply>));

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: (event: any) => void) {
    this.listeners.get(type)?.delete(listener);
  }
  postMessage(request: SimulationWorkerRequest) {
    void this.runtime.receive(request);
  }
  emit(type: string, event: any) {
    for (const cb of this.listeners.get(type) ?? []) cb(event);
  }
}

describe('#175 WorkerSimulationHost transport lifecycle', () => {
  it('keeps correlated RPCs, replay-safe snapshots and immutable change subscribers', async () => {
    const loop = new LoopbackWorker();
    const host = new WorkerSimulationHost(loop as unknown as Worker);
    try {
      await host.initialize();
      const seen: number[] = [];
      const off = host.subscribe(change => {
        expect(Object.isFrozen(change)).toBe(true);
        expect(Object.isFrozen(change.changedDomains)).toBe(true);
        seen.push(change.revision);
      });
      const start = await host.query({ kind: 'hud' });
      const result = await host.dispatch({
        type: 'WORLD_SET_FLAG', key: 'host_client_roundtrip', value: true,
      });
      expect(result.success).toBe(true);
      await host.advanceGameMinutes(4);
      const saved = await host.exportSnapshot();
      expect(saved.world.flags.host_client_roundtrip).toBe(true);
      const hud = await host.query({ kind: 'hud' });
      expect(hud.time.totalMinutes).toBe(start.time.totalMinutes + 4);
      expect(seen.length).toBeGreaterThan(1);
      await host.loadSnapshot(saved);
      expect((await host.query({ kind: 'hud' })).time.totalMinutes).toBe(saved.time.totalMinutes);
      off();
    } finally {
      host.dispose();
    }
    expect(loop.terminate).toHaveBeenCalledTimes(1);
    await expect(host.query({ kind: 'hud' })).rejects.toThrow('disposed');
  });

  it('fails every in-flight request after worker crash and never starts a fallback', async () => {
    const worker = new LoopbackWorker();
    worker.postMessage = vi.fn(); // transport stays pending
    const host = new WorkerSimulationHost(worker as unknown as Worker);
    const starting = host.initialize();
    worker.emit('error', {} as ErrorEvent);
    await expect(starting).rejects.toThrow('crashed');
    await expect(host.query({ kind: 'hud' })).rejects.toThrow('crashed');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    host.dispose();
  });
});
